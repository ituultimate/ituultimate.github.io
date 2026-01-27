document.addEventListener('DOMContentLoaded', () => {
    // ============================================================= 
    // 1. FIREBASE CONFIG (Scheduler ile AYNI olmalı)
    // ============================================================= 
    const firebaseConfig = {
        apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
        authDomain: "ituultimate-7d97f.firebaseapp.com",
        projectId: "ituultimate-7d97f",
        storageBucket: "ituultimate-7d97f.firebasestorage.app",
        messagingSenderId: "1000938340000",
        appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
    };

    // Firebase'i başlat (Zaten başlatılmadıysa)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();

   // =============================================================
// 2. SABİTLER VE DEĞİŞKENLER
// =============================================================
const CONTAINER_ID = 'attendance-container';
// const ATTENDANCE_DATA_KEY = 'ituUltimateAttendance'; // ARTIK BUNA GEREK YOK
let currentUser = null;
let currentAttendanceData = {}; // <-- YENİ: Buluttan gelen yoklama verisini tutmak içi

    // =============================================================
// 3. VERİ YÖNETİMİ
// =============================================================

// --- A. Kullanıcı Verisini Getir (Program ve Yoklama) ---
// ESKİ `fetchCoursesFromCloud` FONKSİYONUNU SİLİN VE BUNU YERİNE KOYUN
const fetchUserData = async (user) => {
    const attendanceContainer = document.getElementById(CONTAINER_ID);
    if (!attendanceContainer) return;

    attendanceContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Veriler buluttan yükleniyor...</div>';

    try {
        const doc = await db.collection('users').doc(user.uid).get();

        if (doc.exists) {
            const userData = doc.data();
            const courses = userData.schedule || [];
            // Buluttaki yoklama verisini global değişkene ata
            currentAttendanceData = userData.attendance || {}; 
            
            if (courses.length > 0) {
                // Hem dersleri hem de mevcut yoklama verisini çiziciye gönder
                renderAttendanceTrackers(courses, currentAttendanceData);
            } else {
                renderEmptyState(attendanceContainer);
            }
        } else {
            renderEmptyState(attendanceContainer);
        }
    } catch (error) {
        console.error("Kullanıcı verisi çekilirken hata:", error);
        attendanceContainer.innerHTML = '<p style="color:red; text-align:center;">Veriler yüklenirken hata oluştu.</p>';
    }
};

// --- B. Yoklama Verisini Buluta Kaydet ---
// ESKİ `getAttendanceData` VE `saveAttendanceData` FONKSİYONLARINI SİLİN VE BUNU YERİNE KOYUN
const saveAttendanceDataToCloud = async (user, attendanceData) => {
    try {
        // Kullanıcının dokümanındaki 'attendance' alanını güncelle
        await db.collection('users').doc(user.uid).update({
            attendance: attendanceData
        });
        console.log("Yoklama verisi buluta başarıyla kaydedildi.");
    } catch (error) {
        console.error("Yoklama verisi buluta kaydedilirken hata:", error);
        // İstersen burada kullanıcıya bir hata mesajı gösterebilirsin.
    }
};

    // ============================================================= 
    // 4. RENDER (ÇİZİM) FONKSİYONLARI
    // ============================================================= 
    
    const renderEmptyState = (container) => {
        container.innerHTML = `
            <p class="no-courses-message">
                Kayıtlı ders bulunamadı. 
                <a href="/programlayici.html">Programlayıcıya git</a> ve derslerini buluta kaydet!
            </p>`;
    };

    // =============================================================
// 4. RENDER (ÇİZİM) FONKSİYONLARI
// =============================================================
// ... (renderEmptyState fonksiyonu aynı kalabilir) ...

// RENDE`renderAttendanceTrackers` FONKSİYONUNU GÜNCELLEYİN
const renderAttendanceTrackers = (courses, attendanceData) => { // <-- attendanceData parametresi eklendi
    const attendanceContainer = document.getElementById(CONTAINER_ID);
    if (!attendanceContainer) return;

    attendanceContainer.innerHTML = '';

    const coursesByCrn = courses.reduce((acc, course) => {
        if (!acc[course.crn]) acc[course.crn] = [];
        acc[course.crn].push(course);
        return acc;
    }, {});

    Object.entries(coursesByCrn).forEach(([crn, courseParts]) => {
        const firstPart = courseParts[0];
        // Artık parametre olarak gelen `attendanceData` kullanılıyor
        const courseAttendance = attendanceData[crn] || new Array(14).fill(null);

        const summary = {
            totalHeld: courseAttendance.filter(s => s === 'P' || s === 'A').length,
            totalPresent: courseAttendance.filter(s => s === 'P').length,
            percentage: 0
        };
        if (summary.totalHeld > 0) {
            summary.percentage = Math.round((summary.totalPresent / summary.totalHeld) * 100);
        }

        const isHighAttendance = summary.percentage >= 70;
        const card = document.createElement('div');
        card.className = `attendance-card ${isHighAttendance ? 'high-attendance' : ''}`;

        card.innerHTML = `
            <div class="attendance-card-header">
                <div class="attendance-card-title">${firstPart.code}</div>
                <div class="attendance-card-subtitle">${firstPart.crn} | ${firstPart.name || 'Ders'}</div>
            </div>
            <div class="attendance-card-body">
                <table class="attendance-grid">
                    <thead>
                        <tr>
                            <th>Hafta</th>
                            ${[...Array(14)].map((_, i) => `<th>${i + 1}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Durum</td>
                            ${courseAttendance.map((status, i) => `
                                <td class="attendance-cell ${status ? status === 'P' ? 'present' : 'absent' : ''}" data-crn="${crn}" data-week="${i}">
                                    ${status || ''}
                                </td>
                            `).join('')}
                        </tr>
                    </tbody>
                </table>
                <div class="attendance-summary">
                    <div class="summary-item">
                        <div class="summary-value">${summary.totalHeld}</div>
                        <div class="summary-label">Toplam</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${summary.totalPresent}</div>
                        <div class="summary-label">Katılınan</div>
                    </div>
                    <div class="summary-item percentage">
                        <div class="summary-value ${isHighAttendance ? 'high-percentage' : ''}">${summary.percentage}%</div>
                        <div class="summary-label">Yüzde</div>
                    </div>
                </div>
            </div>
        `;
        attendanceContainer.appendChild(card);
    });
};

    // `handleCellClick` FONKSİYONUNU TAMAMEN BUNUNLA DEĞİŞTİRİN
const handleCellClick = async (e) => { // <-- async eklendi
    if (e.target.classList.contains('attendance-cell')) {
        const crn = e.target.dataset.crn;
        const weekIndex = parseInt(e.target.dataset.week, 10);

        // Global veriden o anki durumu al
        if (!currentAttendanceData[crn]) {
            currentAttendanceData[crn] = new Array(14).fill(null);
        }

        const currentStatus = currentAttendanceData[crn][weekIndex];
        const newStatus = currentStatus === 'P' ? 'A' : (currentStatus === 'A' ? null : 'P');
        
        // Global veriyi güncelle
        currentAttendanceData[crn][weekIndex] = newStatus;

        // 1. Veriyi anında buluta kaydet
        await saveAttendanceDataToCloud(currentUser, currentAttendanceData);

        // 2. Arayüzü anında güncelle (sayfayı yenilemeden)
        const card = e.target.closest('.attendance-card');
        if (!card) return;

        e.target.textContent = newStatus || '';
        e.target.className = `attendance-cell ${newStatus ? (newStatus === 'P' ? 'present' : 'absent') : ''}`;

        // İstatistikleri yeniden hesapla ve güncelle
        const courseAttendance = currentAttendanceData[crn];
        const summary = {
            totalHeld: courseAttendance.filter(s => s === 'P' || s === 'A').length,
            totalPresent: courseAttendance.filter(s => s === 'P').length,
            percentage: 0
        };
        if (summary.totalHeld > 0) {
            summary.percentage = Math.round((summary.totalPresent / summary.totalHeld) * 100);
        }

        const summaryValues = card.querySelectorAll('.summary-value');
        summaryValues[0].textContent = summary.totalHeld;
        summaryValues[1].textContent = summary.totalPresent;
        
        const percentageElement = summaryValues[2];
        percentageElement.textContent = `${summary.percentage}%`;

        const isHighAttendance = summary.percentage >= 70;
        if (isHighAttendance) {
            card.classList.add('high-attendance');
            percentageElement.classList.add('high-percentage');
        } else {
            card.classList.remove('high-attendance');
            percentageElement.classList.remove('high-percentage');
        }
    }
};
    // Container'a tıklama dinleyicisi ekle
    const mainContainer = document.getElementById(CONTAINER_ID);
    if (mainContainer) {
        mainContainer.addEventListener('click', handleCellClick);
    }

   // =============================================================
// 6. BAŞLATMA & AUTH KONTROLÜ
// =============================================================

auth.onAuthStateChanged((user) => {
    const attendanceContainer = document.getElementById(CONTAINER_ID);
    if (!attendanceContainer) return;

    if (user) {
        console.log("YTS: Kullanıcı giriş yaptı, veriler çekiliyor...", user.email);
        currentUser = user;
        fetchUserData(user); // <-- ESKİ ADI `fetchCoursesFromCloud`'DU
    } else {
        console.log("YTS: Kullanıcı giriş yapmamış.");
        attendanceContainer.innerHTML = `
            <p class="no-courses-message">
                Derslerini görmek için lütfen giriş yap.
                <br><br>
                (Misafir girişi için LocalStorage kullanılabilir ancak şu an Bulut modu aktif.)
            </p>`;
    }
});

    // Hamburger Menü
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });
        document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
        }));
    }
});


