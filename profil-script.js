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
    arrayUnion,
    writeBatch,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State Variables ---
let currentUser = null;
let userFavorites = [];
let currentTab = 'uploads';
let selectedAvatarEmoji = null;

// --- ITU Themed Avatars ---
const ITU_AVATARS = [
    { emoji: '🐝', label: 'Arı (ITU Mascot)' },
    { emoji: '⚙️', label: 'Dişli (Mühendislik)' },
    { emoji: '⚓', label: 'Çapa (Denizcilik)' },
    { emoji: '🏛️', label: 'Sütun (Mimarlık)' },
    { emoji: '🚀', label: 'Roket (Uzay)' },
    { emoji: '🧬', label: 'DNA (Biyoloji)' },
    { emoji: '💻', label: 'Bilgisayar' },
    { emoji: '⛑️', label: 'Kask (İnşaat)' },
    { emoji: '⚡', label: 'Şimşek (Elektrik)' },
    { emoji: '🔬', label: 'Mikroskop (Araştırma)' },
    { emoji: '🎨', label: 'Palet (Tasarım)' },
    { emoji: '📐', label: 'Gönye (Mimar)' },
    { emoji: '🔧', label: 'Anahtar (Makine)' },
    { emoji: '⛏️', label: 'Kazma (Maden)' },
    { emoji: '🌊', label: 'Dalga (Deniz)' },
    { emoji: '✈️', label: 'Uçak (Havacılık)' },
    { emoji: '🎓', label: 'Kep (Mezun)' },
    { emoji: '📚', label: 'Kitaplar (Kütüphane)' },
    { emoji: '🏗️', label: 'Vinç (İnşaat)' },
    { emoji: '🌳', label: 'Ağaç (Kampüs)' }
];

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

    const saveBtn = document.getElementById('save-profile-btn');
    const saveIcon = saveBtn?.querySelector('i');
    const originalIconClass = saveIcon?.className || '';

    try {
        // Show loading state with spinner icon (no text change)
        if (saveBtn && saveIcon) {
            saveIcon.className = 'fas fa-spinner fa-spin';
            saveBtn.disabled = true;
        }

        // 1. Update Firebase Auth
        await updateProfile(currentUser, { displayName });

        // 2. Update Firestore user document (use setDoc with merge to create if missing)
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { displayName }, { merge: true });

        // 3. Batch update all user's notes with new uploader name
        const notesRef = collection(db, 'notes');
        const q = query(notesRef, where('uploaderID', '==', currentUser.uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const batch = writeBatch(db);

            snapshot.forEach((noteDoc) => {
                const noteRef = doc(db, 'notes', noteDoc.id);
                batch.update(noteRef, { uploader: displayName });
            });

            await batch.commit();
            console.log(`Updated ${snapshot.size} notes with new display name.`);
        }

        // 4. Update UI
        document.getElementById('display-name').textContent = displayName;

        showToast('İsim başarıyla güncellendi!', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Profil güncellenirken hata oluştu.', 'error');
    } finally {
        // Reset button state (restore icon)
        if (saveBtn && saveIcon) {
            saveIcon.className = originalIconClass;
            saveBtn.disabled = false;
        }
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

/**
 * Generate a Data URI for an avatar from an emoji
 * Creates an SVG with the emoji centered on a branded background
 */
function generateAvatarDataURI(emoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#062a54"/>
                <stop offset="100%" style="stop-color:#0a3d6f"/>
            </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#bg)"/>
        <text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/**
 * Show a simple toast notification
 */
function showToast(message, type = 'success') {
    // Check if toast-notifications.js is available
    if (window.toast) {
        window.toast[type](message);
        return;
    }

    // Fallback simple toast
    const existing = document.querySelector('.profile-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `profile-toast profile-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// =============================================================
// AVATAR MODAL FUNCTIONS
// =============================================================

function initAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    const closeBtn = document.getElementById('avatar-modal-close');
    const overlay = document.getElementById('avatar-modal-overlay');
    const cancelBtn = document.getElementById('avatar-cancel-btn');
    const saveBtn = document.getElementById('avatar-save-btn');
    const grid = document.getElementById('avatar-grid');

    if (!modal || !grid) return;

    // Render avatar grid
    renderAvatarGrid(grid);

    // Use event delegation for avatar edit button (it gets replaced by onAuthStateChanged)
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('#avatar-edit-btn');
        if (editBtn) {
            e.preventDefault();
            openAvatarModal(modal);
        }
    });

    // Close modal
    closeBtn?.addEventListener('click', () => closeAvatarModal(modal));
    overlay?.addEventListener('click', () => closeAvatarModal(modal));
    cancelBtn?.addEventListener('click', () => closeAvatarModal(modal));

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeAvatarModal(modal);
        }
    });

    // Save avatar
    saveBtn?.addEventListener('click', () => saveAvatar(modal, saveBtn));
}

