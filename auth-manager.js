import { auth } from "./firebase-config.js";
import {
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. AYARLAR VE TANIMLAMALAR
// ==========================================

// Pages that show a friendly modal instead of hard redirect
const softProtectedPages = [
    "programlayici", "programlayici.html",
    "programlayıcı", "programlayıcı.html",
    "yts", "yts.html"
];

// Pages that require hard redirect (must be logged in)
const hardProtectedPages = [
    "profil", "profil.html"
];

// Combined for backwards compatibility
const protectedPages = [...softProtectedPages, ...hardProtectedPages];

const path = window.location.pathname;
const rawPageName = path.split("/").filter(Boolean).pop();
const currentPage = decodeURIComponent(rawPageName || "https://ituultimate.com/").split("?")[0];

console.log("Algılanan Sayfa:", currentPage);

// Security: Whitelist allowed redirect targets
const ALLOWED_REDIRECTS = [
    '/programlayici', 'programlayici',
    '/yts', 'yts',
    '/profil', 'profil',
    '/ortalamahesaplayici', 'ortalamahesaplayici',
    '/duyurular', 'duyurular',
    '/'
];

const urlParams = new URLSearchParams(window.location.search);
const rawRedirect = urlParams.get('redirect') || '/';
const redirectTarget = ALLOWED_REDIRECTS.includes(rawRedirect) ? rawRedirect : '/';

// Guard flag to prevent redundant redirects during auth state changes
let isRedirecting = false;

// Flag to track if modal has been shown (prevent duplicates)
let authModalShown = false;

// ==========================================
// AUTH MODAL FUNCTION
// ==========================================

/**
 * Show a friendly authentication modal for soft-protected pages
 * Instead of hard-redirecting, this shows a dismissible modal
 */
function showAuthModal() {
    // Prevent duplicate modals
    if (authModalShown || document.querySelector('.auth-modal-overlay')) {
        return;
    }
    authModalShown = true;

    // Create modal HTML
    const modalHTML = `
        <div class="auth-modal-overlay" id="auth-modal-overlay">
            <div class="auth-modal">
                <button class="auth-modal-close" id="auth-modal-close" aria-label="Kapat">
                    <i class="fas fa-times"></i>
                </button>
                <div class="auth-modal-icon">
                    ☁️
                </div>
                <h2 class="auth-modal-title">Bulut Kayıt Sistemi</h2>
                <p class="auth-modal-message">
                    Merhaba! Eğer üye girişi yapıp programlayıcıyı kullanırsanız, programınız bulut sistemimize kaydedilir ve istediğiniz zaman giriş yaparak programınızı görebilir, hatta kaydettiğiniz programdaki derslerin yoklama takibini tüm dönem yapabilirsiniz.
                </p>
                <a href="/login?redirect=${encodeURIComponent(currentPage)}" class="auth-modal-cta">
                    <i class="fas fa-sign-in-alt"></i>&nbsp; Giriş Yap
                </a>
                <span class="auth-modal-dismiss" id="auth-modal-dismiss">Şimdilik geç</span>
            </div>
        </div>
    `;

    // Inject modal into the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const overlay = document.getElementById('auth-modal-overlay');
    const closeBtn = document.getElementById('auth-modal-close');
    const dismissBtn = document.getElementById('auth-modal-dismiss');

    const closeModal = () => {
        overlay.style.animation = 'authModalFadeIn 0.2s ease reverse forwards';
        setTimeout(() => {
            overlay.remove();
        }, 200);
    };

    closeBtn.addEventListener('click', closeModal);
    dismissBtn.addEventListener('click', closeModal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// ==========================================
// AVATAR HELPER FUNCTION
// ==========================================

/**
 * Generate a Data URI for an avatar from an emoji
 * Creates an SVG with the emoji centered on a branded background
 * @param {string} emoji - The emoji to use as avatar
 * @returns {string} - Data URI string for the avatar
 */
function generateAvatarDataURI(emoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#062a54"/>
                <stop offset="100%" style="stop-color:#0a3d6f"/>
            </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#bg)"/>
        <text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

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

            // Get user initial for fallback avatar
            const userName = user.displayName || user.email.split('@')[0];
            const userInitial = userName.charAt(0).toUpperCase();

            // Check if user has a photo URL
            const avatarHTML = user.photoURL
                ? `<img src="${user.photoURL}" alt="Avatar" class="user-avatar" onerror="this.outerHTML='<span class=\\'avatar-fallback\\'>${userInitial}</span>'">`
                : `<span class="avatar-fallback">${userInitial}</span>`;

            li.innerHTML = `
                <div class="user-dropdown">
                    <span class="nav-link user-email" style="cursor:pointer;">
                        ${avatarHTML}
                        ${userName} ▼
                    </span>
                    <div class="dropdown-content">
                        <a href="/profil" class="dropdown-item"><i class="fas fa-user"></i> Profilim</a>
                        <a href="/ituconnect" class="dropdown-item"><i class="fas fa-comments"></i> ITU Connect</a>
                        <a href="#" id="global-logout-btn" class="dropdown-item logout"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</a>
                    </div>
                </div>
            `;
            navMenu.appendChild(li);

            document.getElementById('global-logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                signOut(auth).then(() => window.location.replace("/"));
            });
        } else {
            // Kullanıcı yoksa veya mailini doğrulamamışsa "Giriş Yap" göster
            if (!currentPage.includes("login") && !currentPage.includes("register")) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.id = 'login-btn-item';
                li.innerHTML = `<a href="/login.html?redirect=${encodeURIComponent(currentPage)}" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.9rem;">Giriş Yap</a>`;
                navMenu.appendChild(li);
            }
        }
    }

    // --- B. YÜKLEME EKRANI VE İÇERİK ---
    const isSoftProtected = softProtectedPages.includes(currentPage);
    const isHardProtected = hardProtectedPages.includes(currentPage);
    const isProtected = isSoftProtected || isHardProtected;

    // YENİ KURAL: Korumalı sayfaya girmek için hem user olmalı hem maili onaylı olmalı
    const isAuthorized = user && user.emailVerified;

    if (isAuthorized || !isProtected) {
        // User is authorized OR page is not protected - show content normally
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    } else if (isSoftProtected) {
        // Soft-protected page (programlayici, yts) - show modal but allow access
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';

        // Show the auth modal after a short delay for better UX
        setTimeout(() => {
            showAuthModal();
        }, 500);
    } else {
        // Hard-protected page (profil) - redirect to login
        // Skip if already on login/register page to prevent loops
        if (currentPage.includes("login") || currentPage.includes("register")) {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block';
            return;
        }

        // Prevent redundant redirects
        if (isRedirecting) return;
        isRedirecting = true;

        console.warn("Erişim reddedildi (Mail onayı yok veya giriş yapılmadı).");
        // Use replace() instead of href to prevent back button loop
        window.location.replace(`/login?redirect=${encodeURIComponent(currentPage)}`);
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
    if (switchLink && redirectTarget !== '/') {
        const targetPage = currentPage.includes("login") ? "/register.html" : "/login.html";
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
                const rememberMe = document.getElementById('remember-me')?.checked ?? true;
                const btn = loginForm.querySelector('button');

                btn.innerText = "Giriş yapılıyor...";
                btn.disabled = true;

                // Set persistence based on Remember Me checkbox
                const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;

                setPersistence(auth, persistence)
                    .then(() => signInWithEmailAndPassword(auth, email, password))
                    .then((userCredential) => {
                        // YENİ: Mail doğrulaması kontrolü
                        if (!userCredential.user.emailVerified) {
                            signOut(auth); // Girişi iptal et
                            throw { code: 'auth/email-not-verified' }; // Hata fırlat
                        }
                        // Doğrulanmışsa devam et - use replace to avoid back button issues
                        window.location.replace(redirectTarget);
                    })
                    .catch((err) => {
                        btn.innerText = "Giriş Yap";
                        btn.disabled = false;
                        showError(err, errorDiv);
                    });
            });
        }

        // --- ŞİFREMİ UNUTTUM ---
        const forgotPasswordLink = document.getElementById('forgot-password-link');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                handlePasswordReset(errorDiv);
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
                const username = document.getElementById('username')?.value?.trim() || '';
                const selectedAvatar = document.getElementById('selected-avatar')?.value || '🐝';
                const btn = registerForm.querySelector('button');

                // Validate username
                if (username.length < 2 || username.length > 20) {
                    showError({ code: 'auth/invalid-username' }, errorDiv);
                    return;
                }

                btn.innerText = "Kaydediliyor...";
                btn.disabled = true;

                createUserWithEmailAndPassword(auth, email, password)
                    .then(async (userCredential) => {
                        // Generate avatar photoURL from emoji
                        const avatarPhotoURL = generateAvatarDataURI(selectedAvatar);

                        // Update user profile with username and avatar
                        await updateProfile(userCredential.user, {
                            displayName: username,
                            photoURL: avatarPhotoURL
                        });

                        // Send verification email
                        await sendEmailVerification(userCredential.user);

                        // Inform user and sign out
                        alert("Kayıt başarılı! Lütfen email adresinize gönderilen doğrulama linkine tıklayın. (Spam klasörünüzü kontrol etmeyi unutmayın.)");
                        await signOut(auth);
                        window.location.replace("/login");
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
                    window.location.replace(redirectTarget);
                })
                .catch((err) => showError(err, errorDiv));
        });
    }
}

