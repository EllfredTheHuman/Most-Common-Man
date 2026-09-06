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
const roomCode = (params.get("room") || "").trim().toUpperCase();

const MAX_ROUNDS = 5;
const MULTIPLIERS = [1, 1, 1.5, 1.5, 2];

const screens = {
    waiting: document.getElementById("waiting"),
    prompt: document.getElementById("promptScreen"),
    locked: document.getElementById("lockedScreen"),
    reveal: document.getElementById("revealScreen"),
    ranking: document.getElementById("rankingScreen"),
    results: document.getElementById("resultsScreen"),
    final: document.getElementById("finalScreen")
};

const roundNumber = document.getElementById("roundNumber");
const roundTotal = document.getElementById("roundTotal");
const promptCategory = document.getElementById("promptCategory");
const promptQuestion = document.getElementById("promptQuestion");
const modifierIndicator = document.getElementById("modifierIndicator");
const playerStatus = document.getElementById("playerStatus");

const answerInput = document.getElementById("answerInput");
const characterCount = document.getElementById("characterCount");
const submitAnswer = document.getElementById("submitAnswer");

const answerProgress = document.getElementById("answerProgress");
const answersList = document.getElementById("answersList");

const rankingProgress = document.getElementById("rankingProgress");
const rankingList = document.getElementById("rankingList");
const submitRanking = document.getElementById("submitRanking");

const resultsList = document.getElementById("resultsList");
const resultsMultiplier = document.getElementById("resultsMultiplier");
const nextRoundButton = document.getElementById("nextRoundButton");
const resultsWaiting = document.getElementById("resultsWaiting");

const winnerName = document.getElementById("winnerName");
const winnerScore = document.getElementById("winnerScore");
const finalLeaderboard = document.getElementById("finalLeaderboard");

let currentUser = null;
let room = null;
let players = [];
let currentRound = null;
let currentRoundNumber = 0;

let roomUnsubscribe = null;
let playersUnsubscribe = null;
let roundUnsubscribe = null;
let submissionsUnsubscribe = null;
let rankingsUnsubscribe = null;

let creatingRound = false;
let advancingPhase = false;
let finishingRound = false;
let finalRendered = false;

function showScreen(screen) {
    Object.values(screens).forEach(function (item) {
        if (item) {
            item.classList.add("hidden");
        }
    });

    if (screen) {
        screen.classList.remove("hidden");
    }
}

function setStatus(text) {
    if (playerStatus) {
        playerStatus.textContent = text;
    }
}

function getAllPrompts() {
    const sources = [
        ["MONEY", window.moneyPrompts],
        ["EVERYDAY LIFE", window.everydayLifePrompts],
        ["WORK", window.workPrompts],
        ["FOOD", window.foodPrompts],
        ["TRAVEL", window.travelPrompts],
        ["FAMILY", window.familyPrompts],
        ["SPORT", window.sportPrompts],
        ["MORAL DILEMMAS", window.moralDilemmasPrompts],
        ["RIDICULOUS", window.ridiculousPrompts],
        ["HAMISH & ANDY", window.hamishAndAndyPrompts]
    ];

    const prompts = [];

    sources.forEach(function (source) {
        const category = source[0];
        const list = source[1];

        if (!Array.isArray(list)) {
            return;
        }

        list.forEach(function (item) {
            if (typeof item === "string" && item.trim()) {
                prompts.push({
                    category: category,
                    question: item.trim()
                });
                return;
            }

            if (item && typeof item === "object") {
                const question = String(
                    item.question || item.prompt || item.text || ""
                ).trim();

                if (question) {
                    prompts.push({
                        category: item.category || category,
                        question: question
                    });
                }
            }
        });
    });

    return prompts;
}

function choosePrompt() {
    const prompts = getAllPrompts();

    if (!prompts.length) {
        return {
            category: "RANDOM",
            question: "What is the most common thing people do?"
        };
    }

    const used = Array.isArray(room.usedPrompts)
        ? room.usedPrompts
        : [];

    const unused = prompts.filter(function (prompt) {
        return !used.includes(prompt.question);
    });

    const available = unused.length ? unused : prompts;

    return available[Math.floor(Math.random() * available.length)];
}

