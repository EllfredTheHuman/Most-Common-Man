import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    getDocs,
    collection,
    onSnapshot,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const roundNumberElement = document.getElementById("roundNumber");
const timerElement = document.getElementById("timer");
const scoreElement = document.getElementById("score");

const questionScreen = document.getElementById("questionScreen");
const waitingScreen = document.getElementById("waitingScreen");
const rankingScreen = document.getElementById("rankingScreen");
const resultsScreen = document.getElementById("resultsScreen");

const questionElement = document.getElementById("question");
const answerInput = document.getElementById("answerInput");
const characterCountElement = document.getElementById("characterCount");
const submitAnswerButton = document.getElementById("submitAnswer");

const answeredCountElement = document.getElementById("answeredCount");
const totalPlayersElement = document.getElementById("totalPlayers");

const answersListElement = document.getElementById("answersList");
const submitRankingButton = document.getElementById("submitRanking");

const resultsTitleElement = document.getElementById("resultsTitle");
const resultsListElement = document.getElementById("resultsList");
const nextRoundButton = document.getElementById("nextRound");

const gameCode = new URLSearchParams(window.location.search).get("code");

const MAX_ANSWER_LENGTH = 200;

let currentUser = null;
let gameData = null;

let currentRound = 1;
let currentQuestion = "";
let currentScore = 0;

let players = [];
let answers = [];
let ranking = [];

let unsubscribeGame = null;
let unsubscribeAnswers = null;
let unsubscribeResults = null;

const fallbackQuestions = [
    "You find $50 on the ground. What do you do?",
    "What is the most acceptable thing to eat for breakfast?",
    "You have a completely free Saturday. What do you do?",
    "What is the first thing you do when you get home?",
    "Someone gives you a gift you don't like. What do you say?"
];

/* -------------------------------------------------- */
/* INITIALISATION */
/* -------------------------------------------------- */

async function initialiseGame() {
    if (!gameCode) {
        alert("No game code was provided.");
        window.location.href = "../index.html";
        return;
    }

    try {
        if (auth.currentUser) {
            currentUser = auth.currentUser;
        } else {
            const credentials = await signInAnonymously(auth);
            currentUser = credentials.user;
        }

        const gameRef = doc(db, "games", gameCode);
        const gameSnapshot = await getDoc(gameRef);

        if (!gameSnapshot.exists()) {
            alert("That game doesn't exist.");
            window.location.href = "../index.html";
            return;
        }

        gameData = gameSnapshot.data();

        if (gameData.status !== "playing") {
            alert("This game hasn't started yet.");
            window.location.href =
                `../lobby/lobby.html?code=${gameCode}`;
            return;
        }

        currentRound = gameData.currentRound || 1;

        await loadPlayers();
        await loadRound();

        listenForGameChanges();

    } catch (error) {
        console.error("Failed to initialise game:", error);

        alert(
            "We couldn't load the game.\n\n" +
            "Please check your Firebase configuration."
        );

        window.location.href = "../index.html";
    }
}

/* -------------------------------------------------- */
/* PLAYERS */
/* -------------------------------------------------- */

async function loadPlayers() {
    const playersRef = collection(
        db,
        "games",
        gameCode,
        "players"
    );

    const snapshot = await getDocs(playersRef);

    players = [];

    snapshot.forEach((playerSnapshot) => {
        players.push({
            id: playerSnapshot.id,
            ...playerSnapshot.data()
        });
    });

    totalPlayersElement.textContent = players.length;
}

/* -------------------------------------------------- */
/* ROUND */
/* -------------------------------------------------- */

async function loadRound() {
    currentRound = gameData.currentRound || 1;

    roundNumberElement.textContent = currentRound;

    currentQuestion =
        gameData.currentQuestion ||
        fallbackQuestions[(currentRound - 1) % fallbackQuestions.length];

    questionElement.textContent = currentQuestion;

    ranking = [];
    answers = [];

    answerInput.disabled = false;
    answerInput.value = "";

    submitAnswerButton.disabled = false;
    submitAnswerButton.textContent = "SUBMIT ANSWER";

    updateCharacterCount();
    showScreen(questionScreen);

    listenForAnswers();
}

/* -------------------------------------------------- */
/* GAME LISTENER */
/* -------------------------------------------------- */

