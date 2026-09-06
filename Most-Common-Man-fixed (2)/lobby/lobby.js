import { db, loginAnonymously } from "../firebase.js";

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const isHost = params.get("host") === "true";
const requestedCode = (params.get("code") || "").trim().toUpperCase();

let currentUser = null;
let currentRoomCode = null;
let currentPlayerName = "";
let isLeaving = false;

let unsubscribePlayers = null;
let unsubscribeRoom = null;

const nameSection = document.getElementById("nameSection");
const lobbyContent = document.getElementById("lobbyContent");
const playerNameInput = document.getElementById("playerName");
const joinLobbyButton = document.getElementById("joinLobbyButton");
const gameCodeElement = document.getElementById("gameCode");
const copyCodeButton = document.getElementById("copyCodeButton");
const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");
const hostSettings = document.getElementById("hostSettings");
const modifierSelect = document.getElementById("modifierSelect");
const startButton = document.getElementById("startButton");
const leaveButton = document.getElementById("leaveButton");
const lobbyMessage = document.getElementById("lobbyMessage");

function setMessage(text, error) {
    if (!lobbyMessage) {
        return;
    }

    lobbyMessage.textContent = text || "";
    lobbyMessage.classList.toggle("error-message", !!error);
}

async function initialise() {
    try {
        currentUser = await loginAnonymously();

        if (requestedCode) {
            setMessage("Game code ready. Enter your name to join.");
            playerNameInput.value = "";
        }

        playerNameInput.focus();
    } catch (error) {
        console.error("FIREBASE ERROR:", error);
        setMessage("Could not connect to the game. Refresh and try again.", true);
        joinLobbyButton.disabled = true;
    }
}

async function handleJoinButton() {
    const name = playerNameInput.value.trim();

    if (!name) {
        showInputError();
        setMessage("You need a name first.", true);
        return;
    }

    if (!currentUser) {
        setMessage("Still connecting to Firebase...", true);
        return;
    }

    currentPlayerName = name;
    joinLobbyButton.disabled = true;
    joinLobbyButton.textContent = "CONNECTING...";
    setMessage("Connecting...");

    try {
        if (isHost) {
            await createGame();
        } else if (requestedCode) {
            await joinExistingGame(requestedCode);
        } else {
            setMessage("No game code was provided.", true);
            resetJoinButton();
        }
    } catch (error) {
        console.error("LOBBY ERROR:", error);
        setMessage(error.message || "Something went wrong.", true);
        resetJoinButton();
    }
}

function showInputError() {
    playerNameInput.classList.remove("input-error");
    void playerNameInput.offsetWidth;
    playerNameInput.classList.add("input-error");
    setTimeout(function () {
        playerNameInput.classList.remove("input-error");
    }, 350);
    playerNameInput.focus();
}

async function createGame() {
    let roomCode = "";
    let roomRef = null;

    for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = generateRoomCode();
        const candidateRef = doc(db, "rooms", candidate);
        const existing = await getDoc(candidateRef);

        if (!existing.exists()) {
            roomCode = candidate;
            roomRef = candidateRef;
            break;
        }
    }

    if (!roomRef) {
        throw new Error("Could not create a game code. Try again.");
    }

    await setDoc(roomRef, {
        hostId: currentUser.uid,
        status: "lobby",
        modifier: "none",
        currentRound: 0,
        usedPrompts: [],
        createdAt: serverTimestamp()
    });

    await setDoc(
        doc(db, "rooms", roomCode, "players", currentUser.uid),
        {
            name: currentPlayerName,
            isHost: true,
            score: 0,
            joinedAt: serverTimestamp()
        }
    );

    currentRoomCode = roomCode;
    showLobby();
    startListeners();
}

async function joinExistingGame(roomCode) {
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        throw new Error("Game codes are 6 characters long.");
    }

    const roomSnapshot = await getDoc(doc(db, "rooms", roomCode));

    if (!roomSnapshot.exists()) {
        throw new Error("That game does not exist. Check the code and try again.");
    }

    const room = roomSnapshot.data();

    if (room.status !== "lobby") {
        throw new Error("That game has already started.");
    }

    const playersSnapshot = await getDocs(
        collection(db, "rooms", roomCode, "players")
    );

    const existingPlayer = playersSnapshot.docs.find(function (item) {
        return item.id === currentUser.uid;
    });

    if (!existingPlayer && playersSnapshot.size >= 8) {
        throw new Error("That game is full!");
    }

    await setDoc(
        doc(db, "rooms", roomCode, "players", currentUser.uid),
        {
            name: currentPlayerName,
            isHost: false,
            score: 0,
            joinedAt: existingPlayer && existingPlayer.data().joinedAt
                ? existingPlayer.data().joinedAt
                : serverTimestamp()
        }
    );

    currentRoomCode = roomCode;
    showLobby();
    startListeners();
}

function showLobby() {
    nameSection.classList.add("hidden");
    lobbyContent.classList.remove("hidden");
    gameCodeElement.textContent = currentRoomCode;
    hostSettings.classList.toggle("hidden", !isHost);

    if (isHost) {
        setMessage("Share the code with everyone. You need at least 2 players.");
    } else {
        setMessage("You're in! Waiting for the host.");
    }
}

