/**
 * Attendance Tracking Script (YTS - Yoklama Takip Sistemi)
 * Uses modern ES modules with shared Firebase config
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// =============================================================
// CONSTANTS AND VARIABLES
// =============================================================
const CONTAINER_ID = 'attendance-container';
let currentUser = null;
let currentAttendanceData = {};

// =============================================================
// DATA MANAGEMENT
// =============================================================

const fetchUserData = async (user) => {
    const attendanceContainer = document.getElementById(CONTAINER_ID);
    if (!attendanceContainer) return;

    attendanceContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Veriler buluttan yükleniyor...</div>';

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const courses = userData.schedule || [];
            currentAttendanceData = userData.attendance || {};

            if (courses.length > 0) {
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

const saveAttendanceDataToCloud = async (user, attendanceData) => {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
            attendance: attendanceData
        });
        console.log("Yoklama verisi buluta başarıyla kaydedildi.");
    } catch (error) {
        console.error("Yoklama verisi buluta kaydedilirken hata:", error);
    }
};

// =============================================================
// RENDER FUNCTIONS
// =============================================================

const renderEmptyState = (container) => {
    container.innerHTML = `
        <p class="no-courses-message">
            Kayıtlı ders bulunamadı. 
            <a href="/programlayici.html">Programlayıcıya git</a> ve derslerini buluta kaydet!
        </p>`;
};

const renderAttendanceTrackers = (courses, attendanceData) => {
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

// =============================================================
// EVENT HANDLERS
// =============================================================

const handleCellClick = async (e) => {
    if (e.target.classList.contains('attendance-cell')) {
        const crn = e.target.dataset.crn;
        const weekIndex = parseInt(e.target.dataset.week, 10);

        if (!currentAttendanceData[crn]) {
            currentAttendanceData[crn] = new Array(14).fill(null);
        }

        const currentStatus = currentAttendanceData[crn][weekIndex];
        const newStatus = currentStatus === 'P' ? 'A' : (currentStatus === 'A' ? null : 'P');

        currentAttendanceData[crn][weekIndex] = newStatus;

        await saveAttendanceDataToCloud(currentUser, currentAttendanceData);

        const card = e.target.closest('.attendance-card');
        if (!card) return;

        e.target.textContent = newStatus || '';
        e.target.className = `attendance-cell ${newStatus ? (newStatus === 'P' ? 'present' : 'absent') : ''}`;

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

// =============================================================
// INITIALIZATION
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById(CONTAINER_ID);
    if (mainContainer) {
        mainContainer.addEventListener('click', handleCellClick);
    }

    onAuthStateChanged(auth, (user) => {
        const attendanceContainer = document.getElementById(CONTAINER_ID);
        if (!attendanceContainer) return;

        if (user) {
            console.log("YTS: Kullanıcı giriş yaptı, veriler çekiliyor...", user.email);
            currentUser = user;
            fetchUserData(user);
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
});
