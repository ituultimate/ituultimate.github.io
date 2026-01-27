document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const attendanceContainer = document.getElementById('attendance-container');
    const ATTENDANCE_STORAGE_KEY = 'ituUltimateUserSchedule';

    // --- Core Functions ---
    const getCourses = () => {
        const coursesData = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
        if (!coursesData) {
            console.warn("No courses found in localStorage. Key:", ATTENDANCE_STORAGE_KEY);
            return [];
        }
        try {
            const courses = JSON.parse(coursesData);
            console.log("Successfully retrieved courses from localStorage:", courses);
            return courses;
        } catch (error) {
            console.error("Error parsing courses from localStorage:", error);
            return [];
        }
    };

    const getAttendanceData = () => {
        const attendanceData = localStorage.getItem('ituUltimateAttendance');
        if (!attendanceData) return {};
        return JSON.parse(attendanceData);
    };

    const saveAttendanceData = (data) => {
        localStorage.setItem('ituUltimateAttendance', JSON.stringify(data));
    };

    // --- Render Function ---
const renderAttendanceTrackers = () => {
    // 1. Önce kutuyu bulmaya çalışalım
    // (Eğer globalde tanımlıysa bile burada tekrar kontrol etmek en güvenlisidir)
    const attendanceContainer = document.getElementById('attendance-tracker-container'); // HTML'deki ID'n neyse onu yaz

    // 2. HATA ÖNLEYİCİ (GUARD CLAUSE) - İŞTE BU EKSİK
    // Eğer kutu yoksa (yani YTS sayfasında değilsek), fonksiyonu hemen durdur.
    if (!attendanceContainer) return;

    // 3. Artık güvenle devam edebiliriz
    const courses = getCourses();

    if (courses.length === 0) {
        attendanceContainer.innerHTML = `
            <p class="no-courses-message">
                Henüz ders eklemedin. 
                <a href="/programlayici.html">Programlayıcıya git</a> ve ekle!
            </p>`;
        return;
    }

        attendanceContainer.innerHTML = ''; // Clear previous content

        const coursesByCrn = courses.reduce((acc, course) => {
            if (!acc[course.crn]) {
                acc[course.crn] = [];
            }
            acc[course.crn].push(course);
            return acc;
        }, {});

        Object.entries(coursesByCrn).forEach(([crn, courseParts]) => {
            const firstPart = courseParts[0];
            const attendanceData = getAttendanceData();
            const courseAttendance = attendanceData[crn] || new Array(14).fill(null);

            const summary = {
                totalHeld: courseAttendance.filter(s => s === 'P' || s === 'A').length,
                totalPresent: courseAttendance.filter(s => s === 'P').length,
                percentage: 0
            };
            if (summary.totalHeld > 0) {
                summary.percentage = Math.round((summary.totalPresent / summary.totalHeld) * 100);
            }

            // --- NEW: Check for high attendance and apply a class ---
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

    // --- Event Listener for Clicking Attendance Cells ---
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
            renderAttendanceTrackers(); // Re-render to update the UI
        }
    };

    // --- Initial Load ---
    renderAttendanceTrackers();
    attendanceContainer.addEventListener('click', handleCellClick);

    // Hamburger menu logic (from homepage)
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
    });
    document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }));

});
