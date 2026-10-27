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

// Manueller Takt: Grundpegel LOW, invertierter Ausgang HIGH.
// STOP = 0 (unten) gibt den manuellen Taster frei.
function manualClockEnabled() {
    return powerOn && switchStates.switch_clk_stop === 0;
}

// Automatischer Takt: STOP oben, f unten = 1 Hz, f oben = 10 Hz.
// Halbperioden: 500 ms bei 1 Hz, 50 ms bei 10 Hz.
let clockTimer = null;
let clockLevel = 0;
function automaticClockEnabled() {
    return powerOn && switchStates.switch_clk_stop === 1;
}
function refreshClockGenerator() {
    if (clockTimer !== null) {
        clearInterval(clockTimer);
        clockTimer = null;
    }
    clockLevel = 0;
    if (automaticClockEnabled()) {
        clockLevel = 1;
        clockTimer = setInterval(function () {
            if (!automaticClockEnabled()) {
                refreshClockGenerator();
                updateOutputLeds();
                return;
            }
            clockLevel = 1 - clockLevel;
            updateOutputLeds();
        }, switchStates.switch_clk_f === 1 ? 50 : 500);
    }
    updateOutputLeds();
}

const switchLeds = [];
const outputLeds = [];
const sevenSegmentDisplays = [];
// SN74LS293N: QA ist ein 1-Bit-Teiler, QB/QC/QD ein 3-Bit-Zaehler.
// Beide Stufen reagieren auf fallende Taktflanken.
const counter293 = { a: 0, b: 0, prevA: null, prevB: null };
// NE5037N: einfaches zeitdiskretes 6-Bit-ADC-Modell.
// Annahme fuer die unbekannte DigiTrainer-Platinenbeschaltung:
// I' = VREF, I = VIN, Massebuchse = AGND/DGND, CS intern LOW.
// 0V/5V werden aus den Versorgungsschienen abgeleitet.
const adc5037 = { busy: false, ready: false, cycles: 0,
    value: 0, sample: null, prevStart: null, prevClock: null }; 
const adc5037Outputs = Array.from({length: 6}, (_, i) => "adc-Q" + i);
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

            // Dieselbe Verbindung erneut ziehen entfernt das vorhandene Kabel.
            // Die Richtung der Verbindung spielt dabei keine Rolle.
            const existingIndex = wireConnections.findIndex(wire =>
                (wire.from === startHotspot.id && wire.to === endHotspot.id) ||
                (wire.from === endHotspot.id && wire.to === startHotspot.id)
            );

            if (existingIndex !== -1) {
                const existingWire = wireConnections.splice(existingIndex, 1)[0];
                if (existingWire.path) existingWire.path.remove();
                currentWire.remove();
                updateWireColors();
                updateOutputLeds();
                statusMessage.textContent =
                    "Cable removed: " + startHotspot.label + " - " + endHotspot.label;
            } else {
                // Neue Verbindung probeweise anlegen und elektrisch pruefen.
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

    // Vermessungsmodus: rotes, achsenparalleles Rechteck von Start- bis Endpunkt.
    // Die Verdrahtungsdarstellung bleibt unverändert.
    if (path.getAttribute("data-measure") === "true") {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const right = Math.max(x1, x2);
        const bottom = Math.max(y1, y2);
        path.setAttribute("d", `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`);
        return;
    }

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
    path.setAttribute("data-measure", measureMode ? "true" : "false");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", measureMode ? "#FF3030" : "#39FF14");
    path.setAttribute("stroke-width", path.getAttribute("data-measure") === "true" ? "1" : String(3 * zoom));
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
    refreshClockGenerator();
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
            if (control.type !== "switch" && control.type !== "button") return;
            switchStates[control.id] = control.initialState ?? 0;
            if (control.type === "button") {
                createButtonControl(control);
            } else {
                createSwitchControl(control);
            }
        });

        // Schalter-LEDs und die acht Ausgab LEDs D0 bis D7 laden.
        const switchOutputs = new Set(
            switches.filter(control => control.type === "switch")
                .map(control => control.output)
        );
        indicators.forEach(function (indicator) {
            if (indicator.type === "seven-segment") {
                createSevenSegmentDisplay(indicator);
                return;
            }
            if (indicator.type !== "led") return;
            if (switchOutputs.has(indicator.input)) {
                createSwitchLed(indicator);
            } else if (/^D[0-7]$/.test(indicator.input) || indicator.input === "clk-out") {
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
        if (control.id === "switch_clk_stop" || control.id === "switch_clk_f") {
            refreshClockGenerator();
        } else {
            updateOutputLeds();
        }
        statusMessage.textContent =
            (control.label || control.id) + " = " + switchStates[control.id];
    });

    updateSwitchDisplay();
    boardArea.appendChild(element);
}

