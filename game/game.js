import { db, loginAnonymously } from "../firebase.js";

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

const params = new URLSearchParams(window.location.search);
const roomCode = (params.get("room") || "").toUpperCase();

const MAX_ROUNDS = 5;
const multipliers = [1, 1, 1.5, 1.5, 2];

let currentUser = null;
let room = null;
let players = [];

let currentRound = null;

let roomUnsubscribe = null;
let playersUnsubscribe = null;
let roundUnsubscribe = null;

let finishingRound = false;
let changingPhase = false;

const waiting = document.getElementById("waiting");
const promptScreen = document.getElementById("promptScreen");
const lockedScreen = document.getElementById("lockedScreen");
const revealScreen = document.getElementById("revealScreen");
const rankingScreen = document.getElementById("rankingScreen");
const resultsScreen = document.getElementById("resultsScreen");
const finalScreen = document.getElementById("finalScreen");

const roundNumber = document.getElementById("roundNumber");
const roundTotal = document.getElementById("roundTotal");
const promptCategory = document.getElementById("promptCategory");
const promptQuestion = document.getElementById("promptQuestion");
const modifierIndicator = document.getElementById("modifierIndicator");

const answerInput = document.getElementById("answerInput");
const characterCount = document.getElementById("characterCount");
const submitAnswer = document.getElementById("submitAnswer");

const answersList = document.getElementById("answersList");
const rankingList = document.getElementById("rankingList");
const submitRanking = document.getElementById("submitRanking");

const resultsList = document.getElementById("resultsList");
const nextRoundButton = document.getElementById("nextRoundButton");

const winnerName = document.getElementById("winnerName");
const winnerScore = document.getElementById("winnerScore");
const finalLeaderboard = document.getElementById("finalLeaderboard");

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

    screens.forEach(function (item) {
        if (item) {
            item.classList.add("hidden");
        }
    });

    if (screen) {
        screen.classList.remove("hidden");
    }
}

function getPromptArrays() {
    const arrays = [];

    if (Array.isArray(window.moneyPrompts)) {
        arrays.push(...window.moneyPrompts);
    }

    if (Array.isArray(window.everydayLifePrompts)) {
        arrays.push(...window.everydayLifePrompts);
    }

    if (Array.isArray(window.workPrompts)) {
        arrays.push(...window.workPrompts);
    }

    if (Array.isArray(window.foodPrompts)) {
        arrays.push(...window.foodPrompts);
    }

    if (Array.isArray(window.travelPrompts)) {
        arrays.push(...window.travelPrompts);
    }

    if (Array.isArray(window.familyPrompts)) {
        arrays.push(...window.familyPrompts);
    }

    if (Array.isArray(window.sportPrompts)) {
        arrays.push(...window.sportPrompts);
    }

    if (Array.isArray(window.moralDilemmasPrompts)) {
        arrays.push(...window.moralDilemmasPrompts);
    }

    if (Array.isArray(window.ridiculousPrompts)) {
        arrays.push(...window.ridiculousPrompts);
    }

    if (Array.isArray(window.hamishAndAndyPrompts)) {
        arrays.push(...window.hamishAndAndyPrompts);
    }

    return arrays;
}

function normalisePrompt(prompt) {
    if (typeof prompt === "string") {
        return {
            category: "RANDOM",
            question: prompt
        };
    }

    if (!prompt) {
        return null;
    }

    return {
        category:
            prompt.category ||
            "RANDOM",

        question:
            prompt.question ||
            prompt.prompt ||
            prompt.text ||
            ""
    };
}

function choosePrompt() {
    const prompts = getPromptArrays()
        .map(normalisePrompt)
        .filter(function (prompt) {
            return prompt && prompt.question;
        });

    if (!prompts.length) {
        return {
            category: "RANDOM",
            question: "What is the most common thing people do?"
        };
    }

    const usedPrompts =
        Array.isArray(room.usedPrompts)
            ? room.usedPrompts
            : [];

    const unusedPrompts = prompts.filter(function (prompt) {
        return !usedPrompts.includes(prompt.question);
    });

    const available =
        unusedPrompts.length
            ? unusedPrompts
            : prompts;

    return available[
        Math.floor(Math.random() * available.length)
    ];
}

async function initialiseGame() {
    if (!roomCode) {
        window.location.href = "../index.html";
        return;
    }

    try {
        currentUser = await loginAnonymously();

        await loadRoom();

        listenToRoom();
        listenToPlayers();

    } catch (error) {
        console.error(
            "GAME INITIALISE ERROR:",
            error
        );

        alert(
            "Could not connect to the game.\n\n" +
            (error.message || "Unknown error.")
        );
    }
}

