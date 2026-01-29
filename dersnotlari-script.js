/* ===========================================
   DERS NOTLARI PAGE SCRIPT
   Upload Access Control, Note Rendering & Filtering
   =========================================== */

// --- Mock Authentication State ---
let isUserLoggedIn = false;

// --- Robust Mock Notes Data ---
const allNotes = [
    // MAT (Mathematics)
    { id: 1, subjectCode: 'MAT', courseCode: 'MAT103', title: 'Kalkülüs I - Limit ve Süreklilik', description: 'Limit tanımı, limit teoremleri, sağdan ve soldan limit, süreklilik kavramı ve ara değer teoremi.', uploader: 'Ahmet Y.', date: '28 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat103-1', likes: 45, dislikes: 3 },
    { id: 2, subjectCode: 'MAT', courseCode: 'MAT103', title: 'Kalkülüs I - Türev Uygulamaları', description: 'Türev kuralları, zincir kuralı, maksimum-minimum problemleri ve grafik çizimi.', uploader: 'Zeynep K.', date: '27 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat103-2', likes: 38, dislikes: 2 },
    { id: 3, subjectCode: 'MAT', courseCode: 'MAT104', title: 'Kalkülüs II - İntegral Teknikleri', description: 'Belirsiz integral, belirli integral, kısmi kesirler ve trigonometrik integrasyon.', uploader: 'Can T.', date: '26 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat104-1', likes: 52, dislikes: 5 },
    { id: 4, subjectCode: 'MAT', courseCode: 'MAT104', title: 'Kalkülüs II - Seri ve Diziler', description: 'Yakınsaklık testleri, Taylor ve Maclaurin serileri, kuvvet serileri.', uploader: 'Elif S.', date: '25 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat104-2', likes: 29, dislikes: 1 },
    { id: 5, subjectCode: 'MAT', courseCode: 'MAT281', title: 'Diferansiyel Denklemler - Hafta 3', description: 'Birinci mertebeden lineer diferansiyel denklemler ve integrasyon faktörü yöntemi.', uploader: 'Mehmet A.', date: '24 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat281-1', likes: 35, dislikes: 4 },
    { id: 6, subjectCode: 'MAT', courseCode: 'MAT281', title: 'Diferansiyel Denklemler - Laplace', description: 'Laplace dönüşümü ve ters Laplace dönüşümü ile diferansiyel denklem çözümleri.', uploader: 'Selin M.', date: '23 Ocak 2026', externalUrl: 'https://drive.google.com/drive/mat281-2', likes: 41, dislikes: 2 },

    // FIZ (Physics)
    { id: 7, subjectCode: 'FIZ', courseCode: 'FIZ101', title: 'Fizik I - Kinematik Özet', description: 'Hız, ivme, düzgün hareket, eğik atış ve dairesel hareket formülleri.', uploader: 'Ali R.', date: '28 Ocak 2026', externalUrl: 'https://drive.google.com/drive/fiz101-1', likes: 67, dislikes: 4 },
    { id: 8, subjectCode: 'FIZ', courseCode: 'FIZ101', title: 'Fizik I - Newton Yasaları', description: 'Newton\'un hareket yasaları, sürtünme kuvveti ve uygulama problemleri.', uploader: 'Deniz K.', date: '27 Ocak 2026', externalUrl: 'https://drive.google.com/drive/fiz101-2', likes: 55, dislikes: 3 },
    { id: 9, subjectCode: 'FIZ', courseCode: 'FIZ102', title: 'Fizik II - Elektrostatik', description: 'Coulomb yasası, elektrik alan, potansiyel ve kondansatörler.', uploader: 'Berk Ö.', date: '26 Ocak 2026', externalUrl: 'https://drive.google.com/drive/fiz102-1', likes: 48, dislikes: 2 },
    { id: 10, subjectCode: 'FIZ', courseCode: 'FIZ102', title: 'Fizik II - Maxwell Denklemleri', description: 'Maxwell denklemleri, Faraday yasası ve manyetik indüksiyon konularının özeti.', uploader: 'Zeynep K.', date: '25 Ocak 2026', externalUrl: 'https://drive.google.com/drive/fiz102-2', likes: 33, dislikes: 1 },

    // KIM (Chemistry)
    { id: 11, subjectCode: 'KIM', courseCode: 'KIM101', title: 'Genel Kimya - Atom Yapısı', description: 'Atom modelleri, kuantum sayıları, orbital dolumu ve periyodik tablo.', uploader: 'Ayşe B.', date: '28 Ocak 2026', externalUrl: 'https://drive.google.com/drive/kim101-1', likes: 42, dislikes: 3 },
    { id: 12, subjectCode: 'KIM', courseCode: 'KIM101', title: 'Genel Kimya - Kimyasal Bağlar', description: 'İyonik, kovalent ve metalik bağlar. Lewis yapıları ve VSEPR teorisi.', uploader: 'Ozan T.', date: '27 Ocak 2026', externalUrl: 'https://drive.google.com/drive/kim101-2', likes: 36, dislikes: 2 },
    { id: 13, subjectCode: 'KIM', courseCode: 'KIM102', title: 'Organik Kimya - Fonksiyonel Gruplar', description: 'Alkanlar, alkenler, alkoller, eterler ve karboksilik asitler.', uploader: 'Elif S.', date: '26 Ocak 2026', externalUrl: 'https://drive.google.com/drive/kim102-1', likes: 28, dislikes: 4 },
    { id: 14, subjectCode: 'KIM', courseCode: 'KIM102', title: 'Organik Kimya - Reaksiyon Mekanizmaları', description: 'SN1, SN2, E1, E2 reaksiyonları ve stereokimya kavramları.', uploader: 'Ceren A.', date: '25 Ocak 2026', externalUrl: 'https://drive.google.com/drive/kim102-2', likes: 31, dislikes: 2 },

    // BIL (Computer Science)
    { id: 15, subjectCode: 'BIL', courseCode: 'BIL101', title: 'Bilgisayara Giriş - Algoritma', description: 'Algoritma tasarımı, akış diyagramları ve temel programlama kavramları.', uploader: 'Emre Ş.', date: '28 Ocak 2026', externalUrl: 'https://drive.google.com/drive/bil101-1', likes: 58, dislikes: 2 },
    { id: 16, subjectCode: 'BIL', courseCode: 'BIL101', title: 'Bilgisayara Giriş - C Programlama', description: 'C programlama dili temelleri, değişkenler, döngüler ve fonksiyonlar.', uploader: 'Kaan P.', date: '27 Ocak 2026', externalUrl: 'https://drive.google.com/drive/bil101-2', likes: 62, dislikes: 3 },
    { id: 17, subjectCode: 'BIL', courseCode: 'BIL102', title: 'Python Veri Yapıları', description: 'Liste, tuple, dictionary ve set veri yapılarının karşılaştırmalı özeti.', uploader: 'Mehmet A.', date: '26 Ocak 2026', externalUrl: 'https://drive.google.com/drive/bil102-1', likes: 71, dislikes: 2 },
    { id: 18, subjectCode: 'BIL', courseCode: 'BIL102', title: 'Python OOP Kavramları', description: 'Sınıflar, nesneler, kalıtım, polimorfizm ve kapsülleme.', uploader: 'Seda Y.', date: '25 Ocak 2026', externalUrl: 'https://drive.google.com/drive/bil102-2', likes: 49, dislikes: 1 },

    // ELE (Electrical Engineering)
    { id: 19, subjectCode: 'ELE', courseCode: 'ELE201', title: 'Devre Teorisi - Temel Kavramlar', description: 'Ohm yasası, Kirchhoff yasaları, seri ve paralel devreler.', uploader: 'Burak Ç.', date: '28 Ocak 2026', externalUrl: 'https://drive.google.com/drive/ele201-1', likes: 44, dislikes: 3 },
    { id: 20, subjectCode: 'ELE', courseCode: 'ELE201', title: 'Devre Teorisi - Thevenin Norton', description: 'Thevenin ve Norton eşdeğer devreleri, süperpozisyon teoremi.', uploader: 'Selin M.', date: '27 Ocak 2026', externalUrl: 'https://drive.google.com/drive/ele201-2', likes: 39, dislikes: 2 },
    { id: 21, subjectCode: 'ELE', courseCode: 'ELE202', title: 'Elektronik - Diyotlar', description: 'Diyot çeşitleri, LED, Zener diyot ve doğrultucu devreler.', uploader: 'Ege N.', date: '26 Ocak 2026', externalUrl: 'https://drive.google.com/drive/ele202-1', likes: 27, dislikes: 1 },
    { id: 22, subjectCode: 'ELE', courseCode: 'ELE202', title: 'Elektronik - Transistörler', description: 'BJT ve MOSFET transistörler, yükselteç devreleri.', uploader: 'Arda K.', date: '25 Ocak 2026', externalUrl: 'https://drive.google.com/drive/ele202-2', likes: 34, dislikes: 4 },

    // MUK (Mechanics of Materials)
    { id: 23, subjectCode: 'MUK', courseCode: 'MUK201', title: 'Mukavemet - Gerilme Şekil Değiştirme', description: 'Normal gerilme, kayma gerilmesi, Hooke yasası ve elastik modül.', uploader: 'Tolga B.', date: '24 Ocak 2026', externalUrl: 'https://drive.google.com/drive/muk201-1', likes: 22, dislikes: 2 },
    { id: 24, subjectCode: 'MUK', courseCode: 'MUK201', title: 'Mukavemet - Eğilme Momentleri', description: 'Kesit alanı momentleri, eğilme gerilmesi ve elastik eğri.', uploader: 'İrem D.', date: '23 Ocak 2026', externalUrl: 'https://drive.google.com/drive/muk201-2', likes: 19, dislikes: 1 }
];

