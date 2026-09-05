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

// ==================================================
// STATE
// ==================================================

const urlParams = new URLSearchParams(window.location.search);
const isHost = urlParams.get("host") === "true";

let currentUser = null;
let currentRoomCode = null;
let currentPlayerName = null;

let unsubscribePlayers = null;
let unsubscribeRoom = null;

// ==================================================
// ELEMENTS
// ==================================================

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

// ==================================================
// FIREBASE LOGIN
// ==================================================

async function initialiseFirebase() {

```
try {

    currentUser = await loginAnonymously();

    console.log("Firebase connected.");
    console.log("User ID:", currentUser.uid);

} catch (error) {

    console.error("FIREBASE ERROR:", error);
    console.error("FIREBASE ERROR CODE:", error.code);
    console.error("FIREBASE ERROR MESSAGE:", error.message);

    alert(
        "Could not connect to Firebase.\n\n" +
        "Error code: " +
        (error.code || "unknown") +
        "\n\n" +
        "Check the browser console for more information."
    );

    joinLobbyButton.disabled = true;
}
```

}

initialiseFirebase();

// ==================================================
// NAME / JOIN BUTTON
// ==================================================

joinLobbyButton.addEventListener("click", handleJoinButton);

async function handleJoinButton() {

```
const name = playerNameInput.value.trim();


if (!name) {

    playerNameInput.classList.add("input-error");

    setTimeout(function () {

        playerNameInput.classList.remove("input-error");

    }, 300);

    playerNameInput.focus();

    return;
}


if (name.length > 20) {
    return;
}


if (!currentUser) {

    alert(
        "Firebase has not connected yet.\n\n" +
        "Please check the browser console."
    );

    return;
}


currentPlayerName = name;

joinLobbyButton.disabled = true;
joinLobbyButton.textContent = "CONNECTING...";


try {

    if (isHost) {

        await createGame();

    } else {

        await askForGameCode();

    }

} catch (error) {

    console.error("LOBBY ERROR:", error);
    console.error("LOBBY ERROR CODE:", error.code);
    console.error("LOBBY ERROR MESSAGE:", error.message);

    alert(
        "Something went wrong.\n\n" +
        (error.message || "Unknown error.")
    );

    resetJoinButton();
}
```

}

// ==================================================
// ENTER KEY
// ==================================================

playerNameInput.addEventListener("keydown", function (event) {

```
if (event.key === "Enter") {

    handleJoinButton();

}
```

});

// ==================================================
// CREATE GAME
// ==================================================

async function createGame() {

```
let roomCode;
let roomRef;


while (true) {

    roomCode = generateRoomCode();

    roomRef = doc(
        db,
        "rooms",
        roomCode
    );


    const existingRoom = await getDoc(roomRef);


    if (!existingRoom.exists()) {

        break;

    }

}


await setDoc(
    roomRef,
    {
        hostId: currentUser.uid,
        status: "lobby",
        modifier: "none",
        currentRound: 0,
        createdAt: serverTimestamp()
    }
);


const playerRef = doc(
    db,
    "rooms",
    roomCode,
    "players",
    currentUser.uid
);


await setDoc(
    playerRef,
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
```

}

// ==================================================
// ASK FOR GAME CODE
// ==================================================

async function askForGameCode() {

```
const code = prompt("ENTER GAME CODE");


if (code === null) {

    resetJoinButton();

    return;
}


const roomCode = code.trim().toUpperCase();


if (!/^[A-Z0-9]{6}$/.test(roomCode)) {

    alert(
        "Game codes are 6 characters long."
    );

    resetJoinButton();

    return;
}


await joinExistingGame(roomCode);
```

}

// ==================================================
// JOIN EXISTING GAME
// ==================================================

async function joinExistingGame(roomCode) {

```
const roomRef = doc(
    db,
    "rooms",
    roomCode
);


const roomSnapshot = await getDoc(roomRef);


if (!roomSnapshot.exists()) {

    alert(
        "Could not find that game.\n\n" +
        "Check the code and try again."
    );

    resetJoinButton();

    return;
}


const room = roomSnapshot.data();


if (room.status !== "lobby") {

    alert(
        "That game has already started."
    );

    resetJoinButton();

    return;
}


const playersRef = collection(
    db,
    "rooms",
    roomCode,
    "players"
);


const playersSnapshot =
    await getDocs(playersRef);


if (playersSnapshot.size >= 8) {

    alert("That game is full!");

    resetJoinButton();

    return;
}


const playerRef = doc(
    db,
    "rooms",
    roomCode,
    "players",
    currentUser.uid
);


await setDoc(
    playerRef,
    {
        name: currentPlayerName,
        isHost: false,
        score: 0,
        joinedAt: serverTimestamp()
    }
);


currentRoomCode = roomCode;

showLobby();

startListeners();
```

}

// ==================================================
// SHOW LOBBY
// ==================================================

function showLobby() {

```
nameSection.classList.add("hidden");

lobbyContent.classList.remove("hidden");

gameCodeElement.textContent = currentRoomCode;


if (isHost) {

    hostSettings.classList.remove("hidden");

} else {

    hostSettings.classList.add("hidden");

}
```

}

// ==================================================
// START LISTENERS
// ==================================================

function startListeners() {

```
listenToPlayers();

listenToRoom();
```

}

