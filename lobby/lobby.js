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

const gameCodeElement = document.getElementById("gameCode");
const playerCountElement = document.getElementById("playerCount");
const playersListElement = document.getElementById("playersList");

const startGameButton = document.getElementById("startGame");
const leaveGameButton = document.getElementById("leaveGame");
const loadingElement = document.getElementById("loading");

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("code");

let currentUser = null;
let gameData = null;
let unsubscribePlayers = null;
let unsubscribeGame = null;

function showLoading() {
    loadingElement.classList.remove("hidden");
}

function hideLoading() {
    loadingElement.classList.add("hidden");
}

function showError(message) {
    hideLoading();

    alert(message);

    window.location.href = "../index.html";
}

async function initialiseLobby() {
    if (!gameCode) {
        showError("No game code was provided.");
        return;
    }

    try {
        showLoading();

        /*
         * Sign in anonymously if there isn't already
         * an authenticated Firebase user.
         */
        if (auth.currentUser) {
            currentUser = auth.currentUser;
        } else {
            const credentials = await signInAnonymously(auth);
            currentUser = credentials.user;
        }

        const gameRef = doc(db, "games", gameCode);
        const gameSnapshot = await getDoc(gameRef);

        if (!gameSnapshot.exists()) {
            showError("That game doesn't exist.");
            return;
        }

        gameData = gameSnapshot.data();

        /*
         * Make sure the game is still in the lobby.
         */
        if (gameData.status !== "lobby") {
            showError("This game has already started.");
            return;
        }

        /*
         * Display the game code.
         */
        gameCodeElement.textContent = gameCode;

        /*
         * Listen for game changes.
         */
        unsubscribeGame = onSnapshot(
            gameRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    showError("The game has been closed.");
                    return;
                }

                gameData = snapshot.data();

                if (gameData.status === "playing") {
                    window.location.href = `../game/game.html?code=${gameCode}`;
                    return;
                }

                if (gameData.status === "finished") {
                    window.location.href = `../index.html`;
                }

                updateStartButton();
            },
            (error) => {
                console.error("Game listener error:", error);
            }
        );

        /*
         * Listen for players joining and leaving.
         */
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
                console.error("Player listener error:", error);
                hideLoading();
            }
        );

    } catch (error) {
        console.error("Failed to initialise lobby:", error);

        showError(
            "We couldn't connect to the game.\n\n" +
            "Please check your Firebase configuration."
        );
    }
}

function renderPlayers(snapshot) {
    const players = [];

    snapshot.forEach((playerSnapshot) => {
        players.push({
            id: playerSnapshot.id,
            ...playerSnapshot.data()
        });
    });

    playerCountElement.textContent = `${players.length} / 8`;

    playersListElement.innerHTML = "";

    players.forEach((player) => {
        const playerElement = document.createElement("div");

        playerElement.className = "player";

        const nameElement = document.createElement("span");

        nameElement.className = "player-name";
        nameElement.textContent = player.name;

        playerElement.appendChild(nameElement);

        if (player.isHost) {
            const hostBadge = document.createElement("span");

            hostBadge.className = "host-badge";
            hostBadge.textContent = "HOST";

            playerElement.appendChild(hostBadge);
        }

        playersListElement.appendChild(playerElement);
    });

    updateStartButton(players.length);
}

function updateStartButton(playerCount) {
    if (!gameData || !currentUser) {
        startGameButton.disabled = true;
        return;
    }

    const isHost = gameData.hostId === currentUser.uid;

    /*
     * At least two players are required.
     */
    const enoughPlayers =
        typeof playerCount === "number"
            ? playerCount >= 2
            : false;

    startGameButton.disabled = !isHost || !enoughPlayers;

    if (!isHost) {
        startGameButton.textContent = "WAITING FOR HOST";
    } else if (!enoughPlayers) {
        startGameButton.textContent = "NEED 2 PLAYERS";
    } else {
        startGameButton.textContent = "START GAME";
    }
}

async function startGame() {
    if (!currentUser || !gameData) {
        return;
    }

    if (gameData.hostId !== currentUser.uid) {
        return;
    }

    try {
        startGameButton.disabled = true;
        startGameButton.textContent = "STARTING...";

        const gameRef = doc(db, "games", gameCode);

        await updateDoc(gameRef, {
            status: "playing",
            currentRound: 1
        });

    } catch (error) {
        console.error("Failed to start game:", error);

        alert("Couldn't start the game.");

        startGameButton.disabled = false;
        startGameButton.textContent = "START GAME";
    }
}

async function leaveGame() {
    if (!currentUser || !gameCode) {
        window.location.href = "../index.html";
        return;
    }

    try {
        const playerRef = doc(
            db,
            "games",
            gameCode,
            "players",
            currentUser.uid
        );

        await deleteDoc(playerRef);

    } catch (error) {
        console.error("Failed to leave game:", error);
    }

    cleanup();

    sessionStorage.removeItem("gameCode");
    sessionStorage.removeItem("playerId");
    sessionStorage.removeItem("playerName");

    window.location.href = "../index.html";
}

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

startGameButton.addEventListener("click", startGame);
leaveGameButton.addEventListener("click", leaveGame);

window.addEventListener("beforeunload", cleanup);

initialiseLobby();