// --- Track user votes ---
const userVotes = {};

// --- Current filter state ---
let currentFilters = {
    subjectCode: '',
    courseCode: ''
};

// --- Get unique subject codes ---
function getSubjectCodes() {
    const subjects = [...new Set(allNotes.map(note => note.subjectCode))];
    return subjects.sort();
}

// --- Get course codes for a subject ---
function getCourseCodes(subjectCode) {
    const courses = [...new Set(
        allNotes
            .filter(note => note.subjectCode === subjectCode)
            .map(note => note.courseCode)
    )];
    return courses.sort();
}

// --- Filter and sort notes ---
function getFilteredNotes() {
    let filtered = [...allNotes];

    // Apply subject filter
    if (currentFilters.subjectCode) {
        filtered = filtered.filter(note => note.subjectCode === currentFilters.subjectCode);
    }

    // Apply course filter
    if (currentFilters.courseCode) {
        filtered = filtered.filter(note => note.courseCode === currentFilters.courseCode);
    }

    // Sort by net likes (descending)
    filtered.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));

    // If no filters, return top 9
    if (!currentFilters.subjectCode && !currentFilters.courseCode) {
        return filtered.slice(0, 9);
    }

    return filtered;
}

// --- Populate subject dropdown ---
function populateSubjectDropdown() {
    const subjectSelect = document.getElementById('subject-filter');
    if (!subjectSelect) return;

    const subjects = getSubjectCodes();
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

    if (!subjectCode) {
        courseSelect.innerHTML = '<option value="">Önce branş seçin</option>';
        courseSelect.disabled = true;
        return;
    }

    const courses = getCourseCodes(subjectCode);
    let options = '<option value="">Tüm Dersler</option>';

    courses.forEach(course => {
        options += `<option value="${course}">${course}</option>`;
    });

    courseSelect.innerHTML = options;
    courseSelect.disabled = false;
}

