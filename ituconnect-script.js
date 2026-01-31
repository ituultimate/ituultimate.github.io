/**
 * ITU Connect - Campus Social Platform Script
 * Real-time chat with Firebase Firestore
 * 
 * Features:
 * - Real-time message subscription
 * - Heartbeat-based presence system
 * - Client-side message filtering (10 min expiry)
 * - Bee badge system based on message count
 * - Typing indicators
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
    onSnapshot,
    serverTimestamp,
    Timestamp,
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

// Status options with Turkish display text
const STATUS_OPTIONS = {
    online: { text: 'Çevrimiçi', color: '#28a745', icon: '🟢' },
    library: { text: 'Kütüphanede', color: '#007bff', icon: '📚' },
    cafeteria: { text: 'Yemekhanede', color: '#fd7e14', icon: '🍽️' },
    classroom: { text: 'Derste', color: '#6f42c1', icon: '📖' },
    offline: { text: 'Çevrimdışı', color: '#6c757d', icon: '⚫' }
};

// Badge thresholds for message count
const BADGE_THRESHOLDS = {
    bronze: { min: 10, icon: '🐝', label: 'Bronze Bee' },
    silver: { min: 50, icon: '🥈🐝', label: 'Silver Bee' },
    gold: { min: 200, icon: '🥇🐝', label: 'Gold Bee' },
    platinum: { min: 500, icon: '👑🐝', label: 'Platinum Bee' }
};

// Heartbeat configuration for presence system
const HEARTBEAT_INTERVAL_MS = 60000; // 60 seconds
const ONLINE_THRESHOLD_MS = 180000; // 3 minutes - users older than this are considered offline
const MESSAGE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Application state
let currentUser = null;
let currentChannel = null;
let unsubscribeMessages = null;
let unsubscribeOnlineUsers = null;
let heartbeatInterval = null;
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

/**
 * Check if text contains any bad words
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains bad words
 */
function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

// Default avatar as data URI (simple user icon)
const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#062a54"/><circle cx="20" cy="16" r="7" fill="white"/><ellipse cx="20" cy="35" rx="12" ry="10" fill="white"/></svg>');

// =============================================================
// RATE LIMITING
// =============================================================

const RATE_LIMIT = {
    maxMessages: 10,
    windowMs: 60000,
    userHistory: new Map()
};

/**
 * Debounce helper function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
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

/**
 * Check if user is within rate limit
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if within rate limit
 */
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

/**
 * Sanitize message text to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeMessage(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Validate message before sending
 * @param {string} text - Message text
 * @returns {Object} - Validation result with valid flag and error message
 */
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

/**
 * Get badge type based on message count
 * @param {number} count - Message count
 * @returns {string|null} - Badge type or null
 */
function getBadgeForMessageCount(count) {
    if (count >= BADGE_THRESHOLDS.platinum.min) return 'platinum';
    if (count >= BADGE_THRESHOLDS.gold.min) return 'gold';
    if (count >= BADGE_THRESHOLDS.silver.min) return 'silver';
    if (count >= BADGE_THRESHOLDS.bronze.min) return 'bronze';
    return null;
}

/**
 * Render badge HTML
 * @param {string} badgeType - Badge type
 * @returns {string} - HTML string for badge
 */
function renderBadge(badgeType) {
    if (!badgeType) return '';
    const badge = BADGE_THRESHOLDS[badgeType];
    return `<span class="bee-badge ${badgeType}">${badge.icon}</span>`;
}

// =============================================================
// TYPING INDICATOR
// =============================================================

/**
 * Show typing indicator with user names
 * @param {Array} users - Array of user names who are typing
 */
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

    // Auto-hide after 3 seconds
    clearTimeout(typingIndicatorTimeout);
    typingIndicatorTimeout = setTimeout(() => {
        indicator.style.display = 'none';
    }, 3000);
}

/**
 * Send typing indicator to Firestore
 */
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

/**
 * Subscribe to typing users in current channel
 */