function listenForGameChanges() {
    const gameRef = doc(db, "games", gameCode);

    unsubscribeGame = onSnapshot(gameRef, async (snapshot) => {
        if (!snapshot.exists()) {
            alert("The host closed the game.");
            window.location.href = "../index.html";
            return;
        }

        const newGameData = snapshot.data();

        const previousRound = currentRound;

        gameData = newGameData;

        if (gameData.status === "finished") {
            await showFinalResults();
            return;
        }

        if (
            gameData.currentRound &&
            gameData.currentRound !== previousRound
        ) {
            currentRound = gameData.currentRound;

            await loadPlayers();
            await loadRound();
        }

        if (gameData.phase === "ranking") {
            await showRanking();
        }

        if (gameData.phase === "results") {
            await showRoundResults();
        }
    });
}

/* -------------------------------------------------- */
/* ANSWERS */
/* -------------------------------------------------- */

function listenForAnswers() {
    if (unsubscribeAnswers) {
        unsubscribeAnswers();
        unsubscribeAnswers = null;
    }

    const answersRef = collection(
        db,
        "games",
        gameCode,
        "rounds",
        String(currentRound),
        "answers"
    );

    unsubscribeAnswers = onSnapshot(
        answersRef,
        async (snapshot) => {
            answers = [];

            snapshot.forEach((answerSnapshot) => {
                const data = answerSnapshot.data();

                answers.push({
                    id: answerSnapshot.id,
                    ...data
                });
            });

            answeredCountElement.textContent = answers.length;

            totalPlayersElement.textContent = players.length;

            if (
                answers.length >= players.length &&
                players.length >= 2
            ) {
                await tryStartRanking();
            }
        },
        (error) => {
            console.error("Answer listener error:", error);
        }
    );
}

/* -------------------------------------------------- */
/* SUBMIT ANSWER */
/* -------------------------------------------------- */

async function submitAnswer() {
    const answer = answerInput.value.trim();

    if (!answer || !currentUser) {
        answerInput.focus();
        return;
    }

    submitAnswerButton.disabled = true;
    submitAnswerButton.textContent = "SUBMITTING...";

    try {
        const answerRef = doc(
            db,
            "games",
            gameCode,
            "rounds",
            String(currentRound),
            "answers",
            currentUser.uid
        );

        await setDoc(answerRef, {
            playerId: currentUser.uid,
            answer: answer,
            submitted: true,
            submittedAt: serverTimestamp()
        });

        answerInput.disabled = true;

        showScreen(waitingScreen);

    } catch (error) {
        console.error("Failed to submit answer:", error);

        alert("Your answer couldn't be submitted.");

        submitAnswerButton.disabled = false;
        submitAnswerButton.textContent = "SUBMIT ANSWER";
    }
}

/* -------------------------------------------------- */
/* START RANKING */
/* -------------------------------------------------- */

async function tryStartRanking() {
    const gameRef = doc(db, "games", gameCode);

    try {
        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(gameRef);

            if (!snapshot.exists()) {
                return;
            }

            const data = snapshot.data();

            if (data.phase === "ranking") {
                return;
            }

            if (data.phase === "results") {
                return;
            }

            transaction.update(gameRef, {
                phase: "ranking"
            });
        });

    } catch (error) {
        console.error("Failed to start ranking:", error);
    }
}

/* -------------------------------------------------- */
/* RANKING */
/* -------------------------------------------------- */

