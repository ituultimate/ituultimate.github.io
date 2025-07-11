import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase panelinden alınan config
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJEN.firebaseapp.com",
  projectId: "PROJEN-ID",
  storageBucket: "PROJEN.appspot.com",
  messagingSenderId: "MESAJ-ID",
  appId: "APP-ID"
};

// Firebase başlat
const app = initializeApp(firebaseConfig);

// Auth ve provider nesneleri
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