// --- Update filter status text ---
function updateFilterStatus() {
    const statusElement = document.getElementById('filter-status');
    const clearBtn = document.getElementById('clear-filters');
    if (!statusElement) return;

    const notes = getFilteredNotes();

    if (!currentFilters.subjectCode && !currentFilters.courseCode) {
        statusElement.innerHTML = '<i class="fas fa-fire"></i> En popüler 9 not gösteriliyor';
        statusElement.classList.remove('filtered');
        if (clearBtn) clearBtn.style.display = 'none';
    } else if (currentFilters.courseCode) {
        statusElement.innerHTML = `<i class="fas fa-filter"></i> ${currentFilters.courseCode} için ${notes.length} not bulundu`;
        statusElement.classList.add('filtered');
        if (clearBtn) clearBtn.style.display = 'flex';
    } else {
        statusElement.innerHTML = `<i class="fas fa-filter"></i> ${currentFilters.subjectCode} branşında ${notes.length} not bulundu`;
        statusElement.classList.add('filtered');
        if (clearBtn) clearBtn.style.display = 'flex';
    }
}

// --- Render Notes Function ---
function renderNotes() {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;

    const notes = getFilteredNotes();

    if (notes.length === 0) {
        notesGrid.innerHTML = `
            <div class="notes-empty-state">
                <i class="fas fa-search"></i>
                <h3>Not bulunamadı</h3>
                <p>Bu kriterlere uygun not henüz yok.</p>
            </div>
        `;
        return;
    }

    let htmlContent = '';

    notes.forEach(note => {
        const netLikes = note.likes - note.dislikes;
        const ratingClass = netLikes > 0 ? 'positive' : (netLikes < 0 ? 'negative' : '');
        const userVote = userVotes[note.id] || null;

        htmlContent += `
            <article class="note-card" data-note-id="${note.id}" onclick="handleCardClick(event, ${note.id})">
                <div class="note-card-header">
                    <span class="note-subject">${note.courseCode}</span>
                    <span class="note-date"><i class="far fa-clock"></i> ${note.date}</span>
                </div>
                <h3 class="note-title">${note.title}</h3>
                <p class="note-description">${note.description}</p>
                <div class="note-author">
                    <i class="fas fa-user-circle"></i>
                    <span>${note.uploader}</span>
                </div>
                <div class="note-card-footer">
                    <a href="${note.externalUrl}" target="_blank" rel="noopener noreferrer" class="note-link-btn" onclick="event.stopPropagation()">
                        <i class="fas fa-external-link-alt"></i> Linke Git
                    </a>
                    <div class="note-rating">
                        <button class="rating-btn like-btn ${userVote === 'like' ? 'active' : ''}" 
                                onclick="handleVote(event, ${note.id}, 'like')" 
                                aria-label="Beğen">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <span class="rating-count ${ratingClass}" id="rating-count-${note.id}">${netLikes}</span>
                        <button class="rating-btn dislike-btn ${userVote === 'dislike' ? 'active' : ''}" 
                                onclick="handleVote(event, ${note.id}, 'dislike')" 
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

// --- Handle Card Click ---
function handleCardClick(event, noteId) {
    if (event.target.closest('.note-link-btn') || event.target.closest('.rating-btn')) {
        return;
    }
    window.location.href = `note-details.html?id=${noteId}`;
}

// --- Handle Like/Dislike Vote ---
function handleVote(event, noteId, voteType) {
    event.stopPropagation();

    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;

    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    const likeBtn = card.querySelector('.like-btn');
    const dislikeBtn = card.querySelector('.dislike-btn');
    const countElement = document.getElementById(`rating-count-${noteId}`);

    const previousVote = userVotes[noteId];

    if (previousVote === 'like') {
        note.likes--;
        likeBtn.classList.remove('active');
    } else if (previousVote === 'dislike') {
        note.dislikes--;
        dislikeBtn.classList.remove('active');
    }

    if (previousVote === voteType) {
        delete userVotes[noteId];
    } else {
        userVotes[noteId] = voteType;
        if (voteType === 'like') {
            note.likes++;
            likeBtn.classList.add('active');
            dislikeBtn.classList.remove('active');
        } else {
            note.dislikes++;
            dislikeBtn.classList.add('active');
            likeBtn.classList.remove('active');
        }
    }

    const netLikes = note.likes - note.dislikes;
    countElement.textContent = netLikes;
    countElement.className = 'rating-count';
    if (netLikes > 0) countElement.classList.add('positive');
    else if (netLikes < 0) countElement.classList.add('negative');
}

// --- Handle Subject Filter Change ---
function handleSubjectChange(event) {
    currentFilters.subjectCode = event.target.value;
    currentFilters.courseCode = '';

    populateCourseDropdown(currentFilters.subjectCode);
    updateFilterStatus();
    renderNotes();
}

// --- Handle Course Filter Change ---
function handleCourseChange(event) {
    currentFilters.courseCode = event.target.value;
    updateFilterStatus();
    renderNotes();
}

// --- Clear Filters ---
function clearFilters() {
    currentFilters.subjectCode = '';
    currentFilters.courseCode = '';

    document.getElementById('subject-filter').value = '';
    document.getElementById('course-filter').value = '';
    document.getElementById('course-filter').disabled = true;
    document.getElementById('course-filter').innerHTML = '<option value="">Önce branş seçin</option>';

    updateFilterStatus();
    renderNotes();
}

// --- Upload Button Handler ---
function handleUploadClick() {
    if (!isUserLoggedIn) {
        alert('Ders notu yüklemek için lütfen giriş yapın!');
    } else {
        console.log('Opening upload modal...');
    }
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', function () {
    // Populate filters
    populateSubjectDropdown();
    populateCourseDropdown('');

    // Render initial notes (Top 9)
    updateFilterStatus();
    renderNotes();

    // Add event listeners
    const subjectSelect = document.getElementById('subject-filter');
    const courseSelect = document.getElementById('course-filter');
    const clearBtn = document.getElementById('clear-filters');
    const fabButton = document.getElementById('fab-upload');

    if (subjectSelect) subjectSelect.addEventListener('change', handleSubjectChange);
    if (courseSelect) courseSelect.addEventListener('change', handleCourseChange);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    if (fabButton) fabButton.addEventListener('click', handleUploadClick);

    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    if (loadingOverlay && mainContent) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
});

// --- Auth State Listener ---
window.addEventListener('authStateChanged', function (event) {
    if (event.detail) {
        isUserLoggedIn = event.detail.isLoggedIn || false;
    }
});