async function showRanking() {
    if (!currentUser) {
        return;
    }

    const answersRef = collection(
        db,
        "games",
        gameCode,
        "rounds",
        String(currentRound),
        "answers"
    );

    const snapshot = await getDocs(answersRef);

    answers = [];

    snapshot.forEach((answerSnapshot) => {
        const data = answerSnapshot.data();

        answers.push({
            id: answerSnapshot.id,
            ...data
        });
    });

    /*
     * Never reveal who wrote each answer.
     */

    const shuffledAnswers = [...answers];

    shuffleArray(shuffledAnswers);

    answersListElement.innerHTML = "";

    ranking = [];

    shuffledAnswers.forEach((answer, index) => {
        const card = document.createElement("button");

        card.type = "button";
        card.className = "answer-card";

        card.dataset.answerId = answer.id;

        const number = document.createElement("span");

        number.className = "answer-number";
        number.textContent = index + 1;

        const text = document.createElement("span");

        text.className = "answer-text";
        text.textContent = answer.answer;

        card.appendChild(number);
        card.appendChild(text);

        card.addEventListener("click", () => {
            selectAnswer(card, answer.id);
        });

        answersListElement.appendChild(card);
    });

    /*
     * The player cannot rank their own answer.
     */

    const ownAnswer = answers.find(
        (answer) => answer.playerId === currentUser.uid
    );

    if (ownAnswer) {
        const ownCard = answersListElement.querySelector(
            `[data-answer-id="${ownAnswer.id}"]`
        );

        if (ownCard) {
            ownCard.disabled = true;
            ownCard.style.opacity = "0.45";
            ownCard.style.cursor = "not-allowed";

            const ownText = ownCard.querySelector(".answer-text");

            if (ownText) {
                ownText.textContent = "YOUR ANSWER";
            }
        }
    }

    submitRankingButton.disabled = true;

    showScreen(rankingScreen);
}

/* -------------------------------------------------- */
/* SELECT RANKING */
/* -------------------------------------------------- */

function selectAnswer(card, answerId) {
    if (card.disabled) {
        return;
    }

    const existingIndex = ranking.indexOf(answerId);

    if (existingIndex !== -1) {
        ranking.splice(existingIndex, 1);
        card.classList.remove("selected");
    } else {
        ranking.push(answerId);
        card.classList.add("selected");
    }

    updateRankingNumbers();

    /*
     * A player must rank every answer except their own.
     */

    const rankableAnswers = answers.filter(
        (answer) => answer.playerId !== currentUser.uid
    );

    submitRankingButton.disabled =
        ranking.length !== rankableAnswers.length;
}

/* -------------------------------------------------- */
/* UPDATE RANKING NUMBERS */
/* -------------------------------------------------- */

function updateRankingNumbers() {
    const cards =
        answersListElement.querySelectorAll(".answer-card");

    cards.forEach((card) => {
        const answerId = card.dataset.answerId;
        const position = ranking.indexOf(answerId);

        const number = card.querySelector(".answer-number");

        if (!number) {
            return;
        }

        if (position === -1) {
            number.textContent = "—";
        } else {
            number.textContent = position + 1;
        }
    });
}

/* -------------------------------------------------- */
/* SUBMIT RANKING */
/* -------------------------------------------------- */

async function submitRanking() {
    if (!currentUser) {
        return;
    }

    const rankableAnswers = answers.filter(
        (answer) => answer.playerId !== currentUser.uid
    );

    if (ranking.length !== rankableAnswers.length) {
        return;
    }

    submitRankingButton.disabled = true;
    submitRankingButton.textContent = "SUBMITTING...";

    try {
        const rankingRef = doc(
            db,
            "games",
            gameCode,
            "rounds",
            String(currentRound),
            "rankings",
            currentUser.uid
        );

        await setDoc(rankingRef, {
            playerId: currentUser.uid,
            ranking: ranking,
            submittedAt: serverTimestamp()
        });

        await waitForAllRankings();

    } catch (error) {
        console.error("Failed to submit ranking:", error);

        alert("Your ranking couldn't be submitted.");

        submitRankingButton.disabled = false;
        submitRankingButton.textContent = "SUBMIT RANKING";
    }
}

/* -------------------------------------------------- */
/* WAIT FOR RANKINGS */
/* -------------------------------------------------- */

async function waitForAllRankings() {
    const rankingsRef = collection(
        db,
        "games",
        gameCode,
        "rounds",
        String(currentRound),
        "rankings"
    );

    const snapshot = await getDocs(rankingsRef);

    if (snapshot.size >= players.length) {
        await calculateResults();
    } else {
        submitRankingButton.textContent = "WAITING FOR OTHERS...";
    }
}

/* -------------------------------------------------- */
/* CALCULATE RESULTS */
/* -------------------------------------------------- */

