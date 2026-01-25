// Firebase SDK'larını import ediyoruz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase konsolundan aldığın config objesini buraya yapıştır
const firebaseConfig = {
    apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
    authDomain: "ituultimate-7d97f.firebaseapp.com",
    projectId: "ituultimate-7d97f",
    storageBucket: "ituultimate-7d97f.firebasestorage.app",
    messagingSenderId: "1000938340000",
    appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
};

// Uygulamayı başlat
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);