async function loadRoom() {
    const roomRef = doc(
        db,
        "rooms",
        roomCode
    );

    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
        alert("That game does not exist.");
        window.location.href = "../index.html";
        return;
    }

    room = {
        id: snapshot.id,
        ...snapshot.data()
    };
}

function listenToRoom() {
    const roomRef = doc(
        db,
        "rooms",
        roomCode
    );

    roomUnsubscribe = onSnapshot(
        roomRef,
        async function (snapshot) {
            if (!snapshot.exists()) {
                alert("The game has ended.");
                window.location.href = "../index.html";
                return;
            }

            room = {
                id: snapshot.id,
                ...snapshot.data()
            };

            renderHeader();

            if (room.status === "playing") {
                await makeSureRoundExists();
                listenToRound();
            }

            if (room.status === "finished") {
                await renderFinalResults();
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
    const playersRef = collection(
        db,
        "rooms",
        roomCode,
        "players"
    );

    playersUnsubscribe = onSnapshot(
        playersRef,
        function (snapshot) {
            players = [];

            snapshot.forEach(function (playerDoc) {
                players.push({
                    id: playerDoc.id,
                    ...playerDoc.data()
                });
            });

            renderHeader();
        },
        function (error) {
            console.error(
                "PLAYERS LISTENER ERROR:",
                error
            );
        }
    );
}

function renderHeader() {
    const round =
        Number(room.currentRound || 1);

    if (roundNumber) {
        roundNumber.textContent =
            String(round);
    }

    if (roundTotal) {
        roundTotal.textContent =
            String(MAX_ROUNDS);
    }

    if (modifierIndicator) {
        const modifiers = {
            none: "NO MODIFIER",
            "common-man": "COMMON MAN",
            "no-obvious": "NO OBVIOUS ANSWERS",
            character: "THE CHARACTER",
            "money-talks": "MONEY TALKS",
            predictive: "PREDICTIVE COMMON MAN"
        };

        modifierIndicator.textContent =
            modifiers[room.modifier || "none"] ||
            "NO MODIFIER";
    }
}

async function makeSureRoundExists() {
    const number =
        Number(room.currentRound || 1);

    const roundRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(number)
    );

    const snapshot = await getDoc(roundRef);

    if (snapshot.exists()) {
        return;
    }

    if (room.hostId !== currentUser.uid) {
        return;
    }

    const prompt = choosePrompt();

    const usedPrompts =
        Array.isArray(room.usedPrompts)
            ? room.usedPrompts.slice()
            : [];

    if (!usedPrompts.includes(prompt.question)) {
        usedPrompts.push(prompt.question);
    }

    await setDoc(
        roundRef,
        {
            number: number,
            category: prompt.category,
            question: prompt.question,
            phase: "answering",
            createdAt: serverTimestamp()
        }
    );

    await updateDoc(
        doc(db, "rooms", roomCode),
        {
            usedPrompts: usedPrompts
        }
    );
}

function listenToRound() {
    const number =
        Number(room.currentRound || 1);

    const roundRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(number)
    );

    if (roundUnsubscribe) {
        roundUnsubscribe();
    }

    roundUnsubscribe = onSnapshot(
        roundRef,
        function (snapshot) {
            if (!snapshot.exists()) {
                return;
            }

            currentRound = {
                id: snapshot.id,
                ...snapshot.data()
            };

            renderRound();
        },
        function (error) {
            console.error(
                "ROUND LISTENER ERROR:",
                error
            );
        }
    );
}

async function renderRound() {
    if (!currentRound) {
        return;
    }

    if (promptCategory) {
        promptCategory.textContent =
            currentRound.category;
    }

    if (promptQuestion) {
        promptQuestion.textContent =
            currentRound.question;
    }

    if (currentRound.phase === "answering") {
        await renderAnswering();
        return;
    }

    if (currentRound.phase === "reveal") {
        await renderReveal();
        return;
    }

    if (currentRound.phase === "ranking") {
        await renderRanking();
        return;
    }

    if (currentRound.phase === "results") {
        await renderResults();
    }
}

async function getMySubmission() {
    const submissionRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "submissions",
        currentUser.uid
    );

    return await getDoc(submissionRef);
}

