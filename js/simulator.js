const board = document.querySelector(".board");
const boardArea = document.querySelector(".board-area");
const boardContainer = document.querySelector(".board-container");
const coordinates = document.querySelector(".coordinates");
const statusMessage = document.querySelector(".status-message");
const wiringLayer = document.querySelector(".wiring-layer");

const powerSwitch = document.querySelector(".power-switch");
const powerLed = document.querySelector(".power-led");

let powerOn = false;
let measureMode = false;

let currentWire = null;
let activePointerId = null;
let startHotspot = null;

let hotspots = [];
let switches = [];
const switchStates = {};
const switchLeds = [];
const outputLeds = [];
const wireConnections = []; // Verbindungen zwischen Buchsen-IDs
let boardLoaded = false;


const PAD_SIZE = 0.029;  // 2,9 % der Bildhöhe

// Quadratische Trefferfläche um den Buchsenmittelpunkt
function getHotspotBounds(hotspot) {
    const rect = board.getBoundingClientRect();

    const cx = hotspot.x + hotspot.width / 2;
    const cy = hotspot.y + hotspot.height / 2;

    // Gleiche Seitenlänge in Bildschirmpixeln
    const halfHeight = PAD_SIZE / 2;
    const halfWidth = halfHeight * rect.height / rect.width;

    return {
        x: cx - halfWidth,
        y: cy - halfHeight,
        width: 2 * halfWidth,
        height: PAD_SIZE
    };
}


// ------------------------------------------------------------
// Buchsen-Tooltips: Label und bei IC0 die Pin-Funktion
// ------------------------------------------------------------
const ic0PinFunctions = {
    1: "1Y – NOR-Ausgang", 2: "1A – NOR-Eingang",
    3: "1B – NOR-Eingang", 4: "2Y – NOR-Ausgang",
    5: "2A – NOR-Eingang", 6: "2B – NOR-Eingang",
    7: "GND – Versorgung", 8: "Nicht belegt",
    9: "Nicht belegt", 10: "3B – NOR-Eingang",
    11: "3A – NOR-Eingang", 12: "3Y – NOR-Ausgang",
    13: "4B – NOR-Eingang", 14: "4A – NOR-Eingang",
    15: "4Y – NOR-Ausgang", 16: "VCC – +5 V"
};

const ic1PinFunctions = {
    1: "1A – NOT-Eingang", 2: "1Y – NOT-Ausgang",
    3: "2A – NOT-Eingang", 4: "2Y – NOT-Ausgang",
    5: "3A – NOT-Eingang", 6: "3Y – NOT-Ausgang",
    7: "GND – Versorgung", 8: "Nicht belegt",
    9: "Nicht belegt", 10: "4Y – NOT-Ausgang",
    11: "4A – NOT-Eingang", 12: "5Y – NOT-Ausgang",
    13: "5A – NOT-Eingang", 14: "6Y – NOT-Ausgang",
    15: "6A – NOT-Eingang", 16: "VCC – +5 V"
};

const ic2PinFunctions = {
    1: "1A – AND-Eingang", 2: "1B – AND-Eingang", 3: "1Y – AND-Ausgang",
    4: "2A – AND-Eingang", 5: "2B – AND-Eingang", 6: "2Y – AND-Ausgang",
    7: "GND – Versorgung", 8: "Nicht belegt", 9: "Nicht belegt",
    10: "3Y – AND-Ausgang", 11: "3A – AND-Eingang", 12: "3B – AND-Eingang",
    13: "4Y – AND-Ausgang", 14: "4A – AND-Eingang", 15: "4B – AND-Eingang",
    16: "VCC – +5 V"
};

// IC 3: SN74LS86AN – vier XOR-Gatter (exklusives ODER).
const ic3PinFunctions = {
    1: "1A – XOR-Eingang", 2: "1B – XOR-Eingang", 3: "1Y – XOR-Ausgang",
    4: "2A – XOR-Eingang", 5: "2B – XOR-Eingang", 6: "2Y – XOR-Ausgang",
    7: "GND – Versorgung", 8: "Nicht belegt", 9: "Nicht belegt",
    10: "3Y – XOR-Ausgang", 11: "3A – XOR-Eingang", 12: "3B – XOR-Eingang",
    13: "4Y – XOR-Ausgang", 14: "4A – XOR-Eingang", 15: "4B – XOR-Eingang",
    16: "VCC – +5 V"
};

// IC 4: 74LS00PC – vier NAND-Gatter.
const ic4PinFunctions = {
    1: "1A – NAND-Eingang", 2: "1B – NAND-Eingang", 3: "1Y – NAND-Ausgang",
    4: "2A – NAND-Eingang", 5: "2B – NAND-Eingang", 6: "2Y – NAND-Ausgang",
    7: "GND – Versorgung", 8: "Nicht belegt", 9: "Nicht belegt",
    10: "3Y – NAND-Ausgang", 11: "3A – NAND-Eingang", 12: "3B – NAND-Eingang",
    13: "4Y – NAND-Ausgang", 14: "4A – NAND-Eingang", 15: "4B – NAND-Eingang",
    16: "VCC – +5 V"
};

// IC 5: RCA CD4069UBE – sechs CMOS-Inverter (14-polig im 20-poligen Sockel).
// Links: IC-Pins 1–7 = Sockelpositionen 1–7.
// Rechts: IC-Pins 8–14 = Sockelpositionen 14–20.
const ic5PinFunctions = {
    1: "1A – CMOS-NOT-Eingang", 2: "1Y – CMOS-NOT-Ausgang",
    3: "2A – CMOS-NOT-Eingang", 4: "2Y – CMOS-NOT-Ausgang",
    5: "3A – CMOS-NOT-Eingang", 6: "3Y – CMOS-NOT-Ausgang",
    7: "VSS – GND",
    14: "4Y – CMOS-NOT-Ausgang", 15: "4A – CMOS-NOT-Eingang",
    16: "5Y – CMOS-NOT-Ausgang", 17: "5A – CMOS-NOT-Eingang",
    18: "6Y – CMOS-NOT-Ausgang", 19: "6A – CMOS-NOT-Eingang",
    20: "VDD – +5 V"
};
for (let pin = 8; pin <= 13; pin++) ic5PinFunctions[pin] = "Nicht belegt";

