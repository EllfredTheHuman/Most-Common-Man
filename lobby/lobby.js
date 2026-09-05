/* =================================
   MOST COMMON MAN
   Lobby Logic
================================= */


/* ================================
   GAME STATE
================================ */

const urlParams = new URLSearchParams(window.location.search);

const isHost = urlParams.get("host") === "true";

let playerName = "";
let gameCode = "";

let players = [];


/* ================================
   ELEMENTS
================================ */

const nameSection = document.getElementById("nameSection");
const lobbyContent = document.getElementById("lobbyContent");

const playerNameInput = document.getElementById("playerName");

const gameCodeElement = document.getElementById("gameCode");
const playerCountElement = document.getElementById("playerCount");
const playersListElement = document.getElementById("playersList");

const hostSettings = document.getElementById("hostSettings");
const startButton = document.getElementById("startButton");

const modifierSelect = document.getElementById("modifierSelect");


/* ================================
   CREATE GAME CODE
================================ */

function generateGameCode() {

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        const randomIndex = Math.floor(
            Math.random() * characters.length
        );

        code += characters[randomIndex];

    }

    return code;
}


/* ================================
   JOIN LOBBY
================================ */

function joinLobby() {

    const enteredName = playerNameInput.value.trim();

    if (enteredName.length === 0) {

        playerNameInput.focus();

        playerNameInput.classList.add("input-error");

        setTimeout(() => {
            playerNameInput.classList.remove("input-error");
        }, 500);

        return;
    }


    playerName = enteredName;


    /* Generate a room code for the prototype */

    if (isHost) {

        gameCode = generateGameCode();

    } else {

        /*
            Temporary prototype code.

            Later this will come from
            the multiplayer server.
        */

        gameCode = "ABC123";

    }


    gameCodeElement.textContent = gameCode;


    /* Add ourselves to the player list */

    players = [
        {
            name: playerName,
            host: isHost
        }
    ];


    /* Show lobby */

    nameSection.classList.add("hidden");

    lobbyContent.classList.remove("hidden");


    /* Show host settings */

    if (isHost) {

        hostSettings.classList.remove("hidden");

    }


    updatePlayerList();


    /*
        A real multiplayer system will eventually
        listen for players joining here.
    */

}


/* ================================
   UPDATE PLAYER LIST
================================ */

function updatePlayerList() {

    playersListElement.innerHTML = "";


    players.forEach((player) => {

        const playerCard = document.createElement("div");

        playerCard.className = "player-card";


        if (player.host) {
            playerCard.classList.add("host");
        }


        const name = document.createElement("span");

        name.className = "player-card-name";

        name.textContent = player.name;


        playerCard.appendChild(name);


        if (player.host) {

            const hostLabel = document.createElement("span");

            hostLabel.className = "host-label";

            hostLabel.textContent = "HOST";

            playerCard.appendChild(hostLabel);

        }


        playersListElement.appendChild(playerCard);

    });


    playerCountElement.textContent =
        `${players.length}/8`;


    /*
        For now the host can start with just themselves.

        Later we can require a minimum number of players.
    */

    if (isHost && players.length >= 1) {

        startButton.disabled = false;

    } else {

        startButton.disabled = true;

    }

}


/* ================================
   COPY GAME CODE
================================ */

function copyGameCode() {

    if (!gameCode) {
        return;
    }


    navigator.clipboard.writeText(gameCode)
        .then(() => {

            const button =
                document.querySelector(".copy-code");

            const originalText =
                button.textContent;


            button.textContent = "COPIED!";


            setTimeout(() => {

                button.textContent = originalText;

            }, 1200);

        })
        .catch(() => {

            /*
                Fallback for browsers that block
                clipboard access.
            */

            const temporaryInput =
                document.createElement("input");

            temporaryInput.value = gameCode;

            document.body.appendChild(temporaryInput);

            temporaryInput.select();

            document.execCommand("copy");

            temporaryInput.remove();


            const button =
                document.querySelector(".copy-code");

            const originalText =
                button.textContent;


            button.textContent = "COPIED!";


            setTimeout(() => {

                button.textContent = originalText;

            }, 1200);

        });

}


/* ================================
   START GAME
================================ */

function startGame() {

    if (!isHost) {
        return;
    }


    if (players.length < 1) {
        return;
    }


    const modifier =
        modifierSelect.value;


    /*
        Save the game settings temporarily.

        When we add multiplayer, these will be
        stored on the server instead.
    */

    const gameSettings = {

        gameCode: gameCode,

        modifier: modifier,

        players: players

    };


    localStorage.setItem(
        "mostCommonManGame",
        JSON.stringify(gameSettings)
    );


    window.location.href =
        "../game/game.html";

}


/* ================================
   LEAVE LOBBY
================================ */

function leaveLobby() {

    const confirmed =
        confirm("Leave this game?");


    if (!confirmed) {
        return;
    }


    window.location.href = "../index.html";

}


/* ================================
   ENTER KEY
================================ */

playerNameInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            joinLobby();

        }

    }
);


/* ================================
   INPUT CLEANUP
================================ */

playerNameInput.addEventListener(
    "input",
    function () {

        /*
            Remove accidental leading spaces.
        */

        if (this.value.startsWith(" ")) {

            this.value =
                this.value.trimStart();

        }

    }
);
