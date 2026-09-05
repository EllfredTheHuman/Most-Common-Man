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


/* ================================
   HOW TO PLAY
================================ */

function showHowToPlay() {
    document
        .getElementById("howToPlayModal")
        .classList.add("active");
}


function closeHowToPlay() {
    document
        .getElementById("howToPlayModal")
        .classList.remove("active");
}


/* Close when clicking outside the popup */

document
    .getElementById("howToPlayModal")
    .addEventListener("click", function (event) {

        if (event.target === this) {
            closeHowToPlay();
        }

    });


/* Close with Escape */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeHowToPlay();
    }

});