// ==================================================
// PLAYER LISTENER
// ==================================================

function listenToPlayers() {

```
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

    function (snapshot) {

        playersList.innerHTML = "";

        const players = [];


        snapshot.forEach(function (playerDoc) {

            players.push({
                id: playerDoc.id,
                ...playerDoc.data()
            });

        });


        players.sort(function (a, b) {

            const aTime =
                a.joinedAt && a.joinedAt.seconds
                    ? a.joinedAt.seconds
                    : 0;

            const bTime =
                b.joinedAt && b.joinedAt.seconds
                    ? b.joinedAt.seconds
                    : 0;

            return aTime - bTime;

        });


        playerCount.textContent =
            String(players.length) + "/8";


        players.forEach(function (player) {

            const card =
                document.createElement("div");

            card.className =
                "player-card";


            const name =
                document.createElement("span");

            name.textContent =
                player.name;


            card.appendChild(name);


            if (player.isHost) {

                const host =
                    document.createElement("span");

                host.textContent =
                    "HOST";

                host.className =
                    "player-host";

                card.appendChild(host);

            }


            playersList.appendChild(card);

        });


        if (isHost) {

            startButton.disabled =
                players.length < 2;

        }

    },

    function (error) {

        console.error(
            "PLAYER LISTENER ERROR:",
            error
        );

        console.error(
            "PLAYER LISTENER CODE:",
            error.code
        );

        console.error(
            "PLAYER LISTENER MESSAGE:",
            error.message
        );

    }
);
```

}

// ==================================================
// ROOM LISTENER
// ==================================================

function listenToRoom() {

```
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

    function (snapshot) {

        if (!snapshot.exists()) {

            alert(
                "The game no longer exists."
            );

            window.location.href =
                "../index.html";

            return;
        }


        const room = snapshot.data();


        if (!isHost) {

            modifierSelect.value =
                room.modifier || "none";

        }


        if (room.status === "playing") {

            window.location.href =
                "../game/game.html?room=" +
                currentRoomCode;

        }

    },

    function (error) {

        console.error(
            "ROOM LISTENER ERROR:",
            error
        );

        console.error(
            "ROOM LISTENER CODE:",
            error.code
        );

        console.error(
            "ROOM LISTENER MESSAGE:",
            error.message
        );

    }
);
```

}

// ==================================================
// MODIFIER
// ==================================================

modifierSelect.addEventListener(
"change",
async function () {

```
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
            "MODIFIER UPDATE ERROR:",
            error
        );

        console.error(
            "MODIFIER ERROR CODE:",
            error.code
        );

    }

}
```

);

// ==================================================
// START GAME
// ==================================================

startButton.addEventListener(
"click",
startGame
);

async function startGame() {

```
if (!isHost || !currentRoomCode) {

    return;
}


try {

    const playersRef = collection(
        db,
        "rooms",
        currentRoomCode,
        "players"
    );


    const playersSnapshot =
        await getDocs(playersRef);


    if (playersSnapshot.size < 2) {

        alert(
            "You need at least 2 players."
        );

        return;
    }


    startButton.disabled = true;

    startButton.textContent =
        "STARTING...";


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

} catch (error) {

    console.error(
        "START GAME ERROR:",
        error
    );

    console.error(
        "START GAME ERROR CODE:",
        error.code
    );

    console.error(
        "START GAME ERROR MESSAGE:",
        error.message
    );


    alert(
        "Could not start the game.\n\n" +
        (error.message || "Unknown error.")
    );


    startButton.disabled = false;

    startButton.textContent =
        "START GAME";

}
```

}

// ==================================================
// COPY CODE
// ==================================================

copyCodeButton.addEventListener(
"click",
async function () {

```
    if (!currentRoomCode) {

        return;
    }


    try {

        await navigator.clipboard.writeText(
            currentRoomCode
        );


        const oldText =
            copyCodeButton.textContent;


        copyCodeButton.textContent =
            "COPIED!";


        setTimeout(function () {

            copyCodeButton.textContent =
                oldText;

        }, 1500);

    } catch (error) {

        console.error(
            "COPY ERROR:",
            error
        );

    }

}
```

);

// ==================================================
// LEAVE
// ==================================================

leaveButton.addEventListener(
"click",
leaveLobby
);

async function leaveLobby() {

```
const confirmed =
    confirm(
        "Are you sure you want to leave?"
    );


if (!confirmed) {

    return;
}


try {

    if (currentRoomCode && currentUser) {

        const playerRef = doc(
            db,
            "rooms",
            currentRoomCode,
            "players",
            currentUser.uid
        );


        await deleteDoc(playerRef);


        if (isHost) {

            const roomRef = doc(
                db,
                "rooms",
                currentRoomCode
            );


            await deleteDoc(roomRef);

        }

    }

} catch (error) {

    console.error(
        "LEAVE ERROR:",
        error
    );

}


window.location.href =
    "../index.html";
```

}

// ==================================================
// HELPERS
// ==================================================

function resetJoinButton() {

```
joinLobbyButton.disabled = false;

joinLobbyButton.textContent =
    "JOIN GAME";
```

}

function generateRoomCode() {

```
const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let code = "";


for (let i = 0; i < 6; i++) {

    code += characters[
        Math.floor(
            Math.random() * characters.length
        )
    ];

}


return code;
```

}
