import { auth, db, signInAnonymously } from "../firebase.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
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

const gameCode = new URLSearchParams(window.location.search).get("code");

let currentUser = null;
let gameData = null;
let currentRound = 1;
let currentQuestion = null;
let currentScore = 0;

let unsubscribeGame = null;
let unsubscribeAnswers = null;

const MAX_ANSWER_LENGTH = 200;

const fallbackQuestions = [
    "You find $50 on the ground. What do you do?",
    "What is the most acceptable thing to eat for breakfast?",
    "You have a completely free Saturday. What do you do?",
    "What is the first thing you do when you get home?",
    "Someone gives you a gift you don't like. What do you say?"
];

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

        roundNumberElement.textContent = currentRound;

        await loadQuestion();

        listenForGameChanges();
        listenForAnswers();

    } catch (error) {
        console.error("Failed to initialise game:", error);

        alert("We couldn't load the game.");
        window.location.href = "../index.html";
    }
}

async function loadQuestion() {
    /*
     * Temporary question loading.
     *
     * Once the prompt system is added, this will load
     * questions from the appropriate category.
     */
    currentQuestion =
        fallbackQuestions[(currentRound - 1) % fallbackQuestions.length];

    questionElement.textContent = currentQuestion;

    answerInput.value = "";
    updateCharacterCount();

    showScreen(questionScreen);
}

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
            showScreen(resultsScreen);
            return;
        }

        if (
            gameData.currentRound &&
            gameData.currentRound !== previousRound
        ) {
            currentRound = gameData.currentRound;

            roundNumberElement.textContent = currentRound;

            await loadQuestion();
            listenForAnswers();
        }
    });
}

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

    unsubscribeAnswers = onSnapshot(answersRef, (snapshot) => {
        let answeredCount = 0;

        snapshot.forEach((answerSnapshot) => {
            if (answerSnapshot.data().submitted) {
                answeredCount++;
            }
        });

        answeredCountElement.textContent = answeredCount;

        loadPlayerCount().then((playerCount) => {
            totalPlayersElement.textContent = playerCount;

            if (answeredCount >= playerCount && playerCount > 0) {
                /*
                 * Ranking functionality will be connected here
                 * once every player has submitted.
                 */
                if (
                    !answerInput.disabled &&
                    !submitAnswerButton.disabled
                ) {
                    return;
                }

                showScreen(rankingScreen);
            }
        });
    });
}

async function loadPlayerCount() {
    const playersRef = collection(
        db,
        "games",
        gameCode,
        "players"
    );

    const snapshot = await getDocs(playersRef);

    return snapshot.size;
}

async function submitAnswer() {
    const answer = answerInput.value.trim();

    if (!answer) {
        answerInput.focus();
        return;
    }

    if (answer.length > MAX_ANSWER_LENGTH) {
        return;
    }

    if (!currentUser) {
        return;
    }

    submitAnswerButton.disabled = true;
    submitAnswerButton.textContent = "SUBMITTED";

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

answerInput.addEventListener("input", () => {
    if (answerInput.value.length > MAX_ANSWER_LENGTH) {
        answerInput.value =
            answerInput.value.slice(0, MAX_ANSWER_LENGTH);
    }

    updateCharacterCount();
});

submitAnswerButton.addEventListener("click", submitAnswer);

answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
        submitAnswer();
    }
});

window.addEventListener("beforeunload", () => {
    if (unsubscribeGame) {
        unsubscribeGame();
    }

    if (unsubscribeAnswers) {
        unsubscribeAnswers();
    }
});

initialiseGame();
