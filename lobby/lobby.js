const createGameButton = document.getElementById("createGame");
const backButton = document.getElementById("backButton");
const playerNameInput = document.getElementById("playerName");

createGameButton.addEventListener("click", () => {
    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        playerNameInput.focus();
        return;
    }

    console.log("Creating game for:", playerName);

    // Multiplayer functionality will be added here.
});

backButton.addEventListener("click", () => {
    window.location.href = "../index.html";
});
