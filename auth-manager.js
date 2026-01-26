import { auth } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. AYARLAR VE TANIMLAMALAR
// ==========================================

// Korumalı sayfaların tüm varyasyonlarını yaz
const protectedPages = [
    "programlayici", "programlayici.html",
    "programlayıcı", "programlayıcı.html", 
    "yts", "yts.html", 
    "profil", "profil.html"
];

// Şu anki sayfa ismini bul
const path = window.location.pathname;
const rawPageName = path.split("/").filter(Boolean).pop(); 
// Eğer anasayfadaysak (boşsa) 'index.html' kabul et
const currentPage = decodeURIComponent(rawPageName || "https://ituultimate.com/").split("?")[0];

console.log("Algılanan Sayfa:", currentPage); 

// Yönlendirme hedefi (Login'den sonra nereye gidecek?)
const urlParams = new URLSearchParams(window.location.search);
// Eğer redirect yoksa varsayılan olarak anasayfaya ('/') git
const redirectTarget = urlParams.get('redirect') || '/';

// ==========================================
// 2. ARAYÜZ (NAVBAR & LOADING) YÖNETİMİ
// ==========================================

function updateUI(user) {
    const navMenu = document.querySelector('.nav-menu');
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    // --- A. NAVBAR GÜNCELLEME ---
    if (navMenu) {
        const existingUser = document.getElementById('user-menu-item');
        const existingLogin = document.getElementById('login-btn-item');
        if (existingUser) existingUser.remove();
        if (existingLogin) existingLogin.remove();

        if (user) {
            // Kullanıcı Giriş Yapmışsa
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.id = 'user-menu-item';
            li.innerHTML = `
                <div class="user-dropdown">
                    <span class="nav-link user-email" style="cursor:pointer;">
                        ${user.displayName || user.email.split('@')[0]} ▼
                    </span>
                    <div class="dropdown-content">
                        <a href="/profil" class="dropdown-item">Profilim</a>
                        <a href="#" id="global-logout-btn" class="dropdown-item logout">Çıkış Yap</a>
                    </div>
                </div>
            `;
            navMenu.appendChild(li);

            // Çıkış Butonu
            document.getElementById('global-logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                // DÜZELTME: Sadece "/" diyerek anasayfaya atıyoruz
                signOut(auth).then(() => window.location.href = "/");
            });
        } else {
            // Kullanıcı Yoksa
            if (!currentPage.includes("login") && !currentPage.includes("register")) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.id = 'login-btn-item';
                // DÜZELTME: Başına / koyduk
                li.innerHTML = `<a href="/login?redirect=${encodeURIComponent(currentPage)}" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.9rem;">Giriş Yap</a>`;
                navMenu.appendChild(li);
            }
        }
    }

    // --- B. YÜKLEME EKRANI VE İÇERİK ---
    const isProtected = protectedPages.includes(currentPage);
    
    if (user || !isProtected) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    } else {
        // Kullanıcı yok VE sayfa korumalı -> Yönlendir
        console.warn("Erişim reddedildi. Yönlendiriliyor...");
        // DÜZELTME: Başına / koyduk
        window.location.href = `/login?redirect=${encodeURIComponent(currentPage)}`;
    }
}

// ==========================================
// 3. LOGIN & REGISTER FORM İŞLEMLERİ
// ==========================================

function setupAuthForms() {
    const errorDiv = document.getElementById('error-message');
    const googleBtn = document.getElementById('google-btn');

    // Linkleri Güncelle (Redirect parametresini korumak için)
    const switchLink = document.querySelector('.toggle-link a') || document.querySelector('a[href*="register"], a[href*="login"]');
    
    if(switchLink && redirectTarget !== '/') {
        // DÜZELTME: domain ismini sildik, başına / koyduk
        const targetPage = currentPage.includes("login") ? "/register" : "/login";
        switchLink.href = `${targetPage}?redirect=${encodeURIComponent(redirectTarget)}`;
    }

    // --- LOGIN FORMU ---
    if (currentPage.includes("login")) {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const btn = loginForm.querySelector('button');
                
                btn.innerText = "Giriş yapılıyor...";
                btn.disabled = true;

                signInWithEmailAndPassword(auth, email, password)
                    .then(() => window.location.href = redirectTarget)
                    .catch((err) => {
                        btn.innerText = "Giriş Yap";
                        btn.disabled = false;
                        showError(err, errorDiv);
                    });
            });
        }
    }

    // --- REGISTER FORMU ---
    if (currentPage.includes("register")) {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const btn = registerForm.querySelector('button');

                btn.innerText = "Kaydediliyor...";
                btn.disabled = true;

                createUserWithEmailAndPassword(auth, email, password)
                    .then(() => window.location.href = redirectTarget)
                    .catch((err) => {
                        btn.innerText = "Kayıt Ol";
                        btn.disabled = false;
                        showError(err, errorDiv);
                    });
            });
        }
    }

    // --- GOOGLE GİRİŞ ---
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            signInWithPopup(auth, new GoogleAuthProvider())
                .then(() => window.location.href = redirectTarget)
                .catch((err) => showError(err, errorDiv));
        });
    }
}

function showError(error, element) {
    if (!element) return;
    let msg = "Hata: " + error.code;
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') msg = "Bilgiler hatalı.";
    if (error.code === 'auth/wrong-password') msg = "Şifre yanlış.";
    if (error.code === 'auth/email-already-in-use') msg = "Bu email zaten kayıtlı.";
    if (error.code === 'auth/weak-password') msg = "Şifre çok zayıf.";
    
    element.textContent = msg;
    element.style.display = 'block';
}

// ==========================================
// 4. BAŞLATICI (INITIALIZATION)
// ==========================================
document.addEventListener('DOMContentLoaded', setupAuthForms);
onAuthStateChanged(auth, (user) => {
    updateUI(user);
});

