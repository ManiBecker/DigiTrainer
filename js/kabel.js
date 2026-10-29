// ------------------------------------------------------------
// DigiTrainer – Kabel markieren, abziehen und rückgängig (kabel.js)
//
// Ergänzung zu simulator.js. Bestehende Dateien bleiben unverändert;
// diese Datei wird in index.html nach projekt.js eingebunden.
// Sie hängt sich an die vorhandenen Ereignisse und Funktionen:
//   board, boardContainer, wiringLayer, statusMessage, hotspots,
//   wireConnections, powerOn, measureMode, zoom, zoomGesture,
//   getBoardPosition(), findHotspot(), getHotspotCenter(),
//   drawWire(), updateWirePath(), createWirePlug(),
//   checkWiringConflict(), updateWireColors(), updateOutputLeds(),
//   applyWireShadow()
//
// Bedienung nur bei ausgeschaltetem Gerät:
// - Tipp auf die Leitung markiert sie, ein zweiter Tipp entfernt sie
// - Entf, Rücktaste oder Rechtsklick entfernen das markierte Kabel
// - Stecker eines markierten Kabels abziehen und woanders einstecken
// - ↶ oder Strg+Z macht die letzte Kabeländerung rückgängig
// Die bisherige Geste (dieselbe Verbindung noch einmal ziehen) bleibt.
// ------------------------------------------------------------

