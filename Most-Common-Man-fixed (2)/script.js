const createGameButton = document.getElementById("createGameButton");
const joinGameButton = document.getElementById("joinGameButton");
const howToPlayButton = document.getElementById("howToPlayButton");

const howToPlayModal = document.getElementById("howToPlayModal");
const joinGameModal = document.getElementById("joinGameModal");

const closeHowToPlayButton = document.getElementById("closeHowToPlay");
const gotItButton = document.getElementById("gotItButton");

const closeJoinGameButton = document.getElementById("closeJoinGame");
const cancelJoinButton = document.getElementById("cancelJoinButton");
const confirmJoinButton = document.getElementById("confirmJoinButton");

const gameCodeInput = document.getElementById("gameCodeInput");
const joinError = document.getElementById("joinError");


function openModal(modal) {
    if (!modal) {
        return;
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}


function closeModal(modal) {
    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
}


function createGame() {
    window.location.href = "lobby/lobby.html?host=true";
}


function openJoinGame() {
    gameCodeInput.value = "";
    joinError.textContent = "";

    openModal(joinGameModal);

    setTimeout(function () {
        gameCodeInput.focus();
    }, 100);
}


function joinGame() {
    const code = gameCodeInput.value
        .trim()
        .toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
        joinError.textContent =
            "Enter a 6-character game code.";

        gameCodeInput.classList.remove("input-error");

        void gameCodeInput.offsetWidth;

        gameCodeInput.classList.add("input-error");

        gameCodeInput.focus();

        return;
    }

    window.location.href =
        "lobby/lobby.html?room=" +
        encodeURIComponent(code);
}


function showHowToPlay() {
    openModal(howToPlayModal);
}


if (createGameButton) {
    createGameButton.addEventListener(
        "click",
        createGame
    );
}


if (joinGameButton) {
    joinGameButton.addEventListener(
        "click",
        openJoinGame
    );
}


if (howToPlayButton) {
    howToPlayButton.addEventListener(
        "click",
        showHowToPlay
    );
}


closeHowToPlayButton.addEventListener(
    "click",
    function () {
        closeModal(howToPlayModal);
    }
);


gotItButton.addEventListener(
    "click",
    function () {
        closeModal(howToPlayModal);
    }
);


closeJoinGameButton.addEventListener(
    "click",
    function () {
        closeModal(joinGameModal);
    }
);


cancelJoinButton.addEventListener(
    "click",
    function () {
        closeModal(joinGameModal);
    }
);


confirmJoinButton.addEventListener(
    "click",
    joinGame
);


gameCodeInput.addEventListener(
    "input",
    function () {
        gameCodeInput.value =
            gameCodeInput.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 6)
                .toUpperCase();

        joinError.textContent = "";
    }
);


gameCodeInput.addEventListener(
    "keydown",
    function (event) {
        if (event.key === "Enter") {
            joinGame();
        }
    }
);


howToPlayModal.addEventListener(
    "click",
    function (event) {
        if (event.target === howToPlayModal) {
            closeModal(howToPlayModal);
        }
    }
);


joinGameModal.addEventListener(
    "click",
    function (event) {
        if (event.target === joinGameModal) {
            closeModal(joinGameModal);
        }
    }
);


document.addEventListener(
    "keydown",
    function (event) {
        if (event.key !== "Escape") {
            return;
        }

        closeModal(howToPlayModal);
        closeModal(joinGameModal);
    }
);
