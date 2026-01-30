/**
 * Shared Firebase Configuration
 * Consolidated from multiple files for single source of truth
 */

// Firebase configuration object
export const firebaseConfig = {
    apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
    authDomain: "ituultimate-7d97f.firebaseapp.com",
    projectId: "ituultimate-7d97f",
    storageBucket: "ituultimate-7d97f.firebasestorage.app",
    messagingSenderId: "1000938340000",
    appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
};

// Modern ES Module imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export initialized services
export const auth = getAuth(app);
export const db = getFirestore(app);