function getCurrentPlayer() {
    return players.find(function (player) {
        return player.id === currentUser.uid;
    }) || null;
}

function getPlayerName(playerId) {
    const player = players.find(function (item) {
        return item.id === playerId;
    });

    return player ? player.name : "Player";
}

function isHost() {
    return !!currentUser && !!room && room.hostId === currentUser.uid;
}

function getRoundRef(number) {
    return doc(db, "rooms", roomCode, "rounds", String(number));
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

async function initialiseGame() {
    if (!roomCode) {
        window.location.href = "../index.html";
        return;
    }

    try {
        currentUser = await loginAnonymously();

        const roomSnapshot = await getDoc(doc(db, "rooms", roomCode));

        if (!roomSnapshot.exists()) {
            alert("That game does not exist.");
            window.location.href = "../index.html";
            return;
        }

        room = {
            id: roomSnapshot.id,
            ...roomSnapshot.data()
        };

        listenToRoom();
        listenToPlayers();
    } catch (error) {
        console.error("GAME INITIALISE ERROR:", error);
        showScreen(screens.waiting);
        setStatus("Could not connect to the game.");
    }
}

function listenToRoom() {
    const roomRef = doc(db, "rooms", roomCode);

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

            if (room.status === "finished") {
                stopRoundListeners();
                await renderFinalResults();
                return;
            }

            if (room.status !== "playing") {
                showScreen(screens.waiting);
                setStatus("Waiting for the host to start the game...");
                return;
            }

            const number = Number(room.currentRound || 1);

            if (number !== currentRoundNumber) {
                currentRoundNumber = number;
                finalRendered = false;
                subscribeToRound(number);
            }

            await ensureRoundExists(number);
        },
        function (error) {
            console.error("ROOM LISTENER ERROR:", error);
            setStatus("Connection problem. Trying again...");
        }
    );
}

function listenToPlayers() {
    const playersRef = collection(db, "rooms", roomCode, "players");

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

            players.sort(function (a, b) {
                const aTime = a.joinedAt && a.joinedAt.seconds
                    ? a.joinedAt.seconds
                    : 0;
                const bTime = b.joinedAt && b.joinedAt.seconds
                    ? b.joinedAt.seconds
                    : 0;
                return aTime - bTime;
            });

            renderHeader();
            renderCurrentPhase();
        },
        function (error) {
            console.error("PLAYERS LISTENER ERROR:", error);
        }
    );
}

function renderHeader() {
    if (!room) {
        return;
    }

    const round = Number(room.currentRound || 1);

    if (roundNumber) {
        roundNumber.textContent = String(round);
    }

    if (roundTotal) {
        roundTotal.textContent = String(MAX_ROUNDS);
    }

    const modifiers = {
        none: "NO MODIFIER",
        "common-man": "COMMON MAN",
        "no-obvious": "NO OBVIOUS ANSWERS",
        character: "THE CHARACTER",
        "money-talks": "MONEY TALKS",
        predictive: "PREDICTIVE COMMON MAN"
    };

    if (modifierIndicator) {
        modifierIndicator.textContent =
            modifiers[room.modifier || "none"] || "NO MODIFIER";
    }
}

async function ensureRoundExists(number) {
    if (creatingRound || !room || room.status !== "playing") {
        return;
    }

    const roundRef = getRoundRef(number);
    const snapshot = await getDoc(roundRef);

    if (snapshot.exists()) {
        return;
    }

    if (!isHost()) {
        return;
    }

    creatingRound = true;

    try {
        const prompt = choosePrompt();
        const usedPrompts = Array.isArray(room.usedPrompts)
            ? room.usedPrompts.slice()
            : [];

        if (!usedPrompts.includes(prompt.question)) {
            usedPrompts.push(prompt.question);
        }

        await setDoc(roundRef, {
            number: number,
            category: prompt.category,
            question: prompt.question,
            phase: "answering",
            createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, "rooms", roomCode), {
            usedPrompts: usedPrompts
        });
    } catch (error) {
        console.error("CREATE ROUND ERROR:", error);
    } finally {
        creatingRound = false;
    }
}

