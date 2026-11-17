// Elemen DOM Utama
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const messagesList = document.getElementById('messagesList');
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeGreeting = document.getElementById('welcomeGreeting');
const chatContainer = document.getElementById('chatContainer');
const activeChatTitle = document.getElementById('activeChatTitle');

// Elemen Sidebar & History
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const deleteCurrentChatBtn = document.getElementById('deleteCurrentChatBtn');
const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
const historyList = document.getElementById('historyList');
const historySearchInput = document.getElementById('historySearchInput');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Elemen Profil Pengguna
const openProfileModalBtn = document.getElementById('openProfileModalBtn');
const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');
const profileModal = document.getElementById('profileModal');
const profileForm = document.getElementById('profileForm');
const userNameInput = document.getElementById('userNameInput');
const userRoleInput = document.getElementById('userRoleInput');
const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
const sidebarUserName = document.getElementById('sidebarUserName');
const sidebarUserRole = document.getElementById('sidebarUserRole');

// Kunci Penyimpanan LocalStorage (Agar History Tetap Ada Saat Keluar/Refresh)
const STORAGE_KEYS = {
    SESSIONS: 'lumina_ai_sessions_v1',
    ACTIVE_ID: 'lumina_ai_active_session_id_v1',
    PROFILE: 'lumina_ai_user_profile_v1',
    THEME: 'lumina_ai_theme_v1'
};

// State Aplikasi
let chatSessions = [];
let activeSessionId = null;
let userProfile = {
    name: 'Zain',
    role: 'Pro Member • Aktif'
};
let abortController = null;
let isStreaming = false;

// ==========================================
// 1. INISIALISASI TEMA & PROFIL PENGGUNA
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
});

function getInitials(name) {
    const parts = String(name || 'User').trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
}

function loadUserProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.name) {
                userProfile = {
                    name: parsed.name.trim(),
                    role: (parsed.role || 'Pro Member • Aktif').trim()
                };
            }
        }
    } catch (_) {
        // Gunakan profil default jika gagal parse
    }
    renderUserProfile();
}

function saveUserProfile() {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));
    renderUserProfile();
    // Perbarui nama & inisial di bubble chat yang sedang tampil
    renderActiveSessionMessages();
}

function renderUserProfile() {
    const initials = getInitials(userProfile.name);
    sidebarUserAvatar.textContent = initials;
    sidebarUserName.textContent = userProfile.name;
    sidebarUserRole.textContent = userProfile.role;
    welcomeGreeting.textContent = `Halo, ${userProfile.name}!`;
}

// Modal Profil Pengguna
function toggleProfileModal(show) {
    if (show) {
        userNameInput.value = userProfile.name;
        userRoleInput.value = userProfile.role;
        profileModal.classList.remove('hidden');
        userNameInput.focus();
    } else {
        profileModal.classList.add('hidden');
    }
}

openProfileModalBtn.addEventListener('click', () => toggleProfileModal(true));
closeProfileModalBtn.addEventListener('click', () => toggleProfileModal(false));
cancelProfileBtn.addEventListener('click', () => toggleProfileModal(false));
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) toggleProfileModal(false);
});

profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = userNameInput.value.trim();
    const newRole = userRoleInput.value.trim() || 'Pro Member • Aktif';
    if (!newName) return;
    userProfile = { name: newName, role: newRole };
    saveUserProfile();
    toggleProfileModal(false);
});

// ==========================================
// 2. MANAJEMEN SESI & HISTORY CHAT (PERSISTENT)
