import {
    db,
    loginAnonymously
} from "../firebase.js";

import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


const params =
    new URLSearchParams(
        window.location.search
    );

const roomCode =
    (params.get("room") || "")
        .trim()
        .toUpperCase();


const MAX_ROUNDS = 5;

const multipliers = [
    1,
    1,
    1.5,
    1.5,
    2
];


const modifierNames = {
    none: "NO MODIFIER",
    "common-man": "COMMON MAN",
    "no-obvious": "NO OBVIOUS ANSWERS",
    character: "THE CHARACTER",
    "money-talks": "MONEY TALKS",
    predictive: "PREDICTIVE COMMON MAN"
};


const promptSources = [
    {
        category: "MONEY",
        name: "moneyPrompts"
    },
    {
        category: "EVERYDAY LIFE",
        name: "everydayLifePrompts"
    },
    {
        category: "WORK",
        name: "workPrompts"
    },
    {
        category: "FOOD",
        name: "foodPrompts"
    },
    {
        category: "TRAVEL",
        name: "travelPrompts"
    },
    {
        category: "FAMILY",
        name: "familyPrompts"
    },
    {
        category: "SPORT",
        name: "sportPrompts"
    },
    {
        category: "MORAL DILEMMAS",
        name: "moralDilemmasPrompts"
    },
    {
        category: "RIDICULOUS",
        name: "ridiculousPrompts"
    },
    {
        category: "HAMISH & ANDY",
        name: "hamishAndAndyPrompts"
    }
];


let currentUser = null;

let room = null;

let players = [];

let currentRound = null;

let currentRoundNumber = null;

let currentPhase = null;

let currentSubmissions = [];

let currentRankings = [];

let currentResults = null;

let roundUnsubscribe = null;

let submissionsUnsubscribe = null;

let rankingsUnsubscribe = null;

let roomUnsubscribe = null;

let playersUnsubscribe = null;

let creatingRound = false;

let calculatingResults = false;

let finishingGame = false;

let lastRenderedPhase = "";


const waiting =
    document.getElementById("waiting");

const promptScreen =
    document.getElementById("promptScreen");

const lockedScreen =
    document.getElementById("lockedScreen");

const revealScreen =
    document.getElementById("revealScreen");

const rankingScreen =
    document.getElementById("rankingScreen");

const resultsScreen =
    document.getElementById("resultsScreen");

const finalScreen =
    document.getElementById("finalScreen");


const roundNumber =
    document.getElementById("roundNumber");

const roundTotal =
    document.getElementById("roundTotal");

const promptCategory =
    document.getElementById("promptCategory");

const promptQuestion =
    document.getElementById("promptQuestion");

const modifierIndicator =
    document.getElementById("modifierIndicator");


const answerInput =
    document.getElementById("answerInput");

const characterCount =
    document.getElementById("characterCount");

const submitAnswer =
    document.getElementById("submitAnswer");


const answersList =
    document.getElementById("answersList");

const rankingList =
    document.getElementById("rankingList");

const submitRanking =
    document.getElementById("submitRanking");


const resultsList =
    document.getElementById("resultsList");

const nextRoundButton =
    document.getElementById("nextRoundButton");


const winnerName =
    document.getElementById("winnerName");

const winnerScore =
    document.getElementById("winnerScore");

const finalLeaderboard =
    document.getElementById("finalLeaderboard");

const homeButton =
    document.getElementById("homeButton");


function showScreen(screen) {

    const screens = [
        waiting,
        promptScreen,
        lockedScreen,
        revealScreen,
        rankingScreen,
        resultsScreen,
        finalScreen
    ];

    screens.forEach(
        function (item) {

            if (item) {
                item.classList.add(
                    "hidden"
                );
            }
        }
    );

    if (screen) {
        screen.classList.remove(
            "hidden"
        );
    }
}


function isHost() {

    return (
        room &&
        room.hostId ===
            currentUser.uid
    );
}


function getPlayerCount() {

    return players.length;
}


