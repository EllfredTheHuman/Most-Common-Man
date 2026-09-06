import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const createGameButton = document.getElementById("createGame");
const backButton = document.getElementById("backButton");
const playerNameInput = document.getElementById("playerName");

const GAME_CODE_LENGTH = 6;
const GAME_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateGameCode() {
    let code = "";

    for (let i = 0; i < GAME_CODE_LENGTH; i++) {
        const randomIndex = Math.floor(
            Math.random() * GAME_CODE_CHARACTERS.length
        );

        code += GAME_CODE_CHARACTERS[randomIndex];
    }

    return code;
}

async function getAvailableGameCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateGameCode();
        const gameRef = doc(db, "games", code);
        const gameSnapshot = await getDoc(gameRef);

        if (!gameSnapshot.exists()) {
            return code;
        }
    }

    throw new Error("Could not generate an available game code.");
}

async function createGame() {
    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        playerNameInput.focus();
        return;
    }

    createGameButton.disabled = true;
    backButton.disabled = true;
    createGameButton.textContent = "CREATING...";

    try {
        // Sign the player in anonymously.
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        // Find an unused game code.
        const gameCode = await getAvailableGameCode();

        const gameRef = doc(db, "games", gameCode);

        // Create the game room.
        await setDoc(gameRef, {
            code: gameCode,
            hostId: user.uid,
            status: "lobby",
            currentRound: 0,
            createdAt: serverTimestamp()
        });

        // Add the host to the players collection.
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

        // Store the player's current game information.
        sessionStorage.setItem("gameCode", gameCode);
        sessionStorage.setItem("playerId", user.uid);
        sessionStorage.setItem("playerName", playerName);

        // Open the game lobby.
        window.location.href = `lobby.html?code=${gameCode}`;

    } catch (error) {
        console.error("Failed to create game:", error);

        alert(
            "We couldn't create the game.\n\n" +
            "Please check your Firebase setup and try again."
        );

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

backButton.addEventListener("click", () => {
    window.location.href = "../index.html";
});