const socketTooltip = document.createElement("div");
socketTooltip.className = "socket-tooltip";
Object.assign(socketTooltip.style, {
    position: "fixed", display: "none", pointerEvents: "none",
    zIndex: "1000", padding: "6px 9px", borderRadius: "5px",
    background: "rgba(25, 28, 32, 0.94)", color: "white",
    font: "12px/1.5 sans-serif", whiteSpace: "pre-line",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
    maxWidth: "240px"
});
document.body.appendChild(socketTooltip);

function hideSocketTooltip() {
    socketTooltip.style.display = "none";
}

function showSocketTooltip(event, hotspot) {
    if (!hotspot || currentWire !== null || event.pointerType === "touch") {
        hideSocketTooltip();
        return;
    }

    const match = /^ic([012345])-pin(\d+)$/.exec(hotspot.id);
    const lines = [hotspot.label || hotspot.id];
    if (match) {
        const socket = Number(match[1]);
        const socketPin = Number(match[2]);
        const chipPin = socket === 5 ? (socketPin >= 14 ? socketPin - 6 : socketPin) : (socketPin >= 10 ? socketPin - 2 : socketPin);
        const chipNames = ["SN74LS02N", "SN74LS04N", "SN74LS08N", "SN74LS86AN", "74LS00PC", "CD4069UBE"];
        const pinFunctions = [ic0PinFunctions, ic1PinFunctions, ic2PinFunctions, ic3PinFunctions, ic4PinFunctions, ic5PinFunctions];
        lines.push(chipNames[socket] +
            ((socket === 5 ? socketPin >= 8 && socketPin <= 13 : socketPin === 8 || socketPin === 9) ? "" : " · Pin " + chipPin));
        lines.push(pinFunctions[socket][socketPin]);
    }
    socketTooltip.textContent = lines.join("\n");
    socketTooltip.style.display = "block";

    // An Bildschirmrändern nach links/oben ausweichen.
    const rect = socketTooltip.getBoundingClientRect();
    const left = event.clientX + 15 + rect.width > window.innerWidth
        ? event.clientX - rect.width - 12 : event.clientX + 15;
    const top = event.clientY + 18 + rect.height > window.innerHeight
        ? event.clientY - rect.height - 12 : event.clientY + 18;
    socketTooltip.style.left = Math.max(4, left) + "px";
    socketTooltip.style.top = Math.max(4, top) + "px";
}

// ------------------------------------------------------------
// Position relativ zum Board ermitteln
// ------------------------------------------------------------

function getBoardPosition(event) {
    const rect = board.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height
    };
}


// ------------------------------------------------------------
// Hotspot anhand der Position suchen
// ------------------------------------------------------------

function findHotspot(pos) {
    if (!boardLoaded || pos.width <= 0 || pos.height <= 0) {
        return null;
    }

    const x = pos.x / pos.width;
    const y = pos.y / pos.height;

    return hotspots.find(function (hotspot) {
        const bounds = getHotspotBounds(hotspot);

        return (
            x >= bounds.x &&
            x <= bounds.x + bounds.width &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height
        );
    }) || null;
}


// ------------------------------------------------------------
// Mittelpunkt eines Hotspots in Pixeln
// ------------------------------------------------------------

function getHotspotCenter(hotspot) {
    const rect = board.getBoundingClientRect();

    return {
        x: (hotspot.x + hotspot.width / 2) * rect.width,
        y: (hotspot.y + hotspot.height / 2) * rect.height
    };
}


// ------------------------------------------------------------
// Status anzeigen
// ------------------------------------------------------------

function updateStatus() {
    if (powerOn) {
        statusMessage.textContent = "Power ON - Wiring disabled";
    } else if (measureMode) {
        statusMessage.textContent = "Measure mode (M)";
    } else if (!boardLoaded) {
        statusMessage.textContent = "Loading board...";
    } else {
        statusMessage.textContent = "Wiring mode (M)";
    }
}


// Gemeinsame Umschaltung für Tastatur und Toolbar.
const modeButton = document.querySelector(".mode-toggle");

function updateModeDisplay() {
    if (modeButton) {
        modeButton.textContent = measureMode ? "Mode: Measure" : "Mode: Wiring";
        modeButton.setAttribute("aria-pressed", String(measureMode));
    }
    // Die Markierungen sind nur eine visuelle Hilfe.
    // Die elektrische Hotspot-Erkennung bleibt immer aktiv.
    if (typeof hotspotLayer !== "undefined") {
        hotspotLayer.style.display = measureMode ? "block" : "none";
    }
}

function toggleMeasureMode() {
    if (currentWire !== null) return;
    measureMode = !measureMode;
    updateModeDisplay();
    updateStatus();
}

if (modeButton) modeButton.addEventListener("click", toggleMeasureMode);

// ------------------------------------------------------------
// Taste M: Vermessungsmodus umschalten
// ------------------------------------------------------------

document.addEventListener("keydown", function (event) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }

    if (event.key.toLowerCase() !== "m") {
        return;
    }

    // Nicht während einer laufenden Leitung umschalten
    if (currentWire !== null) {
        return;
    }

    toggleMeasureMode();
});

document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey ||
        event.repeat) return;

    if (event.key === "+" || event.key === "Add") {
        event.preventDefault();
        zoomInButton.click();
    } else if (event.key === "-" || event.key === "Subtract") {
        event.preventDefault();
        zoomOutButton.click();
    } else if (event.key === "0") {
        event.preventDefault();
        zoomResetButton.click();
    }
});


// ------------------------------------------------------------
// Pointer bewegen
// ------------------------------------------------------------

board.addEventListener("pointermove", function (event) {
    const pos = getBoardPosition(event);

    const insideBoard =
        pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x <= pos.width &&
        pos.y <= pos.height;

    if (insideBoard && pos.width > 0 && pos.height > 0) {
        coordinates.textContent =
            `X: ${(pos.x / pos.width * 100).toFixed(2)} %   ` +
            `Y: ${(pos.y / pos.height * 100).toFixed(2)} %`;
    } else {
        coordinates.textContent = "X: --   Y: --";
    }

    if (insideBoard && event.pointerType !== "touch") {
        showSocketTooltip(event, findHotspot(pos));
    } else {
        hideSocketTooltip();
    }

    if (
        currentWire !== null &&
        event.pointerId === activePointerId
    ) {
        updateWirePath(currentWire, pos.x, pos.y);
    }
});