async function renderAnswering() {
    const submission =
        await getMySubmission();

    if (submission.exists()) {
        showScreen(lockedScreen);

        if (
            room.hostId === currentUser.uid
        ) {
            await checkEveryoneAnswered();
        }

        return;
    }

    showScreen(promptScreen);

    if (answerInput) {
        answerInput.focus();
    }

    if (
        room.hostId === currentUser.uid
    ) {
        await checkEveryoneAnswered();
    }
}

async function submitMyAnswer() {
    const answer =
        answerInput.value.trim();

    if (!answer) {
        answerInput.classList.add(
            "input-error"
        );

        setTimeout(function () {
            answerInput.classList.remove(
                "input-error"
            );
        }, 300);

        return;
    }

    if (answer.length > 100) {
        return;
    }

    submitAnswer.disabled = true;
    submitAnswer.textContent =
        "LOCKING IN...";

    try {
        const submissionRef = doc(
            db,
            "rooms",
            roomCode,
            "rounds",
            String(currentRound.number),
            "submissions",
            currentUser.uid
        );

        await setDoc(
            submissionRef,
            {
                playerId: currentUser.uid,
                answer: answer,
                submittedAt: serverTimestamp()
            }
        );

        showScreen(lockedScreen);

        if (
            room.hostId === currentUser.uid
        ) {
            await checkEveryoneAnswered();
        }

    } catch (error) {
        console.error(
            "SUBMIT ANSWER ERROR:",
            error
        );

        alert(
            "Could not submit your answer.\n\n" +
            (error.message || "Unknown error.")
        );

        submitAnswer.disabled = false;
        submitAnswer.textContent =
            "LOCK IT IN";
    }
}

async function checkEveryoneAnswered() {
    if (
        changingPhase ||
        room.hostId !== currentUser.uid
    ) {
        return;
    }

    const submissionsRef = collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "submissions"
    );

    const snapshot =
        await getDocs(submissionsRef);

    if (snapshot.size < players.length) {
        return;
    }

    changingPhase = true;

    try {
        await updateDoc(
            doc(
                db,
                "rooms",
                roomCode,
                "rounds",
                String(currentRound.number)
            ),
            {
                phase: "reveal"
            }
        );
    } finally {
        setTimeout(function () {
            changingPhase = false;
        }, 500);
    }
}

async function getSubmissions() {
    const submissionsRef = collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "submissions"
    );

    const snapshot =
        await getDocs(submissionsRef);

    const submissions = [];

    snapshot.forEach(function (submissionDoc) {
        submissions.push({
            id: submissionDoc.id,
            ...submissionDoc.data()
        });
    });

    return submissions;
}

async function renderReveal() {
    const submissions =
        await getSubmissions();

    if (!answersList) {
        return;
    }

    answersList.innerHTML = "";

    const shuffled =
        submissions.slice();

    for (
        let i = shuffled.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        const temporary =
            shuffled[i];

        shuffled[i] =
            shuffled[j];

        shuffled[j] =
            temporary;
    }

    shuffled.forEach(function (submission) {
        const card =
            document.createElement("div");

        card.className =
            "answer-card";

        card.textContent =
            submission.answer;

        answersList.appendChild(card);
    });

    showScreen(revealScreen);

    if (
        room.hostId === currentUser.uid
    ) {
        setTimeout(function () {
            moveToRanking();
        }, 2000);
    }
}

async function moveToRanking() {
    if (
        changingPhase ||
        room.hostId !== currentUser.uid
    ) {
        return;
    }

    changingPhase = true;

    try {
        const roundRef = doc(
            db,
            "rooms",
            roomCode,
            "rounds",
            String(currentRound.number)
        );

        const snapshot =
            await getDoc(roundRef);

        if (!snapshot.exists()) {
            return;
        }

        if (
            snapshot.data().phase !==
            "reveal"
        ) {
            return;
        }

        await updateDoc(
            roundRef,
            {
                phase: "ranking"
            }
        );
    } finally {
        setTimeout(function () {
            changingPhase = false;
        }, 500);
    }
}