function subscribeToRound(number) {
    stopRoundListeners();

    currentRound = null;

    const roundRef = getRoundRef(number);

    roundUnsubscribe = onSnapshot(
        roundRef,
        function (snapshot) {
            if (!snapshot.exists()) {
                showScreen(screens.waiting);
                setStatus("Preparing the next round...");
                return;
            }

            currentRound = {
                id: snapshot.id,
                ...snapshot.data()
            };

            subscribeToPhaseData(number, currentRound.phase);
            renderCurrentPhase();
        },
        function (error) {
            console.error("ROUND LISTENER ERROR:", error);
        }
    );
}

function subscribeToPhaseData(number, phase) {
    if (submissionsUnsubscribe) {
        submissionsUnsubscribe();
        submissionsUnsubscribe = null;
    }

    if (rankingsUnsubscribe) {
        rankingsUnsubscribe();
        rankingsUnsubscribe = null;
    }

    if (phase === "answering" || phase === "locked" || phase === "reveal") {
        submissionsUnsubscribe = onSnapshot(
            getSubmissionsRef(number),
            function (snapshot) {
                const submissions = [];

                snapshot.forEach(function (submissionDoc) {
                    submissions.push({
                        id: submissionDoc.id,
                        ...submissionDoc.data()
                    });
                });

                renderSubmissionProgress(submissions);
                renderCurrentPhase();

                if (isHost() && currentRound && currentRound.phase === "answering") {
                    if (submissions.length >= players.length && players.length >= 2) {
                        advanceToReveal(submissions);
                    }
                }
            },
            function (error) {
                console.error("SUBMISSION LISTENER ERROR:", error);
            }
        );
    }

    if (phase === "ranking" || phase === "results") {
        rankingsUnsubscribe = onSnapshot(
            getRankingsRef(number),
            function (snapshot) {
                const rankings = [];

                snapshot.forEach(function (rankingDoc) {
                    rankings.push({
                        id: rankingDoc.id,
                        ...rankingDoc.data()
                    });
                });

                renderRankingProgress(rankings);
                renderCurrentPhase();

                if (isHost() && currentRound && currentRound.phase === "ranking") {
                    if (rankings.length >= players.length && players.length >= 2) {
                        finishRound(rankings);
                    }
                }
            },
            function (error) {
                console.error("RANKING LISTENER ERROR:", error);
            }
        );
    }
}

function renderCurrentPhase() {
    if (!currentRound || !room) {
        return;
    }

    const phase = currentRound.phase;

    if (phase === "answering") {
        renderAnswering();
        return;
    }

    if (phase === "locked") {
        renderLocked();
        return;
    }

    if (phase === "reveal") {
        renderReveal();
        return;
    }

    if (phase === "ranking") {
        renderRanking();
        return;
    }

    if (phase === "results") {
        renderResults();
    }
}

function renderPromptText() {
    if (promptCategory) {
        promptCategory.textContent = currentRound.category || "RANDOM";
    }

    if (promptQuestion) {
        promptQuestion.textContent = currentRound.question || "Loading question...";
    }
}

function renderAnswering() {
    renderPromptText();

    const mySubmissionExists = currentRound.mySubmission === true;

    if (mySubmissionExists) {
        showScreen(screens.locked);
        setStatus("Answer locked in.");
        return;
    }

    showScreen(screens.prompt);
    setStatus("Write your answer. Everyone is waiting for you.");

    if (answerInput && document.activeElement !== answerInput) {
        answerInput.focus();
    }
}

function renderLocked() {
    showScreen(screens.locked);
    setStatus("Your answer is in. Waiting for everyone...");
}

