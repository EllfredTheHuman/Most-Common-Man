const createGameButton = document.getElementById("createGame");
const joinGameButton = document.getElementById("joinGame");
const howToPlayButton = document.getElementById("howToPlay");

const howToPlayModal = document.getElementById("howToPlayModal");
const closeModalButton = document.getElementById("closeModal");


// HOW TO PLAY

howToPlayButton.addEventListener("click", () => {
    howToPlayModal.classList.remove("hidden");
});

closeModalButton.addEventListener("click", () => {
    howToPlayModal.classList.add("hidden");
});

howToPlayModal.addEventListener("click", (event) => {
    if (event.target === howToPlayModal) {
        howToPlayModal.classList.add("hidden");
    }
});


// KEYBOARD

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        howToPlayModal.classList.add("hidden");
    }
});


// CREATE GAME

createGameButton.addEventListener("click", () => {
    window.location.href = "create/create.html";
});


// JOIN GAME

joinGameButton.addEventListener("click", () => {
    window.location.href = "join/join.html";
});
