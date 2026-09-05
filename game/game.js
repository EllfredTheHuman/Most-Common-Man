/* =================================
   MOST COMMON MAN
   Game Logic
================================= */


/* ================================
   GAME SETTINGS
================================ */

const TOTAL_ROUNDS = 5;

const ROUND_MULTIPLIERS = [
    1,
    1,
    1.5,
    1.5,
    2
];


/* ================================
   GAME STATE
================================ */

let currentRound = 1;

let currentPrompt = null;

let playerName = "Player";

let modifier = "none";

let playerScore = 0;

let roundScores = [];

let usedPrompts = [];

let answers = [];

let ranking = [];


/* ================================
   FAKE PLAYERS
   Temporary until Firebase
================================ */

const fakePlayers = [
    "Dave",
    "Steve",
    "Mitch",
    "Gaz"
];


/* ================================
   ELEMENTS
================================ */

const waitingPanel =
    document.getElementById("waitingPanel");

const promptPanel =
    document.getElementById("promptPanel");

const lockedPanel =
    document.getElementById("lockedPanel");

const revealPanel =
    document.getElementById("revealPanel");

const rankingPanel =
    document.getElementById("rankingPanel");

const resultsPanel =
    document.getElementById("resultsPanel");

const finalPanel =
    document.getElementById("finalPanel");


const roundNumber =
    document.getElementById("roundNumber");

const promptCategory =
    document.getElementById("promptCategory");

const promptText =
    document.getElementById("promptText");

const answerInput =
    document.getElementById("answerInput");

const characterCount =
    document.getElementById("characterCount");

const lockedAnswer =
    document.getElementById("lockedAnswer");

const revealCategory =
    document.getElementById("revealCategory");

const revealPrompt =
    document.getElementById("revealPrompt");

const answersList =
    document.getElementById("answersList");

const rankingList =
    document.getElementById("rankingList");

const resultsRound =
    document.getElementById("resultsRound");

const resultsList =
    document.getElementById("resultsList");

const roundScore =
    document.getElementById("roundScore");

const winnerName =
    document.getElementById("winnerName");

const winnerScore =
    document.getElementById("winnerScore");

const finalRankings =
    document.getElementById("finalRankings");

const modifierIndicator =
    document.getElementById("modifierIndicator");

const modifierName =
    document.getElementById("modifierName");


/* ================================
   PROMPT CATEGORIES
================================ */

const promptCategories = {

    money: {
        name: "MONEY",
        prompts: typeof MONEY_PROMPTS !== "undefined"
            ? MONEY_PROMPTS
            : []
    },

    "everyday-life": {
        name: "EVERYDAY LIFE",
        prompts: typeof EVERYDAY_LIFE_PROMPTS !== "undefined"
            ? EVERYDAY_LIFE_PROMPTS
            : []
    },

    work: {
        name: "WORK",
        prompts: typeof WORK_PROMPTS !== "undefined"
            ? WORK_PROMPTS
            : []
    },

    food: {
        name: "FOOD",
        prompts: typeof FOOD_PROMPTS !== "undefined"
            ? FOOD_PROMPTS
            : []
    },

    travel: {
        name: "TRAVEL",
        prompts: typeof TRAVEL_PROMPTS !== "undefined"
            ? TRAVEL_PROMPTS
            : []
    },

    family: {
        name: "FAMILY",
        prompts: typeof FAMILY_PROMPTS !== "undefined"
            ? FAMILY_PROMPTS
            : []
    },

    sport: {
        name: "SPORT",
        prompts: typeof SPORT_PROMPTS !== "undefined"
            ? SPORT_PROMPTS
            : []
    },

    "moral-dilemmas": {
        name: "MORAL DILEMMAS",
        prompts: typeof MORAL_DILEMMAS_PROMPTS !== "undefined"
            ? MORAL_DILEMMAS_PROMPTS
            : []
    },

    ridiculous: {
        name: "RIDICULOUS",
        prompts: typeof RIDICULOUS_PROMPTS !== "undefined"
            ? RIDICULOUS_PROMPTS
            : []
    },

    "hamish-and-andy": {
        name: "HAMISH & ANDY",
        prompts: typeof HAMISH_AND_ANDY_PROMPTS !== "undefined"
            ? HAMISH_AND_ANDY_PROMPTS
            : []
    }

};