function renderSubmissionProgress(submissions) {
    if (answerProgress) {
        answerProgress.textContent =
            String(submissions.length) + " / " + String(players.length) + " ANSWERED";
    }

    if (currentRound) {
        currentRound.mySubmission = submissions.some(function (item) {
            return item.id === currentUser.uid;
        });
    }
}

function getOrderedSubmissions() {
    if (!currentRound) {
        return [];
    }

    const order = Array.isArray(currentRound.answerOrder)
        ? currentRound.answerOrder
        : [];

    const submissions = currentRound.submissions || [];

    const byId = new Map();

    submissions.forEach(function (item) {
        byId.set(item.id, item);
    });

    const ordered = [];

    order.forEach(function (id) {
        if (byId.has(id)) {
            ordered.push(byId.get(id));
        }
    });

    submissions.forEach(function (item) {
        if (!order.includes(item.id)) {
            ordered.push(item);
        }
    });

    return ordered;
}

async function loadSubmissionsForCurrentRound() {
    const snapshot = await getDocs(getSubmissionsRef(currentRound.number));
    const submissions = [];

    snapshot.forEach(function (submissionDoc) {
        submissions.push({
            id: submissionDoc.id,
            ...submissionDoc.data()
        });
    });

    currentRound.submissions = submissions;
    return submissions;
}

async function renderReveal() {
    showScreen(screens.reveal);
    renderPromptText();
    setStatus("Read the answers. Then rank them.");

    if (!currentRound.submissions) {
        try {
            await loadSubmissionsForCurrentRound();
        } catch (error) {
            console.error("LOAD SUBMISSIONS ERROR:", error);
            return;
        }
    }

    const ordered = getOrderedSubmissions();

    if (!answersList) {
        return;
    }

    answersList.innerHTML = "";

    ordered.forEach(function (submission, index) {
        const card = document.createElement("div");
        card.className = "answer-card reveal-answer-card";

        const number = document.createElement("span");
        number.className = "answer-number";
        number.textContent = String(index + 1);

        const text = document.createElement("p");
        text.textContent = submission.answer;

        card.appendChild(number);
        card.appendChild(text);
        answersList.appendChild(card);
    });

    if (isHost() && !advancingPhase) {
        advancingPhase = true;

        setTimeout(async function () {
            try {
                await updateDoc(getRoundRef(currentRound.number), {
                    phase: "ranking"
                });
            } catch (error) {
                console.error("START RANKING ERROR:", error);
            } finally {
                advancingPhase = false;
            }
        }, 2200);
    }
}

async function advanceToReveal(submissions) {
    if (advancingPhase || !isHost() || !currentRound) {
        return;
    }

    advancingPhase = true;

    try {
        const ids = submissions.map(function (item) {
            return item.id;
        });

        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = ids[i];
            ids[i] = ids[j];
            ids[j] = temp;
        }

        await updateDoc(getRoundRef(currentRound.number), {
            phase: "reveal",
            answerOrder: ids
        });
    } catch (error) {
        console.error("REVEAL ERROR:", error);
    } finally {
        advancingPhase = false;
    }
}

async function submitMyAnswer() {
    if (!currentRound || currentRound.phase !== "answering") {
        return;
    }

    const answer = answerInput.value.trim();

    if (!answer) {
        answerInput.classList.add("input-error");
        setTimeout(function () {
            answerInput.classList.remove("input-error");
        }, 350);
        answerInput.focus();
        return;
    }

    if (answer.length > 100) {
        return;
    }

    submitAnswer.disabled = true;
    submitAnswer.textContent = "LOCKING...";

    try {
        await setDoc(
            doc(getSubmissionsRef(currentRound.number), currentUser.uid),
            {
                answer: answer,
                submittedAt: serverTimestamp()
            }
        );

        showScreen(screens.locked);
        setStatus("Answer locked in. Waiting for everyone...");
    } catch (error) {
        console.error("SUBMIT ANSWER ERROR:", error);
        alert("Could not submit your answer. Please try again.");
        submitAnswer.disabled = false;
        submitAnswer.textContent = "LOCK IT IN";
    }
}

