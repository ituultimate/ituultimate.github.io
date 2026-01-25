import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Hangi sayfalara giriş yapmadan girilemez? Listeyi buraya yaz.
const protectedPages = ["programlayici", "yts"];

// Şu an hangi sayfadayız? (Örn: "yts.html" veya "index.html")
const currentPage = window.location.pathname.split("/").pop();

// Navbar elementlerini seç
const navMenu = document.querySelector('.nav-menu');

// --- NAVBAR GÜNCELLEME FONKSİYONU ---
function updateNavbar(user) {
    // Önce varsa eski kullanıcı menüsünü temizle (tekrar eklememek için)
    const existingUserMenu = document.getElementById('user-menu-item');
    const existingLoginBtn = document.getElementById('login-btn-item');
    if (existingUserMenu) existingUserMenu.remove();
    if (existingLoginBtn) existingLoginBtn.remove();

    if (user) {
        // --- KULLANICI GİRİŞ YAPMIŞSA ---
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.id = 'user-menu-item';
        li.innerHTML = `
            <div class="user-dropdown">
                <span class="nav-link user-email" style="cursor:pointer;">
                    ${user.displayName || user.email.split('@')[0]} ▼
                </span>
                <div class="dropdown-content">
                    <a href="profil" class="dropdown-item">Profilim</a>
                    <a href="https://ituultimate.github.io/" id="global-logout-btn" class="dropdown-item logout">Çıkış Yap</a>
                </div>
            </div>
        `;
        navMenu.appendChild(li);

        // Çıkış Butonu Event'i
        document.getElementById('global-logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "login?redirect=" + encodeURIComponent(currentPage);
            });
        });

    } else {
        // --- KULLANICI GİRİŞ YAPMAMIŞSA ---

        // Eğer giriş zorunlu bir sayfadaysak -> Login'e at!
        if (protectedPages.includes(currentPage)) {
            window.location.href = "login?redirect=" + encodeURIComponent(currentPage);
            return; // Fonksiyonu durdur
        }

        // Değilse -> "Giriş Yap" butonunu ekle
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.id = 'login-btn-item';
        li.innerHTML = `<a href="login" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.9rem;">Giriş Yap</a>`;
        navMenu.appendChild(li);
    }
}

// --- ANA KONTROL ---
// Sayfa yüklendiğinde durumu dinlemeye başla
onAuthStateChanged(auth, (user) => {
    updateNavbar(user);

    // Eğer YTS gibi özel bir sayfadaysak ve loading ekranı varsa onu kaldır
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    if (loadingOverlay && mainContent && user) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }

});



