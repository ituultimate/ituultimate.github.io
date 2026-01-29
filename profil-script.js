/**
 * PROFILE PAGE SCRIPT
 * Handles user uploads, favorites tabs, and profile data
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    documentId,
    arrayRemove,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State Variables ---
let currentUser = null;
let userFavorites = [];
let currentTab = 'uploads';

// =============================================================
// TAB SWITCHING
// =============================================================

function switchTab(tabName) {
    currentTab = tabName;

    // Update tab button states
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Load appropriate content
    if (tabName === 'uploads') {
        loadUserUploads();
    } else if (tabName === 'favorites') {
        loadUserFavorites();
    }
}

// =============================================================
// LOAD USER UPLOADS
// =============================================================

async function loadUserUploads() {
    const grid = document.getElementById('profile-notes-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-text"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</div>';

    try {
        const notesRef = collection(db, 'notes');
        const q = query(
            notesRef,
            where('uploaderID', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-upload"></i>
                    <p>Henüz not yüklememişsiniz.</p>
                    <a href="/dersnotlari" class="btn btn-primary">Ders Notlarına Git</a>
                </div>
            `;
            return;
        }

        const notes = [];
        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() });
        });

        renderProfileNotes(notes, true);

    } catch (error) {
        console.error('Error loading uploads:', error);
        grid.innerHTML = '<div class="error-text">Notlar yüklenirken hata oluştu.</div>';
    }
}

// =============================================================
// LOAD USER FAVORITES
// =============================================================

async function loadUserFavorites() {
    const grid = document.getElementById('profile-notes-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-text"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</div>';

    try {
        // First get user's favorites list
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists() || !userDoc.data().favorites?.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-bookmark"></i>
                    <p>Henüz favori notunuz yok.</p>
                    <a href="/dersnotlari" class="btn btn-primary">Ders Notlarına Git</a>
                </div>
            `;
            return;
        }

        userFavorites = userDoc.data().favorites;

        // Fetch favorite notes (batch by 10 due to Firestore 'in' query limit)
        const notes = [];
        const batches = [];

        for (let i = 0; i < userFavorites.length; i += 10) {
            batches.push(userFavorites.slice(i, i + 10));
        }

        for (const batch of batches) {
            const notesRef = collection(db, 'notes');
            const q = query(notesRef, where(documentId(), 'in', batch));
            const snapshot = await getDocs(q);

            snapshot.forEach(doc => {
                notes.push({ id: doc.id, ...doc.data() });
            });
        }

        if (notes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-bookmark"></i>
                    <p>Favori notlarınız bulunamadı.</p>
                </div>
            `;
            return;
        }

        renderProfileNotes(notes, false);

    } catch (error) {
        console.error('Error loading favorites:', error);
        grid.innerHTML = '<div class="error-text">Favoriler yüklenirken hata oluştu.</div>';
    }
}

// =============================================================
// RENDER PROFILE NOTES
// =============================================================

function renderProfileNotes(notes, showDelete = false) {
    const grid = document.getElementById('profile-notes-grid');
    if (!grid) return;

    let html = '';

    notes.forEach(note => {
        const netLikes = note.netLikes || (note.likes || 0) - (note.dislikes || 0);
        const ratingClass = netLikes > 0 ? 'positive' : (netLikes < 0 ? 'negative' : '');
        const courseCode = note.courseCode || note.subjectCode || 'DERS';
        const title = note.title || 'Başlıksız Not';
        const description = note.description || '';
        const uploader = note.uploader || 'Anonim';
        const date = formatDate(note.createdAt);
        const externalUrl = note.externalUrl || note.url || '#';
        const isFavorited = userFavorites.includes(note.id);

        html += `
            <article class="note-card" data-note-id="${note.id}">
                <div class="note-card-actions">
                    <button class="action-btn favorite-btn ${isFavorited ? 'active' : ''}" 
                            onclick="handleToggleFavorite(event, '${note.id}')"
                            aria-label="Favorilere Ekle">
                        <i class="${isFavorited ? 'fas' : 'far'} fa-bookmark"></i>
                    </button>
                    ${showDelete ? `
                    <button class="action-btn delete-btn" 
                            onclick="handleDeleteNote(event, '${note.id}')"
                            aria-label="Notu Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
                <div class="note-card-header">
                    <span class="note-subject">${courseCode}</span>
                    <span class="note-date"><i class="far fa-clock"></i> ${date}</span>
                </div>
                <h3 class="note-title">${title}</h3>
                <p class="note-description">${description}</p>
                <div class="note-author">
                    <i class="fas fa-user-circle"></i>
                    <span>${uploader}</span>
                </div>
                <div class="note-card-footer">
                    <a href="${externalUrl}" target="_blank" rel="noopener noreferrer" class="note-link-btn">
                        <i class="fas fa-external-link-alt"></i> Linke Git
                    </a>
                    <div class="note-rating">
                        <span class="rating-count ${ratingClass}">${netLikes}</span>
                    </div>
                </div>
            </article>
        `;
    });

    grid.innerHTML = html;
}

// =============================================================
// HANDLE DELETE NOTE
// =============================================================

window.handleDeleteNote = async function (event, noteId) {
    event.stopPropagation();

    if (!confirm('Bu notu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'notes', noteId));

        // Remove from UI
        const card = document.querySelector(`[data-note-id="${noteId}"]`);
        if (card) card.remove();

        // Check if grid is empty
        const grid = document.getElementById('profile-notes-grid');
        if (grid && !grid.querySelector('.note-card')) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-upload"></i>
                    <p>Henüz not yüklememişsiniz.</p>
                    <a href="/dersnotlari" class="btn btn-primary">Ders Notlarına Git</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Not silinirken hata oluştu.');
    }
};

// =============================================================
// HANDLE TOGGLE FAVORITE
// =============================================================

window.handleToggleFavorite = async function (event, noteId) {
    event.stopPropagation();

    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    const isFavorited = userFavorites.includes(noteId);

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);

        if (isFavorited) {
            await updateDoc(userDocRef, { favorites: arrayRemove(noteId) });
            userFavorites = userFavorites.filter(id => id !== noteId);
            icon.classList.replace('fas', 'far');
            btn.classList.remove('active');

            // If on favorites tab, remove the card
            if (currentTab === 'favorites') {
                const card = document.querySelector(`[data-note-id="${noteId}"]`);
                if (card) card.remove();

                // Check if grid is empty
                const grid = document.getElementById('profile-notes-grid');
                if (grid && !grid.querySelector('.note-card')) {
                    grid.innerHTML = `
                        <div class="empty-state">
                            <i class="far fa-bookmark"></i>
                            <p>Henüz favori notunuz yok.</p>
                            <a href="/dersnotlari" class="btn btn-primary">Ders Notlarına Git</a>
                        </div>
                    `;
                }
            }
        } else {
            await updateDoc(userDocRef, { favorites: arrayUnion(noteId) });
            userFavorites.push(noteId);
            icon.classList.replace('far', 'fas');
            btn.classList.add('active');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
};

// =============================================================
// UPDATE USER PROFILE
// =============================================================

async function updateUserProfile(displayName) {
    if (!currentUser) return;

    try {
        // Update Firebase Auth
        await updateProfile(currentUser, { displayName });

        // Update Firestore user document
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, { displayName });

        // Update UI
        document.getElementById('display-name').textContent = displayName;

        alert('Profil güncellendi!');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Profil güncellenirken hata oluştu.');
    }
}

// =============================================================
// HELPER FUNCTIONS
// =============================================================

function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

// =============================================================
// INITIALIZATION
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab button listeners
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Edit profile button
    const editBtn = document.getElementById('edit-profile-btn');
    const editForm = document.getElementById('edit-profile-form');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-profile-btn');

    if (editBtn && editForm) {
        editBtn.addEventListener('click', () => {
            editForm.style.display = 'block';
            editBtn.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editForm.style.display = 'none';
            editBtn.style.display = 'inline-block';
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const newName = document.getElementById('edit-display-name').value.trim();
            if (newName) {
                updateUserProfile(newName);
                editForm.style.display = 'none';
                editBtn.style.display = 'inline-block';
            }
        });
    }
});

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;

        // Load initial tab content
        loadUserUploads();
    } else {
        // Redirect to login if not logged in (auth-manager should handle this)
        currentUser = null;
    }
});