async function renderRanking() {
    showScreen(screens.ranking);
    renderPromptText();
    setStatus("Drag the answers from MOST common to LEAST common.");

    if (!currentRound.submissions) {
        try {
            await loadSubmissionsForCurrentRound();
        } catch (error) {
            console.error("LOAD SUBMISSIONS ERROR:", error);
            return;
        }
    }

    const existingRanking = await getMyRanking();

    if (existingRanking) {
        showScreen(screens.locked);
        setStatus("Vote submitted. Waiting for everyone...");
        return;
    }

    renderRankingList(getOrderedSubmissions());
}

async function getMyRanking() {
    try {
        const snapshot = await getDoc(
            doc(getRankingsRef(currentRound.number), currentUser.uid)
        );

        return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
        console.error("CHECK RANKING ERROR:", error);
        return null;
    }
}

function renderRankingList(items) {
    if (!rankingList) {
        return;
    }

    rankingList.innerHTML = "";

    items.forEach(function (item, index) {
        const card = document.createElement("div");
        card.className = "ranking-card";
        card.draggable = true;
        card.dataset.id = item.id;

        const position = document.createElement("span");
        position.className = "ranking-position";
        position.textContent = String(index + 1);

        const text = document.createElement("span");
        text.textContent = item.answer;

        const grip = document.createElement("span");
        grip.className = "drag-grip";
        grip.textContent = "☷";

        card.appendChild(position);
        card.appendChild(text);
        card.appendChild(grip);

        card.addEventListener("dragstart", function (event) {
            event.dataTransfer.setData("text/plain", item.id);
            card.classList.add("dragging");
        });

        card.addEventListener("dragend", function () {
            card.classList.remove("dragging");
            updateRankingPositions();
        });

        card.addEventListener("dragover", function (event) {
            event.preventDefault();
            const dragging = rankingList.querySelector(".dragging");

            if (!dragging || dragging === card) {
                return;
            }

            const rect = card.getBoundingClientRect();
            const after = event.clientY > rect.top + rect.height / 2;

            if (after) {
                card.after(dragging);
            } else {
                card.before(dragging);
            }
        });

        card.addEventListener("click", function () {
            if (window.matchMedia("(max-width: 700px)").matches) {
                moveCardWithTap(card);
            }
        });

        rankingList.appendChild(card);
    });

    updateRankingPositions();
}

let selectedRankingCard = null;

function moveCardWithTap(card) {
    if (!selectedRankingCard) {
        selectedRankingCard = card;
        card.classList.add("selected");
        return;
    }

    if (selectedRankingCard === card) {
        card.classList.remove("selected");
        selectedRankingCard = null;
        return;
    }

    const cards = Array.from(rankingList.children);
    const from = cards.indexOf(selectedRankingCard);
    const to = cards.indexOf(card);

    if (from < to) {
        card.after(selectedRankingCard);
    } else {
        card.before(selectedRankingCard);
    }

    selectedRankingCard.classList.remove("selected");
    selectedRankingCard = null;
    updateRankingPositions();
}

function updateRankingPositions() {
    if (!rankingList) {
        return;
    }

    Array.from(rankingList.children).forEach(function (card, index) {
        const position = card.querySelector(".ranking-position");
        if (position) {
            position.textContent = String(index + 1);
        }
    });
}

async function submitMyRanking() {
    if (!currentRound || currentRound.phase !== "ranking") {
        return;
    }

    const cards = Array.from(rankingList.children);

    if (cards.length !== players.length) {
        alert("Wait for all the answers to appear first.");
        return;
    }

    const order = cards.map(function (card) {
        return card.dataset.id;
    });

    submitRanking.disabled = true;
    submitRanking.textContent = "SUBMITTING...";

    try {
        await setDoc(
            doc(getRankingsRef(currentRound.number), currentUser.uid),
            {
                order: order,
                submittedAt: serverTimestamp()
            }
        );

        showScreen(screens.locked);
        setStatus("Vote submitted. Waiting for everyone...");
    } catch (error) {
        console.error("SUBMIT RANKING ERROR:", error);
        alert("Could not submit your vote. Please try again.");
        submitRanking.disabled = false;
        submitRanking.textContent = "SUBMIT VOTE";
    }
}