// ------------------------------------------------------------
// Leitung bzw. Vermessung beginnen
// ------------------------------------------------------------

board.addEventListener("pointerdown", function (event) {
    hideSocketTooltip();
    if (zoomGesture || powerOn || currentWire !== null) {
        return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    const pos = getBoardPosition(event);

    if (!measureMode) {
        startHotspot = findHotspot(pos);

        if (startHotspot === null) {
            statusMessage.textContent = "Select a socket";
            return;
        }
    } else {
        startHotspot = null;
    }

    activePointerId = event.pointerId;
    board.setPointerCapture(event.pointerId);

    const start = startHotspot !== null
        ? getHotspotCenter(startHotspot)
        : { x: pos.x, y: pos.y };

    currentWire = drawWire(
        start.x,
        start.y,
        start.x,
        start.y
    );

    statusMessage.textContent = measureMode
        ? "Measuring..."
        : "Routing cable...";
});


// ------------------------------------------------------------
// Leitung bzw. Vermessung beenden
// ------------------------------------------------------------

board.addEventListener("pointerup", function (event) {
    if (
        zoomGesture || currentWire === null ||
        event.pointerId !== activePointerId
    ) {
        return;
    }

    const pos = getBoardPosition(event);

    const insideBoard =
        pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x <= pos.width &&
        pos.y <= pos.height;

    if (measureMode) {
        const x1 = parseFloat(currentWire.getAttribute("x1"));
        const y1 = parseFloat(currentWire.getAttribute("y1"));

        const dx = pos.x - x1;
        const dy = pos.y - y1;
        const length = Math.sqrt(dx * dx + dy * dy);

        currentWire.remove();

        if (insideBoard && pos.width > 0 && pos.height > 0) {
            if (length >= 10) {
                // Diagonale Vermessung: Rechteck
                const x = Math.min(x1, pos.x) / pos.width;
                const y = Math.min(y1, pos.y) / pos.height;

                const width = Math.abs(dx) / pos.width;
                const height = Math.abs(dy) / pos.height;

                statusMessage.textContent =
                    `"x": ${x.toFixed(4)}, "y": ${y.toFixed(4)}, ` +
                    `"width": ${width.toFixed(4)}, "height": ${height.toFixed(4)}`;
            } else {
                // Einfacher Klick: 2%-Hotspot
                const cx = pos.x / pos.width;
                const cy = pos.y / pos.height;
                const size = 0.02;

                statusMessage.textContent =
                    `"x": ${(cx - size / 2).toFixed(4)}, ` +
                    `"y": ${(cy - size / 2).toFixed(4)}, ` +
                    `"width": ${size.toFixed(4)}, "height": ${size.toFixed(4)}`;
            }
        } else {
            updateStatus();
        }
    } else {
        const endHotspot = insideBoard ? findHotspot(pos) : null;

        if (
            endHotspot !== null &&
            endHotspot !== startHotspot
        ) {
            const end = getHotspotCenter(endHotspot);

            updateWirePath(currentWire, end.x, end.y);

            // Erst probeweise elektrisch verbinden. Bei einem Kurzschluss
            // oder mehreren treibenden Ausgaengen wird das Kabel verworfen.
            wireConnections.push({ from: startHotspot.id, to: endHotspot.id, path: currentWire });
            const wiringError = checkWiringConflict();
            if (wiringError) {
                wireConnections.pop();
                currentWire.remove();
                statusMessage.textContent = wiringError;
            } else {
                updateWireColors();
                updateOutputLeds();
                statusMessage.textContent =
                    startHotspot.label + " -> " + endHotspot.label;
            }
        } else {
            currentWire.remove();
            updateStatus();
        }
    }

    if (board.hasPointerCapture(event.pointerId)) {
        board.releasePointerCapture(event.pointerId);
    }

    currentWire = null;
    activePointerId = null;
    startHotspot = null;
});


// ------------------------------------------------------------
// Pointer-Abbruch behandeln
// ------------------------------------------------------------

board.addEventListener("pointercancel", function (event) {
    if (event.pointerId !== activePointerId) {
        return;
    }

    if (currentWire !== null) {
        currentWire.remove();
    }

    currentWire = null;
    activePointerId = null;
    startHotspot = null;

    updateStatus();
});


// ------------------------------------------------------------
// Pointer verlässt das Board
// ------------------------------------------------------------

board.addEventListener("pointerleave", function () {
    hideSocketTooltip();
    if (currentWire === null) {
        coordinates.textContent = "X: --   Y: --";
    }
});


// ------------------------------------------------------------
// SVG-Leitung zeichnen
// ------------------------------------------------------------

// Kabelbogen quer zur Verbindungsrichtung: auch vertikale Leitungen
// erhalten so einen sichtbaren seitlichen Abstand. Die Endpunkte bleiben
// exakt auf den Buchsenmitten. Die Bogenrichtung ist pro Kabel stabil.
function updateWirePath(path, x2, y2) {
    const x1 = Number(path.getAttribute("x1"));
    const y1 = Number(path.getAttribute("y1"));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);

    path.setAttribute("x2", x2);
    path.setAttribute("y2", y2);

    if (length < 1) {
        path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
        return;
    }

    // Senkrechter Einheitsvektor: (-dy, dx) / length.
    // Unterschiedliche Kabel werden abwechselnd nach beiden Seiten gebogen.
    const side = Number(path.getAttribute("data-bend-side")) || 1;
    const bend = Math.min(65, Math.max(14, length * 0.22));
    const offsetX = (-dy / length) * bend * side;
    const offsetY = (dx / length) * bend * side;

    path.setAttribute("d",
        `M ${x1} ${y1} ` +
        `C ${x1 + dx / 3 + offsetX} ${y1 + dy / 3 + offsetY}, ` +
        `${x1 + 2 * dx / 3 + offsetX} ${y1 + 2 * dy / 3 + offsetY}, ` +
        `${x2} ${y2}`
    );
}

