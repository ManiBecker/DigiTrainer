const board = document.querySelector(".board");
const coordinates = document.querySelector(".coordinates");

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
