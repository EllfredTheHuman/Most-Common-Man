```javascript
import { auth, db, signInAnonymously } from "../firebase.js";

import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const createGameButton = document.getElementById("createGame");
const backButton = document.getElementById("backButton");
const playerNameInput = document.getElementById("playerName");

function generateGameCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return code;
}

async function createGame() {
    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        playerNameInput.focus();
        return;
    }

    createGameButton.disabled = true;
    createGameButton.textContent = "CREATING...";

    try {
        // Sign the player in anonymously.
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        const gameCode = generateGameCode();

        // Create the game room.
        await setDoc(doc(collection(db, "games"), gameCode), {
            code: gameCode,
            hostId: user.uid,
            status: "lobby",
            createdAt: serverTimestamp(),
            currentRound: 0
        });

        // Add the host as the first player.
        await setDoc(
            doc(db, "games", gameCode, "players", user.uid),
            {
                id: user.uid,
                name: playerName,
                isHost: true,
                joinedAt: serverTimestamp()
            }
        );

        // Save information for the next page.
        sessionStorage.setItem("gameCode", gameCode);
        sessionStorage.setItem("playerId", user.uid);
        sessionStorage.setItem("playerName", playerName);

        // Go to the lobby.
        window.location.href = `lobby.html?code=${gameCode}`;

    } catch (error) {
        console.error("Failed to create game:", error);

        alert(
            "Something went wrong while creating the game.\n\n" +
            "Check your Firebase configuration and try again."
        );

        createGameButton.disabled = false;
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
```