function renderRankingProgress(rankings) {
    if (rankingProgress) {
        rankingProgress.textContent =
            String(rankings.length) + " / " + String(players.length) + " VOTED";
    }
}

async function finishRound(rankings) {
    if (finishingRound || !isHost() || !currentRound) {
        return;
    }

    finishingRound = true;

    try {
        const submissions = currentRound.submissions || await loadSubmissionsForCurrentRound();
        const answerOrder = Array.isArray(currentRound.answerOrder)
            ? currentRound.answerOrder
            : submissions.map(function (item) { return item.id; });

        const points = {};

        players.forEach(function (player) {
            points[player.id] = 0;
        });

        rankings.forEach(function (ranking) {
            const order = Array.isArray(ranking.order) ? ranking.order : [];
            const totalPlayers = players.length;

            order.forEach(function (answerId, index) {
                const basePoints = Math.max(totalPlayers - index, 1);
                const submission = submissions.find(function (item) {
                    return item.id === answerId;
                });

                if (submission && points[submission.id] !== undefined) {
                    points[submission.id] += basePoints;
                }
            });
        });

        const multiplier = MULTIPLIERS[currentRound.number - 1] || 1;
        const roundScores = {};

        Object.keys(points).forEach(function (playerId) {
            roundScores[playerId] = points[playerId] * multiplier;
        });

        const previousResults = [];

        for (let round = 1; round < currentRound.number; round++) {
            const resultSnapshot = await getDoc(
                doc(db, "rooms", roomCode, "rounds", String(round), "results", "summary")
            );

            if (resultSnapshot.exists()) {
                previousResults.push(resultSnapshot.data());
            }
        }

        const totals = {};

        players.forEach(function (player) {
            totals[player.id] = 0;
        });

        previousResults.forEach(function (result) {
            const scores = result.roundScores || {};
            Object.keys(scores).forEach(function (playerId) {
                totals[playerId] = (totals[playerId] || 0) + Number(scores[playerId] || 0);
            });
        });

        Object.keys(roundScores).forEach(function (playerId) {
            totals[playerId] = (totals[playerId] || 0) + roundScores[playerId];
        });

        await setDoc(
            doc(db, "rooms", roomCode, "rounds", String(currentRound.number), "results", "summary"),
            {
                round: currentRound.number,
                multiplier: multiplier,
                roundScores: roundScores,
                totals: totals,
                answerOrder: answerOrder,
                finishedAt: serverTimestamp()
            }
        );

        await updateDoc(getRoundRef(currentRound.number), {
            phase: "results"
        });
    } catch (error) {
        console.error("FINISH ROUND ERROR:", error);
    } finally {
        finishingRound = false;
    }
}

async function renderResults() {
    showScreen(screens.results);
    setStatus("Round complete.");

    let result;

    try {
        const snapshot = await getDoc(
            doc(db, "rooms", roomCode, "rounds", String(currentRound.number), "results", "summary")
        );

        if (!snapshot.exists()) {
            return;
        }

        result = snapshot.data();
    } catch (error) {
        console.error("LOAD RESULTS ERROR:", error);
        return;
    }

    if (resultsMultiplier) {
        resultsMultiplier.textContent =
            "ROUND " + String(currentRound.number) + " ×" + String(result.multiplier || 1);
    }

    if (resultsList) {
        resultsList.innerHTML = "";

        const scores = result.roundScores || {};

        const sorted = players.slice().sort(function (a, b) {
            return Number(scores[b.id] || 0) - Number(scores[a.id] || 0);
        });

        sorted.forEach(function (player, index) {
            const card = document.createElement("div");
            card.className = "result-card";

            const place = document.createElement("span");
            place.className = "result-place";
            place.textContent = String(index + 1);

            const name = document.createElement("span");
            name.textContent = player.name;

            const score = document.createElement("b");
            score.textContent = "+" + formatScore(scores[player.id] || 0);

            card.appendChild(place);
            card.appendChild(name);
            card.appendChild(score);
            resultsList.appendChild(card);
        });
    }

    if (nextRoundButton) {
        if (isHost()) {
            nextRoundButton.classList.remove("hidden");
            nextRoundButton.textContent =
                currentRound.number >= MAX_ROUNDS
                    ? "SEE FINAL RESULTS"
                    : "NEXT ROUND";
        } else {
            nextRoundButton.classList.add("hidden");
        }
    }

    if (resultsWaiting) {
        resultsWaiting.classList.toggle("hidden", isHost());
    }
}

