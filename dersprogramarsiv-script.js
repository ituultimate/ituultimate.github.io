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

// =============================================================
// FETCH SCHEDULES FROM FIRESTORE
// =============================================================
async function fetchSchedules() {
    try {
        const schedulesRef = collection(db, 'schedules');
        let q;

        switch (currentSort) {
            case 'oldest':
                q = query(schedulesRef, orderBy('createdAt', 'asc'));
                break;
            case 'popular':
                q = query(schedulesRef, orderBy('likes', 'desc'));
                break;
            case 'newest':
            default:
                q = query(schedulesRef, orderBy('createdAt', 'desc'));
        }

        const snapshot = await getDocs(q);
        const schedules = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            schedules.push({
                id: doc.id,
                ...data
            });
            allSchedulesData[doc.id] = { id: doc.id, ...data };
        });

        updateFilterStatus(schedules.length);

        if (schedules.length === 0) {
            renderEmptyState();
        } else {
            renderSchedules(schedules);
        }
    } catch (error) {
        console.error('Error fetching schedules:', error);
        renderEmptyState();
    }
}

// --- Render empty state ---
function renderEmptyState() {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calendar-alt"></i>
            <h3>Henüz program yok</h3>
            <p>Henüz hiç ders programı paylaşılmamış. İlk programı sen paylaş!</p>
        </div>
    `;
}

// --- Render Schedules ---
function renderSchedules(schedules) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    let html = '';

    schedules.forEach(schedule => {
        const isFavorited = userFavorites.includes(schedule.id);
        const isOwner = currentUser && schedule.uploaderID === currentUser.uid;
        const uploaderName = schedule.anonymous ? 'Anonim' : (schedule.uploader || 'Anonim');
        const dateStr = formatDate(schedule.createdAt);
        const likesCount = schedule.likes || 0;

        html += `
            <article class="note-card" data-schedule-id="${schedule.id}">
                ${isOwner ? `
                    <div class="note-card-actions">
                        <button class="action-btn delete-btn" onclick="window.handleDeleteSchedule(event, '${schedule.id}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
                
                <div class="note-card-header">
                    <span class="note-subject"><i class="fas fa-calendar"></i> Program</span>
                    <span class="note-date">${dateStr}</span>
                </div>

                <h3 class="note-title">${schedule.title}</h3>
                
                ${schedule.description ? `<p class="note-description">${schedule.description}</p>` : ''}

                <div class="note-card-footer">
                    <span class="note-uploader">
                        <i class="fas fa-user"></i> ${uploaderName}
                    </span>
                    <div class="note-stats">
                        <span class="note-likes"><i class="fas fa-heart"></i> ${likesCount}</span>
                    </div>
                    <div class="note-actions">
                        <a href="${schedule.url}" target="_blank" rel="noopener" class="note-link-btn" onclick="event.stopPropagation()">
                            <i class="fas fa-external-link-alt"></i> Görüntüle
                        </a>
                        ${isUserLoggedIn ? `
                            <button class="action-btn favorite-btn ${isFavorited ? 'active' : ''}" 
                                    onclick="window.handleToggleFavorite(event, '${schedule.id}')" title="Favorilere Ekle">
                                <i class="${isFavorited ? 'fas' : 'far'} fa-bookmark"></i>
                            </button>
                            <button class="action-btn like-btn" 
                                    onclick="window.handleLike(event, '${schedule.id}')" title="Beğen">
                                <i class="fas fa-heart"></i>
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

// --- Handle Delete Schedule ---
window.handleDeleteSchedule = async function (event, scheduleId) {
    event.stopPropagation();

    if (!currentUser) {
        alert('Bu işlem için giriş yapmalısınız.');
        return;
    }

    if (!confirm('Bu programı silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'schedules', scheduleId));

        const card = document.querySelector(`[data-schedule-id="${scheduleId}"]`);
        if (card) card.remove();

        const remaining = document.querySelectorAll('.note-card').length;
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

        await addDoc(collection(db, 'schedules'), {
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

    // Initialize
    await fetchSchedules();

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