function startListeners() {
    listenToPlayers();
    listenToRoom();
}

function listenToPlayers() {
    if (unsubscribePlayers) {
        unsubscribePlayers();
    }

    unsubscribePlayers = onSnapshot(
        collection(db, "rooms", currentRoomCode, "players"),
        function (snapshot) {
            const players = [];

            snapshot.forEach(function (playerDoc) {
                players.push({
                    id: playerDoc.id,
                    ...playerDoc.data()
                });
            });

            players.sort(function (a, b) {
                const aSeconds = a.joinedAt && a.joinedAt.seconds ? a.joinedAt.seconds : 0;
                const bSeconds = b.joinedAt && b.joinedAt.seconds ? b.joinedAt.seconds : 0;
                return aSeconds - bSeconds;
            });

            playersList.innerHTML = "";
            playerCount.textContent = String(players.length) + "/8";

            players.forEach(function (player, index) {
                const card = document.createElement("div");
                card.className = "player-card";
                if (player.id === currentUser.uid) {
                    card.classList.add("you");
                }

                const number = document.createElement("span");
                number.className = "player-number";
                number.textContent = String(index + 1);

                const name = document.createElement("span");
                name.className = "player-name";
                name.textContent = player.name;

                if (player.isHost) {
                    card.classList.add("host");
                }

                card.appendChild(number);
                card.appendChild(name);

                playersList.appendChild(card);
            });

            if (isHost) {
                startButton.disabled = players.length < 2;
                startButton.textContent = players.length < 2
                    ? "NEED 2 PLAYERS"
                    : "START GAME";
            }
        },
        function (error) {
            console.error("PLAYER LISTENER ERROR:", error);
            setMessage("Couldn't update the player list.", true);
        }
    );
}

function listenToRoom() {
    if (unsubscribeRoom) {
        unsubscribeRoom();
    }

    unsubscribeRoom = onSnapshot(
        doc(db, "rooms", currentRoomCode),
        function (snapshot) {
            if (!snapshot.exists()) {
                setMessage("The game no longer exists.", true);
                return;
            }

            const room = snapshot.data();

            if (!isHost) {
                modifierSelect.value = room.modifier || "none";
            }

            if (room.status === "playing") {
                window.location.href = "../game/game.html?room=" + currentRoomCode;
            }
        },
        function (error) {
            console.error("ROOM LISTENER ERROR:", error);
        }
    );
}

async function updateModifier() {
    if (!isHost || !currentRoomCode) {
        return;
    }

    try {
        await updateDoc(doc(db, "rooms", currentRoomCode), {
            modifier: modifierSelect.value
        });
    } catch (error) {
        console.error("MODIFIER UPDATE ERROR:", error);
        setMessage("Couldn't save that modifier.", true);
    }
}

async function startGame() {
    if (!isHost || !currentRoomCode) {
        return;
    }

    startButton.disabled = true;
    startButton.textContent = "STARTING...";

    try {
        const playersSnapshot = await getDocs(
            collection(db, "rooms", currentRoomCode, "players")
        );

        if (playersSnapshot.size < 2) {
            throw new Error("You need at least 2 players.");
        }

        await updateDoc(doc(db, "rooms", currentRoomCode), {
            status: "playing",
            currentRound: 1
        });
    } catch (error) {
        console.error("START GAME ERROR:", error);
        setMessage(error.message || "Could not start the game.", true);
        startButton.disabled = false;
        startButton.textContent = "START GAME";
    }
}

async function copyCode() {
    if (!currentRoomCode) {
        return;
    }

    try {
        await navigator.clipboard.writeText(currentRoomCode);
        const oldText = copyCodeButton.textContent;
        copyCodeButton.textContent = "COPIED!";
        setTimeout(function () {
            copyCodeButton.textContent = oldText;
        }, 1500);
    } catch (error) {
        console.error("COPY ERROR:", error);
        setMessage("Copy failed. The code is " + currentRoomCode + ".");
    }
}

async function leaveLobby() {
    if (isLeaving) {
        return;
    }

    isLeaving = true;

    try {
        if (unsubscribePlayers) unsubscribePlayers();
        if (unsubscribeRoom) unsubscribeRoom();

        if (currentRoomCode && currentUser) {
            await deleteDoc(
                doc(db, "rooms", currentRoomCode, "players", currentUser.uid)
            );

            if (isHost) {
                await deleteDoc(doc(db, "rooms", currentRoomCode));
            }
        }
    } catch (error) {
        console.error("LEAVE ERROR:", error);
    }

    window.location.href = "../index.html";
}

function resetJoinButton() {
    joinLobbyButton.disabled = false;
    joinLobbyButton.textContent = "JOIN GAME";
}

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
        code += characters[Math.floor(Math.random() * characters.length)];
    }

    return code;
}

playerNameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        handleJoinButton();
    }
});

joinLobbyButton.addEventListener("click", handleJoinButton);
modifierSelect.addEventListener("change", updateModifier);
startButton.addEventListener("click", startGame);
copyCodeButton.addEventListener("click", copyCode);
leaveButton.addEventListener("click", leaveLobby);

window.addEventListener("beforeunload", function () {
    if (unsubscribePlayers) unsubscribePlayers();
    if (unsubscribeRoom) unsubscribeRoom();
});

initialise();
