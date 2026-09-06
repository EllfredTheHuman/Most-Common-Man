```javascript
import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    collection,
    onSnapshot,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ==================================================
// ELEMENTS
// ==================================================

const gameCodeElement = document.getElementById("gameCode");
const playerCountElement = document.getElementById("playerCount");
const playersListElement = document.getElementById("playersList");

const startGameButton = document.getElementById("startGame");
const leaveGameButton = document.getElementById("leaveGame");
const loadingElement = document.getElementById("loading");


// ==================================================
// GAME CODE
// ==================================================

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("code");


// ==================================================
// STATE
// ==================================================

let currentUser = null;
let gameData = null;

let unsubscribePlayers = null;
let unsubscribeGame = null;


// ==================================================
// UI
// ==================================================

function showLoading() {
    if (loadingElement) {
        loadingElement.classList.remove("hidden");
    }
}


function hideLoading() {
    if (loadingElement) {
        loadingElement.classList.add("hidden");
    }
}


function showError(message) {
    console.error(message);

    hideLoading();

    alert(message);

    cleanup();

    window.location.href = "../index.html";
}


// ==================================================
// INITIALISE
// ==================================================

async function initialiseLobby() {
    if (!gameCode) {
        showError("No game code was provided.");
        return;
    }

    try {
        showLoading();

        // ------------------------------------------
        // AUTHENTICATION
        // ------------------------------------------

        if (auth.currentUser) {
            currentUser = auth.currentUser;
        } else {
            const credentials = await signInAnonymously(auth);
            currentUser = credentials.user;
        }


        // ------------------------------------------
        // GAME
        // ------------------------------------------

        const gameRef = doc(
            db,
            "games",
            gameCode
        );

        const gameSnapshot = await getDoc(gameRef);

        if (!gameSnapshot.exists()) {
            showError("That game doesn't exist.");
            return;
        }

        gameData = gameSnapshot.data();


        // ------------------------------------------
        // GAME STATUS
        // ------------------------------------------

        if (
            gameData.status !== "lobby" &&
            gameData.status !== "playing"
        ) {
            showError("This game is no longer available.");
            return;
        }


        // ------------------------------------------
        // DISPLAY CODE
        // ------------------------------------------

        if (gameCodeElement) {
            gameCodeElement.textContent = gameCode;
        }


        // ------------------------------------------
        // GAME LISTENER
        // ------------------------------------------

        unsubscribeGame = onSnapshot(
            gameRef,
            (snapshot) => {

                if (!snapshot.exists()) {
                    showError("The game has been closed.");
                    return;
                }

                gameData = snapshot.data();


                // Game has started.
                if (gameData.status === "playing") {
                    window.location.href =
                        `../game/game.html?code=${encodeURIComponent(gameCode)}`;

                    return;
                }


                // Game was finished/closed.
                if (gameData.status === "finished") {
                    cleanup();

                    window.location.href = "../index.html";

                    return;
                }


                updateStartButton();
            },

            (error) => {
                console.error(
                    "Game listener error:",
                    error
                );
            }
        );


        // ------------------------------------------
        // PLAYERS LISTENER
        // ------------------------------------------

        const playersRef = collection(
            db,
            "games",
            gameCode,
            "players"
        );

        const playersQuery = query(
            playersRef,
            orderBy("joinedAt", "asc")
        );


        unsubscribePlayers = onSnapshot(
            playersQuery,

            (snapshot) => {

                renderPlayers(snapshot);

                hideLoading();
            },

            (error) => {

                console.error(
                    "Player listener error:",
                    error
                );

                hideLoading();

                alert(
                    "We couldn't load the players.\n\n" +
                    "Please check your Firestore rules."
                );
            }
        );

    } catch (error) {

        console.error(
            "Failed to initialise lobby:",
            error
        );

        showError(
            "We couldn't connect to the game.\n\n" +
            "Please check your Firebase configuration."
        );
    }
}


// ==================================================
// RENDER PLAYERS
// ==================================================

function renderPlayers(snapshot) {

    const players = [];

    snapshot.forEach((playerSnapshot) => {

        players.push({
            id: playerSnapshot.id,
            ...playerSnapshot.data()
        });

    });


    // ------------------------------------------
    // PLAYER COUNT
    // ------------------------------------------

    if (playerCountElement) {
        playerCountElement.textContent =
            `${players.length} / 8`;
    }


    // ------------------------------------------
    // CLEAR LIST
    // ------------------------------------------

    if (!playersListElement) {
        return;
    }

    playersListElement.innerHTML = "";


    // ------------------------------------------
    // RENDER
    // ------------------------------------------

    players.forEach((player) => {

        const playerElement =
            document.createElement("div");

        playerElement.className = "player";


        const nameElement =
            document.createElement("span");

        nameElement.className = "player-name";

        nameElement.textContent =
            player.name || "Player";


        playerElement.appendChild(nameElement);


        // Host badge
        if (player.isHost) {

            const hostBadge =
                document.createElement("span");

            hostBadge.className = "host-badge";

            hostBadge.textContent = "HOST";

            playerElement.appendChild(hostBadge);
        }


        playersListElement.appendChild(
            playerElement
        );
    });


    updateStartButton(players.length);
}


// ==================================================
// START BUTTON
// ==================================================

function updateStartButton(playerCount = null) {

    if (!startGameButton) {
        return;
    }


    // We don't know enough yet.
    if (!gameData || !currentUser) {

        startGameButton.disabled = true;

        return;
    }


    const isHost =
        gameData.hostId === currentUser.uid;


    /*
     * If a player count wasn't supplied,
     * leave the button disabled until the
     * players listener provides it.
     */
    if (playerCount === null) {

        startGameButton.disabled = true;

        if (isHost) {
            startGameButton.textContent =
                "LOADING PLAYERS";
        } else {
            startGameButton.textContent =
                "WAITING FOR HOST";
        }

        return;
    }


    const enoughPlayers =
        playerCount >= 2;


    // ------------------------------------------
    // NON-HOST
    // ------------------------------------------

    if (!isHost) {

        startGameButton.disabled = true;

        startGameButton.textContent =
            "WAITING FOR HOST";

        return;
    }


    // ------------------------------------------
    // HOST
    // ------------------------------------------

    if (!enoughPlayers) {

        startGameButton.disabled = true;

        startGameButton.textContent =
            "NEED 2 PLAYERS";

        return;
    }


    startGameButton.disabled = false;

    startGameButton.textContent =
        "START GAME";
}


// ==================================================
// START GAME
// ==================================================

async function startGame() {

    if (!currentUser || !gameData) {
        return;
    }


    // Only host can start.
    if (gameData.hostId !== currentUser.uid) {

        alert("Only the host can start the game.");

        return;
    }


    try {

        startGameButton.disabled = true;

        startGameButton.textContent =
            "STARTING...";


        const gameRef =
            doc(
                db,
                "games",
                gameCode
            );


        await updateDoc(
            gameRef,
            {
                status: "playing",
                currentRound: 1
            }
        );


    } catch (error) {

        console.error(
            "Failed to start game:",
            error
        );


        alert(
            "Couldn't start the game.\n\n" +
            error.message
        );


        startGameButton.disabled = false;

        startGameButton.textContent =
            "START GAME";
    }
}


// ==================================================
// LEAVE GAME
// ==================================================

async function leaveGame() {

    if (!currentUser || !gameCode) {

        window.location.href =
            "../index.html";

        return;
    }


    try {

        const playerRef =
            doc(
                db,
                "games",
                gameCode,
                "players",
                currentUser.uid
            );


        await deleteDoc(playerRef);

    } catch (error) {

        console.error(
            "Failed to leave game:",
            error
        );
    }


    cleanup();


    sessionStorage.removeItem(
        "gameCode"
    );

    sessionStorage.removeItem(
        "playerId"
    );

    sessionStorage.removeItem(
        "playerName"
    );


    window.location.href =
        "../index.html";
}


// ==================================================
// CLEANUP
// ==================================================

function cleanup() {

    if (unsubscribePlayers) {

        unsubscribePlayers();

        unsubscribePlayers = null;
    }


    if (unsubscribeGame) {

        unsubscribeGame();

        unsubscribeGame = null;
    }
}


// ==================================================
// EVENTS
// ==================================================

if (startGameButton) {

    startGameButton.addEventListener(
        "click",
        startGame
    );
}


if (leaveGameButton) {

    leaveGameButton.addEventListener(
        "click",
        leaveGame
    );
}


window.addEventListener(
    "beforeunload",
    cleanup
);


// ==================================================
// START
// ==================================================

initialiseLobby();
```
