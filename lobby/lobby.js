import { db, loginAnonymously } from "../firebase.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    onSnapshot,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// --------------------------------------------------
// STATE
// --------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const isHost = urlParams.get("host") === "true";

let currentUser = null;
let currentRoomCode = null;
let currentPlayerName = null;
let unsubscribePlayers = null;
let unsubscribeRoom = null;


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const nameSection = document.getElementById("nameSection");
const lobbyContent = document.getElementById("lobbyContent");

const playerNameInput = document.getElementById("playerName");

const gameCodeElement = document.getElementById("gameCode");
const playerCountElement = document.getElementById("playerCount");
const playersList = document.getElementById("playersList");

const hostSettings = document.getElementById("hostSettings");
const modifierSelect = document.getElementById("modifierSelect");

const startButton = document.getElementById("startButton");


// --------------------------------------------------
// STARTUP
// --------------------------------------------------

async function initialise() {
    try {
        currentUser = await loginAnonymously();

        console.log("Firebase connected.");
        console.log("Player ID:", currentUser.uid);

    } catch (error) {
        console.error("Firebase login failed:", error);

        alert(
            "Couldn't connect to the game server.\n\n" +
            "Check your internet connection and try again."
        );
    }
}

initialise();


// --------------------------------------------------
// CREATE / JOIN LOBBY
// --------------------------------------------------

window.joinLobby = async function () {

    const name = playerNameInput.value.trim();

    if (!name) {
        playerNameInput.classList.add("input-error");

        setTimeout(() => {
            playerNameInput.classList.remove("input-error");
        }, 300);

        playerNameInput.focus();

        return;
    }

    if (name.length > 20) {
        return;
    }

    if (!currentUser) {
        alert("Still connecting to Firebase. Try again in a second.");
        return;
    }

    currentPlayerName = name;

    try {

        if (isHost) {
            await createGame();
        } else {
            await joinGame();
        }

    } catch (error) {
        console.error(error);

        alert(
            "Something went wrong.\n\n" +
            "Check the console for details."
        );
    }
};


// --------------------------------------------------
// CREATE GAME
// --------------------------------------------------

async function createGame() {

    let roomCode;
    let roomRef;
    let existingRoom;

    // Generate a code until we find one that isn't already being used.
    do {

        roomCode = generateRoomCode();

        roomRef = doc(db, "rooms", roomCode);

        existingRoom = await getDoc(roomRef);

    } while (existingRoom.exists());


    await setDoc(roomRef, {
        hostId: currentUser.uid,
        status: "lobby",

        modifier: "none",

        currentRound: 0,

        createdAt: serverTimestamp()
    });


    const playerRef = doc(
        db,
        "rooms",
        roomCode,
        "players",
        currentUser.uid
    );


    await setDoc(playerRef, {
        name: currentPlayerName,

        isHost: true,

        score: 0,

        joinedAt: serverTimestamp()
    });


    currentRoomCode = roomCode;

    showLobby();

    listenToRoom();
    listenToPlayers();
}


// --------------------------------------------------
// JOIN GAME
// --------------------------------------------------

async function joinGame() {

    const code = prompt(
        "Enter the 6-character game code:"
    );

    if (!code) {
        return;
    }

    const roomCode = code
        .trim()
        .toUpperCase();


    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {

        alert(
            "That doesn't look like a valid game code."
        );

        return;
    }


    const roomRef = doc(
        db,
        "rooms",
        roomCode
    );

    const roomSnapshot = await getDoc(roomRef);


    if (!roomSnapshot.exists()) {

        alert(
            "Couldn't find that game.\n\n" +
            "Double-check the code."
        );

        return;
    }


    const roomData = roomSnapshot.data();


    if (roomData.status !== "lobby") {

        alert(
            "That game has already started."
        );

        return;
    }


    const playerRef = doc(
        db,
        "rooms",
        roomCode,
        "players",
        currentUser.uid
    );


    await setDoc(playerRef, {

        name: currentPlayerName,

        isHost: false,

        score: 0,

        joinedAt: serverTimestamp()

    });


    currentRoomCode = roomCode;


    showLobby();

    listenToRoom();
    listenToPlayers();
}


// --------------------------------------------------
// SHOW LOBBY
// --------------------------------------------------

function showLobby() {

    nameSection.classList.add("hidden");

    lobbyContent.classList.remove("hidden");

    gameCodeElement.textContent = currentRoomCode;


    if (isHost) {

        hostSettings.classList.remove("hidden");

        startButton.disabled = false;

    } else {

        hostSettings.classList.add("hidden");

        startButton.disabled = true;

    }
}


// --------------------------------------------------
// LISTEN TO PLAYERS
// --------------------------------------------------

function listenToPlayers() {

    if (unsubscribePlayers) {
        unsubscribePlayers();
    }


    const playersRef = collection(
        db,
        "rooms",
        currentRoomCode,
        "players"
    );


    unsubscribePlayers = onSnapshot(
        playersRef,
        snapshot => {

            playersList.innerHTML = "";


            const players = [];


            snapshot.forEach(playerDoc => {

                players.push({
                    id: playerDoc.id,
                    ...playerDoc.data()
                });

            });


            players.sort(
                (a, b) => {

                    const aTime =
                        a.joinedAt?.seconds || 0;

                    const bTime =
                        b.joinedAt?.seconds || 0;

                    return aTime - bTime;
                }
            );


            playerCountElement.textContent =
                `${players.length}/8`;


            players.forEach(player => {

                const playerElement =
                    document.createElement("div");

                playerElement.className =
                    "player-card";


                const nameElement =
                    document.createElement("span");

                nameElement.textContent =
                    player.name;


                playerElement.appendChild(
                    nameElement
                );


                if (player.isHost) {

                    const hostElement =
                        document.createElement("span");

                    hostElement.textContent =
                        "HOST";

                    hostElement.className =
                        "player-host";

                    playerElement.appendChild(
                        hostElement
                    );
                }


                playersList.appendChild(
                    playerElement
                );

            });


            // Need at least 2 players to start.
            if (isHost) {

                startButton.disabled =
                    players.length < 2;

            }

        },

        error => {

            console.error(
                "Player listener error:",
                error
            );

        }
    );
}