function drawWire(x1, y1, x2, y2) {
    const path = document.createElementNS(
        "http://www.w3.org/2000/svg", "path"
    );

    // x1/y1 bleiben für den Vermessungsmodus abrufbar.
    path.setAttribute("x1", x1);
    path.setAttribute("y1", y1);
    path.setAttribute("data-bend-side", wireConnections.length % 2 === 0 ? 1 : -1);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#39FF14");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    updateWirePath(path, x2, y2);

    wiringLayer.appendChild(path);
    return path;
}


// ------------------------------------------------------------
// Hauptschalter und Betriebs-LED
// ------------------------------------------------------------

powerSwitch.addEventListener("click", function () {
    powerOn = !powerOn;

    powerLed.classList.toggle("on", powerOn);
    updateSwitchLeds();
    updateOutputLeds();
    updateStatus();
});


// ------------------------------------------------------------
// Hotspot-Markierungen
// ------------------------------------------------------------

const hotspotLayer = document.createElement("div");

hotspotLayer.className = "hotspot-layer";

Object.assign(hotspotLayer.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none"
});

boardArea.appendChild(hotspotLayer);
updateModeDisplay();

// LED-Anzeigen über dem Board; blockieren keine Maus-/Touch-Eingaben
const switchLedLayer = document.createElement("div");
switchLedLayer.className = "switch-led-layer";
Object.assign(switchLedLayer.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "10"
});
boardArea.appendChild(switchLedLayer);


// ------------------------------------------------------------
// Board-Konfiguration laden
// ------------------------------------------------------------

updateStatus();

fetch("boards/itt-digitrainer2/board.json")
    .then(function (response) {
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }
        return response.json();
    })
    .then(function (config) {
        if (!Array.isArray(config.hotspots)) {
            throw new Error("Missing hotspots array");
        }

        hotspots = config.hotspots;
        switches = Array.isArray(config.controls) ? config.controls : [];
        const indicators = Array.isArray(config.indicators) ? config.indicators : [];
        boardLoaded = true;

        switches.forEach(function (control) {
            if (control.type !== "switch") return;
            switchStates[control.id] = control.initialState ?? 0;
            createSwitchControl(control);
        });

        // Schalter-LEDs und die acht Ausgab LEDs D0 bis D7 laden.
        const switchOutputs = new Set(
            switches.filter(control => control.type === "switch")
                .map(control => control.output)
        );
        indicators.forEach(function (indicator) {
            if (indicator.type !== "led") return;
            if (switchOutputs.has(indicator.input)) {
                createSwitchLed(indicator);
            } else if (/^D[0-7]$/.test(indicator.input)) {
                createOutputLed(indicator);
            }
        });
        updateSwitchLeds();
        updateOutputLeds();

        hotspots.forEach(function (hotspot) {
            const marker = document.createElement("div");

            marker.title = hotspot.label;

            const bounds = getHotspotBounds(hotspot);

            Object.assign(marker.style, {
                position: "absolute",
                left: (bounds.x * 100) + "%",
                top: (bounds.y * 100) + "%",
                width: (bounds.width * 100) + "%",
                height: (bounds.height * 100) + "%",
                boxSizing: "border-box",
                border: "1px solid lime",
                backgroundColor: "rgba(0,255,0,0.15)",
                pointerEvents: "none"
            });

            hotspotLayer.appendChild(marker);
        });

        console.log(
            "Board loaded:",
            config.name,
            hotspots.length,
            "hotspots"
        );

        updateStatus();
    })
    .catch(function (error) {
        console.error("Cannot load board.json:", error);
        statusMessage.textContent = "Error loading board.json";
    });


// ------------------------------------------------------------
// Schiebeschalter aus der Board-Konfiguration erzeugen
// ------------------------------------------------------------

function createSwitchControl(control) {
    const element = document.createElement("div");
    element.className = "slide-switch";

    Object.assign(element.style, {
        position: "absolute",
        left: (control.x * 100) + "%",
        top: (control.y * 100) + "%",
        width: (control.width * 100) + "%",
        height: (control.height * 100) + "%",
        boxSizing: "border-box",
        border: "1px solid rgba(0,255,255,0.7)",
        cursor: "pointer",
        zIndex: "20",
        touchAction: "manipulation"
    });

    const indicator = document.createElement("div");

    Object.assign(indicator.style, {
        position: "absolute",
        left: "15%",
        width: "70%",
        height: "15%",
        backgroundColor: "rgba(0,255,255,0.75)",
        borderRadius: "3px",
        pointerEvents: "none"
    });

    element.appendChild(indicator);

    function updateSwitchDisplay() {
        const state = switchStates[control.id];
        indicator.style.top = state === 1 ? "12%" : "73%";
        element.title = (control.label || control.id) + ": " + state;
    }

    element.addEventListener("click", function (event) {
        event.stopPropagation();

        if (!powerOn) return;

        switchStates[control.id] = switchStates[control.id] === 0 ? 1 : 0;
        updateSwitchDisplay();
        updateSwitchLeds();
        updateOutputLeds();
        statusMessage.textContent =
            (control.label || control.id) + " = " + switchStates[control.id];
    });

    updateSwitchDisplay();
    boardArea.appendChild(element);
}

// ------------------------------------------------------------
// LEDs der Schiebeschalter: bei Power ON und Schalter = 1 leuchten
// ------------------------------------------------------------

function createSwitchLed(indicator) {
    const element = document.createElement("div");
    element.title = indicator.input;

    Object.assign(element.style, {
        position: "absolute",
        left: (indicator.x * 100) + "%",
        top: (indicator.y * 100) + "%",
        width: (indicator.width * 100) + "%",
        height: (indicator.height * 100) + "%",
        borderRadius: "50%",
        boxSizing: "border-box",
        pointerEvents: "none"
    });

    switchLedLayer.appendChild(element);
    switchLeds.push({ input: indicator.input, element: element });
}