async function calculateResults() {
    const gameRef = doc(db, "games", gameCode);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnapshot = await transaction.get(gameRef);

            if (!gameSnapshot.exists()) {
                return;
            }

            const latestGameData = gameSnapshot.data();

            if (latestGameData.phase === "results") {
                return;
            }

            const answersRef = collection(
                db,
                "games",
                gameCode,
                "rounds",
                String(currentRound),
                "answers"
            );

            const rankingsRef = collection(
                db,
                "games",
                gameCode,
                "rounds",
                String(currentRound),
                "rankings"
            );

            const answersSnapshot = await getDocs(answersRef);
            const rankingsSnapshot = await getDocs(rankingsRef);

            if (rankingsSnapshot.size < players.length) {
                return;
            }

            const answerData = {};

            answersSnapshot.forEach((answerSnapshot) => {
                answerData[answerSnapshot.id] =
                    answerSnapshot.data();
            });

            const points = {};

            players.forEach((player) => {
                points[player.id] = 0;
            });

            rankingsSnapshot.forEach((rankingSnapshot) => {
                const rankingData = rankingSnapshot.data();

                rankingData.ranking.forEach(
                    (answerId, index) => {
                        const answer = answerData[answerId];

                        if (!answer) {
                            return;
                        }

                        const answerOwner = answer.playerId;

                        /*
                         * With N players:
                         * first = N
                         * second = N - 1
                         * etc.
                         */

                        const basePoints =
                            players.length - index;

                        points[answerOwner] =
                            (points[answerOwner] || 0) +
                            basePoints;
                    }
                );
            });

            const multiplier = getRoundMultiplier(currentRound);

            const finalPoints = {};

            players.forEach((player) => {
                finalPoints[player.id] = Math.round(
                    (points[player.id] || 0) * multiplier
                );
            });

            const resultsRef = doc(
                db,
                "games",
                gameCode,
                "rounds",
                String(currentRound)
            );

            transaction.set(
                resultsRef,
                {
                    results: finalPoints,
                    multiplier: multiplier,
                    calculatedAt: serverTimestamp()
                },
                { merge: true }
            );

            transaction.update(gameRef, {
                phase: "results"
            });
        });

    } catch (error) {
        console.error("Failed to calculate results:", error);
    }
}

/* -------------------------------------------------- */
/* ROUND RESULTS */
/* -------------------------------------------------- */

async function showRoundResults() {
    const roundRef = doc(
        db,
        "games",
        gameCode,
        "rounds",
        String(currentRound)
    );

    const snapshot = await getDoc(roundRef);

    if (!snapshot.exists()) {
        return;
    }

    const data = snapshot.data();

    if (!data.results) {
        return;
    }

    const resultScores = data.results;
    const multiplier = data.multiplier || 1;

    resultsListElement.innerHTML = "";

    const sortedPlayers = [...players].sort(
        (a, b) =>
            (resultScores[b.id] || 0) -
            (resultScores[a.id] || 0)
    );

    sortedPlayers.forEach((player, index) => {
        const card = document.createElement("div");

        card.className = "result-card";

        const place = document.createElement("span");

        place.className = "result-place";
        place.textContent = `#${index + 1}`;

        const name = document.createElement("span");

        name.className = "result-name";
        name.textContent = player.name;

        const points = document.createElement("span");

        points.className = "result-points";

        points.textContent =
            `+${resultScores[player.id] || 0}`;

        card.appendChild(place);
        card.appendChild(name);
        card.appendChild(points);

        resultsListElement.appendChild(card);
    });

    resultsTitleElement.textContent =
        `ROUND ${currentRound} RESULTS`;

    showScreen(resultsScreen);

    currentScore =
        resultScores[currentUser.uid] || 0;

    scoreElement.textContent = currentScore;

    /*
     * Only the host gets to advance the game.
     */

    if (gameData.hostId === currentUser.uid) {
        nextRoundButton.classList.remove("hidden");

        if (currentRound >= 5) {
            nextRoundButton.textContent = "SEE FINAL RESULTS";
        } else {
            nextRoundButton.textContent = "NEXT ROUND";
        }
    }
}

/* -------------------------------------------------- */
/* NEXT ROUND */
/* -------------------------------------------------- */