/* ================================
   LOAD GAME DATA
================================ */

function loadGameData() {

    const savedGame =
        localStorage.getItem("mostCommonManGame");


    if (!savedGame) {
        return;
    }


    try {

        const gameData =
            JSON.parse(savedGame);


        if (gameData.players) {

            const currentPlayer =
                gameData.players.find(
                    player => player.host === true
                );


            if (currentPlayer) {

                playerName =
                    currentPlayer.name;

            }

        }


        if (gameData.modifier) {

            modifier =
                gameData.modifier;

        }

    } catch (error) {

        console.error(
            "Could not load game data:",
            error
        );

    }

}


/* ================================
   START GAME
================================ */

function startGame() {

    loadGameData();

    updateModifier();

    currentRound = 1;

    playerScore = 0;

    roundScores = [];

    usedPrompts = [];


    showWaitingScreen();


    setTimeout(() => {

        startRound();

    }, 1200);

}


/* ================================
   START ROUND
================================ */

function startRound() {

    if (currentRound > TOTAL_ROUNDS) {

        showFinalResults();

        return;

    }


    updateRoundNumber();


    currentPrompt =
        getRandomPrompt();


    if (!currentPrompt) {

        currentPrompt = {
            category: "EVERYDAY LIFE",
            text: "What is the most overrated thing?"
        };

    }


    promptCategory.textContent =
        currentPrompt.category;

    promptText.textContent =
        currentPrompt.text;


    answerInput.value = "";

    updateCharacterCount();


    showPanel(promptPanel);


    setTimeout(() => {

        answerInput.focus();

    }, 100);

}


/* ================================
   GET RANDOM PROMPT
================================ */

function getRandomPrompt() {

    const categories =
        Object.keys(promptCategories);


    const availableCategories =
        categories.filter(category => {

            return promptCategories[category]
                .prompts
                .length > 0;

        });


    if (availableCategories.length === 0) {

        return null;

    }


    let categoryKey;


    /*
        Try not to repeat the same category
        twice in a row.
    */

    do {

        categoryKey =
            availableCategories[
                Math.floor(
                    Math.random() *
                    availableCategories.length
                )
            ];

    } while (
        usedPrompts.length > 0 &&
        usedPrompts[usedPrompts.length - 1].categoryKey === categoryKey &&
        availableCategories.length > 1
    );


    const category =
        promptCategories[categoryKey];


    const availablePrompts =
        category.prompts.filter(prompt => {

            const promptText =
                typeof prompt === "string"
                    ? prompt
                    : prompt.text;

            return !usedPrompts.some(
                used =>
                    used.text === promptText
            );

        });


    if (availablePrompts.length === 0) {

        /*
            If we've used every prompt in this
            category, allow one to repeat.
        */

        const randomPrompt =
            category.prompts[
                Math.floor(
                    Math.random() *
                    category.prompts.length
                )
            ];


        const formatted =
            formatPrompt(
                randomPrompt,
                category.name,
                categoryKey
            );


        usedPrompts.push(formatted);

        return formatted;

    }


    const randomPrompt =
        availablePrompts[
            Math.floor(
                Math.random() *
                availablePrompts.length
            )
        ];


    const formatted =
        formatPrompt(
            randomPrompt,
            category.name,
            categoryKey
        );


    usedPrompts.push(formatted);


    return formatted;

}


/* ================================
   FORMAT PROMPT
================================ */

