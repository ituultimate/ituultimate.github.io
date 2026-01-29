/**
 * DERS NOTLARI PAGE SCRIPT
 * Firebase Integration for Notes & Filtering
 * Uses modern ES modules with shared Firebase config
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    doc,
    updateDoc,
    increment,
    addDoc,
    serverTimestamp,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State Variables ---
let isUserLoggedIn = false;
let currentUser = null;
let allCoursesNested = {};  // Grouped courses data
let userVotes = {};         // Track user votes locally

// --- Current filter state ---
let currentFilters = {
    subjectCode: '',
    courseCode: ''
};

// =============================================================
// FETCH COURSES (Similar to Scheduler)
// =============================================================
const fetchAndGroupCourses = async () => {
    const subjectSelect = document.getElementById('subject-filter');
    if (!subjectSelect) return;

    try {
        // Fetch from the same collection as scheduler
        const coursesCollection = collection(db, '2526-bahar');
        const coursesSnapshot = await getDocs(coursesCollection);

        if (coursesSnapshot.empty) {
            console.warn('No courses found in database');
            return;
        }

        const courses = coursesSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // Group courses by prefix (subject code)
        allCoursesNested = courses.reduce((acc, course) => {
            const codeString = String(course.code || '').trim();
            if (!codeString) return acc;

            const prefix = codeString.split(' ')[0];
            if (!prefix) return acc;

            const fullCode = codeString;

            if (!acc[prefix]) acc[prefix] = {};
            if (!acc[prefix][fullCode]) {
                acc[prefix][fullCode] = course.name || 'N/A';
            }

            return acc;
        }, {});

        // Populate subject dropdown
        populateSubjectDropdown();

    } catch (error) {
        console.error('Error fetching courses:', error);
    }
};

// --- Populate subject dropdown ---
function populateSubjectDropdown() {
    const subjectSelect = document.getElementById('subject-filter');
    if (!subjectSelect) return;

    const subjects = Object.keys(allCoursesNested).sort();
    let options = '<option value="">Tümü</option>';

    subjects.forEach(subject => {
        options += `<option value="${subject}">${subject}</option>`;
    });

    subjectSelect.innerHTML = options;
}

// --- Populate course dropdown based on subject ---
function populateCourseDropdown(subjectCode) {
    const courseSelect = document.getElementById('course-filter');
    if (!courseSelect) return;

    if (!subjectCode || !allCoursesNested[subjectCode]) {
        courseSelect.innerHTML = '<option value="">Önce branş seçin</option>';
        courseSelect.disabled = true;
        return;
    }

    const courses = Object.keys(allCoursesNested[subjectCode]).sort();
    let options = '<option value="">Tüm Dersler</option>';

    courses.forEach(courseCode => {
        const courseName = allCoursesNested[subjectCode][courseCode];
        options += `<option value="${courseCode}">${courseCode}</option>`;
    });

    courseSelect.innerHTML = options;
    courseSelect.disabled = false;
}

// =============================================================
// FETCH NOTES FROM FIRESTORE
// =============================================================
const fetchNotes = async () => {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;

    // Show loading state
    notesGrid.innerHTML = `
        <div class="notes-empty-state">
            <div class="spinner" style="width:40px;height:40px;border-width:4px;margin:0 auto 20px;"></div>
            <p>Notlar yükleniyor...</p>
        </div>
    `;

    try {
        const notesCollection = collection(db, 'notes');
        let notesQuery;

        // Build query based on filters
        if (currentFilters.courseCode) {
            // Scenario B: Filter by specific course - limit 50
            notesQuery = query(
                notesCollection,
                where('courseCode', '==', currentFilters.courseCode),
                orderBy('netLikes', 'desc'),
                limit(50)
            );
        } else if (currentFilters.subjectCode) {
            // Scenario B: Filter by subject - limit 50
            notesQuery = query(
                notesCollection,
                where('subjectCode', '==', currentFilters.subjectCode),
                orderBy('netLikes', 'desc'),
                limit(50)
            );
        } else {
            // Scenario A: Default - Top 9 by likes globally
            notesQuery = query(
                notesCollection,
                orderBy('netLikes', 'desc'),
                limit(9)
            );
        }

        const notesSnapshot = await getDocs(notesQuery);

        if (notesSnapshot.empty) {
            renderEmptyState();
            return;
        }

        const notes = notesSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderNotes(notes);
        updateFilterStatus(notes.length);

    } catch (error) {
        console.error('Error fetching notes:', error);

        // Check if it's an index error
        if (error.code === 'failed-precondition') {
            notesGrid.innerHTML = `
                <div class="notes-empty-state">
                    <i class="fas fa-database"></i>
                    <h3>Veritabanı indeksi gerekli</h3>
                    <p>Lütfen Firestore konsolunda gerekli indeksi oluşturun.</p>
                </div>
            `;
        } else {
            notesGrid.innerHTML = `
                <div class="notes-empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Hata oluştu</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
};

// --- Render empty state ---
function renderEmptyState() {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;

    // Filtre kontrolü yapmadan doğrudan istenen mesajı basıyoruz
    notesGrid.innerHTML = `
        <div class="notes-empty-state">
            <i class="fas fa-folder-open"></i>
            <h3>Henüz not yok</h3>
            <p>İlk notu yükleyen sen ol!</p>
        </div>
    `;
}

// --- Render Notes ---
function renderNotes(notes) {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;

    let htmlContent = '';
    const userId = currentUser?.uid;

    notes.forEach(note => {
        const netLikes = note.netLikes || (note.likes || 0) - (note.dislikes || 0);
        const ratingClass = netLikes > 0 ? 'positive' : (netLikes < 0 ? 'negative' : '');

        // Check if current user has already voted on this note
        const likedByUsers = note.likedByUsers || [];
        const dislikedByUsers = note.dislikedByUsers || [];
        const hasLiked = userId && likedByUsers.includes(userId);
        const hasDisliked = userId && dislikedByUsers.includes(userId);

        // Update local state to match Firestore
        if (hasLiked) userVotes[note.id] = 'like';
        else if (hasDisliked) userVotes[note.id] = 'dislike';

        const userVote = userVotes[note.id] || null;
        const courseCode = note.courseCode || note.subjectCode || 'DERS';
        const title = note.title || 'Başlıksız Not';
        const description = note.description || '';
        const uploader = note.uploader || note.author || 'Anonim';
        const date = note.date || formatDate(note.createdAt);
        const externalUrl = note.externalUrl || note.url || '#';

        htmlContent += `
            <article class="note-card" data-note-id="${note.id}" onclick="window.handleCardClick(event, '${note.id}')">
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
                    <a href="${externalUrl}" target="_blank" rel="noopener noreferrer" class="note-link-btn" onclick="event.stopPropagation()">
                        <i class="fas fa-external-link-alt"></i> Linke Git
                    </a>
                    <div class="note-rating">
                        <button class="rating-btn like-btn ${userVote === 'like' ? 'active' : ''}" 
                                onclick="window.handleVote(event, '${note.id}', 'like')" 
                                aria-label="Beğen">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <span class="rating-count ${ratingClass}" id="rating-count-${note.id}">${netLikes}</span>
                        <button class="rating-btn dislike-btn ${userVote === 'dislike' ? 'active' : ''}" 
                                onclick="window.handleVote(event, '${note.id}', 'dislike')" 
                                aria-label="Beğenme">
                            <i class="fas fa-thumbs-down"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    });

    notesGrid.innerHTML = htmlContent;
}

// --- Format Firestore timestamp ---
function formatDate(timestamp) {
    if (!timestamp) return '';

    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    } catch (e) {
        return '';
    }
}

// --- Update filter status / section heading ---
function updateFilterStatus(count) {
    const statusElement = document.getElementById('filter-status');
    const clearBtn = document.getElementById('clear-filters');
    const pageTitle = document.getElementById('page-title');
    if (!statusElement) return;

    // Eğer branş ve ders kodu seçili değilse (yani "Tümü" durumundaysa)
    if (!currentFilters.subjectCode && !currentFilters.courseCode) {
        // Scenario A: No filter - Top 9 globally

        statusElement.style.display = 'flex'; // Görünür yap

        // DEĞİŞİKLİK BURADA: Emoji yerine turuncu renkli FontAwesome ikonu
        statusElement.innerHTML = '<i class="fas fa-fire" style="color: #ff4500;"></i> En popüler 9 not gösteriliyor';

        statusElement.classList.remove('filtered');
        if (pageTitle) pageTitle.textContent = '📓 Ders Notları';
        if (clearBtn) clearBtn.style.display = 'none';

    } else if (currentFilters.courseCode) {
        // Scenario B: Course selected
        // Ders seçiliyse bu yazıyı GİZLE
        statusElement.style.display = 'none';

        const displayCode = currentFilters.courseCode.replace(/\s+/g, '');
        if (pageTitle) pageTitle.textContent = `📚 ${displayCode} Notları`;
        if (clearBtn) clearBtn.style.display = 'flex';

    } else {
        // Scenario C: Subject selected
        // Branş seçiliyse bu yazıyı GİZLE
        statusElement.style.display = 'none';

        if (pageTitle) pageTitle.textContent = `📚 ${currentFilters.subjectCode} Notları`;
        if (clearBtn) clearBtn.style.display = 'flex';
    }
}

// =============================================================
// EVENT HANDLERS
// =============================================================

// --- Handle Card Click ---
window.handleCardClick = function (event, noteId) {
    if (event.target.closest('.note-link-btn') || event.target.closest('.rating-btn')) {
        return;
    }
    window.location.href = `note-details.html?id=${noteId}`;
};

// --- Handle Like/Dislike Vote ---
window.handleVote = async function (event, noteId, voteType) {
    event.stopPropagation();

    if (!isUserLoggedIn) {
        alert('Oy vermek için lütfen giriş yapın!');
        return;
    }

    const userId = currentUser.uid;
    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!card) return;

    const likeBtn = card.querySelector('.like-btn');
    const dislikeBtn = card.querySelector('.dislike-btn');
    const countElement = document.getElementById(`rating-count-${noteId}`);

    // Disable buttons during operation
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;

    try {
        // Fetch current note data to check if user has already voted
        const noteRef = doc(db, 'notes', noteId);
        const noteSnapshot = await getDoc(noteRef);

        if (!noteSnapshot.exists()) {
            alert('Bu not bulunamadı.');
            return;
        }

        const noteData = noteSnapshot.data();
        const likedByUsers = noteData.likedByUsers || [];
        const dislikedByUsers = noteData.dislikedByUsers || [];

        const hasLiked = likedByUsers.includes(userId);
        const hasDisliked = dislikedByUsers.includes(userId);

        // Check if user has already voted (either like or dislike)
        if (hasLiked || hasDisliked) {
            alert('Bu notu zaten oyladınız!');
            return;
        }

        // User hasn't voted yet - proceed with the vote
        let updateData = {};

        if (voteType === 'like') {
            updateData = {
                likes: increment(1),
                netLikes: increment(1),
                likedByUsers: arrayUnion(userId)
            };
            // Update UI
            likeBtn.classList.add('active');
            userVotes[noteId] = 'like';
        } else {
            updateData = {
                dislikes: increment(1),
                netLikes: increment(-1),
                dislikedByUsers: arrayUnion(userId)
            };
            // Update UI
            dislikeBtn.classList.add('active');
            userVotes[noteId] = 'dislike';
        }

        // Update Firestore
        await updateDoc(noteRef, updateData);

        // Update UI count
        const currentCount = parseInt(countElement.textContent) || 0;
        const newCount = voteType === 'like' ? currentCount + 1 : currentCount - 1;
        countElement.textContent = newCount;
        countElement.className = 'rating-count';
        if (newCount > 0) countElement.classList.add('positive');
        else if (newCount < 0) countElement.classList.add('negative');

    } catch (error) {
        console.error('Error updating vote:', error);
        alert('Oy verirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        // Re-enable buttons
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
    }
};

// --- Handle Subject Filter Change ---
function handleSubjectChange(event) {
    currentFilters.subjectCode = event.target.value;
    currentFilters.courseCode = '';

    populateCourseDropdown(currentFilters.subjectCode);
    fetchNotes();
}

// --- Handle Course Filter Change ---
function handleCourseChange(event) {
    currentFilters.courseCode = event.target.value;
    fetchNotes();
}

// --- Clear Filters ---
function clearFilters() {
    currentFilters.subjectCode = '';
    currentFilters.courseCode = '';

    document.getElementById('subject-filter').value = '';
    document.getElementById('course-filter').value = '';
    document.getElementById('course-filter').disabled = true;
    document.getElementById('course-filter').innerHTML = '<option value="">Önce branş seçin</option>';

    fetchNotes();
}

// =============================================================
// UPLOAD MODAL HANDLERS
// =============================================================

// --- Open Upload Modal ---
function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (!modal) return;

    // Populate modal dropdowns
    populateUploadSubjectDropdown();

    // Reset form
    document.getElementById('upload-form').reset();
    document.getElementById('upload-course').disabled = true;
    document.getElementById('upload-course').innerHTML = '<option value="">Önce branş seçin...</option>';

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// --- Close Upload Modal ---
function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (!modal) return;

    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// --- Populate Upload Subject Dropdown ---
function populateUploadSubjectDropdown() {
    const subjectSelect = document.getElementById('upload-subject');
    if (!subjectSelect) return;

    const subjects = Object.keys(allCoursesNested).sort();
    let options = '<option value="">Branş seçin...</option>';

    subjects.forEach(subject => {
        options += `<option value="${subject}">${subject}</option>`;
    });

    subjectSelect.innerHTML = options;
}

// --- Populate Upload Course Dropdown ---
function populateUploadCourseDropdown(subjectCode) {
    const courseSelect = document.getElementById('upload-course');
    if (!courseSelect) return;

    if (!subjectCode || !allCoursesNested[subjectCode]) {
        courseSelect.innerHTML = '<option value="">Önce branş seçin...</option>';
        courseSelect.disabled = true;
        return;
    }

    const courses = Object.keys(allCoursesNested[subjectCode]).sort();
    let options = '<option value="">Ders seçin...</option>';

    courses.forEach(courseCode => {
        options += `<option value="${courseCode}">${courseCode}</option>`;
    });

    courseSelect.innerHTML = options;
    courseSelect.disabled = false;
}

// --- Handle Upload Form Submit ---
async function handleUploadSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('upload-submit-btn');
    const originalText = submitBtn.innerHTML;

    // Get form values
    const subjectCode = document.getElementById('upload-subject').value;
    const courseCode = document.getElementById('upload-course').value;
    const instructor = document.getElementById('upload-instructor').value.trim();
    const link = document.getElementById('upload-link').value.trim();
    const title = document.getElementById('upload-title').value.trim();
    const description = document.getElementById('upload-description').value.trim();
    const isAnonymous = document.getElementById('upload-anonymous').checked;

    // Validation
    if (!subjectCode || !courseCode || !link || !title || !description) {
        alert('Lütfen tüm zorunlu alanları doldurun!');
        return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';

    try {
        // Determine uploader name based on anonymous checkbox
        const uploaderName = isAnonymous ? 'Anonim' : (currentUser.displayName || currentUser.email.split('@')[0]);

        // Create note document
        const noteData = {
            subjectCode: subjectCode,
            courseCode: courseCode,
            title: title,
            description: description,
            instructor: instructor || null,
            externalUrl: link,
            uploader: uploaderName,
            uploaderID: currentUser.uid,
            uploaderEmail: currentUser.email,
            likes: 0,
            dislikes: 0,
            netLikes: 0,
            likedByUsers: [],      // Array to track users who liked
            dislikedByUsers: [],   // Array to track users who disliked
            createdAt: serverTimestamp(),
            date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        };

        // Add to Firestore
        await addDoc(collection(db, 'notes'), noteData);

        // Success
        alert('Not başarıyla yüklendi! ✅');
        closeUploadModal();

        // Refresh notes if viewing that course/subject
        fetchNotes();

    } catch (error) {
        console.error('Error uploading note:', error);
        alert('Yükleme sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// --- FAB Upload Button Handler ---
function handleUploadClick() {
    if (!isUserLoggedIn) {
        alert('Ders notu yüklemek için lütfen giriş yapın!');
    } else {
        openUploadModal();
    }
}

// =============================================================
// INITIALIZATION
// =============================================================
document.addEventListener('DOMContentLoaded', async function () {
    // Filter event listeners
    const subjectSelect = document.getElementById('subject-filter');
    const courseSelect = document.getElementById('course-filter');
    const clearBtn = document.getElementById('clear-filters');
    const fabButton = document.getElementById('fab-upload');

    if (subjectSelect) subjectSelect.addEventListener('change', handleSubjectChange);
    if (courseSelect) courseSelect.addEventListener('change', handleCourseChange);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    if (fabButton) fabButton.addEventListener('click', handleUploadClick);

    // Upload modal event listeners
    const uploadModal = document.getElementById('upload-modal');
    const uploadModalClose = document.getElementById('upload-modal-close');
    const uploadForm = document.getElementById('upload-form');
    const uploadSubject = document.getElementById('upload-subject');

    if (uploadModalClose) uploadModalClose.addEventListener('click', closeUploadModal);
    if (uploadModal) {
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) closeUploadModal();
        });
    }
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);
    if (uploadSubject) {
        uploadSubject.addEventListener('change', (e) => {
            populateUploadCourseDropdown(e.target.value);
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeUploadModal();
    });

    // Fetch courses for dropdown
    await fetchAndGroupCourses();

    // Fetch initial notes (Top 9)
    await fetchNotes();

    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    if (loadingOverlay && mainContent) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
});

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        isUserLoggedIn = true;
        currentUser = user;
        console.log('User logged in:', user.email);
    } else {
        isUserLoggedIn = false;
        currentUser = null;
        console.log('Guest user');
    }
});