async function nextRound() {
    if (!currentUser || gameData.hostId !== currentUser.uid) {
        return;
    }

    nextRoundButton.disabled = true;
    nextRoundButton.textContent = "LOADING...";

    try {
        const gameRef = doc(db, "games", gameCode);

        if (currentRound >= 5) {
            await runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(gameRef);

                if (!snapshot.exists()) {
                    return;
                }

                transaction.update(gameRef, {
                    status: "finished",
                    phase: "finished"
                });
            });

            return;
        }

        const newRound = currentRound + 1;

        const newQuestion =
            fallbackQuestions[
                (newRound - 1) % fallbackQuestions.length
            ];

        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(gameRef);

            if (!snapshot.exists()) {
                return;
            }

            transaction.update(gameRef, {
                currentRound: newRound,
                currentQuestion: newQuestion,
                phase: "answers"
            });
        });

    } catch (error) {
        console.error("Failed to start next round:", error);

        alert("Couldn't start the next round.");

        nextRoundButton.disabled = false;
        nextRoundButton.textContent =
            currentRound >= 5
                ? "SEE FINAL RESULTS"
                : "NEXT ROUND";
    }
}

/* -------------------------------------------------- */
/* FINAL RESULTS */
/* -------------------------------------------------- */

async function showFinalResults() {
    await loadPlayers();

    const totals = {};

    players.forEach((player) => {
        totals[player.id] = 0;
    });

    for (let round = 1; round <= 5; round++) {
        const roundRef = doc(
            db,
            "games",
            gameCode,
            "rounds",
            String(round)
        );

        const snapshot = await getDoc(roundRef);

        if (!snapshot.exists()) {
            continue;
        }

        const data = snapshot.data();

        if (!data.results) {
            continue;
        }

        Object.entries(data.results).forEach(
            ([playerId, points]) => {
                totals[playerId] =
                    (totals[playerId] || 0) + points;
            }
        );
    }

    const sortedPlayers = [...players].sort(
        (a, b) =>
            (totals[b.id] || 0) -
            (totals[a.id] || 0)
    );

    resultsListElement.innerHTML = "";

    sortedPlayers.forEach((player, index) => {
        const card = document.createElement("div");

        card.className = "result-card";

        const place = document.createElement("span");

        place.className = "result-place";
        place.textContent = `#${index + 1}`;

        const name = document.createElement("span");

        name.className = "result-name";

        if (index === 0) {
            name.textContent =
                `${player.name} — THE MOST COMMON MAN`;
        } else {
            name.textContent = player.name;
        }

        const points = document.createElement("span");

        points.className = "result-points";
        points.textContent = `${totals[player.id] || 0}`;

        card.appendChild(place);
        card.appendChild(name);
        card.appendChild(points);

        resultsListElement.appendChild(card);
    });

    resultsTitleElement.textContent = "THE FINAL RESULTS";

    nextRoundButton.classList.add("hidden");

    showScreen(resultsScreen);
}

/* -------------------------------------------------- */
/* ROUND MULTIPLIERS */
/* -------------------------------------------------- */

function getRoundMultiplier(round) {
    if (round <= 2) {
        return 1;
    }

    if (round <= 4) {
        return 1.5;
    }

    return 2;
}

/* -------------------------------------------------- */
/* UTILITIES */
/* -------------------------------------------------- */

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const randomIndex =
            Math.floor(Math.random() * (i + 1));

        [array[i], array[randomIndex]] =
            [array[randomIndex], array[i]];
    }

    return array;
}

function updateCharacterCount() {
    characterCountElement.textContent =
        `${answerInput.value.length} / ${MAX_ANSWER_LENGTH}`;
}

function showScreen(screen) {
    questionScreen.classList.add("hidden");
    waitingScreen.classList.add("hidden");
    rankingScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}

/* -------------------------------------------------- */
/* EVENTS */
/* -------------------------------------------------- */

answerInput.addEventListener("input", () => {
    if (answerInput.value.length > MAX_ANSWER_LENGTH) {
        answerInput.value =
            answerInput.value.slice(0, MAX_ANSWER_LENGTH);
    }

    updateCharacterCount();
});

answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
        submitAnswer();
    }
});

submitAnswerButton.addEventListener(
    "click",
    submitAnswer
);

submitRankingButton.addEventListener(
    "click",
    submitRanking
);

nextRoundButton.addEventListener(
    "click",
    nextRound
);

window.addEventListener("beforeunload", () => {
    if (unsubscribeGame) {
        unsubscribeGame();
    }

    if (unsubscribeAnswers) {
        unsubscribeAnswers();
    }

    if (unsubscribeResults) {
        unsubscribeResults();
    }
});

initialiseGame();