(function () {
    "use strict";

    if (typeof wireConnections === "undefined" || typeof drawWire !== "function" ||
            typeof applyWireShadow !== "function") {
        console.warn("kabel.js: simulator.js nicht gefunden – Kabelbearbeitung deaktiviert.");
        return;
    }

    const WIRE_HIT_WIDTH = 18;
    const UNDO_LIMIT = 50;
    const TAP_SLOP = 12;
    const undoStack = [];
    let selectedWire = null;
    let hoveredWire = null;
    let pendingTap = null;
    let grabState = null;
    let previewPath = null;
    let gestureOwned = false;
    let snapshotBefore = null;

    // Schatten von simulator.js bleibt. Markierung und Hover kommen dazu.
    const applyWireShadowBase = applyWireShadow;
    applyWireShadow = function (path) {
        if (!path || path.getAttribute("data-hit") === "true") return;
        applyWireShadowBase(path);
        if (path.getAttribute("data-measure") === "true") return;
        const scale = typeof zoom === "number" ? zoom : 1;
        if (path.classList.contains("wire-selected")) {
            path.setAttribute("stroke-dasharray", (10 * scale) + " " + (6 * scale));
            path.style.filter += " drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #ffe14d)";
        } else {
            path.removeAttribute("stroke-dasharray");
            if (path.classList.contains("wire-hover")) {
                path.style.filter += " drop-shadow(0 0 3px #fff)";
            }
        }
    };

    const style = document.createElement("style");
    style.textContent = ".wiring-layer circle.wire-selected { stroke: #ffe14d; }";
    document.head.appendChild(style);

    const helpButton = document.querySelector(".help-toggle");
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "undo-wiring";
    undoButton.title = "Letzte Kabeländerung rückgängig (Strg+Z)";
    undoButton.textContent = "↶";
    if (helpButton) helpButton.parentNode.insertBefore(undoButton, helpButton);
    else document.querySelector(".toolbar").appendChild(undoButton);

    const wireHitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wireHitPath.setAttribute("fill", "none");
    wireHitPath.setAttribute("stroke", "transparent");
    wireHitPath.setAttribute("stroke-linecap", "round");
    wireHitPath.setAttribute("data-hit", "true");
    wireHitPath.setAttribute("data-measure", "true");
    wireHitPath.style.pointerEvents = "none";
    wiringLayer.appendChild(wireHitPath);

    function setStatus(text) {
        if (typeof statusMessage !== "undefined" && statusMessage) statusMessage.textContent = text;
    }

    function wireLabel(wire) {
        const a = hotspots.find(h => h.id === wire.from);
        const b = hotspots.find(h => h.id === wire.to);
        return (a ? a.label : wire.from) + " - " + (b ? b.label : wire.to);
    }

    function wiringSnapshot() {
        return wireConnections.map(wire => ({
            from: wire.from,
            to: wire.to,
            color: wire.color || null
        }));
    }

    function wiringKey(list) {
        return list.map(wire => [wire.from, wire.to].join("\0")).join("\n");
    }

    function pushUndoSnapshot(label, wires) {
        undoStack.push({ label: label, wires: wires });
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }

    function pushUndo(label) {
        pushUndoSnapshot(label, wiringSnapshot());
    }

    function dropUndo() {
        undoStack.pop();
    }

    function deleteWire(wire) {
        const index = wireConnections.indexOf(wire);
        if (index !== -1) wireConnections.splice(index, 1);
        if (selectedWire === wire) selectedWire = null;
        if (hoveredWire === wire) hoveredWire = null;
        if (wire.path) wire.path.remove();
        if (wire.plugs) wire.plugs.forEach(plug => plug.remove());
    }

    function createWire(fromId, toId, color) {
        const a = hotspots.find(h => h.id === fromId);
        const b = hotspots.find(h => h.id === toId);
        if (!a || !b) return null;
        const start = getHotspotCenter(a);
        const end = getHotspotCenter(b);
        const path = drawWire(start.x, start.y, end.x, end.y);
        path.setAttribute("data-measure", "false");
        path.setAttribute("stroke-width", String(3 * (typeof zoom === "number" ? zoom : 1)));
        path.removeAttribute("vector-effect");
        updateWirePath(path, end.x, end.y);
        const wire = { from: fromId, to: toId, path: path };
        if (color) wire.color = color;
        wire.plugs = [createWirePlug(path, "x1", "y1"), createWirePlug(path, "x2", "y2")];
        wireConnections.push(wire);
        return wire;
    }

    function setWiringList(list) {
        clearWireSelection();
        [...wireConnections].forEach(deleteWire);
        list.forEach(item => createWire(item.from, item.to, item.color));
        updateWireColors();
        updateOutputLeds();
    }

    function undoWiring() {
        if (powerOn) {
            setStatus("Rückgängig nur bei ausgeschaltetem Gerät");
            return;
        }
        if (grabState || previewPath) return;
        const entry = undoStack.pop();
        if (!entry) {
            setStatus("Nichts rückgängig zu machen");
            return;
        }
        setWiringList(entry.wires);
        setStatus("Rückgängig: " + entry.label);
    }

    function findWireAt(pos) {
        if (!wireConnections.length) return null;
        const point = wiringLayer.createSVGPoint();
        point.x = pos.x;
        point.y = pos.y;
        for (const width of [4, WIRE_HIT_WIDTH]) {
            wireHitPath.setAttribute("stroke-width", String(width * (typeof zoom === "number" ? zoom : 1)));
            for (let i = wireConnections.length - 1; i >= 0; i--) {
                const wire = wireConnections[i];
                if (!wire.path) continue;
                wireHitPath.setAttribute("d", wire.path.getAttribute("d"));
                if (wireHitPath.isPointInStroke(point)) return wire;
            }
        }
        return null;
    }

    function findWireEndAt(pos) {
        const hotspot = findHotspot(pos);
        if (!hotspot || !selectedWire) return null;
        if (selectedWire.from === hotspot.id) {
            return { wire: selectedWire, movingKey: "from", fixedId: selectedWire.to };
        }
        if (selectedWire.to === hotspot.id) {
            return { wire: selectedWire, movingKey: "to", fixedId: selectedWire.from };
        }
        return null;
    }

    function setWireHighlight(wire, className, enabled) {
        if (!wire || !wire.path) return;
        wire.path.classList.toggle(className, enabled);
        if (wire.plugs) wire.plugs.forEach(plug => plug.classList.toggle(className, enabled));
        applyWireShadow(wire.path);
    }

    function selectWire(wire) {
        setWireHighlight(selectedWire, "wire-selected", false);
        selectedWire = wire;
        setWireHighlight(selectedWire, "wire-selected", true);
    }

    function clearWireSelection() {
        selectWire(null);
        setHoveredWire(null);
    }

    function setHoveredWire(wire) {
        if (hoveredWire === wire) return;
        setWireHighlight(hoveredWire, "wire-hover", false);
        hoveredWire = wire;
        setWireHighlight(hoveredWire, "wire-hover", true);
    }

    function removePreview() {
        if (previewPath) previewPath.remove();
        previewPath = null;
    }

    function removeWireWithUndo(wire, how) {
        if (!wire || powerOn) return;
        const label = wireLabel(wire);
        pushUndo("Kabel entfernen");
        if (selectedWire === wire) setWireHighlight(wire, "wire-selected", false);
        deleteWire(wire);
        updateWireColors();
        updateOutputLeds();
        setStatus("Kabel entfernt" + (how ? " (" + how + ")" : "") + ": " + label + " – Strg+Z = rückgängig");
    }

    function startGrab(grab, event, pos) {
        pushUndo("Kabel umstecken");
        grabState = {
            original: { from: grab.wire.from, to: grab.wire.to, color: grab.wire.color || null },
            fixedId: grab.fixedId,
            movingKey: grab.movingKey,
            pointerId: event.pointerId
        };
        clearWireSelection();
        deleteWire(grab.wire);
        const fixed = hotspots.find(h => h.id === grab.fixedId);
        const start = fixed ? getHotspotCenter(fixed) : pos;
        previewPath = drawWire(start.x, start.y, pos.x, pos.y);
        previewPath.setAttribute("data-preview", "true");
        previewPath.setAttribute("data-measure", "false");
        try { board.setPointerCapture(event.pointerId); } catch (error) {}
        board.style.cursor = "grabbing";
        setStatus("Stecker abgezogen – auf eine Buchse ziehen oder im Leeren loslassen");
    }

    function restoreGrab() {
        createWire(grabState.original.from, grabState.original.to, grabState.original.color);
        dropUndo();
    }

    function finishGrab(endHotspot) {
        const original = grabState.original;
        const fixed = hotspots.find(h => h.id === grabState.fixedId) || null;
        const oldMovingId = original[grabState.movingKey];
        removePreview();

        if (!fixed) {
            restoreGrab();
            setStatus("Kabel unverändert: " + wireLabel(original));
        } else if (!endHotspot) {
            setStatus("Kabel entfernt: " + wireLabel(original) + " – Strg+Z = rückgängig");
        } else if (endHotspot === fixed || endHotspot.id === oldMovingId) {
            restoreGrab();
            setStatus("Kabel unverändert: " + wireLabel(original));
        } else if (wireConnections.some(wire =>
                (wire.from === fixed.id && wire.to === endHotspot.id) ||
                (wire.from === endHotspot.id && wire.to === fixed.id))) {
            restoreGrab();
            setStatus("Verbindung besteht bereits: " + fixed.label + " - " + endHotspot.label);
        } else {
            const wire = grabState.movingKey === "to"
                ? createWire(fixed.id, endHotspot.id, original.color)
                : createWire(endHotspot.id, fixed.id, original.color);
            const wiringError = wire ? checkWiringConflict() : "Buchse nicht gefunden";
            if (!wire || wiringError) {
                if (wire) deleteWire(wire);
                restoreGrab();
                setStatus(wiringError + " – Kabel nicht umgesteckt");
            } else {
                setStatus("Kabel umgesteckt: " + wireLabel(wire));
            }
        }
        grabState = null;
        board.style.cursor = "";
        updateWireColors();
        updateOutputLeds();
    }

    function cancelGrab() {
        if (!grabState) return;
        removePreview();
        restoreGrab();
        grabState = null;
        board.style.cursor = "";
        updateWireColors();
        updateOutputLeds();
    }

    function editingAllowed() {
        return !powerOn && !measureMode && !zoomGesture;
    }

    function updateHover(pos) {
        if (!editingAllowed() || grabState || previewPath) {
            setHoveredWire(null);
            if (!grabState) board.style.cursor = "";
            return;
        }
        if (findWireEndAt(pos)) {
            setHoveredWire(null);
            board.style.cursor = "grab";
            return;
        }
        const wire = findHotspot(pos) ? null : findWireAt(pos);
        setHoveredWire(wire);
        board.style.cursor = wire ? "pointer" : "";
    }

    // Capture: vor simulator.js, damit ein Treffer auf der Leitung kein neues Kabel startet.
    board.addEventListener("pointerdown", function (event) {
        pendingTap = null;
        gestureOwned = false;
        snapshotBefore = editingAllowed() ? wiringSnapshot() : null;
        if (!editingAllowed() || (event.pointerType === "mouse" && event.button !== 0)) return;

        const pos = getBoardPosition(event);
        const grab = findWireEndAt(pos);
        if (grab) {
            gestureOwned = true;
            startGrab(grab, event, pos);
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        if (findHotspot(pos)) {
            clearWireSelection();
            return;
        }
        const wire = findWireAt(pos);
        if (!wire) {
            clearWireSelection();
            return;
        }
        gestureOwned = true;
        const alreadySelected = wire === selectedWire;
        pendingTap = {
            wire: wire,
            x: pos.x,
            y: pos.y,
            pointerId: event.pointerId,
            remove: alreadySelected
        };
        if (!alreadySelected) selectWire(wire);
        setStatus(alreadySelected
            ? "Loslassen entfernt das Kabel"
            : "Kabel markiert: " + wireLabel(wire) + " – nochmals tippen oder Entf entfernt, Stecker ziehen steckt um");
        event.stopImmediatePropagation();
        event.preventDefault();
    }, true);

    board.addEventListener("pointermove", function (event) {
        const pos = getBoardPosition(event);
        if (pendingTap && event.pointerId === pendingTap.pointerId && pendingTap.remove &&
                Math.hypot(pos.x - pendingTap.x, pos.y - pendingTap.y) > TAP_SLOP) {
            pendingTap.remove = false;
            setStatus("Kabel bleibt markiert: " + wireLabel(pendingTap.wire));
        }
        if (grabState && previewPath && event.pointerId === grabState.pointerId) {
            updateWirePath(previewPath, pos.x, pos.y);
        }
        updateHover(pos);
    });

    board.addEventListener("pointerup", function (event) {
        if (pendingTap && event.pointerId === pendingTap.pointerId) {
            const tap = pendingTap;
            pendingTap = null;
            const pos = getBoardPosition(event);
            if (tap.remove && Math.hypot(pos.x - tap.x, pos.y - tap.y) <= TAP_SLOP) {
                removeWireWithUndo(tap.wire, "Tipp");
            }
            gestureOwned = false;
            snapshotBefore = null;
            return;
        }
        if (grabState && event.pointerId === grabState.pointerId) {
            const pos = getBoardPosition(event);
            const inside = pos.x >= 0 && pos.y >= 0 && pos.x <= pos.width && pos.y <= pos.height;
            try { if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId); } catch (error) {}
            finishGrab(inside ? findHotspot(pos) : null);
            gestureOwned = false;
            snapshotBefore = null;
            return;
        }
        // Von simulator.js gestecktes oder durch erneutes Ziehen entferntes Kabel.
        if (snapshotBefore && !gestureOwned && wiringKey(snapshotBefore) !== wiringKey(wireConnections)) {
            const removed = wireConnections.length < snapshotBefore.length;
            pushUndoSnapshot(removed ? "Kabel entfernen" : "Kabel hinzufügen", snapshotBefore);
        }
        snapshotBefore = null;
    });

    board.addEventListener("pointercancel", function (event) {
        if (pendingTap && event.pointerId === pendingTap.pointerId) pendingTap = null;
        if (grabState && event.pointerId === grabState.pointerId) {
            try { if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId); } catch (error) {}
            cancelGrab();
        }
        snapshotBefore = null;
    });

    boardContainer.addEventListener("touchstart", function () {
        if (typeof zoomGesture !== "undefined" && zoomGesture) cancelGrab();
    }, true);

    board.addEventListener("contextmenu", function (event) {
        if (!editingAllowed()) return;
        const wire = findWireAt(getBoardPosition(event));
        if (!wire) return;
        event.preventDefault();
        if (event.button !== 2 && !event.ctrlKey) return;
        removeWireWithUndo(wire, "Rechtsklick");
    });

    document.addEventListener("keydown", function (event) {
        const target = event.target;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        if (document.querySelector("dialog[open]")) return;
        if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
                event.key.toLowerCase() === "z") {
            event.preventDefault();
            undoWiring();
        } else if ((event.key === "Delete" || event.key === "Backspace") && selectedWire) {
            event.preventDefault();
            removeWireWithUndo(selectedWire, "Entf");
        } else if (event.key === "Escape" && selectedWire && !grabState) {
            clearWireSelection();
        }
    });

    undoButton.addEventListener("click", undoWiring);
    const powerSwitch = document.querySelector(".power-switch");
    if (powerSwitch) powerSwitch.addEventListener("click", clearWireSelection);
    const modeButton = document.querySelector(".mode-toggle");
    if (modeButton) modeButton.addEventListener("click", clearWireSelection);

    // Projekt laden ersetzt die Kabel. Rückgängig würde sonst die alte
    // Leitung unter die neuen Schalterstellungen legen.
    const projectDialog = document.getElementById("project-dialog");
    if (projectDialog) {
        let opened = null;
        projectDialog.addEventListener("close", function () {
            if (!opened) return;
            if (wiringKey(opened) !== wiringKey(wireConnections)) {
                undoStack.length = 0;
                clearWireSelection();
            }
            opened = null;
        });
        const projectButton = document.querySelector(".project-toggle");
        if (projectButton) {
            projectButton.addEventListener("click", function () {
                opened = wiringSnapshot();
            });
        }
    }
})();
