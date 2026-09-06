import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const playerNameInput = document.getElementById("playerName");
const gameCodeInput = document.getElementById("gameCode");
const joinGameButton = document.getElementById("joinGame");
const backButton = document.getElementById("backButton");
const errorMessage = document.getElementById("errorMessage");

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

function getGameCode() {
    return gameCodeInput.value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

async function joinGame() {
    hideError();

    const playerName = playerNameInput.value.trim();
    const gameCode = getGameCode();

    if (!playerName) {
        showError("Please enter your name.");
        playerNameInput.focus();
        return;
    }

    if (gameCode.length !== 6) {
        showError("Game codes are 6 characters long.");
        gameCodeInput.focus();
        return;
    }

    joinGameButton.disabled = true;
    backButton.disabled = true;
    joinGameButton.textContent = "JOINING...";

    try {
        // Sign in anonymously.
        const userCredential = auth.currentUser
            ? { user: auth.currentUser }
            : await signInAnonymously(auth);

        const user = userCredential.user;

        // Check that the game exists.
        const gameRef = doc(db, "games", gameCode);
        const gameSnapshot = await getDoc(gameRef);

        if (!gameSnapshot.exists()) {
            throw new Error("GAME_NOT_FOUND");
        }

        const game = gameSnapshot.data();

        // Only allow players into a waiting lobby.
        if (game.status !== "lobby") {
            throw new Error("GAME_ALREADY_STARTED");
        }

        // Check the current player count.
        // This is a client-side check for a better user experience.
        // Firestore security rules should enforce the actual limit.
        const playersSnapshot = await getDoc(
            doc(db, "games", gameCode, "players", user.uid)
        );

        if (!playersSnapshot.exists()) {
            // We only need to create the player if they aren't already in the room.
            await setDoc(
                doc(db, "games", gameCode, "players", user.uid),
                {
                    id: user.uid,
                    name: playerName,
                    isHost: false,
                    joinedAt: serverTimestamp()
                }
            );
        }

        // Save the player's session.
        sessionStorage.setItem("gameCode", gameCode);
        sessionStorage.setItem("playerId", user.uid);
        sessionStorage.setItem("playerName", playerName);

        // Enter the lobby.
        window.location.href = `../lobby/lobby.html?code=${gameCode}`;

    } catch (error) {
        console.error("Failed to join game:", error);

        let message = "Something went wrong. Please try again.";

        if (error.message === "GAME_NOT_FOUND") {
            message = "That game doesn't exist.";
        } else if (error.message === "GAME_ALREADY_STARTED") {
            message = "That game has already started.";
        }

        showError(message);

        joinGameButton.disabled = false;
        backButton.disabled = false;
        joinGameButton.textContent = "JOIN GAME";
    }
}

joinGameButton.addEventListener("click", joinGame);

gameCodeInput.addEventListener("input", () => {
    gameCodeInput.value = gameCodeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);

    hideError();
});

playerNameInput.addEventListener("input", hideError);

playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        joinGame();
    }
});

gameCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        joinGame();
    }
});

backButton.addEventListener("click", () => {
    window.location.href = "../index.html";
});