function showError(error, element) {
    if (!element) return;
    let msg = "Hata: " + error.code;

    // Custom error messages
    if (error.code === 'auth/email-not-verified') msg = "Lütfen önce email adresinizi doğrulayın (Spam kutusuna bakın).";
    if (error.code === 'auth/invalid-username') msg = "Kullanıcı adı 2-20 karakter arasında olmalıdır.";
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') msg = "Bilgiler hatalı.";
    if (error.code === 'auth/wrong-password') msg = "Şifre yanlış.";
    if (error.code === 'auth/email-already-in-use') msg = "Bu email zaten kayıtlı.";
    if (error.code === 'auth/weak-password') msg = "Şifre çok zayıf.";

    element.textContent = msg;
    element.style.display = 'block';
}

// ==========================================
// 5. ŞİFRE SIFIRLAMA
// ==========================================

function handlePasswordReset(errorDiv) {
    const emailInput = document.getElementById('email');
    const email = prompt(
        'Şifre sıfırlama linki göndermek için email adresinizi girin:',
        emailInput?.value || ''
    );

    if (!email || !email.trim()) return;

    sendPasswordResetEmail(auth, email.trim())
        .then(() => {
            alert('Şifre sıfırlama linki gönderildi! Email kutunuzu kontrol edin. (Spam klasörüne de bakın.)');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        })
        .catch((error) => {
            let msg = 'Hata: ' + error.code;

            if (error.code === 'auth/user-not-found') msg = 'Bu email adresi kayıtlı değil.';
            if (error.code === 'auth/invalid-email') msg = 'Geçersiz email adresi.';
            if (error.code === 'auth/too-many-requests') msg = 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.';

            if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
            } else {
                alert(msg);
            }
        });
}

// ==========================================
// 4. BAŞLATICI
// ==========================================
document.addEventListener('DOMContentLoaded', setupAuthForms);
onAuthStateChanged(auth, (user) => {
    updateUI(user);
});