function formatPrompt(
    prompt,
    categoryName,
    categoryKey
) {

    if (typeof prompt === "string") {

        return {
            category: categoryName,
            categoryKey: categoryKey,
            text: prompt
        };

    }


    return {
        category:
            prompt.category || categoryName,

        categoryKey:
            categoryKey,

        text:
            prompt.text || prompt.question || ""
    };

}


/* ================================
   SUBMIT ANSWER
================================ */

function submitAnswer() {

    const answer =
        answerInput.value.trim();


    if (answer.length === 0) {

        answerInput.focus();

        shakeElement(answerInput);

        return;

    }


    /*
        Save the player's answer.
    */

    answers = [

        {
            player: playerName,
            text: answer,
            isYou: true
        }

    ];


    /*
        Add temporary fake answers.

        Firebase will replace this later.
    */

    fakePlayers.forEach((name, index) => {

        answers.push({

            player: name,

            text:
                generateFakeAnswer(
                    currentPrompt,
                    index
                ),

            isYou: false

        });

    });


    lockedAnswer.textContent =
        answer;


    showPanel(lockedPanel);


    /*
        Pretend we're waiting for everyone.
    */

    setTimeout(() => {

        showReveal();

    }, 1200);

}


/* ================================
   FAKE ANSWERS
================================ */

function generateFakeAnswer(
    prompt,
    index
) {

    const genericAnswers = [

        "Probably something expensive.",

        "My neighbour, unfortunately.",

        "Whatever everyone else likes.",

        "A completely unnecessary purchase.",

        "The obvious answer."

    ];


    /*
        These are deliberately simple for
        the prototype.

        Real players will replace these.
    */

    return genericAnswers[
        index % genericAnswers.length
    ];

}


/* ================================
   REVEAL ANSWERS
================================ */

function showReveal() {

    revealCategory.textContent =
        currentPrompt.category;

    revealPrompt.textContent =
        currentPrompt.text;


    answersList.innerHTML = "";


    /*
        Shuffle answers so nobody knows
        which answer belongs to whom.
    */

    const shuffledAnswers =
        [...answers]
            .sort(() => Math.random() - 0.5);


    shuffledAnswers.forEach(
        (answer, index) => {

            const card =
                document.createElement("div");

            card.className =
                "answer-card";


            card.textContent =
                answer.text;


            card.dataset.index =
                index;


            answersList.appendChild(card);

        }
    );


    showPanel(revealPanel);

}


/* ================================
   CONTINUE TO RANKING
================================ */

function continueToRanking() {

    createRankingList();

    showPanel(rankingPanel);

}


/* ================================
   CREATE RANKING
================================ */

function createRankingList() {

    rankingList.innerHTML = "";


    const shuffledAnswers =
        [...answers]
            .sort(() => Math.random() - 0.5);


    shuffledAnswers.forEach(
        (answer, index) => {

            const card =
                document.createElement("div");


            card.className =
                "ranking-card";

            card.draggable = true;

            card.dataset.player =
                answer.player;


            const number =
                document.createElement("div");

            number.className =
                "ranking-number";

            number.textContent =
                index + 1;


            const text =
                document.createElement("div");

            text.className =
                "ranking-answer";

            text.textContent =
                answer.text;


            card.appendChild(number);

            card.appendChild(text);


            addDragEvents(card);


            rankingList.appendChild(card);

        }
    );


    updateRankingNumbers();

}


/* ================================
   DRAG & DROP
================================ */

let draggedCard = null;


