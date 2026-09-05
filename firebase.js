import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCP35K-2Urj4axmtcVfAe955x6lAeDK8YE",
    authDomain: "most-common-man.firebaseapp.com",
    projectId: "most-common-man",
    storageBucket: "most-common-man.firebasestorage.app",
    messagingSenderId: "1011338202971",
    appId: "1:1011338202971:web:98766ee07c2e380c60147e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export async function loginAnonymously() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const result = await signInAnonymously(auth);
    return result.user;
}
