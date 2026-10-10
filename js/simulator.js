
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
let boardLoaded = false;


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
        return (
            x >= hotspot.x &&
            x <= hotspot.x + hotspot.width &&
            y >= hotspot.y &&
            y <= hotspot.y + hotspot.height
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
                    `x: ${x.toFixed(4)}, y: ${y.toFixed(4)}, ` +
                    `width: ${width.toFixed(4)}, height: ${height.toFixed(4)}`;
            } else {
                // Einfacher Klick: 2%-Hotspot
                const cx = pos.x / pos.width;
                const cy = pos.y / pos.height;
                const size = 0.02;

                statusMessage.textContent =
                    `x: ${(cx - size / 2).toFixed(4)}, ` +
                    `y: ${(cy - size / 2).toFixed(4)}, ` +
                    `width: ${size.toFixed(4)}, height: ${size.toFixed(4)}`;
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
        boardLoaded = true;

        hotspots.forEach(function (hotspot) {
            const marker = document.createElement("div");

            marker.title = hotspot.label;

            Object.assign(marker.style, {
                position: "absolute",
                left: (hotspot.x * 100) + "%",
                top: (hotspot.y * 100) + "%",
                width: (hotspot.width * 100) + "%",
                height: (hotspot.height * 100) + "%",
                boxSizing: "border-box",
                border: "2px solid lime",
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
