/**
 * ITU Connect - Campus Social Platform Script
 * Real-time chat with Firebase Firestore
 */
import { auth, db } from './firebase-config.js';
import toast from './toast-notifications.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    onDisconnect,
    runTransaction,
    startAfter
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
let unsubscribePresence = null;
let typingTimeout = null;
let typingIndicatorTimeout = null;
let messages = [];
let lastVisibleMessage = null;
let isLoadingMore = false;

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

// Rate limiting configuration
const RATE_LIMIT = {
    maxMessages: 10,
    windowMs: 60000,
    userHistory: new Map()
};

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Rate limiter
function checkRateLimit(userId) {
    const now = Date.now();
    const history = RATE_LIMIT.userHistory.get(userId) || [];

    const recentMessages = history.filter(time => now - time < RATE_LIMIT.windowMs);

    if (recentMessages.length >= RATE_LIMIT.maxMessages) {
        return false;
    }

    recentMessages.push(now);
    RATE_LIMIT.userHistory.set(userId, recentMessages);
    return true;
}

function sanitizeMessage(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function validateMessage(text) {
    if (!text || !text.trim()) {
        return { valid: false, error: 'Mesaj boş olamaz' };
    }

    if (text.trim().length > 500) {
        return { valid: false, error: 'Mesaj çok uzun (maksimum 500 karakter)' };
    }

    if (containsBadWords(text)) {
        return { valid: false, error: 'Mesajınız uygunsuz içerik barındırıyor' };
    }

    return { valid: true };
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
// TYPING INDICATOR
// =============================================================

function showTypingIndicator(users) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;

    if (!users || users.length === 0) {
        indicator.style.display = 'none';
        return;
    }

    const typingText = indicator.querySelector('.typing-text');
    if (users.length === 1) {
        typingText.textContent = `${users[0]} yazıyor...`;
    } else if (users.length === 2) {
        typingText.textContent = `${users[0]} ve ${users[1]} yazıyor...`;
    } else {
        typingText.textContent = `${users.length} kişi yazıyor...`;
    }

    indicator.style.display = 'flex';

    clearTimeout(typingIndicatorTimeout);
    typingIndicatorTimeout = setTimeout(() => {
        indicator.style.display = 'none';
    }, 3000);
}

function sendTypingIndicator() {
    if (!currentChannel || !currentUser) return;

    const typingRef = doc(db, 'channels', currentChannel, 'typing', currentUser.uid);
    setDoc(typingRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Kullanıcı',
        timestamp: serverTimestamp()
    }).catch(error => {
        console.error('Error sending typing indicator:', error);
    });
}

function subscribeToTypingUsers() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const typingRef = collection(db, 'channels', currentChannel, 'typing');

    unsubscribeMessages = onSnapshot(typingRef, (snapshot) => {
        const now = Date.now();
        const typingUsers = snapshot.docs
            .map(doc => doc.data())
            .filter(user => {
                const time = user.timestamp?.toDate?.() || user.timestamp;
                if (!time) return false;
                const diff = now - new Date(time).getTime();
                return diff < 3000;
            })
            .filter(user => user.userId !== currentUser?.uid)
            .map(user => user.userName);

        showTypingIndicator(typingUsers);
    }, (error) => {
        console.error('Error listening to typing users:', error);
    });
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

    // Subscribe to typing users
    subscribeToTypingUsers();

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

    // Reset pagination
    messages = [];
    lastVisibleMessage = null;
    isLoadingMore = false;

    const messagesRef = collection(db, 'channels', channelId, 'messages');
    // Only get messages from last 10 minutes (database limit)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const q = query(
        messagesRef,
        where('createdAt', '>', tenMinutesAgo),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).reverse(); // Oldest first

        if (snapshot.docs.length > 0) {
            lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
        }

        renderMessages(messages);
    }, (error) => {
        console.error('Error listening to messages:', error);
        toast.error('Mesajlar yüklenirken hata oluştu');
    });
}

async function loadMoreMessages() {
    if (isLoadingMore || !lastVisibleMessage || !currentChannel) return;

    isLoadingMore = true;
    const loadingIndicator = document.getElementById('loading-more-messages');

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    try {
        const messagesRef = collection(db, 'channels', currentChannel, 'messages');
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const q = query(
            messagesRef,
            where('createdAt', '>', tenMinutesAgo),
            orderBy('createdAt', 'desc'),
            startAfter(lastVisibleMessage),
            limit(30)
        );

        const snapshot = await getDocs(q);

        const newMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).reverse();

        if (newMessages.length > 0) {
            messages = [...newMessages, ...messages];
            lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
            renderMessages(messages);
        }

        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading more messages:', error);
        toast.error('Daha fazla mesaj yüklenirken hata oluştu');
    } finally {
        isLoadingMore = false;
    }
}

