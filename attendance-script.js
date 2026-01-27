document.addEventListener('DOMContentLoaded', () => {
    // --- SABİTLER ---
    // HTML'deki ID'nin 'attendance-tracker-container' olduğundan EMİN OL!
    const CONTAINER_ID = 'attendance-tracker-container'; 
    const ATTENDANCE_STORAGE_KEY = 'ituUltimateUserSchedule';
    const ATTENDANCE_DATA_KEY = 'ituUltimateAttendance';

    // --- Core Functions ---
    const getCourses = () => {
        const coursesData = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
        if (!coursesData) {
            // console.warn iptal edildi, kafa karıştırmasın
            return [];
        }
        try {
            return JSON.parse(coursesData);
        } catch (error) {
            console.error("Error parsing courses:", error);
            return [];
        }
    };

    const getAttendanceData = () => {
        const attendanceData = localStorage.getItem(ATTENDANCE_DATA_KEY);
        if (!attendanceData) return {};
        return JSON.parse(attendanceData);
    };

    const saveAttendanceData = (data) => {
        localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
    };

    // --- Render Function ---
    const renderAttendanceTrackers = () => {
        const attendanceContainer = document.getElementById(CONTAINER_ID);

        // 1. GÜVENLİK KONTROLÜ: Kutu yoksa (Programlayıcı sayfasındaysak) DUR.
        if (!attendanceContainer) return;

        const courses = getCourses();

        if (courses.length === 0) {
            attendanceContainer.innerHTML = `
                <p class="no-courses-message">
                    Henüz ders eklemedin. 
                    <a href="/programlayici.html">Programlayıcıya git</a> ve ekle!
                </p>`;
            return;
        }

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
            // Varsayılan 14 hafta boş
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

            card.innerHTML = `
                <div class="attendance-card-header">
                    <div class="attendance-card-title">${firstPart.code}</div>
                    <div class="attendance-card-subtitle">${firstPart.crn} | ${firstPart.name || 'N/A'}</div>
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

    // --- Tıklama Olayı (Event Handler) ---
    const handleCellClick = (e) => {
        if (e.target.classList.contains('attendance-cell')) {
            const crn = e.target.dataset.crn;
            const weekIndex = parseInt(e.target.dataset.week, 10);

            let attendanceData = getAttendanceData();
            if (!attendanceData[crn]) {
                attendanceData[crn] = new Array(14).fill(null);
            }

            const currentStatus = attendanceData[crn][weekIndex];
            // Döngü: Yok -> Var (P) -> Yok (A) -> Sıfırla (null)
            const newStatus = currentStatus === 'P' ? 'A' : (currentStatus === 'A' ? null : 'P');
            attendanceData[crn][weekIndex] = newStatus;

            saveAttendanceData(attendanceData);
            renderAttendanceTrackers(); 
        }
    };

    // ==========================================
    // BAŞLATMA & EVENT LISTENERS (DÜZELTİLDİ)
    // ==========================================
    
    // 1. Sayfayı Çiz
    renderAttendanceTrackers();

    // 2. Event Listener'ı GÜVENLİ EKLE
    // Önce container'ı bul
    const mainContainer = document.getElementById(CONTAINER_ID);
    
    // Sadece container varsa dinleyici ekle! (Hata Çözen Kısım Burası)
    if (mainContainer) {
        mainContainer.addEventListener('click', handleCellClick);
    }

    // Hamburger Menü (Standart)
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    if (hamburger && navMenu) { // Hamburger de yoksa hata vermesin diye kontrol
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
