import {
    db,
    loginAnonymously
} from "../firebase.js";

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


const params =
    new URLSearchParams(
        window.location.search
    );

const hostMode =
    params.get("host") === "true";

const requestedRoom =
    (params.get("room") || "")
        .trim()
        .toUpperCase();


let currentUser = null;
let currentRoomCode = null;
let currentPlayerName = "";

let unsubscribePlayers = null;
let unsubscribeRoom = null;

let leaving = false;


const nameSection =
    document.getElementById("nameSection");

const lobbyContent =
    document.getElementById("lobbyContent");

const playerNameInput =
    document.getElementById("playerName");

const joinLobbyButton =
    document.getElementById("joinLobbyButton");

const joinError =
    document.getElementById("joinError");

const gameCodeElement =
    document.getElementById("gameCode");

const copyCodeButton =
    document.getElementById("copyCodeButton");

const playersList =
    document.getElementById("playersList");

const playerCount =
    document.getElementById("playerCount");

const hostSettings =
    document.getElementById("hostSettings");

const modifierSelect =
    document.getElementById("modifierSelect");

const startButton =
    document.getElementById("startButton");

const leaveButton =
    document.getElementById("leaveButton");


async function initialise() {

    try {

        currentUser =
            await loginAnonymously();

        if (requestedRoom) {
            currentRoomCode =
                requestedRoom;
        }

    } catch (error) {

        console.error(
            "Firebase error:",
            error
        );

        showError(
            "Could not connect to the game."
        );

        joinLobbyButton.disabled = true;
    }
}


function showError(message) {

    joinError.textContent =
        message;

    playerNameInput.classList.remove(
        "input-error"
    );

    void playerNameInput.offsetWidth;

    playerNameInput.classList.add(
        "input-error"
    );
}


function clearError() {

    joinError.textContent = "";

    playerNameInput.classList.remove(
        "input-error"
    );
}


joinLobbyButton.addEventListener(
    "click",
    joinFromName
);


playerNameInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {
            joinFromName();
        }

    }
);


async function joinFromName() {

    clearError();

    const name =
        playerNameInput.value.trim();

    if (!name) {

        showError(
            "Please enter your name."
        );

        playerNameInput.focus();

        return;
    }

    if (name.length > 20) {

        showError(
            "Your name is too long."
        );

        return;
    }

    if (!currentUser) {

        showError(
            "Still connecting to Firebase..."
        );

        return;
    }

    currentPlayerName = name;

    joinLobbyButton.disabled = true;
    joinLobbyButton.textContent =
        "JOINING...";

    try {

        if (hostMode) {

            await createRoom();

        } else {

            await joinRoom(
                currentRoomCode
            );

        }

    } catch (error) {

        console.error(
            "LOBBY ERROR:",
            error
        );

        showError(
            error.message ||
            "Something went wrong."
        );

        joinLobbyButton.disabled = false;
        joinLobbyButton.textContent =
            "JOIN GAME";
    }
}


async function createRoom() {

    let code = "";

    let roomRef = null;

    for (let attempt = 0; attempt < 20; attempt++) {

        code =
            generateRoomCode();

        roomRef =
            doc(
                db,
                "rooms",
                code
            );

        const existing =
            await getDoc(roomRef);

        if (!existing.exists()) {
            break;
        }

        roomRef = null;
    }

    if (!roomRef) {

        throw new Error(
            "Could not create a game. Try again."
        );
    }

    await setDoc(
        roomRef,
        {
            hostId:
                currentUser.uid,

            status:
                "lobby",

            modifier:
                "none",

            currentRound:
                0,

            usedPrompts:
                [],

            scores:
                {},

            createdAt:
                serverTimestamp()
        }
    );

    await setDoc(
        doc(
            db,
            "rooms",
            code,
            "players",
            currentUser.uid
        ),
        {
            name:
                currentPlayerName,

            isHost:
                true,

            joinedAt:
                serverTimestamp()
        }
    );

    currentRoomCode =
        code;

    showLobby();

    startListeners();
}


async function joinRoom(code) {

    if (!code) {

        throw new Error(
            "Please enter a game code."
        );
    }

    if (!/^[A-Z0-9]{6}$/.test(code)) {

        throw new Error(
            "Game codes are 6 characters."
        );
    }

    const roomRef =
        doc(
            db,
            "rooms",
            code
        );

    const roomSnapshot =
        await getDoc(roomRef);

    if (!roomSnapshot.exists()) {

        throw new Error(
            "That game does not exist."
        );
    }

    const room =
        roomSnapshot.data();

    if (room.status !== "lobby") {

        throw new Error(
            "That game has already started."
        );
    }

    const playersRef =
        collection(
            db,
            "rooms",
            code,
            "players"
        );

    const playersSnapshot =
        await getDocs(playersRef);

    const alreadyJoined =
        playersSnapshot.docs.some(
            function (item) {
                return (
                    item.id ===
                    currentUser.uid
                );
            }
        );

    if (
        !alreadyJoined &&
        playersSnapshot.size >= 8
    ) {

        throw new Error(
            "That game is full."
        );
    }

    await setDoc(
        doc(
            db,
            "rooms",
            code,
            "players",
            currentUser.uid
        ),
        {
            name:
                currentPlayerName,

            isHost:
                false,

            joinedAt:
                serverTimestamp()
        }
    );

    currentRoomCode =
        code;

    showLobby();

    startListeners();
}