function subscribeToTypingUsers() {
    const typingRef = collection(db, 'channels', currentChannel, 'typing');

    onSnapshot(typingRef, (snapshot) => {
        const now = Date.now();
        const typingUsers = snapshot.docs
            .map(doc => doc.data())
            .filter(user => {
                const time = user.timestamp?.toDate?.() || user.timestamp;
                if (!time) return false;
                const diff = now - new Date(time).getTime();
                return diff < 3000; // Only show if typed within last 3 seconds
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

/**
 * Render all channel lists in sidebar
 */
function renderChannels() {
    // Faculty channels
    const facultyContainer = document.getElementById('faculty-channels');
    if (facultyContainer) {
        facultyContainer.innerHTML = CHANNELS.faculty.map(channel => `
            <div class="channel-item" data-channel-id="${channel.id}">
                <span class="channel-icon">${channel.icon}</span>
                <span class="channel-name">${channel.name}</span>
            </div>
        `).join('');
    }

    // Campus channels
    const campusContainer = document.getElementById('campus-channels');
    if (campusContainer) {
        campusContainer.innerHTML = CHANNELS.campus.map(channel => `
            <div class="channel-item" data-channel-id="${channel.id}">
                <span class="channel-icon">${channel.icon}</span>
                <span class="channel-name">${channel.name}</span>
            </div>
        `).join('');
    }

    // General channels
    const generalContainer = document.getElementById('general-channels');
    if (generalContainer) {
        generalContainer.innerHTML = CHANNELS.general.map(channel => `
            <div class="channel-item" data-channel-id="${channel.id}">
                <span class="channel-icon">${channel.icon}</span>
                <span class="channel-name">${channel.name}</span>
            </div>
        `).join('');
    }

    // Add click listeners to all channel items
    document.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channelId = item.dataset.channelId;
            selectChannel(channelId);
        });
    });
}

/**
 * Select a channel and subscribe to its messages
 * @param {string} channelId - Channel ID to select
 */
function selectChannel(channelId) {
    // Find channel info from all categories
    const allChannels = [...CHANNELS.faculty, ...CHANNELS.campus, ...CHANNELS.general];
    const channel = allChannels.find(ch => ch.id === channelId);

    if (!channel) return;

    // Update state
    currentChannel = channelId;

    // Update UI - highlight active channel
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

    // Subscribe to messages for this channel
    subscribeToMessages(channelId);

    // Subscribe to typing users
    subscribeToTypingUsers();

    // Close mobile sidebar
    channelSidebar.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('active');
}

// =============================================================
// REAL-TIME MESSAGES (Client-side filtering)
// =============================================================

/**
 * Subscribe to messages for a channel
 * Fetches last 50 messages and filters by time client-side
 * @param {string} channelId - Channel ID to subscribe to
 */
function subscribeToMessages(channelId) {
    // Unsubscribe from previous channel
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    // Reset pagination state
    messages = [];
    lastVisibleMessage = null;
    isLoadingMore = false;

    const messagesRef = collection(db, 'channels', channelId, 'messages');

    // Query without time filter - fetch last 50 messages
    // Time filtering is done client-side to avoid Firestore index requirements
    const messagesQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const now = Date.now();
        const tenMinutesAgo = now - MESSAGE_EXPIRY_MS;

        // Client-side time filtering - hide messages older than 10 minutes
        messages = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(msg => {
                const messageTime = msg.createdAt?.toDate?.() || new Date(0);
                return messageTime.getTime() > tenMinutesAgo;
            })
            .reverse(); // Oldest first for display order

        if (snapshot.docs.length > 0) {
            lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
        }

        renderMessages(messages);
    }, (error) => {
        console.error('Error listening to messages:', error);
        toast.error('Mesajlar yüklenirken hata oluştu');
    });
}

/**
 * Load more messages for pagination
 */