function addDragEvents(card) {

    card.addEventListener(
        "dragstart",
        function () {

            draggedCard = this;

            this.style.opacity = "0.5";

        }
    );


    card.addEventListener(
        "dragend",
        function () {

            this.style.opacity = "1";

            draggedCard = null;

        }
    );


    card.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

        }
    );


    card.addEventListener(
        "drop",
        function (event) {

            event.preventDefault();


            if (
                draggedCard &&
                draggedCard !== this
            ) {

                const rect =
                    this.getBoundingClientRect();


                const middle =
                    rect.top +
                    rect.height / 2;


                if (
                    event.clientY < middle
                ) {

                    this.parentNode.insertBefore(
                        draggedCard,
                        this
                    );

                } else {

                    this.parentNode.insertBefore(
                        draggedCard,
                        this.nextSibling
                    );

                }


                updateRankingNumbers();

            }

        }
    );

}


/* ================================
   UPDATE RANKING NUMBERS
================================ */

function updateRankingNumbers() {

    const cards =
        rankingList.querySelectorAll(
            ".ranking-card"
        );


    cards.forEach((card, index) => {

        const number =
            card.querySelector(
                ".ranking-number"
            );


        number.textContent =
            index + 1;

    });

}


/* ================================
   SUBMIT RANKING
================================ */

function submitRanking() {

    const cards =
        rankingList.querySelectorAll(
            ".ranking-card"
        );


    ranking = [];


    cards.forEach(card => {

        ranking.push({
            player:
                card.dataset.player,

            rank:
                ranking.length + 1
        });

    });


    calculateRoundScore();

}


/* ================================
   CALCULATE SCORE
================================ */

function calculateRoundScore() {

    const playerRanking =
        ranking.find(
            item =>
                item.player === playerName
        );


    if (!playerRanking) {

        showResults(0);

        return;

    }


    /*
        5 players:

        1st = 5
        2nd = 4
        3rd = 3
        4th = 2
        5th = 1
    */

    const baseScore =
        answers.length -
        playerRanking.rank +
        1;


    const multiplier =
        ROUND_MULTIPLIERS[
            currentRound - 1
        ];


    const score =
        Math.round(
            baseScore * multiplier
        );


    playerScore += score;


    roundScores.push(score);


    showResults(score);

}


/* ================================
   SHOW RESULTS
================================ */

function showResults(score) {

    resultsRound.textContent =
        currentRound;


    roundScore.textContent =
        `+${score}`;


    resultsList.innerHTML = "";


    /*
        Calculate the points for every answer
        based on its ranking.
    */

    const resultData =
        ranking.map(item => {

            const baseScore =
                answers.length -
                item.rank +
                1;


            const multiplier =
                ROUND_MULTIPLIERS[
                    currentRound - 1
                ];


            return {

                player: item.player,

                points:
                    Math.round(
                        baseScore *
                        multiplier
                    ),

                rank:
                    item.rank

            };

        });


    resultData.sort(
        (a, b) =>
            a.rank - b.rank
    );


    resultData.forEach(result => {

        const card =
            document.createElement("div");

        card.className =
            "result-card";


        const position =
            document.createElement("div");

        position.className =
            "result-position";

        position.textContent =
            `#${result.rank}`;


        const name =
            document.createElement("div");

        name.className =
            "result-name";

        name.textContent =
            result.player;


        const points =
            document.createElement("div");

        points.className =
            "result-points";

        points.textContent =
            `+${result.points}`;


        card.appendChild(position);

        card.appendChild(name);

        card.appendChild(points);


        resultsList.appendChild(card);

    });


    showPanel(resultsPanel);

}


/* ================================
   NEXT ROUND
================================ */

function nextRound() {

    currentRound++;


    if (currentRound > TOTAL_ROUNDS) {

        showFinalResults();

        return;

    }


    showWaitingScreen();


    setTimeout(() => {

        startRound();

    }, 900);

}


/* ================================
   FINAL RESULTS
================================ */

