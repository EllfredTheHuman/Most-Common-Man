/* =================================
   MOST COMMON MAN
   Title Screen
================================= */

function createGame() {
    window.location.href = "lobby/lobby.html?host=true";
}

function joinGame() {
    window.location.href = "lobby/lobby.html";
}

function showHowToPlay() {
    const message = `
MOST COMMON MAN

5 rounds. 5 prompts.

Everyone gets the same prompt and secretly submits an answer.

Then everyone ranks the answers from BEST to WORST.

The better your answer ranks, the more points you get.

ROUND 1–2: ×1
ROUND 3–4: ×1.5
ROUND 5: ×2

At the end, whoever has the most points becomes...

THE MOST COMMON MAN.
    `;

    alert(message);
}
