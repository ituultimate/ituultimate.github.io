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
    const ATTENDANCE_DATA_KEY = 'ituUltimateAttendance'; // Yoklama durumları (P/A) hala localde kalsın
    let currentUser = null;

    // ============================================================= 
    // 3. VERİ YÖNETİMİ
    // ============================================================= 

    // --- A. Dersleri Getir (Firebase'den) ---
    const fetchCoursesFromCloud = async (user) => {
        const attendanceContainer = document.getElementById(CONTAINER_ID);
        if (!attendanceContainer) return;

        // Yükleniyor mesajı verelim
        attendanceContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Dersler buluttan yükleniyor...</div>';

        try {
            const doc = await db.collection('users').doc(user.uid).get();
            
            if (doc.exists && doc.data().schedule && doc.data().schedule.length > 0) {
                // Veri bulundu, çizelim
                renderAttendanceTrackers(doc.data().schedule);
            } else {
                // Veri yok
                renderEmptyState(attendanceContainer);
            }
        } catch (error) {
            console.error("Dersler çekilirken hata:", error);
            attendanceContainer.innerHTML = '<p style="color:red; text-align:center;">Dersler yüklenirken hata oluştu.</p>';
        }
    };

    // --- B. Yoklama Durumunu Getir (Local Storage) ---
    // Not: Tikleri de buluta taşımak istersen burayı da değiştirmemiz gerekir.
    // Şimdilik dersler buluttan, tikler cihazdan gelsin.
    const getAttendanceData = () => {
        const attendanceData = localStorage.getItem(ATTENDANCE_DATA_KEY);
        if (!attendanceData) return {};
        return JSON.parse(attendanceData);
    };

    const saveAttendanceData = (data) => {
        localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
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

    const renderAttendanceTrackers = (courses) => {
        const attendanceContainer = document.getElementById(CONTAINER_ID);
        if (!attendanceContainer) return;

        attendanceContainer.innerHTML = ''; // Temizle

        // Dersleri CRN'e göre grupla
        const coursesByCrn = courses.reduce((acc, course) => {
            if (!acc[course.crn]) acc[course.crn] = [];
            acc[course.crn].push(course);
            return acc;
        }, {});

        // Kartları Oluştur
        Object.entries(coursesByCrn).forEach(([crn, courseParts]) => {
            const firstPart = courseParts[0];
            const attendanceData = getAttendanceData();
            const courseAttendance = attendanceData[crn] || new Array(14).fill(null);

            // İstatistik Hesaplama
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

            // HTML Yapısı
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

    // ============================================================= 
    // 5. EVENT LISTENERS
    // ============================================================= 

    // Tıklama Olayı (Event Delegation)
    const handleCellClick = (e) => {
        if (e.target.classList.contains('attendance-cell')) {
            const crn = e.target.dataset.crn;
            const weekIndex = parseInt(e.target.dataset.week, 10);

            let attendanceData = getAttendanceData();
            if (!attendanceData[crn]) {
                attendanceData[crn] = new Array(14).fill(null);
            }

            const currentStatus = attendanceData[crn][weekIndex];
            const newStatus = currentStatus === 'P' ? 'A' : (currentStatus === 'A' ? null : 'P');
            attendanceData[crn][weekIndex] = newStatus;

            saveAttendanceData(attendanceData);
            
            // UI'ı güncellemek için, o anki dersleri tekrar çizmemiz gerekebilir.
            // Ancak sürekli fetch atmamak için DOM manipülasyonu veya basit reload yapılabilir.
            // Şimdilik sadece hücreyi güncelleyelim veya sayfayı yeniletelim.
            // En temizi: Basitçe hücre sınıfını ve içeriğini güncellemek, ama istatistikler için re-render iyidir.
            // Veri zaten elimizde olduğu için tekrar fetch etmeye gerek yok, ama o veriyi saklamadık.
            // Basit çözüm: Sayfayı yenilemeye gerek yok, hücreyi güncelle.
            // İstatistik güncellemesi karmaşık olacağı için şimdilik:
            e.target.textContent = newStatus || '';
            e.target.className = `attendance-cell ${newStatus ? newStatus === 'P' ? 'present' : 'absent' : ''}`;
            
            // Eğer istatistiklerin anlık değişmesini istersen tam re-render lazım.
            // Bunun için 'courses' verisini global bir değişkende tutabiliriz.
            location.reload(); // En tembel ve kesin çözüm :)
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
    
    // Kullanıcı giriş durumunu dinle
    auth.onAuthStateChanged((user) => {
        const attendanceContainer = document.getElementById(CONTAINER_ID);
        if (!attendanceContainer) return; // Programlayıcı sayfasındaysak çalışma

        if (user) {
            console.log("YTS: Kullanıcı giriş yaptı, dersler çekiliyor...", user.email);
            currentUser = user;
            fetchCoursesFromCloud(user);
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