function renderAvatarGrid(grid) {
    grid.innerHTML = ITU_AVATARS.map((avatar, index) => `
        <button type="button" 
                class="avatar-option" 
                data-emoji="${avatar.emoji}"
                title="${avatar.label}"
                aria-label="${avatar.label}">
            <span class="avatar-emoji">${avatar.emoji}</span>
        </button>
    `).join('');

    // Add click listeners
    grid.querySelectorAll('.avatar-option').forEach(btn => {
        btn.addEventListener('click', () => selectAvatar(btn, grid));
    });
}

function selectAvatar(btn, grid) {
    // Remove previous selection
    grid.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));

    // Add selection to clicked
    btn.classList.add('selected');
    selectedAvatarEmoji = btn.dataset.emoji;
}

function openAvatarModal(modal) {
    // Reset selection
    selectedAvatarEmoji = null;
    modal.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));

    // Open modal
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first avatar
    setTimeout(() => {
        const firstAvatar = modal.querySelector('.avatar-option');
        if (firstAvatar) firstAvatar.focus();
    }, 100);
}

function closeAvatarModal(modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    selectedAvatarEmoji = null;
}

async function saveAvatar(modal, saveBtn) {
    if (!selectedAvatarEmoji || !currentUser) {
        showToast('Lütfen bir avatar seçin', 'error');
        return;
    }

    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Kaydediliyor...';
    saveBtn.disabled = true;

    try {
        // Generate photo URL from emoji
        const newPhotoURL = generateAvatarDataURI(selectedAvatarEmoji);

        // 1. Update Firebase Auth profile
        await updateProfile(currentUser, { photoURL: newPhotoURL });

        // 2. Update Firestore users collection
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { photoURL: newPhotoURL }, { merge: true });

        // 3. Update UI immediately (edit button is outside container, so just update inner content)
        const avatarContainer = document.getElementById('avatar-container');
        if (avatarContainer) {
            avatarContainer.innerHTML = `<img src="${newPhotoURL}" alt="Profil" class="avatar-img">`;
        }

        // 4. Close modal and show success
        closeAvatarModal(modal);
        showToast('Avatar başarıyla güncellendi!', 'success');

    } catch (error) {
        console.error('Error saving avatar:', error);
        showToast('Avatar güncellenirken hata oluştu', 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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

    // ===========================================
    // INLINE USERNAME EDITING
    // ===========================================

    const viewMode = document.getElementById('name-view-mode');
    const editMode = document.getElementById('name-edit-mode');
    const displayName = document.getElementById('display-name');
    const editInput = document.getElementById('edit-display-name');
    const editBtn = document.getElementById('edit-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    /**
     * Enter Edit Mode: Hide view, show input with current name
     */
    function enterEditMode() {
        if (!viewMode || !editMode || !displayName || !editInput) return;

        // Populate input with current name
        editInput.value = displayName.textContent;

        // Toggle visibility
        viewMode.classList.add('hidden');
        editMode.classList.add('active');

        // Focus and select the input
        editInput.focus();
        editInput.select();
    }

    /**
     * Exit Edit Mode: Hide input, show view (discard changes)
     */
    function exitEditMode() {
        if (!viewMode || !editMode) return;

        viewMode.classList.remove('hidden');
        editMode.classList.remove('active');
    }

    /**
     * Save and Exit: Update Firebase, update UI, then exit
     */
    async function saveAndExit() {
        const newName = editInput.value.trim();

        if (!newName || newName.length < 2) {
            showToast('İsim en az 2 karakter olmalı', 'error');
            editInput.focus();
            return;
        }

        if (newName.length > 30) {
            showToast('İsim en fazla 30 karakter olabilir', 'error');
            editInput.focus();
            return;
        }

        // Update Firebase and UI
        await updateUserProfile(newName);

        // Update the display name text
        displayName.textContent = newName;

        // Exit edit mode
        exitEditMode();
    }

    // Event Listeners
    if (editBtn) {
        editBtn.addEventListener('click', enterEditMode);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', exitEditMode);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveAndExit);
    }

    // Keyboard shortcuts for input
    if (editInput) {
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveAndExit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                exitEditMode();
            }
        });
    }

    // Initialize avatar modal
    initAvatarModal();
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
