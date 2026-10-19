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

    const match = /^ic0-pin(\d+)$/.exec(hotspot.id);
    const lines = [hotspot.label || hotspot.id];
    if (match) {
        const socketPin = Number(match[1]);
        const chipPin = socketPin >= 10 ? socketPin - 2 : socketPin;
        lines.push("SN74LS02N" + (socketPin === 8 || socketPin === 9 ? "" : " · Pin " + chipPin));
        lines.push(ic0PinFunctions[socketPin]);
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

    measureMode = !measureMode;
    updateStatus();
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

// Leicht durchhängendes Patchkabel als kubischer Bézier-Pfad.
// Endpunkte bleiben exakt auf den Buchsenmitten.
function updateWirePath(path, x2, y2) {
    const x1 = Number(path.getAttribute("x1"));
    const y1 = Number(path.getAttribute("y1"));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    // Mehr Durchhang bei langen Kabeln, unabhängig von der Ziehrichtung.
    const sag = Math.min(55, length * 0.20);

    path.setAttribute("x2", x2);
    path.setAttribute("y2", y2);
    path.setAttribute("d",
        `M ${x1} ${y1} C ${x1 + dx / 3} ${y1 + sag}, ` +
        `${x1 + 2 * dx / 3} ${y2 + sag}, ${x2} ${y2}`
    );
}

function drawWire(x1, y1, x2, y2) {
    const path = document.createElementNS(
        "http://www.w3.org/2000/svg", "path"
    );

    // x1/y1 bleiben für den Vermessungsmodus abrufbar.
    path.setAttribute("x1", x1);
    path.setAttribute("y1", y1);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "red");
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
    wireConnections.forEach(w => join(w.from, w.to));
    norGatesIC0.forEach(g => {
        root(g.a); root(g.b); root(g.y);
    });
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
// Verdrahtung pruefen, bevor ein neues Kabel uebernommen wird.
// Zwei aktiv treibende Ausgaenge duerfen niemals dasselbe Netz
// belegen, selbst wenn ihre Pegel momentan uebereinstimmen.
// Die Versorgungsschienen sind keine frei kombinierbaren Ausgaenge:
// mehrere VCC- bzw. GND-Buchsen sind dagegen ausdruecklich erlaubt.
// ------------------------------------------------------------
function checkWiringConflict() {
    const { nets } = buildWireNets();
    const gateOutputs = new Set(norGatesIC0.map(gate => gate.y));
    const switchOutputs = new Set();
    switches.forEach(control => {
        if (control.type === "switch") {
            switchOutputs.add(control.output);
            switchOutputs.add(control.output + "_NOT");
        }
    });

    for (const ids of nets.values()) {
        const hasVcc = ids.has("vcc1") || ids.has("vcc2");
        const hasGnd = ids.has("gnd1") || ids.has("gnd2");
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
    drive("vcc1", 1);
    drive("vcc2", 1);
    drive("gnd1", 0);
    drive("gnd2", 0);

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
    const supplyShort =
        ["vcc1", "vcc2"].some(id =>
            ["gnd1", "gnd2"].some(gnd => root(id) === root(gnd))
        );
    const ic0Powered = !supplyShort &&
        ["vcc1", "vcc2"].some(id => root("ic0-pin16") === root(id)) &&
        ["gnd1", "gnd2"].some(id => root("ic0-pin7") === root(id));

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

fullscreenButton.addEventListener("click", async function () {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else if (boardContainer.requestFullscreen) {
            await boardContainer.requestFullscreen();
        } else {
            statusMessage.textContent = "Vollbild wird von diesem Browser nicht unterstützt";
        }
    } catch (error) {
        statusMessage.textContent = "Vollbild nicht verfügbar";
    }
});
document.addEventListener("fullscreenchange", function () {
    fullscreenButton.textContent = document.fullscreenElement ? "Vollbild beenden" : "Vollbild";
    fitBoard();
});
board.addEventListener("load", fitBoard);
window.addEventListener("resize", fitBoard);
if (board.complete && board.naturalWidth) fitBoard();
