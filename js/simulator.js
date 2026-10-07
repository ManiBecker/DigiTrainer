const board = document.querySelector(".board");
const coordinates = document.querySelector(".coordinates");
const statusMessage = document.querySelector(".status-message");
const wiringLayer = document.querySelector(".wiring-layer");

let currentWire = null;
let activePointerId = null;


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
// Pointer bewegen
// ------------------------------------------------------------

board.addEventListener("pointermove", function (event) {
    const pos = getBoardPosition(event);

    const insideBoard =
        pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x <= pos.width &&
        pos.y <= pos.height;

    // Koordinaten anzeigen
    if (insideBoard) {
        const x = pos.x / pos.width;
        const y = pos.y / pos.height;

        coordinates.textContent =
            `X: ${(x * 100).toFixed(2)} %   Y: ${(y * 100).toFixed(2)} %`;
    } else {
        coordinates.textContent = "X: --   Y: --";
    }

    // Wird gerade eine Leitung gezogen?
    if (
        currentWire !== null &&
        event.pointerId === activePointerId
    ) {
        currentWire.setAttribute("x2", pos.x);
        currentWire.setAttribute("y2", pos.y);
    }
});


// ------------------------------------------------------------
// Leitung beginnen
// ------------------------------------------------------------

board.addEventListener("pointerdown", function (event) {

    // Bei einer Maus nur die linke Taste verwenden
    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    const pos = getBoardPosition(event);

    activePointerId = event.pointerId;

    // Pointer auch außerhalb des Boards weiter verfolgen
    board.setPointerCapture(event.pointerId);

    currentWire = drawWire(
        pos.x,
        pos.y,
        pos.x,
        pos.y
    );

    statusMessage.textContent = "Routing cable...";
});


// ------------------------------------------------------------
// Leitung beenden
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

    if (insideBoard) {
        // Leitung endgültig ablegen
        currentWire.setAttribute("x2", pos.x);
        currentWire.setAttribute("y2", pos.y);
    } else {
        // Außerhalb losgelassen:
        // Leitung wieder entfernen
        currentWire.remove();
    }

    if (board.hasPointerCapture(event.pointerId)) {
        board.releasePointerCapture(event.pointerId);
    }

    currentWire = null;
    activePointerId = null;

    statusMessage.textContent = "Ready";
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