function getCurrentPlayer() {

    return players.find(
        function (player) {

            return (
                player.id ===
                currentUser.uid
            );
        }
    );
}


function getPromptPool() {

    const pool = [];

    promptSources.forEach(
        function (source) {

            const list =
                window[
                    source.name
                ];

            if (!Array.isArray(list)) {
                return;
            }

            list.forEach(
                function (question) {

                    if (
                        typeof question !==
                        "string"
                    ) {
                        return;
                    }

                    const cleaned =
                        question.trim();

                    if (!cleaned) {
                        return;
                    }

                    pool.push(
                        {
                            category:
                                source.category,

                            question:
                                cleaned
                        }
                    );
                }
            );
        }
    );

    return pool;
}


function choosePrompt() {

    const pool =
        getPromptPool();

    if (!pool.length) {

        return {
            category: "RANDOM",
            question:
                "What is the most common thing people do?"
        };
    }

    const used =
        Array.isArray(
            room.usedPrompts
        )
            ? room.usedPrompts
            : [];

    let available =
        pool.filter(
            function (prompt) {

                return !used.includes(
                    prompt.question
                );
            }
        );

    if (!available.length) {
        available = pool;
    }

    return available[
        Math.floor(
            Math.random() *
            available.length
        )
    ];
}


function getRoundRef(number) {

    return doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(number)
    );
}


function getSubmissionsRef(number) {

    return collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(number),
        "submissions"
    );
}


function getRankingsRef(number) {

    return collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(number),
        "rankings"
    );
}


async function initialise() {

    if (!roomCode) {

        window.location.href =
            "../index.html";

        return;
    }

    try {

        currentUser =
            await loginAnonymously();

        const roomSnapshot =
            await getDoc(
                doc(
                    db,
                    "rooms",
                    roomCode
                )
            );

        if (!roomSnapshot.exists()) {

            alert(
                "That game does not exist."
            );

            window.location.href =
                "../index.html";

            return;
        }

        room = {
            id:
                roomSnapshot.id,

            ...roomSnapshot.data()
        };

        listenToRoom();

        listenToPlayers();

    } catch (error) {

        console.error(
            "GAME INIT ERROR:",
            error
        );

        alert(
            "Could not connect to the game.\n\n" +
            (error.message ||
                "Unknown error.")
        );
    }
}


