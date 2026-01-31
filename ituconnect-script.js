/**
 * ITU Connect - Campus Social Platform Script
 * Real-time chat with Firebase Firestore
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// =============================================================
// CONFIGURATION & STATE
// =============================================================

// Pre-defined channels
const CHANNELS = {
    campus: [
        { id: 'meda', name: 'MED', icon: '🌳' },
        { id: 'mustafainan', name: 'Mustafa İnan', icon: '📚' },
        { id: 'yemekhane', name: 'Yemekhane', icon: '🍽️' },
        { id: 'spor', name: 'Spor Salonu', icon: '🏃' }
    ],
    faculty: [
        { id: 'makine', name: 'Gümüşsuyu', icon: '⚙️' },
        { id: 'elektrik', name: 'EEB', icon: '⚡' },
        { id: 'bilgisayar', name: 'Bilgisayar Mühendisliği', icon: '💻' },
        { id: 'kimyametalurji', name: 'KMB', icon: '⚗️' },
        { id: 'ucakuzay', name: 'UUB', icon: '🚀' },
        { id: 'insaat', name: 'İnşaat', icon: '🏗️' },
        { id: 'maden', name: 'Maden', icon: '⛏️' },
        { id: 'mimarlik', name: 'Taşkışla', icon: '🏛️' },
        { id: 'macka', name: 'Maçka', icon: '📊' }

    ],
    general: [
        { id: 'genel', name: 'Genel Sohbet', icon: '💬' },
        { id: 'duyurular', name: 'Duyurular', icon: '📢' }
    ]
};

// Status options
const STATUS_OPTIONS = {
    online: { text: 'Çevrimiçi', color: '#28a745', icon: '🟢' },
    library: { text: 'Kütüphanede', color: '#007bff', icon: '📚' },
    cafeteria: { text: 'Yemekhanede', color: '#fd7e14', icon: '🍽️' },
    classroom: { text: 'Derste', color: '#6f42c1', icon: '📖' },
    offline: { text: 'Çevrimdışı', color: '#6c757d', icon: '⚫' }
};

// Badge thresholds
const BADGE_THRESHOLDS = {
    bronze: { min: 10, icon: '🐝', label: 'Bronze Bee' },
    silver: { min: 50, icon: '🥈🐝', label: 'Silver Bee' },
    gold: { min: 200, icon: '🥇🐝', label: 'Gold Bee' },
    platinum: { min: 500, icon: '👑🐝', label: 'Platinum Bee' }
};

// State
let currentUser = null;
let currentChannel = null;
let unsubscribeMessages = null;
let unsubscribeOnlineUsers = null;

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const mainContent = document.getElementById('main-content');
const channelSidebar = document.getElementById('channel-sidebar');
const usersSidebar = document.getElementById('users-sidebar');
const welcomeState = document.getElementById('welcome-state');
const messageList = document.getElementById('message-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const channelName = document.getElementById('channel-name');
const channelIcon = document.getElementById('channel-icon');
const onlineCount = document.getElementById('online-count');

// =============================================================
// BAD WORDS FILTER
// =============================================================

const BAD_WORDS = [
    // Add Turkish and English inappropriate words here
    // This is a basic example - expand as needed
];

function containsBadWords(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return BAD_WORDS.some(word => lower.includes(word.toLowerCase()));
}

// Default avatar as data URI (simple user icon)
const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#062a54"/><circle cx="20" cy="16" r="7" fill="white"/><ellipse cx="20" cy="35" rx="12" ry="10" fill="white"/></svg>');

function sanitizeMessage(text) {
    // Basic XSS prevention
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================================
// BADGE CALCULATION
// =============================================================

function getBadgeForMessageCount(count) {
    if (count >= BADGE_THRESHOLDS.platinum.min) return 'platinum';
    if (count >= BADGE_THRESHOLDS.gold.min) return 'gold';
    if (count >= BADGE_THRESHOLDS.silver.min) return 'silver';
    if (count >= BADGE_THRESHOLDS.bronze.min) return 'bronze';
    return null;
}

function renderBadge(badgeType) {
    if (!badgeType) return '';
    const badge = BADGE_THRESHOLDS[badgeType];
    return `<span class="bee-badge ${badgeType}">${badge.icon}</span>`;
}

// =============================================================
// CHANNEL RENDERING
// =============================================================

function renderChannels() {
    // Faculty channels
    const facultyContainer = document.getElementById('faculty-channels');
    if (facultyContainer) {
        facultyContainer.innerHTML = CHANNELS.faculty.map(ch => `
            <div class="channel-item" data-channel-id="${ch.id}">
                <span class="channel-icon">${ch.icon}</span>
                <span class="channel-name">${ch.name}</span>
            </div>
        `).join('');
    }

    // Campus channels
    const campusContainer = document.getElementById('campus-channels');
    if (campusContainer) {
        campusContainer.innerHTML = CHANNELS.campus.map(ch => `
            <div class="channel-item" data-channel-id="${ch.id}">
                <span class="channel-icon">${ch.icon}</span>
                <span class="channel-name">${ch.name}</span>
            </div>
        `).join('');
    }

    // General channels
    const generalContainer = document.getElementById('general-channels');
    if (generalContainer) {
        generalContainer.innerHTML = CHANNELS.general.map(ch => `
            <div class="channel-item" data-channel-id="${ch.id}">
                <span class="channel-icon">${ch.icon}</span>
                <span class="channel-name">${ch.name}</span>
            </div>
        `).join('');
    }

    // Add click listeners
    document.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channelId = item.dataset.channelId;
            selectChannel(channelId);
        });
    });
}

function selectChannel(channelId) {
    // Find channel info
    const allChannels = [...CHANNELS.faculty, ...CHANNELS.campus, ...CHANNELS.general];
    const channel = allChannels.find(ch => ch.id === channelId);

    if (!channel) return;

    // Update state
    currentChannel = channelId;

    // Update UI
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.toggle('active', item.dataset.channelId === channelId);
    });

    channelName.textContent = channel.name;
    channelIcon.textContent = channel.icon;

    // Hide welcome, show messages
    welcomeState.style.display = 'none';
    messageList.style.display = 'flex';

    // Enable input if user is logged in
    if (currentUser) {
        messageInput.disabled = false;
        messageInput.placeholder = `#${channel.name} kanalına mesaj yaz...`;
        sendBtn.disabled = false;
    }

    // Subscribe to messages
    subscribeToMessages(channelId);

    // Close mobile sidebar
    channelSidebar.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('active');
}

// =============================================================
// REAL-TIME MESSAGES
// =============================================================

function subscribeToMessages(channelId) {
    // Unsubscribe from previous channel
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const messagesRef = collection(db, 'channels', channelId, 'messages');
    // --- YENİ KOD BAŞLANGIÇ ---
    // Şu andan 10 dakika öncesini hesapla
    const onDakikaOnce = new Date(Date.now() - 10 * 60 * 1000);

    const q = query(
        messagesRef,
        where('createdAt', '>', onDakikaOnce), // Sadece son 10 dakikayı getir
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    // --- YENİ KOD BİTİŞ ---
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).reverse(); // Oldest first

        renderMessages(messages);
    }, (error) => {
        console.error('Error listening to messages:', error);
    });
}

function renderMessages(messages) {
    // ...
    messageList.innerHTML = messages.map(msg => {
        // ... (badge tanımları vs)

        // --- DEĞİŞİKLİK BURADA ---
        // Veritabanındaki isim yerine, eğer kullanıcı bizsek güncel ismi kullan
        let displayName = msg.userName || 'Anonim';

        // Eğer mesajın sahibi şu anki kullanıcı ise, güncel auth bilgisini kullan
        if (currentUser && msg.userId === currentUser.uid) {
            displayName = currentUser.displayName || displayName;
        }
        // -------------------------

        // Aşağıdaki ${sanitizeMessage(msg.userName)} kısmını ${sanitizeMessage(displayName)} yap
        return `
            <div class="message-item" ...>
                ...
                    <div class="message-header">
                        <span class="message-author">${sanitizeMessage(displayName)}</span>
                        ...
                    </div>
                ...
            </div>
        `;
    }).join('');
    // ...
}

function formatTime(timestamp) {
    if (!timestamp) return '';

    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Within last hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return mins <= 1 ? 'şimdi' : `${mins} dk önce`;
        }

        // Today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }

        // This week
        if (diff < 604800000) {
            return date.toLocaleDateString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }

        // Older
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch (error) {
        return '';
    }
}

// =============================================================
// SEND MESSAGE
// =============================================================

async function sendMessage(text) {
    if (!currentChannel || !currentUser || !text.trim()) return;

    // Check for bad words
    if (containsBadWords(text)) {
        alert('Mesajınız uygunsuz içerik barındırıyor. Lütfen düzenleyin.');
        return;
    }

    // Check if user has @itu.edu.tr email
    const email = currentUser.email || '';
    if (!email.endsWith('@itu.edu.tr')) {
        alert('Sadece @itu.edu.tr hesapları mesaj gönderebilir.');
        return;
    }

    try {
        // Get user's message count for badge
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.exists() ? userDoc.data() : {};
        const messageCount = (userData.messageCount || 0) + 1;

        // --- DÜZELTME BURADA BAŞLIYOR ---
        // 1. ÖNCE TARİHİ HESAPLIYORUZ (Bu satır eksikti)
        const imhaTarihi = new Date();
        imhaTarihi.setMinutes(imhaTarihi.getMinutes() + 10); // 10 dakika ekle
        // --------------------------------

        // Add message
        await addDoc(collection(db, 'channels', currentChannel, 'messages'), {
            text: text.trim(),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonim',
            userPhoto: currentUser.photoURL || null,
            userMessageCount: messageCount,
            createdAt: serverTimestamp(),
            expireAt: imhaTarihi // 2. SONRA BURADA KULLANIYORUZ
        });

        // Update user's message count
        await setDoc(userDocRef, {
            messageCount: messageCount,
            lastSeen: serverTimestamp()
        }, { merge: true });

        // Clear input
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
}

// =============================================================
// ONLINE USERS
// =============================================================

function subscribeToOnlineUsers() {
    if (unsubscribeOnlineUsers) {
        unsubscribeOnlineUsers();
    }

    const usersRef = collection(db, 'userStatus');
    const q = query(usersRef, orderBy('lastChanged', 'desc'), limit(20));

    unsubscribeOnlineUsers = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.status !== 'offline');

        renderOnlineUsers(users);
        onlineCount.textContent = users.length;
    }, (error) => {
        console.error('Error listening to online users:', error);
    });
}

function renderOnlineUsers(users) {
    const container = document.getElementById('online-users-list');
    if (!container) return;

    if (!users.length) {
        container.innerHTML = '<div class="empty-users">Henüz kimse çevrimiçi değil</div>';
        return;
    }

    container.innerHTML = users.map(user => {
        const status = STATUS_OPTIONS[user.status] || STATUS_OPTIONS.online;
        const badge = getBadgeForMessageCount(user.messageCount || 0);

        return `
            <div class="user-item">
                <img class="user-avatar" src="${user.photoURL || DEFAULT_AVATAR}" alt="Avatar" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="user-info">
                    <span class="user-name">${sanitizeMessage(user.displayName || 'Kullanıcı')}</span>
                    <span class="user-status">${status.icon} ${status.text}</span>
                </div>
                ${badge ? `<span class="user-badge">${BADGE_THRESHOLDS[badge].icon}</span>` : ''}
            </div>
        `;
    }).join('');
}

// =============================================================
// USER STATUS
// =============================================================

async function updateUserStatus(status) {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, 'userStatus', currentUser.uid), {
            status: status,
            displayName: currentUser.displayName || 'Kullanıcı',
            photoURL: currentUser.photoURL || null,
            lastChanged: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

function updateMyStatusUI(user) {
    const avatar = document.getElementById('my-avatar');
    const name = document.getElementById('my-name');
    const statusSelect = document.getElementById('status-select');
    const badgeContainer = document.getElementById('my-badge');

    if (user) {
        avatar.src = user.photoURL || DEFAULT_AVATAR;
        name.textContent = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
        statusSelect.disabled = false;

        // Get user data for badge
        getDoc(doc(db, 'users', user.uid)).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const badge = getBadgeForMessageCount(data.messageCount || 0);
                if (badge) {
                    badgeContainer.innerHTML = `${BADGE_THRESHOLDS[badge].icon} ${BADGE_THRESHOLDS[badge].label}`;
                    badgeContainer.classList.add('visible');
                }
            }
        });
    } else {
        avatar.src = DEFAULT_AVATAR;
        name.textContent = 'Giriş Yapın';
        statusSelect.disabled = true;
        badgeContainer.classList.remove('visible');
    }
}

// =============================================================
// MOBILE SIDEBAR HANDLING
// =============================================================

function setupMobileHandlers() {
    const mobileChannelsBtn = document.getElementById('mobile-channels-btn');
    const toggleUsersBtn = document.getElementById('toggle-users-btn');

    // Create overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        mainContent.appendChild(overlay);
    }

    // Toggle channels sidebar
    mobileChannelsBtn?.addEventListener('click', () => {
        channelSidebar.classList.toggle('open');
        usersSidebar.classList.remove('open');
        overlay.classList.toggle('active', channelSidebar.classList.contains('open'));
    });

    // Toggle users sidebar
    toggleUsersBtn?.addEventListener('click', () => {
        usersSidebar.classList.toggle('open');
        channelSidebar.classList.remove('open');
        overlay.classList.toggle('active', usersSidebar.classList.contains('open'));
    });

    // Close on overlay click
    overlay.addEventListener('click', () => {
        channelSidebar.classList.remove('open');
        usersSidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

// =============================================================
// INITIALIZATION
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Render channels
    renderChannels();

    // Setup mobile handlers
    setupMobileHandlers();

    // Message form submit
    messageForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value;
        if (text.trim()) {
            await sendMessage(text);
        }
    });

    // Status change
    document.getElementById('status-select')?.addEventListener('change', (e) => {
        updateUserStatus(e.target.value);
    });

    // Show content
    if (loadingOverlay && mainContent) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user) {
        console.log('User logged in:', user.email);

        // Update UI
        updateMyStatusUI(user);

        // Set online status
        updateUserStatus('online');

        // Enable input if channel selected
        if (currentChannel) {
            messageInput.disabled = false;
            sendBtn.disabled = false;
        }

        // Subscribe to online users
        subscribeToOnlineUsers();

        // Update input hint
        const inputHint = document.getElementById('input-hint');
        if (inputHint && user.email?.endsWith('@itu.edu.tr')) {
            inputHint.style.display = 'none';
        }
    } else {
        console.log('User logged out');

        // Update UI
        updateMyStatusUI(null);

        // Disable input
        messageInput.disabled = true;
        messageInput.placeholder = 'Mesaj göndermek için giriş yapın...';
        sendBtn.disabled = true;
    }
});

// Set offline status when leaving
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        // Note: This may not always fire due to browser restrictions
        // Consider using Firebase Presence for more reliable offline detection
        updateUserStatus('offline');
    }
});