// ------------------------------------------------------------
// Momenttaster aus board.json: gedrueckt nur waehrend Pointer-Kontakt.
// Manueller Taster treibt CLK nur bei STOP unten.
// ------------------------------------------------------------
function createButtonControl(control) {
    const element = document.createElement("div");
    element.className = "momentary-button";
    Object.assign(element.style, {
        position: "absolute",
        left: (control.x * 100) + "%",
        top: (control.y * 100) + "%",
        width: (control.width * 100) + "%",
        height: (control.height * 100) + "%",
        boxSizing: "border-box",
        border: "1px solid rgba(0,255,255,0.8)",
        backgroundColor: "transparent",
        cursor: "pointer",
        zIndex: "20",
        touchAction: "none"
    });
    element.title = control.label || control.id;

    function setPressed(pressed) {
        switchStates[control.id] = pressed ? 1 : 0;
        element.style.backgroundColor = pressed ? "rgba(0,255,255,0.25)" : "transparent";
        element.style.borderColor = pressed ? "#ffffff" : "rgba(0,255,255,0.8)";
        if (control.id === "button_clk_man" || control.id === "switch_clk_man") {
            updateOutputLeds();
        }
        statusMessage.textContent = (control.label || control.id) +
            (pressed ? " gedrueckt" : " losgelassen");
    }

    element.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
        if (!powerOn || (event.pointerType === "mouse" && event.button !== 0)) return;
        if ((control.id === "button_clk_man" || control.id === "switch_clk_man") && !manualClockEnabled()) {
            statusMessage.textContent = "CLK man: STOP muss unten stehen";
            return;
        }
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        setPressed(true);
    });
    element.addEventListener("pointerup", function (event) {
        event.stopPropagation();
        if (switchStates[control.id] === 1) setPressed(false);
    });
    element.addEventListener("pointercancel", function (event) {
        event.stopPropagation();
        if (switchStates[control.id] === 1) setPressed(false);
    });
    element.addEventListener("lostpointercapture", function () {
        if (switchStates[control.id] === 1) setPressed(false);
    });
    element.addEventListener("click", event => event.stopPropagation());
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
    // Fuenf passive Verteilerschienen L0 bis L4.
    // Jeweils vier Buchsen sind intern miteinander verbunden;
    // die Schienen bleiben untereinander und von VCC/GND getrennt.
    for (let rail = 0; rail <= 4; rail++) {
        const ids = hotspots.map(h => h.id)
            .filter(id => new RegExp("^l" + rail + "_[1-4]$").test(id));
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
    sevenSegmentDisplays.forEach(display => {
        display.inputs.forEach(id => root(id));
        if (display.latch) root(display.latch);
    });
    ["ctr-RO0", "ctr-RO1", "ctr-CKA", "ctr-CKB",
     "ctr-QA", "ctr-QB", "ctr-QC", "ctr-QD"].forEach(root);
    // Fest eingebauter SN74LS382N: ALU-Buchsen als Netzknoten registrieren.
    [...alu382Inputs, ...alu382Outputs].forEach(root);
    ["adc-I'", "adc-I", "adc-a-gnd", "adc-clk", "adc-st", "adc-oe", "adc-EOC",
     ...adc5037Outputs].forEach(root);
    switches.forEach(control => {
        if (control.type === "switch" && control.output) {
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
    ["ctr-QA", "ctr-QB", "ctr-QC", "ctr-QD"].forEach(id => gateOutputs.add(id));
    alu382Outputs.forEach(id => gateOutputs.add(id));
    adc5037Outputs.forEach(id => gateOutputs.add(id));
    gateOutputs.add("adc-EOC");
    gateOutputs.add("clk-out");
    gateOutputs.add("clk-out-not");
    const switchOutputs = new Set();
    switches.forEach(control => {
        if (control.type === "switch" && control.output) {
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

// SN74LS382N: fest eingebaute 4-Bit-ALU auf dem DigiTrainer.
const alu382Inputs = ["alu-S0", "alu-S1", "alu-S2", "alu-Cn",
    ...Array.from({length: 4}, (_, i) => "alu-A" + i),
    ...Array.from({length: 4}, (_, i) => "alu-B" + i)];
const alu382Outputs = ["alu-F0", "alu-F1", "alu-F2", "alu-F3", "alu-OVR", "alu-Cn4"];

// Alle Eingangssignale müssen definiert sein. Cn ist bei der Addition
// der Übertrag und bei der Subtraktion der invertierte Borrow-Eingang.
function calculateAlu382(read) {
    const selectBits = ["alu-S0", "alu-S1", "alu-S2"].map(read);
    if (selectBits.some(bit => bit !== 0 && bit !== 1)) return null;
    const mode = selectBits[0] | (selectBits[1] << 1) | (selectBits[2] << 2);
    if (mode === 0 || mode === 7) return { f: mode === 0 ? 0 : 15, carry: 0, overflow: 0 };
    const aBits = [0,1,2,3].map(i => read("alu-A" + i));
    const bBits = [0,1,2,3].map(i => read("alu-B" + i));
    if ([...aBits, ...bBits].some(bit => bit !== 0 && bit !== 1)) return null;
    const a = aBits.reduce((v, bit, i) => v | (bit << i), 0);
    const b = bBits.reduce((v, bit, i) => v | (bit << i), 0);
    if (mode >= 4) {
        const f = mode === 4 ? a ^ b : mode === 5 ? a | b : a & b;
        return { f, carry: 0, overflow: 0 };
    }
    const cin = read("alu-Cn");
    if (cin !== 0 && cin !== 1) return null;
    // Subtraktion: X - Y = X + (~Y & 15) + Cn; Cn=1: ohne Borrow.
    const x = mode === 1 ? b : a;
    const y = mode === 1 ? a : b;
    const operand2 = mode === 3 ? b : (~y & 15);
    const sum = x + operand2 + cin;
    const carry = (sum >> 4) & 1;
    const carryIntoMsb = ((x & 7) + (operand2 & 7) + cin) >> 3;
    return { f: sum & 15, carry, overflow: carryIntoMsb ^ carry };
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

    // Zaehlerausgaenge treiben ihre Buchsen auch ohne externe Verdrahtung.
    drive("ctr-QA", counter293.a);
    drive("ctr-QB", counter293.b & 1);
    drive("ctr-QC", (counter293.b >> 1) & 1);
    drive("ctr-QD", (counter293.b >> 2) & 1);
    // ADC-Datenbus: OE LOW schaltet die Ausgaenge frei (sonst hochohmig).
    // EOC LOW meldet fertig; bei OE LOW wird EOC wieder HIGH.
    if (adc5037.ready) {
        // OE wird unten aus den geloesten Pegeln gelesen (zweiter Durchlauf).
    }

    switches.forEach(control => {
        if (control.type !== "switch" || !control.output) return;
        const state = switchStates[control.id] === 1 ? 1 : 0;
        drive(control.output, state);
        drive(control.output + "_NOT", 1 - state);
    });

    // Manueller Takt, solange STOP unten steht.
    // Beim Druecken HIGH am CLK, LOW am negierten CLK.
    // Beim Loslassen genau umgekehrt.
    if (manualClockEnabled()) {
        const pressed = switchStates.button_clk_man === 1 ||
                        switchStates.switch_clk_man === 1;
        drive("clk-out", pressed ? 1 : 0);
        drive("clk-out-not", pressed ? 0 : 1);
    }
    else if (automaticClockEnabled()) {
        drive("clk-out", clockLevel);
        drive("clk-out-not", 1 - clockLevel);
    }

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
        // NE5037N: Daten erst nach abgeschlossener Wandlung und OE=LOW.
        // EOC wird bei OE=LOW quittiert (HIGH); ansonsten LOW bei fertig.
        if (!supplyShort) {
            const adcRead = id => previous.get(root(id)) ?? null;
            const oe = adcRead("adc-oe");
            if (adc5037.ready && oe === 0) {
                adc5037Outputs.forEach((id, bit) => {
                    const key = root(id);
                    if (!drivers.has(key)) drivers.set(key, new Set());
                    drivers.get(key).add((adc5037.value >> bit) & 1);
                });
            }
            const eoc = adc5037.ready && oe !== 0 ? 0 : 1;
            const key = root("adc-EOC");
            if (!drivers.has(key)) drivers.set(key, new Set());
            drivers.get(key).add(eoc);
        }
        // ALU mit den Pegeln der vorherigen Iteration auswerten.
        // Dadurch sind auch vorgeschaltete Logikgatter nutzbar.
        if (!supplyShort) {
            const readAlu = id => previous.get(root(id)) ?? null;
            const result = calculateAlu382(readAlu);
            if (result !== null) {
                const bits = [0, 1, 2, 3].map(i => (result.f >> i) & 1);
                const values = [...bits, result.overflow, result.carry];
                alu382Outputs.forEach((id, index) => {
                    const key = root(id);
                    if (!drivers.has(key)) drivers.set(key, new Set());
                    drivers.get(key).add(values[index]);
                });
            }
        }
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

// ------------------------------------------------------------
// MC14495P: vier Binäreingänge und Latch Enable (E).
// E=LOW: transparent; E=HIGH: zuletzt gültigen Wert halten.
// E offen: Anzeige dunkel (definierte Simulatorregel).
// Nur bei vier definierten Pegeln (LOW/HIGH) wird ein neuer Wert übernommen.
// Die Anzeige bleibt im unveränderten Originalfoto.
// ------------------------------------------------------------
function createSevenSegmentDisplay(indicator) {
    if (!Array.isArray(indicator.inputs) || indicator.inputs.length !== 4) {
        console.warn("Seven-segment configuration incomplete:", indicator.id);
        return;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 160");
    svg.setAttribute("preserveAspectRatio", "none");
    // Anzeige um 30 % verkleinern, Mittelpunkt beibehalten
    svg.style.transform = "scale(0.70)";
    svg.style.transformOrigin = "center center";
    Object.assign(svg.style, {
        position: "absolute", left: (indicator.x * 100) + "%",
        top: (indicator.y * 100) + "%", width: (indicator.width * 100) + "%",
        height: (indicator.height * 100) + "%", pointerEvents: "none", zIndex: "11"
    });
    // Sieben Grundsegmente; die optionale h/i-Segmentdarstellung
    // des MC14495P kann später anhand des Originalfotos ergänzt werden.
    const shapes = {
        a: "M 20 8 L 84 8 L 74 18 L 27 18 Z",
        b: "M 86 12 L 92 20 L 82 72 L 73 79 L 76 66 Z",
        c: "M 81 84 L 87 92 L 77 144 L 67 151 L 70 137 Z",
        d: "M 16 146 L 73 146 L 65 156 L 8 156 Z",
        e: "M 14 84 L 23 92 L 14 142 L 5 150 L 8 137 Z",
        f: "M 24 13 L 32 22 L 23 73 L 13 80 L 16 65 Z",
        g: "M 23 77 L 77 77 L 69 88 L 16 88 Z"
    };
    const paths = {};
    Object.entries(shapes).forEach(([name, d]) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "rgba(255, 255, 255, 0.9)");
        // Leuchtende Segmente etwas breiter darstellen
        path.setAttribute("stroke", "rgba(255, 255, 255, 0.9)");
        path.setAttribute("stroke-width", "5");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("opacity", "0");
        path.style.filter =
            "drop-shadow(0 0 3px #ff2020) " +
            "drop-shadow(0 0 7px #ff0000)";
        svg.appendChild(path);
        paths[name] = path;
    });
    boardArea.appendChild(svg);
    // Standardbuchse E; alternativ explizite ID aus board.json verwenden.
    const latch = indicator.latch || "b7s-E";
    sevenSegmentDisplays.push({ inputs: indicator.inputs, latch, paths, stored: null });
}

// Übliche 7-Segment-Glyphen für 0..F. Das Original verwendet
// bei einigen Hex-Zeichen zusätzlich h/i; das ist ein erster Stand.
const hexSegmentPatterns = [
    "abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc",
    "abcdefg", "abcdfg", "abcefg", "cdefg", "adef", "bcdeg", "adefg", "aefg"
];

function updateSevenSegmentDisplays(signals) {
    sevenSegmentDisplays.forEach(display => {
        if (!signals) {
            // Ohne Versorgung erlischt die Anzeige; gespeicherter Wert wird gelöscht.
            display.stored = null;
        } else {
            const read = id => signals.levels.get(signals.root(id)) ?? null;
            const latch = read(display.latch);

            if (latch === 0) {
                // Transparent: Die Anzeige folgt den vier Binäreingängen.
                const bits = display.inputs.map(read);
                display.stored = bits.every(bit => bit === 0 || bit === 1)
                    ? bits.reduce((number, bit, i) => number | (bit << i), 0)
                    : null;
            } else if (latch === null) {
                // E ist offen/undefiniert: Anzeige dunkel, kein gültiger Latch-Zustand.
                display.stored = null;
            }
            // E=HIGH: Der zuletzt bei E=LOW übernommene Wert bleibt erhalten.
        }

        const lit = display.stored === null ? "" : hexSegmentPatterns[display.stored];
        Object.entries(display.paths).forEach(([name, path]) => {
            path.setAttribute("opacity", lit.includes(name) ? "0.95" : "0");
        });
    });
}

// Einen Simulationsschritt des SN74LS293N auswerten.
// R0(1) und R0(2) gemeinsam HIGH setzen den Zaehler asynchron zurueck.
function updateCounter293(signals) {
    if (!signals) {
        counter293.a = 0;
        counter293.b = 0;
        counter293.prevA = null;
        counter293.prevB = null;
        return;
    }
    const read = id => signals.levels.get(signals.root(id)) ?? null;
    const reset = read("ctr-RO0") === 1 && read("ctr-RO1") === 1;
    if (reset) {
        counter293.a = 0;
        counter293.b = 0;
        // Bei Reset keine Flanke nachholen.
        counter293.prevA = read("ctr-CKA");
        counter293.prevB = read("ctr-CKB");
        return;
    }

    const aClock = read("ctr-CKA");
    const bClock = read("ctr-CKB");
    const fallingA = counter293.prevA === 1 && aClock === 0;
    let fallingB = counter293.prevB === 1 && bClock === 0;
    if (fallingA) {
        const oldA = counter293.a;
        counter293.a ^= 1;
        // QA->CKB ist die uebliche Kaskadierung zum 4-Bit-Zaehler.
        if (oldA === 1 && counter293.a === 0 &&
            signals.root("ctr-QA") === signals.root("ctr-CKB")) {
            fallingB = true;
        }
    }
    if (fallingB) counter293.b = (counter293.b + 1) & 7;
    // Nur definierte Pegel als neue Flankenbasis akzeptieren.
    counter293.prevA = aClock;
    counter293.prevB = signals.root("ctr-QA") === signals.root("ctr-CKB")
        ? counter293.a : bClock;
}

// Analogmodell: nur feste 0-V-/5-V-Quellen. Nicht angeschlossen = ungueltig.
// Bei VREF=5V liegt der Referenzwert ausserhalb des empfohlenen
// Genauigkeitsbereichs (1,5..2,5V), ist aber als Lehrmodell verwendbar.
function adc5037Voltage(signals, id) {
    if (!signals) return null;
    const net = signals.root(id);
    const onVcc = supplyIds("vcc").some(x => signals.root(x) === net);
    const onGnd = supplyIds("gnd").some(x => signals.root(x) === net);
    if (onVcc && !onGnd) return 5;
    if (onGnd && !onVcc) return 0;
    return null;
}
function updateAdc5037(signals) {
    if (!signals) {
        Object.assign(adc5037, {busy:false, ready:false, cycles:0,
            value:0, sample:null, prevStart:null, prevClock:null});
        return;
    }
    const read = id => signals.levels.get(signals.root(id)) ?? null;
    const start = read("adc-st");
    const clock = read("adc-clk");
    // Negative START-Flanke startet die Wandlung. CS wird auf dem
    // Originalboard vorlaeufig als fest aktiv (LOW) angenommen.
    if (adc5037.prevStart === 1 && start === 0) {
        const vin = adc5037Voltage(signals, "adc-I");
        const vref = adc5037Voltage(signals, "adc-I'");
        const gnd = adc5037Voltage(signals, "adc-a-gnd");
        adc5037.sample = vin !== null && vref !== null && vref > 0 && gnd === 0
            ? Math.max(0, Math.min(63, Math.floor(vin / vref * 64))) : null;
        adc5037.busy = true;
        adc5037.ready = false;
        adc5037.cycles = 0;
    }
    if (adc5037.busy && adc5037.prevClock === 1 && clock === 0) {
        adc5037.cycles++;
        if (adc5037.cycles >= 9) {
            adc5037.busy = false;
            if (adc5037.sample !== null) {
                adc5037.value = adc5037.sample;
                adc5037.ready = true;
            }
        }
    }
    if (start === 0 || start === 1) adc5037.prevStart = start;
    if (clock === 0 || clock === 1) adc5037.prevClock = clock;
}

function updateOutputLeds() {
    // Vorherigen Zustand lesen, Taktflanken verarbeiten, dann neue
    // Zaehlerausgaenge fuer LEDs, Gatter und 7-Segment erneut aufloesen.
    const before = powerOn ? resolveSignals() : null;
    updateCounter293(before);
    updateAdc5037(before);
    const signals = powerOn ? resolveSignals() : null;
    updateSevenSegmentDisplays(signals);
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

// SVG uses pixel coordinates without a viewBox. Therefore its stroke width
// must be adjusted explicitly when the board is resized.
function refreshWireWidths() {
    wiringLayer.querySelectorAll("path").forEach(function (path) {
        path.setAttribute("stroke-width", path.getAttribute("data-measure") === "true" ? "1" : String(3 * zoom));
    });
}

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
    refreshWireWidths();
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
