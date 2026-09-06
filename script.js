const createGameButton = document.getElementById("createGame");
const joinGameButton = document.getElementById("joinGame");
const howToPlayButton = document.getElementById("howToPlay");

const howToPlayModal = document.getElementById("howToPlayModal");
const closeModalButton = document.getElementById("closeModal");

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

createGameButton.addEventListener("click", () => {
    console.log("Create Game clicked");
});

joinGameButton.addEventListener("click", () => {
    console.log("Join Game clicked");
});