function updateSwitchLeds() {
    switchLeds.forEach(function (led) {
        const control = switches.find(function (item) {
            return item.type === "switch" && item.output === led.input;
        });
        const on = powerOn && control && switchStates[control.id] === 1;

        // Ausgeschaltet bleibt das unveränderte Foto sichtbar.
        led.element.style.backgroundColor = on ? "rgba(255, 25, 25, 0.9)" : "transparent";
        led.element.style.boxShadow = on
            ? "0 0 6px 3px rgba(255, 0, 0, 0.85), 0 0 12px 5px rgba(255, 0, 0, 0.35)"
            : "none";
    });
}


// ------------------------------------------------------------
// Ausgab LEDs D0-D7: direkte Signale über verdrahtete Buchsen
// ------------------------------------------------------------

function createOutputLed(indicator) {
    const element = document.createElement("div");
    element.title = indicator.input;

    Object.assign(element.style, {
        position: "absolute",
        left: (indicator.x * 100) + "%",
        top: (indicator.y * 100) + "%",
        width: (indicator.width * 100) + "%",
        height: (indicator.height * 100) + "%",
        borderRadius: "50%",
        boxSizing: "border-box",
        pointerEvents: "none"
    });

    switchLedLayer.appendChild(element);
    outputLeds.push({ input: indicator.input, element: element });
}

// ------------------------------------------------------------
// IC 0: SN74LS02N - vier NOR-Gatter mit je zwei Eingängen.
// Der DigiTrainer-Sockel hat 16 Anschlusspositionen. Bei einem
// 14-poligen IC entspricht die rechte oberste Buchse (16) Pin 14,
// rechts darunter (15) Pin 13 usw. Die Positionen 8 und 9
// sind bei diesem 14-poligen IC nicht belegt.
// ------------------------------------------------------------
const norGatesIC0 = [
    { a: "ic0-pin2",  b: "ic0-pin3",  y: "ic0-pin1"  },
    { a: "ic0-pin5",  b: "ic0-pin6",  y: "ic0-pin4"  },
    { a: "ic0-pin11", b: "ic0-pin10", y: "ic0-pin12" },
    { a: "ic0-pin14", b: "ic0-pin13", y: "ic0-pin15" }
];

// IC 1: SN74LS04N – sechs Inverter (14-polig im 16-poligen Sockel).
// Die Sockelpositionen 8 und 9 sind nicht mit dem IC verbunden.
const notGatesIC1 = [
    { a: "ic1-pin1",  y: "ic1-pin2"  },
    { a: "ic1-pin3",  y: "ic1-pin4"  },
    { a: "ic1-pin5",  y: "ic1-pin6"  },
    { a: "ic1-pin11", y: "ic1-pin10" },
    { a: "ic1-pin13", y: "ic1-pin12" },
    { a: "ic1-pin15", y: "ic1-pin14" }
];

// IC 2: SN74LS08N – vier AND-Gatter (14-polig im 16-poligen Sockel).
// Sockelpositionen 8 und 9 sind unbenutzt.
const andGatesIC2 = [
    { a: "ic2-pin1",  b: "ic2-pin2",  y: "ic2-pin3"  },
    { a: "ic2-pin4",  b: "ic2-pin5",  y: "ic2-pin6"  },
    { a: "ic2-pin11", b: "ic2-pin12", y: "ic2-pin10" },
    { a: "ic2-pin14", b: "ic2-pin15", y: "ic2-pin13" }
];

// IC 3: SN74LS86AN – vier XOR-Gatter (14-polig im 16-poligen Sockel).
// Sockelpositionen 8 und 9 sind nicht belegt.
const xorGatesIC3 = [
    { a: "ic3-pin1",  b: "ic3-pin2",  y: "ic3-pin3"  },
    { a: "ic3-pin4",  b: "ic3-pin5",  y: "ic3-pin6"  },
    { a: "ic3-pin11", b: "ic3-pin12", y: "ic3-pin10" },
    { a: "ic3-pin14", b: "ic3-pin15", y: "ic3-pin13" }
];

// IC 4: 74LS00PC – vier NAND-Gatter (14-polig im 16-poligen Sockel).
// Sockelpositionen 8 und 9 sind nicht belegt.
const nandGatesIC4 = [
    { a: "ic4-pin1",  b: "ic4-pin2",  y: "ic4-pin3"  },
    { a: "ic4-pin4",  b: "ic4-pin5",  y: "ic4-pin6"  },
    { a: "ic4-pin11", b: "ic4-pin12", y: "ic4-pin10" },
    { a: "ic4-pin14", b: "ic4-pin15", y: "ic4-pin13" }
];

// IC 5: CD4069UBE – sechs CMOS-Inverter (14 Pins im 20-poligen Sockel).
// Nicht belegte Sockelpositionen: 8–13.
const notGatesIC5 = [
    { a: "ic5-pin1",  y: "ic5-pin2"  },
    { a: "ic5-pin3",  y: "ic5-pin4"  },
    { a: "ic5-pin5",  y: "ic5-pin6"  },
    { a: "ic5-pin15", y: "ic5-pin14" },
    { a: "ic5-pin17", y: "ic5-pin16" },
    { a: "ic5-pin19", y: "ic5-pin18" }
];

// Versorgungsschienen: alle gleichnamigen Buchsen sind intern verbunden.
// Die IDs stammen aus board.json (vcc1, vcc2, ... / gnd1, gnd2, ...).
function supplyIds(prefix) {
    const pattern = new RegExp("^" + prefix + "\\d+$");
    return hotspots.map(h => h.id).filter(id => pattern.test(id));
}