function showLobby() {

    nameSection.classList.add(
        "hidden"
    );

    lobbyContent.classList.remove(
        "hidden"
    );

    gameCodeElement.textContent =
        currentRoomCode;

    if (hostMode) {

        hostSettings.classList.remove(
            "hidden"
        );

    } else {

        hostSettings.classList.add(
            "hidden"
        );
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

    const playersRef =
        collection(
            db,
            "rooms",
            currentRoomCode,
            "players"
        );

    unsubscribePlayers =
        onSnapshot(
            playersRef,
            function (snapshot) {

                const playerData = [];

                snapshot.forEach(
                    function (playerDoc) {

                        playerData.push(
                            {
                                id:
                                    playerDoc.id,

                                ...playerDoc.data()
                            }
                        );
                    }
                );

                playerData.sort(
                    function (a, b) {

                        const aTime =
                            a.joinedAt &&
                            a.joinedAt.toMillis
                                ? a.joinedAt.toMillis()
                                : 0;

                        const bTime =
                            b.joinedAt &&
                            b.joinedAt.toMillis
                                ? b.joinedAt.toMillis()
                                : 0;

                        return (
                            aTime -
                            bTime
                        );
                    }
                );

                playersList.innerHTML =
                    "";

                playerCount.textContent =
                    playerData.length +
                    "/8";

                playerData.forEach(
                    function (player) {

                        const card =
                            document.createElement(
                                "div"
                            );

                        card.className =
                            "player-card";

                        if (player.isHost) {
                            card.classList.add(
                                "host"
                            );
                        }

                        const name =
                            document.createElement(
                                "span"
                            );

                        name.className =
                            "player-card-name";

                        name.textContent =
                            player.name;

                        card.appendChild(
                            name
                        );

                        if (player.isHost) {

                            const hostLabel =
                                document.createElement(
                                    "small"
                                );

                            hostLabel.className =
                                "host-label";

                            hostLabel.textContent =
                                "HOST";

                            card.appendChild(
                                hostLabel
                            );
                        }

                        playersList.appendChild(
                            card
                        );
                    }
                );

                if (hostMode) {

                    startButton.disabled =
                        playerData.length < 2;

                }

            },
            function (error) {

                console.error(
                    "PLAYER LISTENER ERROR:",
                    error
                );
            }
        );
}


function listenToRoom() {

    if (unsubscribeRoom) {
        unsubscribeRoom();
    }

    const roomRef =
        doc(
            db,
            "rooms",
            currentRoomCode
        );

    unsubscribeRoom =
        onSnapshot(
            roomRef,
            function (snapshot) {

                if (!snapshot.exists()) {

                    if (!leaving) {

                        alert(
                            "The game no longer exists."
                        );

                        window.location.href =
                            "../index.html";
                    }

                    return;
                }

                const room =
                    snapshot.data();

                if (!hostMode) {

                    modifierSelect.value =
                        room.modifier ||
                        "none";
                }

                if (
                    room.status ===
                    "playing"
                ) {

                    window.location.href =
                        "../game/game.html?room=" +
                        encodeURIComponent(
                            currentRoomCode
                        );
                }

            },
            function (error) {

                console.error(
                    "ROOM LISTENER ERROR:",
                    error
                );
            }
        );
}


modifierSelect.addEventListener(
    "change",
    async function () {

        if (
            !hostMode ||
            !currentRoomCode
        ) {
            return;
        }

        try {

            await updateDoc(
                doc(
                    db,
                    "rooms",
                    currentRoomCode
                ),
                {
                    modifier:
                        modifierSelect.value
                }
            );

        } catch (error) {

            console.error(
                "MODIFIER ERROR:",
                error
            );
        }
    }
);


startButton.addEventListener(
    "click",
    startGame
);


async function startGame() {

    if (
        !hostMode ||
        !currentRoomCode
    ) {
        return;
    }

    startButton.disabled =
        true;

    startButton.textContent =
        "STARTING...";

    try {

        const playersSnapshot =
            await getDocs(
                collection(
                    db,
                    "rooms",
                    currentRoomCode,
                    "players"
                )
            );

        if (playersSnapshot.size < 2) {

            throw new Error(
                "You need at least 2 players."
            );
        }

        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoomCode
            ),
            {
                status:
                    "playing",

                currentRound:
                    1
            }
        );

    } catch (error) {

        console.error(
            "START ERROR:",
            error
        );

        alert(
            error.message ||
            "Could not start the game."
        );

        startButton.disabled =
            false;

        startButton.textContent =
            "START GAME";
    }
}


copyCodeButton.addEventListener(
    "click",
    async function () {

        try {

            await navigator.clipboard.writeText(
                currentRoomCode
            );

            copyCodeButton.textContent =
                "COPIED!";

            setTimeout(
                function () {

                    copyCodeButton.textContent =
                        "COPY CODE";

                },
                1200
            );

        } catch (error) {

            console.error(
                "COPY ERROR:",
                error
            );
        }
    }
);


leaveButton.addEventListener(
    "click",
    leaveLobby
);


async function leaveLobby() {

    if (leaving) {
        return;
    }

    leaving = true;

    try {

        if (
            currentUser &&
            currentRoomCode
        ) {

            await deleteDoc(
                doc(
                    db,
                    "rooms",
                    currentRoomCode,
                    "players",
                    currentUser.uid
                )
            );

            if (hostMode) {

                await deleteDoc(
                    doc(
                        db,
                        "rooms",
                        currentRoomCode
                    )
                );
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
}


function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];
    }

    return code;
}


initialise();