async function loadMoreMessages() {
    if (isLoadingMore || !lastVisibleMessage || !currentChannel) return;

    isLoadingMore = true;
    const loadingIndicator = document.getElementById('loading-more-messages');

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    try {
        const messagesRef = collection(db, 'channels', currentChannel, 'messages');
        const now = Date.now();
        const tenMinutesAgo = now - MESSAGE_EXPIRY_MS;

        // Query for more messages
        const moreMessagesQuery = query(
            messagesRef,
            orderBy('createdAt', 'desc'),
            startAfter(lastVisibleMessage),
            limit(30)
        );

        const snapshot = await getDocs(moreMessagesQuery);

        // Client-side filtering for older messages too
        const newMessages = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(msg => {
                const messageTime = msg.createdAt?.toDate?.() || new Date(0);
                return messageTime.getTime() > tenMinutesAgo;
            })
            .reverse();

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

/**
 * Render messages to the DOM
 * @param {Array} messageList - Array of messages to render
 */
function renderMessages(messagesToRender) {
    const previousScrollHeight = messagesContainer.scrollHeight;
    const wasScrolledToBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50;

    if (!messagesToRender.length) {
        messageList.innerHTML = `
            <div class="empty-messages">
                <p>Bu kanalda henüz mesaj yok. İlk mesajı sen yaz! 🐝</p>
            </div>
        `;
        return;
    }

    messageList.innerHTML = messagesToRender.map(msg => {
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

/**
 * Format timestamp for display
 * @param {Timestamp} timestamp - Firestore timestamp
 * @returns {string} - Formatted time string
 */
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

/**
 * Send a message to the current channel
 * @param {string} text - Message text
 */
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
        // Get user's message count for badge calculation
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.exists() ? userDoc.data() : {};
        const messageCount = (userData.messageCount || 0) + 1;

        // Calculate message expiration date (10 minutes from now)
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 10);

        // Add message to Firestore
        await addDoc(collection(db, 'channels', currentChannel, 'messages'), {
            text: sanitizeMessage(text.trim()),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonim',
            userPhoto: currentUser.photoURL || null,
            userMessageCount: messageCount,
            createdAt: serverTimestamp(),
            expireAt: expirationDate
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
        await deleteDoc(typingRef).catch(() => { });
    } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
}

// =============================================================
// HEARTBEAT PRESENCE SYSTEM
// =============================================================

/**
 * Send heartbeat to update user's lastSeen timestamp
 * This is more reliable than onDisconnect for Firestore
 */
async function sendHeartbeat() {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, 'userStatus', currentUser.uid), {
            status: 'online',
            displayName: currentUser.displayName || 'Kullanıcı',
            photoURL: currentUser.photoURL || null,
            lastSeen: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Heartbeat failed:', error);
    }
}

/**
 * Start the heartbeat interval
 * Updates lastSeen every 60 seconds
 */
function startHeartbeat() {
    if (heartbeatInterval || !currentUser) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up periodic heartbeat every 60 seconds
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop the heartbeat interval
 */
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

/**
 * Set user status to offline before page unload
 */
function setOfflineStatus() {
    if (!currentUser) return;

    // Use sendBeacon for reliable delivery during page unload
    const statusData = JSON.stringify({
        status: 'offline',
        lastSeen: new Date().toISOString()
    });

    // Note: This is a best-effort attempt - the heartbeat system
    // handles the main presence detection
    navigator.sendBeacon?.('/api/offline', statusData);
}

// =============================================================
// ONLINE USERS (Heartbeat-based filtering)
// =============================================================

/**
 * Subscribe to online users with client-side filtering
 * Filters out users whose lastSeen is older than 3 minutes
 */
function subscribeToOnlineUsers() {
    if (unsubscribeOnlineUsers) {
        unsubscribeOnlineUsers();
    }

    const usersRef = collection(db, 'userStatus');
    const usersQuery = query(usersRef, orderBy('lastSeen', 'desc'), limit(30));

    unsubscribeOnlineUsers = onSnapshot(usersQuery, (snapshot) => {
        const now = Date.now();

        // Client-side filtering - only show users with recent lastSeen
        const users = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user => {
                const lastSeen = user.lastSeen?.toDate?.() || new Date(0);
                const timeSinceLastSeen = now - lastSeen.getTime();
                return timeSinceLastSeen < ONLINE_THRESHOLD_MS;
            });

        renderOnlineUsers(users);
        onlineCount.textContent = users.length;
    }, (error) => {
        console.error('Error listening to online users:', error);
    });
}

/**
 * Render online users list
 * @param {Array} users - Array of online users
 */
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

/**
 * Debounced status update to prevent excessive writes
 */
const debouncedUpdateStatus = debounce(async (status) => {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, 'userStatus', currentUser.uid), {
            status: status,
            displayName: currentUser.displayName || 'Kullanıcı',
            photoURL: currentUser.photoURL || null,
            lastSeen: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating status:', error);
    }
}, 500);

/**
 * Update user status
 * @param {string} status - New status value
 */
async function updateUserStatus(status) {
    await debouncedUpdateStatus(status);
}

/**
 * Update the user's status UI section
 * @param {Object} user - Firebase user object
 */
function updateMyStatusUI(user) {
    const avatar = document.getElementById('my-avatar');
    const name = document.getElementById('my-name');
    const statusSelect = document.getElementById('status-select');
    const badgeContainer = document.getElementById('my-badge');

    if (user) {
        avatar.src = user.photoURL || DEFAULT_AVATAR;
        name.textContent = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
        statusSelect.disabled = false;

        // Get user data for badge display
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

/**
 * Set up mobile sidebar toggle handlers
 */
function setupMobileHandlers() {
    const mobileChannelsBtn = document.getElementById('mobile-channels-btn');
    const toggleUsersBtn = document.getElementById('toggle-users-btn');

    // Create overlay element
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

    // Close sidebars on overlay click
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
    // Render channel list
    renderChannels();

    // Set up mobile handlers
    setupMobileHandlers();

    // Message form submit handler
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

    // Status change handler
    document.getElementById('status-select')?.addEventListener('change', (e) => {
        updateUserStatus(e.target.value);
    });

    // Infinite scroll for loading more messages
    messagesContainer?.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop < 50) {
            loadMoreMessages();
        }
    });

    // Handle page unload - attempt to set offline status
    window.addEventListener('beforeunload', setOfflineStatus);

    // Show main content
    if (loadingOverlay && mainContent) {
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
});

// =============================================================
// AUTH STATE LISTENER
// =============================================================

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user) {
        // Start heartbeat for presence
        startHeartbeat();

        // Update UI
        updateMyStatusUI(user);

        // Set online status
        updateUserStatus('online');

        // Enable input if channel is already selected
        if (currentChannel) {
            messageInput.disabled = false;
            sendBtn.disabled = false;
        }

        // Subscribe to online users
        subscribeToOnlineUsers();

        // Hide input hint for ITU users
        const inputHint = document.getElementById('input-hint');
        if (inputHint && user.email?.endsWith('@itu.edu.tr')) {
            inputHint.style.display = 'none';
        }
    } else {
        // Stop heartbeat
        stopHeartbeat();

        // Update UI
        updateMyStatusUI(null);

        // Disable input
        messageInput.disabled = true;
        messageInput.placeholder = 'Mesaj göndermek için giriş yapın...';
        sendBtn.disabled = true;
    }
});
