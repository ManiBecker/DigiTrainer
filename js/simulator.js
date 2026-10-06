const board = document.querySelector(".board");
const coordinates = document.querySelector(".coordinates");
const statusMessage = document.querySelector(".status-message");
const wiringLayer = document.querySelector(".wiring-layer");

let startPoint = null;

board.addEventListener("mousemove", function (event) {
    const rect = board.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    coordinates.textContent =
        `X: ${(x * 100).toFixed(2)} %   Y: ${(y * 100).toFixed(2)} %`;
});

board.addEventListener("mouseleave", function () {
    coordinates.textContent = "X: --   Y: --";
});

board.addEventListener("click", function (event) {
    const rect = board.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (startPoint === null) {
        startPoint = { x, y };

        statusMessage.textContent = "Select cable end";
    } else {
        drawWire(startPoint.x, startPoint.y, x, y);

        startPoint = null;

        statusMessage.textContent = "Ready";
    }
});

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
}