function listenToRoom() {

    const roomRef =
        doc(
            db,
            "rooms",
            roomCode
        );

    roomUnsubscribe =
        onSnapshot(
            roomRef,
            async function (snapshot) {

                if (!snapshot.exists()) {

                    alert(
                        "The game has ended."
                    );

                    window.location.href =
                        "../index.html";

                    return;
                }

                room = {
                    id:
                        snapshot.id,

                    ...snapshot.data()
                };

                renderHeader();

                if (
                    room.status ===
                    "playing"
                ) {

                    const number =
                        Number(
                            room.currentRound ||
                            1
                        );

                    if (
                        currentRoundNumber !==
                        number
                    ) {

                        currentRoundNumber =
                            number;

                        unsubscribeRoundListeners();

                        currentRound =
                            null;

                        currentPhase =
                            null;

                        lastRenderedPhase =
                            "";

                        await ensureRound(
                            number
                        );

                        listenToRound(
                            number
                        );
                    }

                } else if (
                    room.status ===
                    "finished"
                ) {

                    unsubscribeRoundListeners();

                    renderFinalResults();
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


function listenToPlayers() {

    const playersRef =
        collection(
            db,
            "rooms",
            roomCode,
            "players"
        );

    playersUnsubscribe =
        onSnapshot(
            playersRef,
            function (snapshot) {

                players = [];

                snapshot.forEach(
                    function (playerDoc) {

                        players.push(
                            {
                                id:
                                    playerDoc.id,

                                ...playerDoc.data()
                            }
                        );
                    }
                );

                players.sort(
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

                if (
                    currentRound &&
                    currentPhase ===
                    "answering"
                ) {
                    renderAnsweringState();
                }
            },
            function (error) {

                console.error(
                    "PLAYERS LISTENER ERROR:",
                    error
                );
            }
        );
}


async function ensureRound(number) {

    if (
        creatingRound ||
        !isHost()
    ) {
        return;
    }

    const roundRef =
        getRoundRef(number);

    const existing =
        await getDoc(roundRef);

    if (existing.exists()) {
        return;
    }

    creatingRound = true;

    try {

        const prompt =
            choosePrompt();

        const used =
            Array.isArray(
                room.usedPrompts
            )
                ? room.usedPrompts.slice()
                : [];

        if (
            !used.includes(
                prompt.question
            )
        ) {

            used.push(
                prompt.question
            );
        }

        await setDoc(
            roundRef,
            {
                number:
                    number,

                category:
                    prompt.category,

                question:
                    prompt.question,

                phase:
                    "answering",

                answerOrder:
                    [],

                createdAt:
                    serverTimestamp()
            }
        );

        await updateDoc(
            doc(
                db,
                "rooms",
                roomCode
            ),
            {
                usedPrompts:
                    used
            }
        );

    } catch (error) {

        console.error(
            "CREATE ROUND ERROR:",
            error
        );

    } finally {

        creatingRound =
            false;
    }
}


function listenToRound(number) {

    if (roundUnsubscribe) {
        roundUnsubscribe();
    }

    const roundRef =
        getRoundRef(number);

    roundUnsubscribe =
        onSnapshot(
            roundRef,
            function (snapshot) {

                if (!snapshot.exists()) {
                    return;
                }

                currentRound = {
                    id:
                        snapshot.id,

                    ...snapshot.data()
                };

                currentPhase =
                    currentRound.phase ||
                    "answering";

                renderRound();

                listenToSubmissions(
                    number
                );

                listenToRankings(
                    number
                );

                if (
                    isHost() &&
                    currentPhase ===
                    "answering"
                ) {

                    maybeCreateAnswerOrder();
                }

            },
            function (error) {

                console.error(
                    "ROUND LISTENER ERROR:",
                    error
                );
            }
        );
}


function listenToSubmissions(number) {

    if (submissionsUnsubscribe) {
        submissionsUnsubscribe();
    }

    submissionsUnsubscribe =
        onSnapshot(
            getSubmissionsRef(number),
            function (snapshot) {

                currentSubmissions = [];

                snapshot.forEach(
                    function (submissionDoc) {

                        currentSubmissions.push(
                            {
                                id:
                                    submissionDoc.id,

                                ...submissionDoc.data()
                            }
                        );
                    }
                );

                if (
                    currentPhase ===
                    "answering"
                ) {

                    renderAnsweringState();
                }

                if (
                    currentPhase ===
                    "reveal"
                ) {

                    renderReveal();
                }

                if (
                    isHost() &&
                    currentPhase ===
                    "answering"
                ) {

                    maybeStartReveal();
                }

            },
            function (error) {

                console.error(
                    "SUBMISSION LISTENER ERROR:",
                    error
                );
            }
        );
}


function listenToRankings(number) {

    if (rankingsUnsubscribe) {
        rankingsUnsubscribe();
    }

    rankingsUnsubscribe =
        onSnapshot(
            getRankingsRef(number),
            function (snapshot) {

                currentRankings = [];

                snapshot.forEach(
                    function (rankingDoc) {

                        currentRankings.push(
                            {
                                id:
                                    rankingDoc.id,

                                ...rankingDoc.data()
                            }
                        );
                    }
                );

                if (
                    isHost() &&
                    currentPhase ===
                    "ranking"
                ) {

                    maybeFinishRanking();
                }

            },
            function (error) {

                console.error(
                    "RANKING LISTENER ERROR:",
                    error
                );
            }
        );
}


function unsubscribeRoundListeners() {

    if (roundUnsubscribe) {
        roundUnsubscribe();
        roundUnsubscribe = null;
    }

    if (submissionsUnsubscribe) {
        submissionsUnsubscribe();
        submissionsUnsubscribe = null;
    }

    if (rankingsUnsubscribe) {
        rankingsUnsubscribe();
        rankingsUnsubscribe = null;
    }
}


function renderHeader() {

    if (!room) {
        return;
    }

    const number =
        Number(
            room.currentRound || 1
        );

    roundNumber.textContent =
        String(number);

    roundTotal.textContent =
        String(MAX_ROUNDS);

    modifierIndicator.textContent =
        modifierNames[
            room.modifier ||
            "none"
        ] ||
        "NO MODIFIER";
}


function renderRound() {

    if (!currentRound) {
        return;
    }

    promptCategory.textContent =
        currentRound.category ||
        "RANDOM";

    promptQuestion.textContent =
        currentRound.question ||
        "Loading question...";

    if (
        lastRenderedPhase ===
        currentPhase
    ) {

        if (
            currentPhase ===
            "answering"
        ) {
            renderAnsweringState();
        }

        return;
    }

    lastRenderedPhase =
        currentPhase;

    if (
        currentPhase ===
        "answering"
    ) {

        renderAnsweringState();

    } else if (
        currentPhase ===
        "reveal"
    ) {

        renderReveal();

    } else if (
        currentPhase ===
        "ranking"
    ) {

        renderRanking();

    } else if (
        currentPhase ===
        "results"
    ) {

        renderResults();
    }
}


function renderAnsweringState() {

    const hasSubmitted =
        currentSubmissions.some(
            function (submission) {

                return (
                    submission.id ===
                    currentUser.uid
                );
            }
        );

    if (hasSubmitted) {

        showScreen(
            lockedScreen
        );

        return;
    }

    showScreen(
        promptScreen
    );

    submitAnswer.disabled =
        false;

    submitAnswer.textContent =
        "LOCK IT IN";

    answerInput.disabled =
        false;
}


async function submitMyAnswer() {

    const answer =
        answerInput.value.trim();

    if (!answer) {

        answerInput.focus();

        answerInput.classList.remove(
            "input-error"
        );

        void answerInput.offsetWidth;

        answerInput.classList.add(
            "input-error"
        );

        return;
    }

    if (answer.length > 100) {
        return;
    }

    submitAnswer.disabled =
        true;

    submitAnswer.textContent =
        "LOCKING IN...";

    try {

        await setDoc(
            doc(
                db,
                "rooms",
                roomCode,
                "rounds",
                String(
                    currentRound.number
                ),
                "submissions",
                currentUser.uid
            ),
            {
                answer:
                    answer,

                playerId:
                    currentUser.uid,

                submittedAt:
                    serverTimestamp()
            }
        );

        answerInput.disabled =
            true;

        showScreen(
            lockedScreen
        );

    } catch (error) {

        console.error(
            "ANSWER ERROR:",
            error
        );

        alert(
            "Could not submit your answer.\n\n" +
            (error.message ||
                "Unknown error.")
        );

        submitAnswer.disabled =
            false;

        submitAnswer.textContent =
            "LOCK IT IN";
    }
}


async function maybeStartReveal() {

    if (
        !isHost() ||
        currentPhase !==
            "answering" ||
        !currentRound
    ) {
        return;
    }

    if (
        currentSubmissions.length <
        getPlayerCount()
    ) {
        return;
    }

    try {

        const roundRef =
            getRoundRef(
                currentRound.number
            );

        await updateDoc(
            roundRef,
            {
                phase:
                    "reveal"
            }
        );

    } catch (error) {

        console.error(
            "REVEAL ERROR:",
            error
        );
    }
}


async function maybeCreateAnswerOrder() {

    if (
        !isHost() ||
        !currentRound
    ) {
        return;
    }

    if (
        Array.isArray(
            currentRound.answerOrder
        ) &&
        currentRound.answerOrder.length
    ) {
        return;
    }

    if (
        currentSubmissions.length <
        getPlayerCount()
    ) {
        return;
    }

    const ids =
        currentSubmissions.map(
            function (submission) {
                return submission.id;
            }
        );

    shuffle(ids);

    try {

        await updateDoc(
            getRoundRef(
                currentRound.number
            ),
            {
                answerOrder:
                    ids
            }
        );

    } catch (error) {

        console.error(
            "ANSWER ORDER ERROR:",
            error
        );
    }
}


function renderReveal() {

    showScreen(
        revealScreen
    );

    answersList.innerHTML =
        "";

    const order =
        Array.isArray(
            currentRound.answerOrder
        ) &&
        currentRound.answerOrder.length
            ? currentRound.answerOrder
            : currentSubmissions.map(
                function (submission) {
                    return submission.id;
                }
            );

    order.forEach(
        function (playerId, index) {

            const submission =
                currentSubmissions.find(
                    function (item) {
                        return (
                            item.id ===
                            playerId
                        );
                    }
                );

            if (!submission) {
                return;
            }

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "answer-card";

            card.style.animationDelay =
                String(index * 0.04) +
                "s";

            const number =
                document.createElement(
                    "strong"
                );

            number.className =
                "answer-number";

            number.textContent =
                String(index + 1);

            const text =
                document.createElement(
                    "span"
                );

            text.className =
                "answer-text";

            text.textContent =
                submission.answer;

            card.appendChild(
                number
            );

            card.appendChild(
                text
            );

            answersList.appendChild(
                card
            );
        }
    );

    if (
        isHost() &&
        currentSubmissions.length >=
        getPlayerCount()
    ) {

        setTimeout(
            async function () {

                if (
                    currentPhase !==
                    "reveal"
                ) {
                    return;
                }

                await updateDoc(
                    getRoundRef(
                        currentRound.number
                    ),
                    {
                        phase:
                            "ranking"
                    }
                );

            },
            2200
        );
    }
}


function renderRanking() {

    showScreen(
        rankingScreen
    );

    const existing =
        currentRankings.find(
            function (ranking) {

                return (
                    ranking.id ===
                    currentUser.uid
                );
            }
        );

    if (existing) {

        showScreen(
            lockedScreen
        );

        return;
    }

    rankingList.innerHTML =
        "";

    const order =
        Array.isArray(
            currentRound.answerOrder
        )
            ? currentRound.answerOrder
            : [];

    order.forEach(
        function (playerId, index) {

            const submission =
                currentSubmissions.find(
                    function (item) {

                        return (
                            item.id ===
                            playerId
                        );
                    }
                );

            if (!submission) {
                return;
            }

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "ranking-item";

            item.draggable =
                true;

            item.dataset.playerId =
                playerId;

            const rank =
                document.createElement(
                    "span"
                );

            rank.className =
                "rank-number";

            rank.textContent =
                String(index + 1);

            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                submission.answer;

            text.style.overflowWrap =
                "anywhere";

            const handle =
                document.createElement(
                    "span"
                );

            handle.className =
                "drag-handle";

            handle.textContent =
                "☰";

            item.appendChild(
                rank
            );

            item.appendChild(
                text
            );

            item.appendChild(
                handle
            );

            rankingList.appendChild(
                item
            );
        }
    );

    setupDragging();

    submitRanking.disabled =
        false;

    submitRanking.textContent =
        "SUBMIT VOTE";
}


function setupDragging() {

    let dragged = null;

    const items =
        Array.from(
            rankingList.querySelectorAll(
                ".ranking-item"
            )
        );

    items.forEach(
        function (item) {

            item.addEventListener(
                "dragstart",
                function () {

                    dragged =
                        item;

                    item.classList.add(
                        "dragging"
                    );
                }
            );

            item.addEventListener(
                "dragend",
                function () {

                    item.classList.remove(
                        "dragging"
                    );

                    dragged =
                        null;

                    updateRankNumbers();
                }
            );

            item.addEventListener(
                "dragover",
                function (event) {

                    event.preventDefault();

                    if (
                        !dragged ||
                        dragged === item
                    ) {
                        return;
                    }

                    const rect =
                        item.getBoundingClientRect();

                    const before =
                        event.clientY <
                        rect.top +
                        rect.height / 2;

                    if (before) {

                        rankingList.insertBefore(
                            dragged,
                            item
                        );

                    } else {

                        rankingList.insertBefore(
                            dragged,
                            item.nextSibling
                        );
                    }

                    updateRankNumbers();
                }
            );
        }
    );


    let touchItem = null;

    items.forEach(
        function (item) {

            item.addEventListener(
                "touchstart",
                function () {

                    touchItem =
                        item;

                    item.classList.add(
                        "dragging"
                    );

                },
                {
                    passive: true
                }
            );

            item.addEventListener(
                "touchmove",
                function (event) {

                    if (!touchItem) {
                        return;
                    }

                    const touch =
                        event.touches[0];

                    const target =
                        document.elementFromPoint(
                            touch.clientX,
                            touch.clientY
                        );

                    const targetItem =
                        target
                            ? target.closest(
                                ".ranking-item"
                            )
                            : null;

                    if (
                        !targetItem ||
                        targetItem ===
                            touchItem
                    ) {
                        return;
                    }

                    const rect =
                        targetItem.getBoundingClientRect();

                    const before =
                        touch.clientY <
                        rect.top +
                        rect.height / 2;

                    if (before) {

                        rankingList.insertBefore(
                            touchItem,
                            targetItem
                        );

                    } else {

                        rankingList.insertBefore(
                            touchItem,
                            targetItem.nextSibling
                        );
                    }

                    updateRankNumbers();

                },
                {
                    passive: true
                }
            );

            item.addEventListener(
                "touchend",
                function () {

                    if (touchItem) {

                        touchItem.classList.remove(
                            "dragging"
                        );
                    }

                    touchItem =
                        null;

                    updateRankNumbers();

                }
            );
        }
    );
}


function updateRankNumbers() {

    const items =
        Array.from(
            rankingList.querySelectorAll(
                ".ranking-item"
            )
        );

    items.forEach(
        function (item, index) {

            const rank =
                item.querySelector(
                    ".rank-number"
                );

            if (rank) {
                rank.textContent =
                    String(index + 1);
            }
        }
    );
}


async function submitMyRanking() {

    const items =
        Array.from(
            rankingList.querySelectorAll(
                ".ranking-item"
            )
        );

    const ranking =
        items.map(
            function (item) {
                return item.dataset.playerId;
            }
        );

    if (
        ranking.length !==
        currentSubmissions.length
    ) {
        return;
    }

    submitRanking.disabled =
        true;

    submitRanking.textContent =
        "SUBMITTING...";

    try {

        await setDoc(
            doc(
                db,
                "rooms",
                roomCode,
                "rounds",
                String(
                    currentRound.number
                ),
                "rankings",
                currentUser.uid
            ),
            {
                ranking:
                    ranking,

                playerId:
                    currentUser.uid,

                submittedAt:
                    serverTimestamp()
            }
        );

        showScreen(
            lockedScreen
        );

    } catch (error) {

        console.error(
            "RANKING ERROR:",
            error
        );

        alert(
            "Could not submit your vote.\n\n" +
            (error.message ||
                "Unknown error.")
        );

        submitRanking.disabled =
            false;

        submitRanking.textContent =
            "SUBMIT VOTE";
    }
}


async function maybeFinishRanking() {

    if (
        !isHost() ||
        calculatingResults ||
        currentPhase !==
            "ranking"
    ) {
        return;
    }

    if (
        currentRankings.length <
        getPlayerCount()
    ) {
        return;
    }

    calculatingResults =
        true;

    try {

        await calculateResults();

        await updateDoc(
            getRoundRef(
                currentRound.number
            ),
            {
                phase:
                    "results"
            }
        );

    } catch (error) {

        console.error(
            "RESULTS ERROR:",
            error
        );

    } finally {

        calculatingResults =
            false;
    }
}


async function calculateResults() {

    const submissionsSnapshot =
        await getDocs(
            getSubmissionsRef(
                currentRound.number
            )
        );

    const rankingsSnapshot =
        await getDocs(
            getRankingsRef(
                currentRound.number
            )
        );

    const answerScores = {};

    submissionsSnapshot.forEach(
        function (submissionDoc) {

            answerScores[
                submissionDoc.id
            ] = 0;
        }
    );


    rankingsSnapshot.forEach(
        function (rankingDoc) {

            const data =
                rankingDoc.data();

            const ranking =
                Array.isArray(
                    data.ranking
                )
                    ? data.ranking
                    : [];

            ranking.forEach(
                function (
                    playerId,
                    position
                ) {

                    const points =
                        ranking.length -
                        position;

                    if (
                        Object.prototype.hasOwnProperty.call(
                            answerScores,
                            playerId
                        )
                    ) {

                        answerScores[
                            playerId
                        ] += points;
                    }
                }
            );
        }
    );


    const multiplier =
        multipliers[
            Math.min(
                Number(
                    currentRound.number
                ) - 1,
                multipliers.length - 1
            )
        ];


    const results =
        [];

    submissionsSnapshot.forEach(
        function (submissionDoc) {

            results.push(
                {
                    playerId:
                        submissionDoc.id,

                    answer:
                        submissionDoc.data()
                            .answer || "",

                    rawScore:
                        answerScores[
                            submissionDoc.id
                        ] || 0
                }
            );
        }
    );


    results.sort(
        function (a, b) {

            if (
                b.rawScore !==
                a.rawScore
            ) {

                return (
                    b.rawScore -
                    a.rawScore
                );
            }

            return a.answer.localeCompare(
                b.answer
            );
        }
    );


    results.forEach(
        function (result) {

            result.score =
                Math.round(
                    result.rawScore *
                    multiplier
                );
        }
    );


    const previousScores =
        room.scores &&
        typeof room.scores ===
            "object"
            ? {
                ...room.scores
            }
            : {};


    results.forEach(
        function (result) {

            previousScores[
                result.playerId
            ] =
                Number(
                    previousScores[
                        result.playerId
                    ] || 0
                ) +
                result.score;
        }
    );


    await setDoc(
        doc(
            db,
            "rooms",
            roomCode,
            "rounds",
            String(
                currentRound.number
            ),
            "results",
            "summary"
        ),
        {
            multiplier:
                multiplier,

            answers:
                results,

            createdAt:
                serverTimestamp()
        }
    );


    await updateDoc(
        doc(
            db,
            "rooms",
            roomCode
        ),
        {
            scores:
                previousScores
        }
    );
}


async function renderResults() {

    const resultRef =
        doc(
            db,
            "rooms",
            roomCode,
            "rounds",
            String(
                currentRound.number
            ),
            "results",
            "summary"
        );

    const snapshot =
        await getDoc(resultRef);

    if (!snapshot.exists()) {
        return;
    }

    currentResults =
        snapshot.data();

    showScreen(
        resultsScreen
    );

    resultsList.innerHTML =
        "";

    const answers =
        Array.isArray(
            currentResults.answers
        )
            ? currentResults.answers
            : [];


    answers.forEach(
        function (result, index) {

            const player =
                players.find(
                    function (item) {

                        return (
                            item.id ===
                            result.playerId
                        );
                    }
                );


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "result-card";


            const place =
                document.createElement(
                    "strong"
                );

            place.className =
                "result-place";

            place.textContent =
                "#" +
                String(index + 1);


            const answer =
                document.createElement(
                    "span"
                );

            answer.className =
                "result-answer";

            answer.textContent =
                result.answer;


            const author =
                document.createElement(
                    "small"
                );

            author.className =
                "result-author";

            author.textContent =
                player
                    ? player.name
                    : "PLAYER";


            const points =
                document.createElement(
                    "b"
                );

            points.className =
                "result-points";

            points.textContent =
                "+" +
                String(
                    result.score || 0
                );


            card.appendChild(
                place
            );

            card.appendChild(
                answer
            );

            card.appendChild(
                author
            );

            card.appendChild(
                points
            );

            resultsList.appendChild(
                card
            );
        }
    );


    nextRoundButton.classList.add(
        "hidden"
    );

    if (isHost()) {

        if (
            Number(
                currentRound.number
            ) <
            MAX_ROUNDS
        ) {

            nextRoundButton.textContent =
                "NEXT ROUND";

            nextRoundButton.classList.remove(
                "hidden"
            );

        } else {

            nextRoundButton.textContent =
                "SEE FINAL RESULTS";

            nextRoundButton.classList.remove(
                "hidden"
            );
        }
    }
}


async function nextRound() {

    if (
        !isHost() ||
        !currentRound
    ) {
        return;
    }

    nextRoundButton.disabled =
        true;

    try {

        const number =
            Number(
                currentRound.number
            );

        if (
            number >=
            MAX_ROUNDS
        ) {

            await updateDoc(
                doc(
                    db,
                    "rooms",
                    roomCode
                ),
                {
                    status:
                        "finished"
                }
            );

            return;
        }


        await updateDoc(
            doc(
                db,
                "rooms",
                roomCode
            ),
            {
                currentRound:
                    number + 1
            }
        );

    } catch (error) {

        console.error(
            "NEXT ROUND ERROR:",
            error
        );

        alert(
            error.message ||
            "Could not start the next round."
        );

        nextRoundButton.disabled =
            false;
    }
}


async function renderFinalResults() {

    if (finishingGame) {
        return;
    }

    const scores =
        room.scores &&
        typeof room.scores ===
            "object"
            ? room.scores
            : {};


    const sorted =
        players
            .slice()
            .sort(
                function (a, b) {

                    const scoreA =
                        Number(
                            scores[a.id] ||
                            0
                        );

                    const scoreB =
                        Number(
                            scores[b.id] ||
                            0
                        );

                    return (
                        scoreB -
                        scoreA
                    );
                }
            );


    if (!sorted.length) {
        return;
    }


    const winner =
        sorted[0];

    winnerName.textContent =
        winner.name;

    winnerScore.textContent =
        String(
            scores[winner.id] ||
            0
        );


    finalLeaderboard.innerHTML =
        "";


    sorted.forEach(
        function (player, index) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "leaderboard-row";


            const rank =
                document.createElement(
                    "strong"
                );

            rank.className =
                "leaderboard-rank";

            rank.textContent =
                "#" +
                String(index + 1);


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "leaderboard-name";

            name.textContent =
                player.name;


            const score =
                document.createElement(
                    "b"
                );

            score.className =
                "leaderboard-score";

            score.textContent =
                String(
                    scores[player.id] ||
                    0
                );


            row.appendChild(
                rank
            );

            row.appendChild(
                name
            );

            row.appendChild(
                score
            );

            finalLeaderboard.appendChild(
                row
            );
        }
    );


    showScreen(
        finalScreen
    );
}


function updateCharacterCount() {

    characterCount.textContent =
        String(
            answerInput.value.length
        ) +
        "/100";
}


function shuffle(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        const temporary =
            array[i];

        array[i] =
            array[j];

        array[j] =
            temporary;
    }

    return array;
}


answerInput.addEventListener(
    "input",
    updateCharacterCount
);


answerInput.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            event.shiftKey
        ) {
            return;
        }

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            submitMyAnswer();
        }
    }
);


submitAnswer.addEventListener(
    "click",
    submitMyAnswer
);


submitRanking.addEventListener(
    "click",
    submitMyRanking
);


nextRoundButton.addEventListener(
    "click",
    nextRound
);


homeButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "../index.html";
    }
);


initialise();