function showFinalResults() {

    /*
        For the prototype, the player's score
        is compared against generated scores.
    */

    const finalScores = [

        {
            name: playerName,
            score: playerScore
        },

        {
            name: "Dave",
            score: generateFinalFakeScore()
        },

        {
            name: "Steve",
            score: generateFinalFakeScore()
        },

        {
            name: "Mitch",
            score: generateFinalFakeScore()
        },

        {
            name: "Gaz",
            score: generateFinalFakeScore()
        }

    ];


    finalScores.sort(
        (a, b) =>
            b.score - a.score
    );


    const winner =
        finalScores[0];


    winnerName.textContent =
        winner.name;


    winnerScore.textContent =
        `${winner.score} POINTS`;


    finalRankings.innerHTML = "";


    finalScores.forEach(
        (player, index) => {

            const card =
                document.createElement("div");

            card.className =
                "final-rank-card";


            const name =
                document.createElement("span");

            name.className =
                "final-rank-name";

            name.textContent =
                `${index + 1}. ${player.name}`;


            const score =
                document.createElement("span");

            score.className =
                "final-rank-score";

            score.textContent =
                `${player.score} pts`;


            card.appendChild(name);

            card.appendChild(score);


            finalRankings.appendChild(card);

        }
    );


    showPanel(finalPanel);

}


/* ================================
   FAKE FINAL SCORES
================================ */

function generateFinalFakeScore() {

    /*
        Keeps the fake scores in a vaguely
        believable range.
    */

    return Math.floor(
        Math.random() * 25
    ) + 10;

}


/* ================================
   SHOW PANEL
================================ */

function showPanel(panel) {

    const panels = [

        waitingPanel,
        promptPanel,
        lockedPanel,
        revealPanel,
        rankingPanel,
        resultsPanel,
        finalPanel

    ];


    panels.forEach(item => {

        item.classList.add("hidden");

    });


    panel.classList.remove("hidden");


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* ================================
   WAITING SCREEN
================================ */

function showWaitingScreen() {

    showPanel(waitingPanel);

}


/* ================================
   ROUND NUMBER
================================ */

function updateRoundNumber() {

    roundNumber.textContent =
        currentRound;

}


/* ================================
   MODIFIER
================================ */

function updateModifier() {

    const modifierLabels = {

        none: "NONE",

        "common-man":
            "COMMON MAN",

        "no-obvious":
            "NO OBVIOUS ANSWERS",

        character:
            "THE CHARACTER",

        "money-talks":
            "MONEY TALKS",

        predictive:
            "PREDICTIVE COMMON MAN"

    };


    const label =
        modifierLabels[modifier]
        || "NONE";


    modifierName.textContent =
        label;


    if (modifier === "none") {

        modifierIndicator.classList.add(
            "hidden"
        );

    } else {

        modifierIndicator.classList.remove(
            "hidden"
        );

    }

}


/* ================================
   CHARACTER COUNTER
================================ */

function updateCharacterCount() {

    const length =
        answerInput.value.length;


    characterCount.textContent =
        `${length}/150`;


    if (length >= 140) {

        characterCount.style.opacity = "1";

    } else {

        characterCount.style.opacity = "";

    }

}


answerInput.addEventListener(
    "input",
    updateCharacterCount
);


/* ================================
   ENTER KEY
================================ */

answerInput.addEventListener(
    "keydown",
    function (event) {

        /*
            Ctrl + Enter submits.

            Regular Enter creates a new line.
        */

        if (
            event.key === "Enter" &&
            event.ctrlKey
        ) {

            submitAnswer();

        }

    }
);


/* ================================
   SHAKE ELEMENT
================================ */

function shakeElement(element) {

    element.classList.remove(
        "input-error"
    );


    /*
        Force the animation to restart.
    */

    void element.offsetWidth;


    element.classList.add(
        "input-error"
    );


    setTimeout(() => {

        element.classList.remove(
            "input-error"
        );

    }, 500);

}


/* ================================
   RETURN TO TITLE
================================ */

function returnToTitle() {

    localStorage.removeItem(
        "mostCommonManGame"
    );


    window.location.href =
        "../index.html";

}


/* ================================
   START
================================ */

startGame();