function renderMessages(messages) {
    const previousScrollHeight = messagesContainer.scrollHeight;
    const wasScrolledToBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50;

    if (!messages.length) {
        messageList.innerHTML = `
            <div class="empty-messages">
                <p>Bu kanalda henüz mesaj yok. İlk mesajı sen yaz! 🐝</p>
            </div>
        `;
        return;
    }

    messageList.innerHTML = messages.map(msg => {
        const badge = getBadgeForMessageCount(msg.userMessageCount || 0);
        const time = formatTime(msg.createdAt);
        const avatarUrl = msg.userPhoto || DEFAULT_AVATAR;

        return `
            <div class="message-item" data-message-id="${msg.id}">
                <img class="message-avatar" src="${avatarUrl}" alt="Avatar" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${sanitizeMessage(msg.userName || 'Anonim')}</span>
                        ${renderBadge(badge)}
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${sanitizeMessage(msg.text)}</div>
                </div>
            </div>
        `;
    }).join('');

    // Maintain scroll position when loading more messages
    if (previousScrollHeight !== messagesContainer.scrollHeight) {
        if (wasScrolledToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            messagesContainer.scrollTop = messagesContainer.scrollHeight - previousScrollHeight;
        }
    } else {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    if (!currentChannel || !currentUser || !text.trim()) {
        toast.error('Kanal seçin ve giriş yapın');
        return;
    }

    // Check if user has @itu.edu.tr email
    const email = currentUser.email || '';
    if (!email.endsWith('@itu.edu.tr')) {
        toast.error('Sadece @itu.edu.tr hesapları mesaj gönderebilir.');
        return;
    }

    // Validate message
    const validation = validateMessage(text);
    if (!validation.valid) {
        toast.error(validation.error);
        return;
    }

    // Check rate limit
    if (!checkRateLimit(currentUser.uid)) {
        toast.warning('Çok fazla mesaj gönderiyorsunuz. Lütfen bekleyin.');
        return;
    }

    try {
        // Get user's message count for badge
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.exists() ? userDoc.data() : {};
        const messageCount = (userData.messageCount || 0) + 1;

        // Calculate expiration date (10 minutes from now)
        const expireDate = new Date();
        expireDate.setMinutes(expireDate.getMinutes() + 10);

        // Add message with 10-minute expiration
        await addDoc(collection(db, 'channels', currentChannel, 'messages'), {
            text: sanitizeMessage(text.trim()),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonim',
            userPhoto: currentUser.photoURL || null,
            userMessageCount: messageCount,
            createdAt: serverTimestamp(),
            expireAt: expireDate
        });

        // Update user's message count
        await setDoc(userDocRef, {
            messageCount: messageCount,
            lastSeen: serverTimestamp()
        }, { merge: true });

        // Clear input
        messageInput.value = '';

        // Remove typing indicator
        const typingRef = doc(db, 'channels', currentChannel, 'typing', currentUser.uid);
        await deleteDoc(typingRef).catch(() => {});
    } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
}

// =============================================================
// FIREBASE PRESENCE (Reliable Online/Offline Detection)
// =============================================================

function setupFirebasePresence() {
    if (!currentUser || unsubscribePresence) return;

    const presenceRef = doc(db, 'userStatus', currentUser.uid);
    const onlineRef = doc(db, '.info/connected');

    const unsubscribeConnected = onSnapshot(onlineRef, (snapshot) => {
        if (snapshot.data()?.connected === true) {
            const presenceData = {
                status: 'online',
                displayName: currentUser.displayName || 'Kullanıcı',
                photoURL: currentUser.photoURL || null,
                messageCount: 0,
                lastChanged: serverTimestamp()
            };

            onDisconnect(presenceRef).set({
                status: 'offline',
                displayName: currentUser.displayName || 'Kullanıcı',
                photoURL: currentUser.photoURL || null,
                messageCount: 0,
                lastChanged: serverTimestamp()
            });

            setDoc(presenceRef, presenceData, { merge: true });
        }
    });

    unsubscribePresence = () => unsubscribeConnected();
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

const debouncedUpdateStatus = debounce(async (status) => {
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
}, 500);

async function updateUserStatus(status) {
    await debouncedUpdateStatus(status);
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

    // Typing indicator on input
    messageInput?.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            sendTypingIndicator();
        }, 300);
    });

    // Status change
    document.getElementById('status-select')?.addEventListener('change', (e) => {
        updateUserStatus(e.target.value);
    });

    // Infinite scroll for messages
    messagesContainer?.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop < 50) {
            loadMoreMessages();
        }
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

        // Setup Firebase Presence
        setupFirebasePresence();

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

        // Unsubscribe from presence
        if (unsubscribePresence) {
            unsubscribePresence();
            unsubscribePresence = null;
        }

        // Update UI
        updateMyStatusUI(null);

        // Disable input
        messageInput.disabled = true;
        messageInput.placeholder = 'Mesaj göndermek için giriş yapın...';
        sendBtn.disabled = true;
    }
});