// Bestimmt alle elektrisch zusammenhängenden Netze. Die reine
// Zeichnung der roten Leitungen bleibt davon unabhängig.
function buildWireNets() {
    const parent = new Map();

    function root(id) {
        if (!parent.has(id)) parent.set(id, id);
        if (parent.get(id) !== id) parent.set(id, root(parent.get(id)));
        return parent.get(id);
    }
    function join(a, b) {
        const ra = root(a), rb = root(b);
        if (ra !== rb) parent.set(ra, rb);
    }

    hotspots.forEach(h => root(h.id));
    // Physische Brücken innerhalb der beiden Versorgungsschienen.
    for (const prefix of ["vcc", "gnd"]) {
        const ids = supplyIds(prefix);
        for (let i = 1; i < ids.length; i++) join(ids[0], ids[i]);
    }
    wireConnections.forEach(w => join(w.from, w.to));
    norGatesIC0.forEach(g => {
        root(g.a); root(g.b); root(g.y);
    });
    notGatesIC1.forEach(g => {
        root(g.a); root(g.y);
    });
    andGatesIC2.forEach(g => {
        root(g.a); root(g.b); root(g.y);
    });
    xorGatesIC3.forEach(g => {
        root(g.a); root(g.b); root(g.y);
    });
    nandGatesIC4.forEach(g => {
        root(g.a); root(g.b); root(g.y);
    });
    notGatesIC5.forEach(g => { root(g.a); root(g.y); });
    outputLeds.forEach(led => root(led.input));
    switches.forEach(control => {
        if (control.type === "switch") {
            root(control.output);
            root(control.output + "_NOT");
        }
    });

    const nets = new Map();
    for (const id of parent.keys()) {
        const key = root(id);
        if (!nets.has(key)) nets.set(key, new Set());
        nets.get(key).add(id);
    }
    return { nets, root };
}

// ------------------------------------------------------------
// Kabelfarben nach elektrischer Netzzugehoerigkeit.
// Gruen = Signal, Rot = +5 V, Hellblau = GND.
// Nicht der momentane Logikpegel, sondern die feste Versorgung
// entscheidet ueber die Farbe. Dadurch werden auch indirekt
// angeschlossene Leitungen im selben Netz eingefaerbt.
// ------------------------------------------------------------
function updateWireColors() {
    const { root } = buildWireNets();
    const vcc = new Set(supplyIds("vcc").map(id => root(id)));
    const gnd = new Set(supplyIds("gnd").map(id => root(id)));

    wireConnections.forEach(function (wire) {
        if (!wire.path) return;
        const net = root(wire.from);
        if (vcc.has(net)) {
            wire.path.setAttribute("stroke", "#FF3030");
            wire.path.style.filter = "none";
        } else if (gnd.has(net)) {
            wire.path.setAttribute("stroke", "#45C8FF");
            wire.path.style.filter = "none";
        } else {
            wire.path.setAttribute("stroke", "#39FF14");
            wire.path.style.filter = "none";
        }
    });
}

// ------------------------------------------------------------
// Verdrahtung pruefen, bevor ein neues Kabel uebernommen wird.
// Zwei aktiv treibende Ausgaenge duerfen niemals dasselbe Netz
// belegen, selbst wenn ihre Pegel momentan uebereinstimmen.
// Die Versorgungsschienen sind keine frei kombinierbaren Ausgaenge:
// mehrere VCC- bzw. GND-Buchsen sind dagegen ausdruecklich erlaubt.
// ------------------------------------------------------------
function checkWiringConflict() {
    const { nets } = buildWireNets();
    const gateOutputs = new Set([...norGatesIC0, ...notGatesIC1, ...andGatesIC2, ...xorGatesIC3, ...nandGatesIC4, ...notGatesIC5].map(gate => gate.y));
    const switchOutputs = new Set();
    switches.forEach(control => {
        if (control.type === "switch") {
            switchOutputs.add(control.output);
            switchOutputs.add(control.output + "_NOT");
        }
    });

    for (const ids of nets.values()) {
        const hasVcc = [...ids].some(id => /^vcc\d+$/.test(id));
        const hasGnd = [...ids].some(id => /^gnd\d+$/.test(id));
        if (hasVcc && hasGnd) {
            return "Kurzschluss: +5 V und GND dürfen nicht verbunden werden!";
        }

        const outputs = [...ids].filter(id =>
            switchOutputs.has(id) || gateOutputs.has(id)
        );
        if (outputs.length > 1) {
            return "Ausgangskonflikt: " + outputs.join(" / ") + "!";
        }
        if (outputs.length && (hasVcc || hasGnd)) {
            return "Ausgangskonflikt: " + outputs[0] +
                " darf nicht direkt an " + (hasVcc ? "+5 V" : "GND") + "!";
        }
    }
    return null;
}