async function renderRanking() {
    const rankingRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "rankings",
        currentUser.uid
    );

    const existingRanking =
        await getDoc(rankingRef);

    if (existingRanking.exists()) {
        showScreen(waiting);
        return;
    }

    const submissions =
        await getSubmissions();

    if (!rankingList) {
        return;
    }

    rankingList.innerHTML = "";

    submissions.forEach(function (submission) {
        const item =
            document.createElement("div");

        item.className =
            "ranking-card";

        item.draggable = true;

        item.dataset.playerId =
            submission.playerId;

        const number =
            document.createElement("span");

        number.className =
            "ranking-position";

        const text =
            document.createElement("span");

        text.textContent =
            submission.answer;

        item.appendChild(number);
        item.appendChild(text);

        item.addEventListener(
            "dragstart",
            function (event) {
                event.dataTransfer.setData(
                    "text/plain",
                    submission.playerId
                );
            }
        );

        item.addEventListener(
            "dragover",
            function (event) {
                event.preventDefault();
            }
        );

        item.addEventListener(
            "drop",
            function (event) {
                event.preventDefault();

                const draggedId =
                    event.dataTransfer.getData(
                        "text/plain"
                    );

                const dragged =
                    rankingList.querySelector(
                        '[data-player-id="' +
                        draggedId +
                        '"]'
                    );

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

                updateRankingNumbers();
            }
        );

        rankingList.appendChild(item);
    });

    updateRankingNumbers();

    showScreen(rankingScreen);
}

function updateRankingNumbers() {
    if (!rankingList) {
        return;
    }

    const cards =
        rankingList.querySelectorAll(
            ".ranking-card"
        );

    cards.forEach(function (card, index) {
        const number =
            card.querySelector(
                ".ranking-position"
            );

        if (number) {
            number.textContent =
                String(index + 1);
        }
    });
}

async function submitMyRanking() {
    const cards =
        Array.from(
            rankingList.querySelectorAll(
                ".ranking-card"
            )
        );

    if (
        cards.length !== players.length
    ) {
        alert(
            "Something went wrong with the answers."
        );

        return;
    }

    const ranking =
        cards.map(function (card) {
            return card.dataset.playerId;
        });

    submitRanking.disabled = true;
    submitRanking.textContent =
        "SUBMITTING...";

    try {
        const rankingRef = doc(
            db,
            "rooms",
            roomCode,
            "rounds",
            String(currentRound.number),
            "rankings",
            currentUser.uid
        );

        await setDoc(
            rankingRef,
            {
                playerId: currentUser.uid,
                ranking: ranking,
                submittedAt: serverTimestamp()
            }
        );

        showScreen(waiting);

        if (
            room.hostId === currentUser.uid
        ) {
            await checkEveryoneVoted();
        }

    } catch (error) {
        console.error(
            "SUBMIT RANKING ERROR:",
            error
        );

        alert(
            "Could not submit your vote.\n\n" +
            (error.message || "Unknown error.")
        );

        submitRanking.disabled = false;
        submitRanking.textContent =
            "SUBMIT VOTE";
    }
}

async function checkEveryoneVoted() {
    if (
        finishingRound ||
        room.hostId !== currentUser.uid
    ) {
        return;
    }

    const rankingsRef = collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "rankings"
    );

    const snapshot =
        await getDocs(rankingsRef);

    if (snapshot.size < players.length) {
        return;
    }

    finishingRound = true;

    try {
        await calculateResults();

        await updateDoc(
            doc(
                db,
                "rooms",
                roomCode,
                "rounds",
                String(currentRound.number)
            ),
            {
                phase: "results"
            }
        );

    } catch (error) {
        console.error(
            "CALCULATE RESULTS ERROR:",
            error
        );
    } finally {
        setTimeout(function () {
            finishingRound = false;
        }, 500);
    }
}

async function calculateResults() {
    const submissions =
        await getSubmissions();

    const rankingsRef = collection(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "rankings"
    );

    const rankingsSnapshot =
        await getDocs(rankingsRef);

    const scores = {};

    submissions.forEach(function (submission) {
        scores[submission.playerId] = 0;
    });

    rankingsSnapshot.forEach(function (rankingDoc) {
        const rankingData =
            rankingDoc.data();

        const ranking =
            Array.isArray(rankingData.ranking)
                ? rankingData.ranking
                : [];

        ranking.forEach(function (
            playerId,
            position
        ) {
            const points =
                players.length -
                position;

            if (
                Object.prototype.hasOwnProperty.call(
                    scores,
                    playerId
                )
            ) {
                scores[playerId] += points;
            }
        });
    });

    const multiplier =
        multipliers[
            Math.min(
                currentRound.number - 1,
                multipliers.length - 1
            )
        ];

    const orderedAnswers =
        submissions
            .map(function (submission) {
                return {
                    playerId:
                        submission.playerId,

                    answer:
                        submission.answer,

                    rawScore:
                        scores[
                            submission.playerId
                        ] || 0,

                    score:
                        Math.round(
                            (
                                scores[
                                    submission.playerId
                                ] || 0
                            ) *
                            multiplier
                        )
                };
            })
            .sort(function (a, b) {
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
            });

    const resultsRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "results",
        "summary"
    );

    await setDoc(
        resultsRef,
        {
            multiplier:
                multiplier,

            answers:
                orderedAnswers,

            createdAt:
                serverTimestamp()
        }
    );

    for (
        const result of orderedAnswers
    ) {
        const playerRef = doc(
            db,
            "rooms",
            roomCode,
            "players",
            result.playerId
        );

        const playerSnapshot =
            await getDoc(playerRef);

        if (!playerSnapshot.exists()) {
            continue;
        }

        const player =
            playerSnapshot.data();

        await updateDoc(
            playerRef,
            {
                score:
                    Number(
                        player.score || 0
                    ) +
                    result.score
            }
        );
    }
}