// --------------------------------------------------
// LISTEN TO ROOM
// --------------------------------------------------

function listenToRoom() {

    if (unsubscribeRoom) {
        unsubscribeRoom();
    }


    const roomRef = doc(
        db,
        "rooms",
        currentRoomCode
    );


    unsubscribeRoom = onSnapshot(
        roomRef,

        snapshot => {

            if (!snapshot.exists()) {

                alert(
                    "The host closed the game."
                );

                window.location.href =
                    "../index.html";

                return;
            }


            const roomData =
                snapshot.data();


            // If the host changes the modifier,
            // everyone sees it.
            if (
                !isHost &&
                modifierSelect
            ) {

                modifierSelect.value =
                    roomData.modifier || "none";

            }


            // When the host starts the game,
            // everyone moves to the game.
            if (
                roomData.status === "playing"
            ) {

                window.location.href =
                    `../game/game.html?room=${currentRoomCode}`;

            }

        },

        error => {

            console.error(
                "Room listener error:",
                error
            );

        }
    );
}


// --------------------------------------------------
// MODIFIER
// --------------------------------------------------

modifierSelect.addEventListener(
    "change",
    async () => {

        if (!isHost || !currentRoomCode) {
            return;
        }


        try {

            const roomRef = doc(
                db,
                "rooms",
                currentRoomCode
            );


            await updateDoc(
                roomRef,
                {
                    modifier:
                        modifierSelect.value
                }
            );

        } catch (error) {

            console.error(
                "Couldn't update modifier:",
                error
            );

        }

    }
);


// --------------------------------------------------
// START GAME
// --------------------------------------------------

window.startGame = async function () {

    if (!isHost || !currentRoomCode) {
        return;
    }


    const playersSnapshot =
        await getDoc(
            doc(
                db,
                "rooms",
                currentRoomCode
            )
        );


    if (!playersSnapshot.exists()) {
        return;
    }


    const playersRef =
        collection(
            db,
            "rooms",
            currentRoomCode,
            "players"
        );


    const playersSnapshotList =
        await getDoc(
            doc(
                db,
                "rooms",
                currentRoomCode
            )
        );


    // Make sure there are enough players.
    // The live player listener also handles this,
    // but this prevents accidental starts.
    const currentPlayers =
        await getPlayers();


    if (currentPlayers.length < 2) {

        alert(
            "You need at least 2 players to start."
        );

        return;
    }


    const roomRef = doc(
        db,
        "rooms",
        currentRoomCode
    );


    await updateDoc(
        roomRef,
        {
            status: "playing",

            currentRound: 1
        }
    );

};


// --------------------------------------------------
// GET PLAYERS
// --------------------------------------------------

async function getPlayers() {

    const playersRef =
        collection(
            db,
            "rooms",
            currentRoomCode,
            "players"
        );


    const snapshot =
        await getDocs(playersRef);


    const players = [];


    snapshot.forEach(playerDoc => {

        players.push({
            id: playerDoc.id,
            ...playerDoc.data()
        });

    });


    return players;
}


// --------------------------------------------------
// COPY CODE
// --------------------------------------------------

window.copyGameCode = async function () {

    if (!currentRoomCode) {
        return;
    }


    try {

        await navigator.clipboard.writeText(
            currentRoomCode
        );


        const originalText =
            document.querySelector(
                ".copy-code"
            ).textContent;


        document.querySelector(
            ".copy-code"
        ).textContent = "COPIED!";


        setTimeout(() => {

            document.querySelector(
                ".copy-code"
            ).textContent = originalText;

        }, 1500);


    } catch (error) {

        console.error(
            "Couldn't copy code:",
            error
        );

    }

};


// --------------------------------------------------
// LEAVE LOBBY
// --------------------------------------------------

window.leaveLobby = async function () {

    const shouldLeave =
        confirm(
            "Are you sure you want to leave?"
        );


    if (!shouldLeave) {
        return;
    }


    try {

        if (
            currentRoomCode &&
            currentUser
        ) {

            const playerRef =
                doc(
                    db,
                    "rooms",
                    currentRoomCode,
                    "players",
                    currentUser.uid
                );


            await deleteDoc(playerRef);


            // If the host leaves, remove the room.
            if (isHost) {

                const roomRef =
                    doc(
                        db,
                        "rooms",
                        currentRoomCode
                    );


                await deleteDoc(roomRef);

            }

        }

    } catch (error) {

        console.error(
            "Error leaving lobby:",
            error
        );

    }


    window.location.href =
        "../index.html";
};


// --------------------------------------------------
// ROOM CODE GENERATOR
// --------------------------------------------------

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";


    for (let i = 0; i < 6; i++) {

        code += characters[
            Math.floor(
                Math.random() *
                characters.length
            )
        ];

    }


    return code;
}


// --------------------------------------------------
// ENTER KEY
// --------------------------------------------------

playerNameInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            joinLobby();

        }

    }
);
