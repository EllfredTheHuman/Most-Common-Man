function createGame() {
    window.location.href = "lobby/lobby.html?host=true";
}

function joinGame() {
    document.getElementById("joinGameModal").classList.add("active");
    document.getElementById("gameCodeInput").value = "";
    setTimeout(function () {
        document.getElementById("gameCodeInput").focus();
    }, 80);
}

function closeJoinGame() {
    document.getElementById("joinGameModal").classList.remove("active");
}

function submitJoinGame() {
    const input = document.getElementById("gameCodeInput");
    const code = input.value.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
        input.classList.remove("input-error");
        void input.offsetWidth;
        input.classList.add("input-error");
        document.getElementById("joinGameError").textContent = "Enter the 6-character game code.";
        input.focus();
        return;
    }

    window.location.href = "lobby/lobby.html?code=" + encodeURIComponent(code);
}

function showHowToPlay() {
    document.getElementById("howToPlayModal").classList.add("active");
}

function closeHowToPlay() {
    document.getElementById("howToPlayModal").classList.remove("active");
}

document.getElementById("gameCodeInput").addEventListener("input", function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    document.getElementById("joinGameError").textContent = "";
});

document.getElementById("gameCodeInput").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        submitJoinGame();
    }
});

document.getElementById("howToPlayModal").addEventListener("click", function (event) {
    if (event.target === this) {
        closeHowToPlay();
    }
});

document.getElementById("joinGameModal").addEventListener("click", function (event) {
    if (event.target === this) {
        closeJoinGame();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeHowToPlay();
        closeJoinGame();
    }
});
