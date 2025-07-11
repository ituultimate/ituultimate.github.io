import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_b1yaECqlO_m2p2fZ0WKtCqrvq0buchI",
  authDomain: "ituultimate.firebaseapp.com",
  projectId: "ituultimate",
  storageBucket: "ituultimate.firebasestorage.app",
  messagingSenderId: "633943417394",
  appId: "1:633943417394:web:97279ba32cdc3ee4e9d22b",
  measurementId: "G-1ZXF2BG1SE"
};

// Firebase başlat
const app = initializeApp(firebaseConfig);

// Auth ve provider nesneleri
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
