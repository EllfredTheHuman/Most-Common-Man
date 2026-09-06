import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// FIREBASE CONFIG

const firebaseConfig = {
    apiKey: "AIzaSyCP35K2-Urj4axmtcVfAe955x6lAeDK8YE",
    authDomain: "most-common-man.firebaseapp.com",
    projectId: "most-common-man",
    storageBucket: "most-common-man.firebasestorage.app",
    messagingSenderId: "1011338202971",
    appId: "1:1011338202971:web:98766ee07c2e380c60147e"
};


// INITIALISE FIREBASE

const app = initializeApp(firebaseConfig);


// AUTHENTICATION

const auth = getAuth(app);


// DATABASE

const db = getFirestore(app);


// EXPORTS

export {
    app,
    auth,
    db,
    signInAnonymously
};