async function renderResults() {
    const resultsRef = doc(
        db,
        "rooms",
        roomCode,
        "rounds",
        String(currentRound.number),
        "results",
        "summary"
    );

    const snapshot =
        await getDoc(resultsRef);

    if (!snapshot.exists()) {
        return;
    }

    const data =
        snapshot.data();

    resultsList.innerHTML = "";

    data.answers.forEach(
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
                document.createElement("div");

            card.className =
                "result-card";

            const place =
                document.createElement("strong");

            place.textContent =
                "#" + String(index + 1);

            const answer =
                document.createElement("span");

            answer.textContent =
                result.answer;

            const author =
                document.createElement("small");

            author.textContent =
                player
                    ? player.name
                    : "PLAYER";

            const points =
                document.createElement("b");

            points.textContent =
                "+" +
                String(result.score);

            card.appendChild(place);
            card.appendChild(answer);
            card.appendChild(author);
            card.appendChild(points);

            resultsList.appendChild(card);
        }
    );

    showScreen(resultsScreen);

    if (
        room.hostId === currentUser.uid &&
        currentRound.number <
        MAX_ROUNDS
    ) {
        nextRoundButton.classList.remove(
            "hidden"
        );
    }
}

async function startNextRound() {
    if (
        room.hostId !== currentUser.uid
    ) {
        return;
    }

    nextRoundButton.disabled = true;

    const nextRound =
        Number(room.currentRound || 1) +
        1;

    await updateDoc(
        doc(
            db,
            "rooms",
            roomCode
        ),
        {
            currentRound:
                nextRound
        }
    );

    nextRoundButton.disabled = false;
}

async function finishGame() {
    if (
        room.hostId !== currentUser.uid
    ) {
        return;
    }

    await updateDoc(
        doc(
            db,
            "rooms",
            roomCode
        ),
        {
            status: "finished"
        }
    );
}

async function renderFinalResults() {
    const sortedPlayers =
        players
            .slice()
            .sort(function (a, b) {
                return (
                    Number(b.score || 0) -
                    Number(a.score || 0)
                );
            });

    if (sortedPlayers.length) {
        const winner =
            sortedPlayers[0];

        if (winnerName) {
            winnerName.textContent =
                winner.name;
        }

        if (winnerScore) {
            winnerScore.textContent =
                String(
                    winner.score || 0
                );
        }
    }

    finalLeaderboard.innerHTML = "";

    sortedPlayers.forEach(
        function (player, index) {
            const row =
                document.createElement("div");

            row.className =
                "leaderboard-row";

            const place =
                document.createElement("strong");

            place.textContent =
                "#" + String(index + 1);

            const name =
                document.createElement("span");

            name.textContent =
                player.name;

            const score =
                document.createElement("b");

            score.textContent =
                String(
                    player.score || 0
                );

            row.appendChild(place);
            row.appendChild(name);
            row.appendChild(score);

            finalLeaderboard.appendChild(row);
        }
    );

    showScreen(finalScreen);
}

function updateCharacterCount() {
    if (
        !answerInput ||
        !characterCount
    ) {
        return;
    }

    characterCount.textContent =
        String(
            answerInput.value.length
        ) +
        "/100";
}

if (answerInput) {
    answerInput.addEventListener(
        "input",
        updateCharacterCount
    );
}

if (submitAnswer) {
    submitAnswer.addEventListener(
        "click",
        submitMyAnswer
    );
}

if (submitRanking) {
    submitRanking.addEventListener(
        "click",
        submitMyRanking
    );
}

if (nextRoundButton) {
    nextRoundButton.addEventListener(
        "click",
        async function () {
            if (
                currentRound.number >=
                MAX_ROUNDS
            ) {
                await finishGame();
            } else {
                await startNextRound();
            }
        }
    );
}

initialiseGame();
