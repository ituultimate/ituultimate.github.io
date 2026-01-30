/**
 * DERS REHBERLERİ PAGE SCRIPT
 * Firebase Integration for Course Guides & Filtering
 * Uses modern ES modules with shared Firebase config
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
    where,
    orderBy,
    Timestamp,
    increment,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State Variables ---
let allCourses = {};
let currentUser = null;
let isUserLoggedIn = false;
let userFavorites = [];
let allGuidesData = {};

let currentFilters = {
    subjectCode: '',
    courseCode: ''
};

// =============================================================
// FETCH COURSES (Similar to Scheduler)
// =============================================================
async function fetchAndGroupCourses() {
    try {
        const response = await fetch('courses.json');
        if (!response.ok) throw new Error('Failed to load courses');

        const data = await response.json();
        const grouped = {};

        data.forEach(course => {
            const subjectCode = course.subject_code;
            const courseCode = course.course_code;
            const fullCode = `${subjectCode} ${courseCode}`;

            if (!grouped[subjectCode]) {
                grouped[subjectCode] = {};
            }
            if (!grouped[subjectCode][fullCode]) {
                grouped[subjectCode][fullCode] = {
                    title: course.course_title,
                    code: fullCode
                };
            }
        });

        allCourses = grouped;
        populateSubjectDropdown();
        populateUploadSubjectDropdown();
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// --- Populate subject dropdown ---
function populateSubjectDropdown() {
    const select = document.getElementById('subject-filter');
    if (!select) return;

    select.innerHTML = '<option value="">Tüm Bölümler</option>';
    Object.keys(allCourses).sort().forEach(subjectCode => {
        const option = document.createElement('option');
        option.value = subjectCode;
        option.textContent = subjectCode;
        select.appendChild(option);
    });
}

// --- Populate course dropdown based on subject ---
function populateCourseDropdown(subjectCode) {
    const select = document.getElementById('course-filter');
    if (!select) return;

    select.innerHTML = '<option value="">Tüm Dersler</option>';

    if (!subjectCode || !allCourses[subjectCode]) {
        select.disabled = true;
        select.innerHTML = '<option value="">Önce bölüm seçin</option>';
        return;
    }

    select.disabled = false;
    Object.values(allCourses[subjectCode]).sort((a, b) => a.code.localeCompare(b.code)).forEach(course => {
        const option = document.createElement('option');
        option.value = course.code;
        option.textContent = `${course.code} - ${course.title}`;
        select.appendChild(option);
    });
}

// =============================================================
// FETCH GUIDES FROM FIRESTORE
// =============================================================
async function fetchGuides() {
    try {
        const guidesRef = collection(db, 'guides');
        let q;

        if (currentFilters.courseCode) {
            q = query(guidesRef, where('courseCode', '==', currentFilters.courseCode), orderBy('createdAt', 'desc'));
        } else if (currentFilters.subjectCode) {
            q = query(guidesRef, where('subjectCode', '==', currentFilters.subjectCode), orderBy('createdAt', 'desc'));
        } else {
            q = query(guidesRef, orderBy('createdAt', 'desc'));
        }

        const snapshot = await getDocs(q);
        const guides = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            guides.push({
                id: doc.id,
                ...data
            });
            allGuidesData[doc.id] = { id: doc.id, ...data };
        });

        updateFilterStatus(guides.length);

        if (guides.length === 0) {
            renderEmptyState();
        } else {
            renderGuides(guides);
        }
    } catch (error) {
        console.error('Error fetching guides:', error);
        renderEmptyState();
    }
}

// --- Render empty state ---
function renderEmptyState() {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-compass"></i>
            <h3>Henüz rehber yok</h3>
            <p>Bu kategoride henüz bir ders rehberi bulunmuyor. İlk rehberi sen ekle!</p>
        </div>
    `;
}

// --- Render Guides ---
function renderGuides(guides) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    let html = '';

    guides.forEach(guide => {
        const isFavorited = userFavorites.includes(guide.id);
        const isOwner = currentUser && guide.uploaderID === currentUser.uid;
        const uploaderName = guide.anonymous ? 'Anonim' : (guide.uploader || 'Anonim');
        const dateStr = formatDate(guide.createdAt);

        html += `
            <article class="note-card" data-guide-id="${guide.id}">
                ${isOwner ? `
                    <div class="note-card-actions">
                        <button class="action-btn delete-btn" onclick="window.handleDeleteGuide(event, '${guide.id}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
                
                <div class="note-card-header">
                    <span class="note-subject">${guide.courseCode || guide.subjectCode}</span>
                    <span class="note-date">${dateStr}</span>
                </div>

                <h3 class="note-title">${guide.title}</h3>
                
                ${guide.description ? `<p class="note-description">${guide.description}</p>` : ''}

                <div class="note-card-footer">
                    <span class="note-uploader">
                        <i class="fas fa-user"></i> ${uploaderName}
                    </span>
                    <div class="note-actions">
                        <a href="${guide.url}" target="_blank" rel="noopener" class="note-link-btn" onclick="event.stopPropagation()">
                            <i class="fas fa-external-link-alt"></i> Görüntüle
                        </a>
                        ${isUserLoggedIn ? `
                            <button class="action-btn favorite-btn ${isFavorited ? 'active' : ''}" 
                                    onclick="window.handleToggleFavorite(event, '${guide.id}')" title="Favorilere Ekle">
                                <i class="${isFavorited ? 'fas' : 'far'} fa-bookmark"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </article>
        `;
    });

    grid.innerHTML = html;
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

// --- Handle Delete Guide ---
window.handleDeleteGuide = async function (event, guideId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Bu işlem için giriş yapmalısınız.');
        return;
    }

    if (!confirm('Bu rehberi silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'guides', guideId));

        const card = document.querySelector(`[data-guide-id="${guideId}"]`);
        if (card) card.remove();

        const remaining = document.querySelectorAll('.note-card').length;
        updateFilterStatus(remaining);
        if (remaining === 0) renderEmptyState();

        alert('Rehber silindi!');
    } catch (error) {
        console.error('Error deleting guide:', error);
        alert('Rehber silinirken hata oluştu.');
    }
};

// --- Handle Toggle Favorite ---
window.handleToggleFavorite = async function (event, guideId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Favorilere eklemek için giriş yapmalısınız.');
        return;
    }

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const isFavorited = userFavorites.includes(guideId);

        if (isFavorited) {
            await updateDoc(userDocRef, { favoriteGuides: arrayRemove(guideId) });
            userFavorites = userFavorites.filter(id => id !== guideId);
        } else {
            await updateDoc(userDocRef, { favoriteGuides: arrayUnion(guideId) });
            userFavorites.push(guideId);
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

// --- Fetch User Favorites ---
async function fetchUserFavorites() {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            userFavorites = userDoc.data().favoriteGuides || [];
        }
    } catch (error) {
        console.error('Error fetching favorites:', error);
    }
}

// --- Handle Subject Filter Change ---
function handleSubjectChange(event) {
    const subjectCode = event.target.value;
    currentFilters.subjectCode = subjectCode;
    currentFilters.courseCode = '';
    populateCourseDropdown(subjectCode);
    fetchGuides();
}

// --- Handle Course Filter Change ---
function handleCourseChange(event) {
    currentFilters.courseCode = event.target.value;
    fetchGuides();
}

// =============================================================
// UPLOAD MODAL HANDLERS
// =============================================================

function openUploadModal() {
    if (!isUserLoggedIn) {
        alert('Rehber yüklemek için giriş yapmalısınız.');
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

function populateUploadSubjectDropdown() {
    const select = document.getElementById('upload-subject');
    if (!select) return;

    select.innerHTML = '<option value="">Bölüm Seçin</option>';
    Object.keys(allCourses).sort().forEach(subjectCode => {
        const option = document.createElement('option');
        option.value = subjectCode;
        option.textContent = subjectCode;
        select.appendChild(option);
    });
}

function populateUploadCourseDropdown(subjectCode) {
    const select = document.getElementById('upload-course');
    if (!select) return;

    if (!subjectCode || !allCourses[subjectCode]) {
        select.innerHTML = '<option value="">Önce bölüm seçin</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">Ders Seçin</option>';

    Object.values(allCourses[subjectCode]).sort((a, b) => a.code.localeCompare(b.code)).forEach(course => {
        const option = document.createElement('option');
        option.value = course.code;
        option.textContent = `${course.code} - ${course.title}`;
        select.appendChild(option);
    });
}

async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        alert('Rehber yüklemek için giriş yapmalısınız.');
        return;
    }

    const title = document.getElementById('upload-title').value.trim();
    const subjectCode = document.getElementById('upload-subject').value;
    const courseCode = document.getElementById('upload-course').value;
    const url = document.getElementById('upload-url').value.trim();
    const description = document.getElementById('upload-description').value.trim();
    const anonymous = document.getElementById('upload-anonymous').checked;

    if (!title || !subjectCode || !courseCode || !url) {
        alert('Lütfen tüm gerekli alanları doldurun.');
        return;
    }

    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';

        await addDoc(collection(db, 'guides'), {
            title,
            subjectCode,
            courseCode,
            url,
            description,
            anonymous,
            uploader: currentUser.displayName || currentUser.email,
            uploaderID: currentUser.uid,
            createdAt: Timestamp.now(),
            likes: 0,
            dislikes: 0
        });

        closeUploadModal();
        fetchGuides();
        alert('Rehber başarıyla yüklendi!');
    } catch (error) {
        console.error('Error uploading guide:', error);
        alert('Rehber yüklenirken hata oluştu.');
    }
}

// =============================================================
// INITIALIZATION
// =============================================================
document.addEventListener('DOMContentLoaded', async function () {
    // Filter event listeners
    const subjectSelect = document.getElementById('subject-filter');
    const courseSelect = document.getElementById('course-filter');

    if (subjectSelect) subjectSelect.addEventListener('change', handleSubjectChange);
    if (courseSelect) courseSelect.addEventListener('change', handleCourseChange);

    // Upload modal event listeners
    const fab = document.getElementById('fab-upload');
    const closeBtn = document.getElementById('modal-close-btn');
    const overlay = document.querySelector('.upload-modal-overlay');
    const uploadForm = document.getElementById('upload-form');
    const uploadSubject = document.getElementById('upload-subject');

    if (fab) fab.addEventListener('click', openUploadModal);
    if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);
    if (overlay) overlay.addEventListener('click', closeUploadModal);
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);
    if (uploadSubject) uploadSubject.addEventListener('change', (e) => populateUploadCourseDropdown(e.target.value));

    // Initialize
    await fetchAndGroupCourses();
    await fetchGuides();

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
        fetchGuides();
    } else {
        isUserLoggedIn = false;
        currentUser = null;
        userFavorites = [];
    }
});
