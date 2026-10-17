const board = document.querySelector(".board");
const boardArea = document.querySelector(".board-area");
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

    if (
        currentWire !== null &&
        event.pointerId === activePointerId
    ) {
        currentWire.setAttribute("x2", pos.x);
        currentWire.setAttribute("y2", pos.y);
    }
});


// ------------------------------------------------------------
// Leitung bzw. Vermessung beginnen
// ------------------------------------------------------------

board.addEventListener("pointerdown", function (event) {
    if (powerOn || currentWire !== null) {
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
        currentWire === null ||
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

            currentWire.setAttribute("x2", end.x);
            currentWire.setAttribute("y2", end.y);

            // Die SVG-Leitung bleibt sichtbar; zusätzlich elektrische
            // Verbindung speichern, damit die LED-Simulation sie auswertet.
            wireConnections.push({ from: startHotspot.id, to: endHotspot.id });
            updateOutputLeds();

            statusMessage.textContent =
                startHotspot.label + " -> " + endHotspot.label;
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
    if (currentWire === null) {
        coordinates.textContent = "X: --   Y: --";
    }
});


// ------------------------------------------------------------
// SVG-Leitung zeichnen
// ------------------------------------------------------------

function drawWire(x1, y1, x2, y2) {
    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);

    line.setAttribute("stroke", "red");
    line.setAttribute("stroke-width", "4");
    line.setAttribute("stroke-linecap", "round");

    wiringLayer.appendChild(line);

    return line;
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
    { a: "ic0-pin10", b: "ic0-pin11", y: "ic0-pin12" },
    { a: "ic0-pin13", b: "ic0-pin14", y: "ic0-pin15" }
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

    switches.forEach(control => {
        if (control.type !== "switch") return;
        const state = switchStates[control.id] === 1 ? 1 : 0;
        drive(control.output, state);
        drive(control.output + "_NOT", 1 - state);
    });

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
        norGatesIC0.forEach(gate => {
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
