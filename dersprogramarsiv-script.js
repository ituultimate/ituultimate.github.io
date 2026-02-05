/**
 * DERS PROGRAMI ARŞİVİ PAGE SCRIPT
 * Firebase Integration for Schedule Archives
 * No subject/course filters - just sort functionality
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    Timestamp,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State Variables ---
let currentUser = null;
let isUserLoggedIn = false;
let userFavorites = [];
let allSchedulesData = {};
let currentSort = 'newest';
let selectedTerm = ''; // Firebase collection name for selected semester

// =============================================================
// FETCH SCHEDULES FROM FIRESTORE
// =============================================================
let allFetchedSchedules = []; // Store all schedules for filtering
let selectedSubject = ''; // Current subject filter

async function fetchSchedules() {
    // Require term selection before fetching
    if (!selectedTerm) {
        return;
    }

    try {
        // Use selectedTerm as the collection name (e.g., '2526-bahar')
        const schedulesRef = collection(db, selectedTerm);
        const snapshot = await getDocs(schedulesRef);
        const schedules = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            schedules.push({
                id: docSnap.id,
                ...data
            });
            allSchedulesData[docSnap.id] = { id: docSnap.id, ...data };
        });

        // Store all schedules for filtering
        allFetchedSchedules = schedules;

        // Populate subject filter based on course code prefixes
        populateSubjectFilter(schedules);

        // Don't render yet - wait for subject selection
        // Show empty state prompting user to select a subject
        const tableWrapper = document.getElementById('schedule-table-wrapper');
        const emptyState = document.getElementById('schedule-empty-state');

        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `
                <i class="fas fa-building-columns"></i>
                <h3>Branş kodu seçin</h3>
                <p>${schedules.length} ders bulundu. Görüntülemek için branş seçin.</p>
            `;
        }

    } catch (error) {
        console.error('Error fetching schedules:', error);
        renderEmptyState();
    }
}

// --- Populate subject filter based on course code prefixes ---
function populateSubjectFilter(schedules) {
    const subjectFilter = document.getElementById('subject-filter');
    if (!subjectFilter) return;

    // Extract subject prefixes from course code (e.g., "MAT" from "MAT 281")
    const subjects = [...new Set(
        schedules
            .map(s => {
                const code = String(s.code || '').trim();
                return code.split(' ')[0]; // Get prefix (first word)
            })
            .filter(Boolean)
    )].sort();

    subjectFilter.innerHTML = '<option value="">Branş Seçin</option>';
    subjects.forEach(subject => {
        subjectFilter.innerHTML += `<option value="${subject}">${subject}</option>`;
    });

    subjectFilter.disabled = false;
}

// --- Handle Subject Filter Change ---
function handleSubjectChange(event) {
    selectedSubject = event.target.value;

    if (!selectedSubject) {
        // Reset to prompt state
        const tableWrapper = document.getElementById('schedule-table-wrapper');
        const emptyState = document.getElementById('schedule-empty-state');
        const filterStatus = document.getElementById('filter-status');

        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (filterStatus) filterStatus.style.display = 'none';
        return;
    }

    // Filter schedules by selected subject prefix
    const filteredSchedules = allFetchedSchedules.filter(s => {
        const code = String(s.code || '').trim();
        const prefix = code.split(' ')[0];
        return prefix === selectedSubject;
    });

    updateFilterStatus(filteredSchedules.length);

    if (filteredSchedules.length === 0) {
        renderEmptyState();
    } else {
        renderSchedules(filteredSchedules);
    }
}

// --- Render empty state ---
function renderEmptyState() {
    const tableWrapper = document.getElementById('schedule-table-wrapper');
    const emptyState = document.getElementById('schedule-empty-state');

    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            <h3>Bu dönemde henüz ders programı yok</h3>
            <p>Seçilen dönem için henüz veri bulunmuyor</p>
        `;
    }
}

// --- Render Schedules as Table Rows (grouped by CRN) ---
function renderSchedules(schedules) {
    const tableBody = document.getElementById('schedule-table-body');
    const tableWrapper = document.getElementById('schedule-table-wrapper');
    const emptyState = document.getElementById('schedule-empty-state');

    if (!tableBody) return;

    // Show table, hide empty state
    if (tableWrapper) tableWrapper.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Group schedules by CRN (same CRN = same course with multiple days)
    const groupedByCrn = schedules.reduce((acc, course) => {
        const crn = course.crn;
        if (!crn) return acc;
        if (!acc[crn]) acc[crn] = [];
        acc[crn].push(course);
        return acc;
    }, {});

    // Day order for sorting
    const dayOrder = { 'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4, 'Cuma': 5 };

    let html = '';

    Object.entries(groupedByCrn).forEach(([crn, courseParts]) => {
        // Sort parts by day
        const sortedParts = courseParts.sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));

        // Get common info from first part
        const firstPart = sortedParts[0];
        const courseCode = firstPart.code || '-';
        const courseName = firstPart.name || '-';

        // Combine instructors (unique)
        const instructors = [...new Set(
            courseParts
                .map(p => p.instructor)
                .join(', ')
                .split(',')
                .map(n => n.trim())
                .filter(Boolean)
        )].join(', ') || '-';

        // Combine days
        const days = sortedParts.map(p => p.day).filter(Boolean).join(', ') || '-';

        // Combine times (format: start-end)
        const times = sortedParts.map(p => {
            if (p.time && p.time.start && p.time.end) {
                return `${p.time.start}-${p.time.end}`;
            }
            return null;
        }).filter(Boolean).join(', ') || '-';

        // Combine building + classroom, clean duplicates (e.g., "KMBKMB" → "KMB")
        const locations = [...new Set(
            sortedParts.map(p => {
                let building = (p.building || '').trim();
                let classroom = (p.classroom || '').trim();

                // Clean up duplicate building names (e.g., "KMBKMBKMB" → "KMB")
                if (building.length >= 6) {
                    // Try to find a repeating pattern
                    for (let len = 2; len <= Math.floor(building.length / 2); len++) {
                        const pattern = building.substring(0, len);
                        const repeated = pattern.repeat(Math.ceil(building.length / len)).substring(0, building.length);
                        if (repeated === building) {
                            building = pattern;
                            break;
                        }
                    }
                }

                return `${building} ${classroom}`.trim();
            }).filter(Boolean)
        )].join(', ') || '-';

        // Get capacity and exam from first part
        const capacity = firstPart.capacity || firstPart.enrolled || '-';
        const exam = firstPart.majorRestriction || firstPart.exam || '-';

        html += `
            <tr data-crn="${crn}">
                <td>${courseCode}</td>
                <td>${courseName}</td>
                <td>${instructors}</td>
                <td>${days}</td>
                <td>${times}</td>
                <td>${locations}</td>
                <td>${capacity}</td>
                <td>${enrolled}</td>
                <td>${crn}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// --- Format Firestore timestamp ---
function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

// --- Update filter status ---
function updateFilterStatus(count) {
    const statusEl = document.getElementById('filter-status');
    const countEl = document.getElementById('result-count');

    if (countEl) countEl.textContent = count;
    if (statusEl) statusEl.style.display = 'block';
}

// =============================================================
// EVENT HANDLERS
// =============================================================

// --- Handle Delete Schedule ---
window.handleDeleteSchedule = async function (event, scheduleId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Bu işlem için giriş yapmalısınız.');
        return;
    }

    if (!selectedTerm) {
        alert('Dönem seçilmedi.');
        return;
    }

    if (!confirm('Bu programı silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, selectedTerm, scheduleId));

        const row = document.querySelector(`[data-schedule-id="${scheduleId}"]`);
        if (row) row.remove();

        const remaining = document.querySelectorAll('#schedule-table-body tr').length;
        updateFilterStatus(remaining);
        if (remaining === 0) renderEmptyState();

        alert('Program silindi!');
    } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Program silinirken hata oluştu.');
    }
};

// --- Handle Toggle Favorite ---
window.handleToggleFavorite = async function (event, scheduleId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Favorilere eklemek için giriş yapmalısınız.');
        return;
    }

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const isFavorited = userFavorites.includes(scheduleId);

        if (isFavorited) {
            await updateDoc(userDocRef, { favoriteSchedules: arrayRemove(scheduleId) });
            userFavorites = userFavorites.filter(id => id !== scheduleId);
        } else {
            await updateDoc(userDocRef, { favoriteSchedules: arrayUnion(scheduleId) });
            userFavorites.push(scheduleId);
        }

        // Update UI
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');
        btn.classList.toggle('active');
        icon.classList.toggle('fas');
        icon.classList.toggle('far');
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
};

// --- Handle Like ---
window.handleLike = async function (event, scheduleId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Beğenmek için giriş yapmalısınız.');
        return;
    }

    try {
        const scheduleRef = doc(db, 'schedules', scheduleId);
        await updateDoc(scheduleRef, { likes: (allSchedulesData[scheduleId]?.likes || 0) + 1 });

        // Update local data and UI
        if (allSchedulesData[scheduleId]) {
            allSchedulesData[scheduleId].likes = (allSchedulesData[scheduleId].likes || 0) + 1;
        }

        const card = document.querySelector(`[data-schedule-id="${scheduleId}"]`);
        const likesSpan = card?.querySelector('.note-likes');
        if (likesSpan) {
            likesSpan.innerHTML = `<i class="fas fa-heart"></i> ${allSchedulesData[scheduleId].likes}`;
        }
    } catch (error) {
        console.error('Error liking schedule:', error);
    }
};

// --- Fetch User Favorites ---
async function fetchUserFavorites() {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            userFavorites = userDoc.data().favoriteSchedules || [];
        }
    } catch (error) {
        console.error('Error fetching favorites:', error);
    }
}

// --- Handle Sort Change ---
function handleSortChange(event) {
    currentSort = event.target.value;
    fetchSchedules();
}

// --- Handle Term Filter Change ---
function handleTermChange(event) {
    selectedTerm = event.target.value;
    allSchedulesData = {}; // Clear cached data when switching terms

    const subjectFilter = document.getElementById('subject-filter');
    const emptyState = document.getElementById('schedule-empty-state');
    const tableWrapper = document.getElementById('schedule-table-wrapper');
    const filterStatus = document.getElementById('filter-status');

    if (!selectedTerm) {
        // Reset to initial state
        if (subjectFilter) {
            subjectFilter.innerHTML = '<option value="">Önce dönem seçin</option>';
            subjectFilter.disabled = true;
        }
        if (emptyState) emptyState.style.display = 'flex';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (filterStatus) filterStatus.style.display = 'none';
        return;
    }

    fetchSchedules();
}

// =============================================================
// UPLOAD MODAL HANDLERS
// =============================================================

function openUploadModal() {
    if (!isUserLoggedIn) {
        alert('Program paylaşmak için giriş yapmalısınız.');
        window.location.href = '/login';
        return;
    }
    const modal = document.getElementById('upload-modal');
    if (modal) modal.classList.add('active');
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) modal.classList.remove('active');
    document.getElementById('upload-form')?.reset();
}

async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        alert('Program paylaşmak için giriş yapmalısınız.');
        return;
    }

    if (!selectedTerm) {
        alert('Lütfen önce bir dönem seçin.');
        return;
    }

    const title = document.getElementById('upload-title').value.trim();
    const url = document.getElementById('upload-url').value.trim();
    const description = document.getElementById('upload-description').value.trim();
    const anonymous = document.getElementById('upload-anonymous').checked;

    if (!title || !url) {
        alert('Lütfen tüm gerekli alanları doldurun.');
        return;
    }

    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';

        await addDoc(collection(db, selectedTerm), {
            title,
            url,
            description,
            anonymous,
            uploader: currentUser.displayName || currentUser.email,
            uploaderID: currentUser.uid,
            createdAt: Timestamp.now(),
            likes: 0
        });

        closeUploadModal();
        fetchSchedules();
        alert('Program başarıyla paylaşıldı!');
    } catch (error) {
        console.error('Error uploading schedule:', error);
        alert('Program paylaşılırken hata oluştu.');
    }
}

// =============================================================
// INITIALIZATION
// =============================================================
document.addEventListener('DOMContentLoaded', async function () {
    // Term filter event listener
    const termSelect = document.getElementById('term-filter');
    if (termSelect) termSelect.addEventListener('change', handleTermChange);

    // Subject filter event listener
    const subjectSelect = document.getElementById('subject-filter');
    if (subjectSelect) subjectSelect.addEventListener('change', handleSubjectChange);

    // Sort filter event listener
    const sortSelect = document.getElementById('sort-filter');
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);

    // Upload modal event listeners
    const fab = document.getElementById('fab-upload');
    const closeBtn = document.getElementById('modal-close-btn');
    const overlay = document.querySelector('.upload-modal-overlay');
    const uploadForm = document.getElementById('upload-form');

    if (fab) fab.addEventListener('click', openUploadModal);
    if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);
    if (overlay) overlay.addEventListener('click', closeUploadModal);
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);

    // Show main content
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    if (loadingOverlay && mainContent) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
});

// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        isUserLoggedIn = true;
        currentUser = user;
        await fetchUserFavorites();
        fetchSchedules();
    } else {
        isUserLoggedIn = false;
        currentUser = null;
        userFavorites = [];
    }
});