function formatScore(score) {
    const number = Number(score);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

async function goNextRound() {
    if (!isHost() || !currentRound) {
        return;
    }

    nextRoundButton.disabled = true;
    nextRoundButton.textContent = "LOADING...";

    try {
        if (currentRound.number >= MAX_ROUNDS) {
            await updateDoc(doc(db, "rooms", roomCode), {
                status: "finished"
            });
            return;
        }

        await updateDoc(doc(db, "rooms", roomCode), {
            currentRound: currentRound.number + 1
        });
    } catch (error) {
        console.error("NEXT ROUND ERROR:", error);
        nextRoundButton.disabled = false;
        nextRoundButton.textContent = "NEXT ROUND";
    }
}

async function renderFinalResults() {
    if (finalRendered) {
        return;
    }

    finalRendered = true;
    showScreen(screens.final);
    setStatus("Game finished!");

    const totals = {};

    players.forEach(function (player) {
        totals[player.id] = 0;
    });

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        try {
            const snapshot = await getDoc(
                doc(db, "rooms", roomCode, "rounds", String(round), "results", "summary")
            );

            if (!snapshot.exists()) {
                continue;
            }

            const data = snapshot.data();
            const scores = data.roundScores || {};

            Object.keys(scores).forEach(function (playerId) {
                totals[playerId] = (totals[playerId] || 0) + Number(scores[playerId] || 0);
            });
        } catch (error) {
            console.error("FINAL SCORE ERROR:", error);
        }
    }

    const leaderboard = players.slice().sort(function (a, b) {
        return Number(totals[b.id] || 0) - Number(totals[a.id] || 0);
    });

    if (leaderboard.length && winnerName && winnerScore) {
        winnerName.textContent = leaderboard[0].name;
        winnerScore.textContent = formatScore(totals[leaderboard[0].id] || 0);
    }

    if (finalLeaderboard) {
        finalLeaderboard.innerHTML = "";

        leaderboard.forEach(function (player, index) {
            const row = document.createElement("div");
            row.className = "leaderboard-row";

            const place = document.createElement("span");
            place.className = "leaderboard-place";
            place.textContent = String(index + 1);

            const name = document.createElement("span");
            name.textContent = player.name;

            const score = document.createElement("b");
            score.textContent = formatScore(totals[player.id] || 0);

            row.appendChild(place);
            row.appendChild(name);
            row.appendChild(score);
            finalLeaderboard.appendChild(row);
        });
    }
}

function stopRoundListeners() {
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

answerInput.addEventListener("input", function () {
    if (characterCount) {
        characterCount.textContent =
            String(answerInput.value.length) + "/100";
    }
});

answerInput.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        submitMyAnswer();
    }
});

submitAnswer.addEventListener("click", submitMyAnswer);
submitRanking.addEventListener("click", submitMyRanking);
nextRoundButton.addEventListener("click", goNextRound);

window.addEventListener("beforeunload", function () {
    if (roomUnsubscribe) roomUnsubscribe();
    if (playersUnsubscribe) playersUnsubscribe();
    stopRoundListeners();
});

initialiseGame();