// 0 = LOW, 1 = HIGH, null = unbestimmt (z.B. offener Eingang).
// Bei widersprüchlichen Treibern wird das Netz unbestimmt.
function resolveSignals() {
    const { nets, root } = buildWireNets();
    const sourceLevels = new Map();
    const levels = new Map();

    function drive(id, level) {
        if (level === null) return;
        const key = root(id);
        if (!sourceLevels.has(key)) sourceLevels.set(key, new Set());
        sourceLevels.get(key).add(level);
    }

    // Feste Versorgungspotenziale sind ebenfalls Signalquellen.
    // Die Verbindung wird ueber das gesamte elektrische Netz aufgeloest:
    // +5 V = HIGH, GND = LOW. Bei Kurzschluss bleibt der Pegel unbestimmt.
    supplyIds("vcc").forEach(id => drive(id, 1));
    supplyIds("gnd").forEach(id => drive(id, 0));

    switches.forEach(control => {
        if (control.type !== "switch") return;
        const state = switchStates[control.id] === 1 ? 1 : 0;
        drive(control.output, state);
        drive(control.output + "_NOT", 1 - state);
    });

    // SN74LS02N (14 Pins) im 16-poligen IC-Sockel 0:
    // IC-Pin 14 (VCC) = ic0-pin16, IC-Pin 7 (GND) = ic0-pin7.
    // Nur die tatsächliche Verbindung mit den Versorgungsbuchsen zählt.
    // Ein HIGH-Pegel eines Schalters ersetzt keine VCC-Verbindung.
    const vccIds = supplyIds("vcc");
    const gndIds = supplyIds("gnd");
    const supplyShort = vccIds.some(id =>
        gndIds.some(gnd => root(id) === root(gnd))
    );
    const ic0Powered = !supplyShort &&
        vccIds.some(id => root("ic0-pin16") === root(id)) &&
        gndIds.some(id => root("ic0-pin7") === root(id));
    const ic1Powered = !supplyShort &&
        vccIds.some(id => root("ic1-pin16") === root(id)) &&
        gndIds.some(id => root("ic1-pin7") === root(id));
    const ic2Powered = !supplyShort &&
        vccIds.some(id => root("ic2-pin16") === root(id)) &&
        gndIds.some(id => root("ic2-pin7") === root(id));

    const ic3Powered = !supplyShort &&
        vccIds.some(id => root("ic3-pin16") === root(id)) &&
        gndIds.some(id => root("ic3-pin7") === root(id));
    const ic4Powered = !supplyShort &&
        vccIds.some(id => root("ic4-pin16") === root(id)) &&
        gndIds.some(id => root("ic4-pin7") === root(id));

    const ic5Powered = !supplyShort &&
        vccIds.some(id => root("ic5-pin20") === root(id)) &&
        gndIds.some(id => root("ic5-pin7") === root(id));

    // IC-Ausgänge iterativ auswerten: damit funktionieren auch
    // hintereinander geschaltete NOR-Gatter ohne Verzögerungsmodell.
    // Ein unbekannter Eingang bleibt unbekannt. Sobald ein Eingang
    // HIGH ist, ist der NOR-Ausgang jedoch sicher LOW.
    let previous = new Map();
    const maxIterations = 32;
    for (let i = 0; i < maxIterations; i++) {
        const drivers = new Map();
        for (const [key, values] of sourceLevels) {
            drivers.set(key, new Set(values));
        }
        if (ic0Powered) norGatesIC0.forEach(gate => {
            const a = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            const b = previous.has(root(gate.b)) ? previous.get(root(gate.b)) : null;
            let result = null;
            if (a === 1 || b === 1) result = 0;
            else if (a === 0 && b === 0) result = 1;
            if (result !== null) {
                const key = root(gate.y);
                if (!drivers.has(key)) drivers.set(key, new Set());
                drivers.get(key).add(result);
            }
        });
        // IC 1: Inverter – bei fehlender Versorgung oder unbekanntem
        // Eingang wird kein definierter Ausgangspegel erzeugt.
        if (ic1Powered) notGatesIC1.forEach(gate => {
            const input = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            if (input === null) return;
            const key = root(gate.y);
            if (!drivers.has(key)) drivers.set(key, new Set());
            drivers.get(key).add(1 - input);
        });
        // IC 2: AND – LOW an einem Eingang erzwingt LOW.
        // HIGH entsteht nur, wenn beide Eingänge HIGH sind.
        if (ic2Powered) andGatesIC2.forEach(gate => {
            const a = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            const b = previous.has(root(gate.b)) ? previous.get(root(gate.b)) : null;
            let result = null;
            if (a === 0 || b === 0) result = 0;
            else if (a === 1 && b === 1) result = 1;
            if (result !== null) {
                const key = root(gate.y);
                if (!drivers.has(key)) drivers.set(key, new Set());
                drivers.get(key).add(result);
            }
        });
        // IC 3: XOR – HIGH genau dann, wenn die Eingänge verschieden sind.
        // Bei einem unbekannten Eingang bleibt der Ausgang unbekannt.
        if (ic3Powered) xorGatesIC3.forEach(gate => {
            const a = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            const b = previous.has(root(gate.b)) ? previous.get(root(gate.b)) : null;
            if (a === null || b === null) return;
            const key = root(gate.y);
            if (!drivers.has(key)) drivers.set(key, new Set());
            drivers.get(key).add(a ^ b);
        });
        // IC 4: NAND – LOW nur bei zwei HIGH-Eingängen.
        // Ein LOW-Eingang erzwingt HIGH; sonst bleibt ein offener Eingang unbekannt.
        if (ic4Powered) nandGatesIC4.forEach(gate => {
            const a = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            const b = previous.has(root(gate.b)) ? previous.get(root(gate.b)) : null;
            let result = null;
            if (a === 0 || b === 0) result = 1;
            else if (a === 1 && b === 1) result = 0;
            if (result !== null) {
                const key = root(gate.y);
                if (!drivers.has(key)) drivers.set(key, new Set());
                drivers.get(key).add(result);
            }
        });
        // IC 5: CD4069UBE – CMOS-Inverter.
        // Unversorgte oder offene Eingänge liefern keinen definierten Pegel.
        if (ic5Powered) notGatesIC5.forEach(gate => {
            const input = previous.has(root(gate.a)) ? previous.get(root(gate.a)) : null;
            if (input === null) return;
            const key = root(gate.y);
            if (!drivers.has(key)) drivers.set(key, new Set());
            drivers.get(key).add(1 - input);
        });
        levels.clear();
        for (const key of nets.keys()) {
            const values = drivers.get(key);
            levels.set(key, values && values.size === 1 ? values.values().next().value : null);
        }
        let unchanged = true;
        for (const key of nets.keys()) {
            if (levels.get(key) !== previous.get(key)) { unchanged = false; break; }
        }
        if (unchanged) return { levels, root };
        previous = new Map(levels);
    }
    // Nicht konvergierende Rückkopplungen werden nicht als stabile
    // HIGH-Pegel ausgegeben.
    return { levels: new Map([...nets.keys()].map(k => [k, null])), root };
}

function updateOutputLeds() {
    const signals = powerOn ? resolveSignals() : null;
    outputLeds.forEach(function (led) {
        const on = signals && signals.levels.get(signals.root(led.input)) === 1;
        led.element.style.backgroundColor = on
            ? "rgba(255, 25, 25, 0.9)" : "transparent";
        led.element.style.boxShadow = on
            ? "0 0 6px 3px rgba(255, 0, 0, 0.85), 0 0 12px 5px rgba(255, 0, 0, 0.35)"
            : "none";
    });
}

window.addEventListener("blur", hideSocketTooltip);

// ------------------------------------------------------------
// Zoom (100–400 %), Zwei-Finger-Gesten und Vollbild
// Die Platine wird im Layout skaliert; alle Overlays folgen mit.
// ------------------------------------------------------------
const zoomInButton = document.querySelector(".zoom-in");
const zoomOutButton = document.querySelector(".zoom-out");
const zoomResetButton = document.querySelector(".zoom-reset");
const fullscreenButton = document.querySelector(".fullscreen-toggle");
const zoomDisplay = document.querySelector(".zoom-value");
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
let zoom = 1;
let baseWidth = 0;
let baseHeight = 0;
let zoomGesture = false;
let pinchStart = null;

