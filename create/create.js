import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const playerNameInput = document.getElementById("playerName");
const createGameButton = document.getElementById("createGame");
const backButton = document.getElementById("backButton");
const errorMessage = document.getElementById("errorMessage");

const GAME_CODE_LENGTH = 6;
const GAME_CODE_CHARACTERS =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

function generateGameCode() {
    let code = "";

    for (let i = 0; i < GAME_CODE_LENGTH; i++) {
        const index = Math.floor(
            Math.random() * GAME_CODE_CHARACTERS.length
        );

        code += GAME_CODE_CHARACTERS[index];
    }

    return code;
}

async function getAvailableGameCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateGameCode();

        const gameRef = doc(db, "games", code);
        const snapshot = await getDoc(gameRef);

        if (!snapshot.exists()) {
            return code;
        }
    }

    throw new Error("NO_AVAILABLE_CODE");
}

async function createGame() {
    hideError();

    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        showError("Please enter your name.");
        playerNameInput.focus();
        return;
    }

    createGameButton.disabled = true;
    backButton.disabled = true;
    createGameButton.textContent = "CREATING...";

    try {
        const credentials = auth.currentUser
            ? { user: auth.currentUser }
            : await signInAnonymously(auth);

        const user = credentials.user;

        const gameCode = await getAvailableGameCode();

        const gameRef = doc(db, "games", gameCode);

        await setDoc(gameRef, {
            code: gameCode,
            hostId: user.uid,

            status: "lobby",
            phase: "lobby",

            currentRound: 0,
            currentQuestion: null,

            createdAt: serverTimestamp()
        });

        const playerRef = doc(
            db,
            "games",
            gameCode,
            "players",
            user.uid
        );

        await setDoc(playerRef, {
            id: user.uid,
            name: playerName,
            isHost: true,
            joinedAt: serverTimestamp()
        });

        sessionStorage.setItem("gameCode", gameCode);
        sessionStorage.setItem("playerId", user.uid);
        sessionStorage.setItem("playerName", playerName);

        window.location.href =
            `../lobby/lobby.html?code=${gameCode}`;

    } catch (error) {
        console.error("Failed to create game:", error);

        if (error.message === "NO_AVAILABLE_CODE") {
            showError(
                "We couldn't find an available game code. Please try again."
            );
        } else {
            showError(
                "We couldn't create the game. Please check your Firebase setup."
            );
        }

        createGameButton.disabled = false;
        backButton.disabled = false;
        createGameButton.textContent = "CREATE GAME";
    }
}

createGameButton.addEventListener("click", createGame);

playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        createGame();
    }
});

playerNameInput.addEventListener("input", hideError);

backButton.addEventListener("click", () => {
    window.location.href = "../index.html";
});
