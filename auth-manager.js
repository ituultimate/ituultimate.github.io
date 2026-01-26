import { auth } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- AYARLAR ---
// Uzantısız ve uzantılı hallerini ekliyoruz ki hata olmasın
const protectedPages = ["programlayici", "programlayici.html", "yts", "yts.html", "profil", "profil.html"];

// Şu an hangi sayfadayız?
const path = window.location.pathname;
const rawPageName = path.split("/").pop();
// "login.html?redirect=..." gibi durumlarda ?'den sonrasını temizleyip saf ismi alıyoruz
const currentPage = decodeURIComponent(rawPageName).split("?")[0] || "index.html";

// Yönlendirme hedefi var mı? (URL'den ?redirect=... parametresini okur)
const urlParams = new URLSearchParams(window.location.search);
const redirectTarget = urlParams.get('redirect') || 'index.html'; // Yoksa anasayfaya atar

// --- NAVBAR GÜNCELLEME FONKSİYONU ---
const navMenu = document.querySelector('.nav-menu');

function updateNavbar(user) {
    const existingUserMenu = document.getElementById('user-menu-item');
    const existingLoginBtn = document.getElementById('login-btn-item');
    if (existingUserMenu) existingUserMenu.remove();
    if (existingLoginBtn) existingLoginBtn.remove();

    if (user) {
        // --- KULLANICI VARSA ---
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.id = 'user-menu-item';
        li.innerHTML = `
            <div class="user-dropdown">
                <span class="nav-link user-email" style="cursor:pointer;">
                    ${user.displayName || user.email.split('@')[0]} ▼
                </span>
                <div class="dropdown-content">
                    <a href="profil.html" class="dropdown-item">Profilim</a>
                    <a href="#" id="global-logout-btn" class="dropdown-item logout">Çıkış Yap</a>
                </div>
            </div>
        `;
        if(navMenu) navMenu.appendChild(li);

        document.getElementById('global-logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = "index.html");
        });

    } else {
        // --- KULLANICI YOKSA ---
        
        // Eğer korumalı sayfadaysak -> Login'e yönlendir (Redirect parametresiyle)
        if (protectedPages.includes(currentPage)) {
            console.log("Korumalı sayfaya erişim engellendi. Yönlendiriliyor...");
            window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
            return;
        }

        // Login veya Register sayfasında değilsek "Giriş Yap" butonu koy
        if (!currentPage.includes("login") && !currentPage.includes("register")) {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.id = 'login-btn-item';
            li.innerHTML = `<a href="login.html" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.9rem;">Giriş Yap</a>`;
            if(navMenu) navMenu.appendChild(li);
        }
    }
}

// --- SAYFAYA ÖZEL İŞLEMLER (LOGIN & REGISTER) ---
function setupAuthForms() {
    
    // 1. EĞER LOGİN SAYFASINDAYSAK
    if (currentPage.includes("login")) {
        const loginForm = document.getElementById('login-form');
        const googleBtn = document.getElementById('google-btn');
        const errorDiv = document.getElementById('error-message');

        // Email Giriş
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const btn = loginForm.querySelector('button');

                btn.innerText = "Giriş yapılıyor...";
                btn.disabled = true;

                signInWithEmailAndPassword(auth, email, password)
                    .then(() => {
                        // Başarılıysa yönlendir
                        window.location.href = redirectTarget;
                    })
                    .catch((error) => {
                        btn.innerText = "Giriş Yap";
                        btn.disabled = false;
                        showAuthError(error, errorDiv);
                    });
            });
        }

        // Google Giriş
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                const provider = new GoogleAuthProvider();
                signInWithPopup(auth, provider)
                    .then(() => {
                        window.location.href = redirectTarget;
                    })
                    .catch((error) => showAuthError(error, errorDiv));
            });
        }
    }

    // 2. EĞER REGISTER SAYFASINDAYSAK
    if (currentPage.includes("register")) {
        const registerForm = document.getElementById('register-form');
        const googleBtn = document.getElementById('google-btn');
        const errorDiv = document.getElementById('error-message');

        // "Zaten hesabın var mı?" linkini güncelle (Redirect bilgisini korumak için)
        // Eğer Login'e tıklarsa redirect bilgisi kaybolmasın
        const loginLink = document.querySelector('a[href*="login"]'); 
        if(loginLink && redirectTarget !== 'index.html') {
             loginLink.href = `login.html?redirect=${encodeURIComponent(redirectTarget)}`;
        }

        // Kayıt Ol Formu
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const btn = registerForm.querySelector('button');

                btn.innerText = "Kaydediliyor...";
                btn.disabled = true;

                createUserWithEmailAndPassword(auth, email, password)
                    .then(() => {
                        // Kayıt olunca da hedefe git
                        window.location.href = redirectTarget;
                    })
                    .catch((error) => {
                        btn.innerText = "Kayıt Ol";
                        btn.disabled = false;
                        showAuthError(error, errorDiv);
                    });
            });
        }
        
        // Google ile Kayıt
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                const provider = new GoogleAuthProvider();
                signInWithPopup(auth, provider)
                    .then(() => {
                        window.location.href = redirectTarget;
                    })
                    .catch((error) => showAuthError(error, errorDiv));
            });
        }
    }
}

// Hata Mesajlarını Gösteren Yardımcı Fonksiyon
function showAuthError(error, errorDiv) {
    if(!errorDiv) return;
    let msg
