import { auth } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
    sendEmailVerification // YENİ: Mail gönderme fonksiyonu eklendi
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. AYARLAR VE TANIMLAMALAR
// ==========================================

const protectedPages = [
    "programlayici", "programlayici.html",
    "programlayıcı", "programlayıcı.html", 
    "yts", "yts.html", 
    "profil", "profil.html"
];

const path = window.location.pathname;
const rawPageName = path.split("/").filter(Boolean).pop(); 
const currentPage = decodeURIComponent(rawPageName || "https://ituultimate.com/").split("?")[0];

console.log("Algılanan Sayfa:", currentPage); 

const urlParams = new URLSearchParams(window.location.search);
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

        // YENİ KURAL: Kullanıcı var VE maili doğrulanmışsa giriş yapmış say
        if (user && user.emailVerified) {
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

            document.getElementById('global-logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                signOut(auth).then(() => window.location.href = "/");
            });
        } else {
            // Kullanıcı yoksa veya mailini doğrulamamışsa "Giriş Yap" göster
            if (!currentPage.includes("login") && !currentPage.includes("register")) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.id = 'login-btn-item';
                li.innerHTML = `<a href="/login?redirect=${encodeURIComponent(currentPage)}" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.9rem;">Giriş Yap</a>`;
                navMenu.appendChild(li);
            }
        }
    }

    // --- B. YÜKLEME EKRANI VE İÇERİK ---
    const isProtected = protectedPages.includes(currentPage);
    
    // YENİ KURAL: Korumalı sayfaya girmek için hem user olmalı hem maili onaylı olmalı
    const isAuthorized = user && user.emailVerified;

    if (isAuthorized || !isProtected) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    } else {
        // Yetkisiz erişim varsa yönlendir
        console.warn("Erişim reddedildi (Mail onayı yok veya giriş yapılmadı).");
        window.location.href = `/login?redirect=${encodeURIComponent(currentPage)}`;
    }
}

// ==========================================
// 3. LOGIN & REGISTER FORM İŞLEMLERİ
// ==========================================

function setupAuthForms() {
    const errorDiv = document.getElementById('error-message');
    const googleBtn = document.getElementById('google-btn');

    // Linkleri Güncelle
    const switchLink = document.querySelector('.toggle-link a') || document.querySelector('a[href*="register"], a[href*="login"]');
    if(switchLink && redirectTarget !== '/') {
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
                    .then((userCredential) => {
                        // YENİ: Mail doğrulaması kontrolü
                        if (!userCredential.user.emailVerified) {
                            signOut(auth); // Girişi iptal et
                            throw { code: 'auth/email-not-verified' }; // Hata fırlat
                        }
                        // Doğrulanmışsa devam et
                        window.location.href = redirectTarget;
                    })
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
                    .then(async (userCredential) => {
                        // YENİ: Doğrulama maili gönder
                        await sendEmailVerification(userCredential.user);
                        
                        // Kullanıcıyı bilgilendir ve çıkış yap (Login sayfasına at)
                        alert("Kayıt başarılı! Lütfen email adresinize gönderilen doğrulama linkine tıklayın. (Spam klasörünüzü kontrol etmeyi unutmayın.)");
                        await signOut(auth);
                        window.location.href = "/login";
                    })
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
                .then(() => {
                    // Google hesapları otomatik olarak "Doğrulanmış" sayılır, ekstra kontrole gerek yok
                    window.location.href = redirectTarget;
                })
                .catch((err) => showError(err, errorDiv));
        });
    }
}

function showError(error, element) {
    if (!element) return;
    let msg = "Hata: " + error.code;
    
    // YENİ: Mail doğrulanmamış hatası
    if (error.code === 'auth/email-not-verified') msg = "Lütfen önce email adresinizi doğrulayın (Spam kutusuna bakın).";
    
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') msg = "Bilgiler hatalı.";
    if (error.code === 'auth/wrong-password') msg = "Şifre yanlış.";
    if (error.code === 'auth/email-already-in-use') msg = "Bu email zaten kayıtlı.";
    if (error.code === 'auth/weak-password') msg = "Şifre çok zayıf.";
    
    element.textContent = msg;
    element.style.display = 'block';
}

// ==========================================
// 4. BAŞLATICI
// ==========================================
document.addEventListener('DOMContentLoaded', setupAuthForms);
onAuthStateChanged(auth, (user) => {
    updateUI(user);
});

// ==========================================
// 5. GÜVENLİK (KLAVYE & SAĞ TIK ENGELLEME)
// ==========================================

function disableDevToolsShortcuts() {

    //document.addEventListener('contextmenu', (e) => {
    //    e.preventDefault();
    //});

    document.addEventListener('keydown', (e) => {

        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }

        if (e.ctrlKey && e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC')) {
            e.preventDefault();
            return false;
        }


        if (e.ctrlKey && e.code === 'KeyU') {
            e.preventDefault();
            return false;
        }
    });
}
disableDevToolsShortcuts();