function refreshWireGeometry() {
    wireConnections.forEach(function (wire) {
        if (!wire.path) return;
        const a = hotspots.find(h => h.id === wire.from);
        const b = hotspots.find(h => h.id === wire.to);
        if (!a || !b) return;
        const start = getHotspotCenter(a);
        const end = getHotspotCenter(b);
        wire.path.setAttribute("x1", start.x);
        wire.path.setAttribute("y1", start.y);
        updateWirePath(wire.path, end.x, end.y);
    });
}

function fitBoard() {
    if (!board.naturalWidth || !board.naturalHeight) return;
    const availableWidth = Math.max(1, boardContainer.clientWidth - 12);
    const availableHeight = Math.max(1, boardContainer.clientHeight - 12);
    const ratio = board.naturalWidth / board.naturalHeight;
    baseWidth = Math.min(availableWidth, availableHeight * ratio);
    baseHeight = baseWidth / ratio;
    applyZoom(zoom);
}

function applyZoom(value, clientX, clientY) {
    if (!baseWidth) return;
    const oldWidth = boardArea.offsetWidth || baseWidth;
    const oldHeight = boardArea.offsetHeight || baseHeight;
    const rect = boardArea.getBoundingClientRect();
    const viewport = boardContainer.getBoundingClientRect();
    const focusX = clientX ?? (viewport.left + viewport.width / 2);
    const focusY = clientY ?? (viewport.top + viewport.height / 2);
    const relativeX = (focusX - rect.left) / oldWidth;
    const relativeY = (focusY - rect.top) / oldHeight;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    boardArea.style.width = (baseWidth * zoom) + "px";
    boardArea.style.height = (baseHeight * zoom) + "px";
    zoomDisplay.textContent = Math.round(zoom * 100) + " %";
    refreshWireGeometry();
    // Mittelpunkt bzw. Mausposition beim Zoomen festhalten.
    boardContainer.scrollLeft += relativeX * (baseWidth * zoom - oldWidth);
    boardContainer.scrollTop += relativeY * (baseHeight * zoom - oldHeight);
}

zoomInButton.addEventListener("click", () => applyZoom(zoom * 1.25));
zoomOutButton.addEventListener("click", () => applyZoom(zoom / 1.25));
zoomResetButton.addEventListener("click", () => {
    applyZoom(1);
    boardContainer.scrollLeft = 0;
    boardContainer.scrollTop = 0;
});

// Mausrad: Zoom am Mauszeiger (nur über der Platine).
boardContainer.addEventListener("wheel", function (event) {
    if (!event.target.closest(".board-area")) return;
    event.preventDefault();
    applyZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
}, { passive: false });

// Touch: Ein Finger bedient weiterhin Buchsen und Schalter.
// Zwei Finger zoomen und verschieben die gesamte Platine.
function touchInfo(event) {
    const a = event.touches[0], b = event.touches[1];
    return {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
    };
}
function cancelCurrentCable() {
    if (currentWire) currentWire.remove();
    if (activePointerId !== null && board.hasPointerCapture(activePointerId)) {
        board.releasePointerCapture(activePointerId);
    }
    currentWire = null;
    activePointerId = null;
    startHotspot = null;
    hideSocketTooltip();
    updateStatus();
}
boardContainer.addEventListener("touchstart", function (event) {
    if (event.touches.length < 2) return;
    zoomGesture = true;
    cancelCurrentCable();
    const info = touchInfo(event);
    pinchStart = { ...info, zoom, scrollLeft: boardContainer.scrollLeft, scrollTop: boardContainer.scrollTop };
    event.preventDefault();
}, { capture: true, passive: false });
boardContainer.addEventListener("touchmove", function (event) {
    if (!zoomGesture || event.touches.length < 2 || !pinchStart) return;
    event.preventDefault();
    event.stopPropagation();
    const info = touchInfo(event);
    applyZoom(pinchStart.zoom * info.distance / Math.max(1, pinchStart.distance), info.x, info.y);
    boardContainer.scrollLeft -= info.x - pinchStart.x;
    boardContainer.scrollTop -= info.y - pinchStart.y;
    pinchStart = { ...info, zoom, scrollLeft: boardContainer.scrollLeft, scrollTop: boardContainer.scrollTop };
}, { capture: true, passive: false });
function endPinch(event) {
    if (event.touches.length < 2) pinchStart = null;
    if (event.touches.length === 0) zoomGesture = false;
}
boardContainer.addEventListener("touchend", endPinch, { capture: true });
boardContainer.addEventListener("touchcancel", endPinch, { capture: true });

// iPhone-Fallback: Pseudo-Vollbild statt Fullscreen API.
const pseudoExitButton = document.querySelector(".pseudo-fullscreen-exit");
function setPseudoFullscreen(enabled) {
    document.body.classList.toggle("pseudo-fullscreen", enabled);
    fullscreenButton.textContent = enabled ? "Vollbild beenden" : "Vollbild";
    requestAnimationFrame(() => {
        fitBoard();
        boardContainer.scrollLeft = 0;
        boardContainer.scrollTop = 0;
    });
}
pseudoExitButton.addEventListener("click", () => setPseudoFullscreen(false));
fullscreenButton.addEventListener("click", async function () {
    if (document.body.classList.contains("pseudo-fullscreen")) {
        setPseudoFullscreen(false);
        return;
    }
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else if (boardContainer.requestFullscreen) {
            await boardContainer.requestFullscreen();
        } else {
            setPseudoFullscreen(true);
        }
    } catch (error) {
        // Safari auf dem iPhone kann die Fullscreen API ablehnen.
        setPseudoFullscreen(true);
    }
});
document.addEventListener("fullscreenchange", function () {
    fullscreenButton.textContent = document.fullscreenElement ? "Vollbild beenden" : "Vollbild";
    requestAnimationFrame(fitBoard);
});
board.addEventListener("load", fitBoard);
window.addEventListener("resize", fitBoard);
if (board.complete && board.naturalWidth) fitBoard();
