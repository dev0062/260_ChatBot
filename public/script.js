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
// ==========================================
function loadSessionsFromStorage() {
    try {
        const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
        if (rawSessions) {
            const parsed = JSON.parse(rawSessions);
            if (Array.isArray(parsed)) {
                chatSessions = parsed;
            }
        }
    } catch (_) {
        chatSessions = [];
    }

    const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    if (savedActiveId && chatSessions.some((s) => s.id === savedActiveId)) {
        activeSessionId = savedActiveId;
    } else if (chatSessions.length > 0) {
        activeSessionId = chatSessions[0].id;
    } else {
        createNewSession(false);
    }
}

function saveSessionsToStorage() {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(chatSessions));
    if (activeSessionId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeSessionId);
    } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    }
}

function getActiveSession() {
    return chatSessions.find((s) => s.id === activeSessionId) || null;
}

function createNewSession(shouldRender = true) {
    if (isStreaming && abortController) {
        abortController.abort();
    }

    // Jika sesi aktif saat ini masih kosong (belum ada pesan), langsung gunakan sesi tersebut
    const current = getActiveSession();
    if (current && current.messages.length === 0) {
        if (shouldRender) {
            renderHistorySidebar();
            renderActiveSessionMessages();
            toggleSidebar(false);
            messageInput.focus();
        }
        return current;
    }

    const newSession = {
        id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: 'Percakapan Baru',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
    };

    chatSessions.unshift(newSession);
    activeSessionId = newSession.id;
    saveSessionsToStorage();

    if (shouldRender) {
        renderHistorySidebar();
        renderActiveSessionMessages();
        toggleSidebar(false);
        messageInput.focus();
    }

    return newSession;
}

function switchSession(sessionId) {
    if (isStreaming && abortController) {
        abortController.abort();
    }
    if (!chatSessions.some((s) => s.id === sessionId)) return;

    activeSessionId = sessionId;
    saveSessionsToStorage();
    renderHistorySidebar();
    renderActiveSessionMessages();
    toggleSidebar(false);
}

function deleteSession(sessionId, event) {
    if (event) {
        event.stopPropagation();
    }
    if (isStreaming && activeSessionId === sessionId && abortController) {
        abortController.abort();
    }

    chatSessions = chatSessions.filter((s) => s.id !== sessionId);

    if (activeSessionId === sessionId) {
        if (chatSessions.length > 0) {
            activeSessionId = chatSessions[0].id;
        } else {
            createNewSession(false);
        }
    }

    saveSessionsToStorage();
    renderHistorySidebar();
    renderActiveSessionMessages();
}

function clearAllSessions() {
    if (chatSessions.length === 0) return;
    if (!confirm('Hapus seluruh riwayat percakapan?')) return;

    if (isStreaming && abortController) {
        abortController.abort();
    }

    chatSessions = [];
    activeSessionId = null;
    createNewSession(false);
    saveSessionsToStorage();
    renderHistorySidebar();
    renderActiveSessionMessages();
}

function formatSessionDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (isToday) {
        return `Hari ini, ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
    });
    return `${dateStr}, ${timeStr}`;
}

function renderHistorySidebar() {
    const query = (historySearchInput.value || '').trim().toLowerCase();
    historyList.innerHTML = '';

    const filtered = chatSessions.filter((session) => {
        if (!query) return true;
        const inTitle = session.title.toLowerCase().includes(query);
        const inMessages = session.messages.some((m) =>
            (m.content || '').toLowerCase().includes(query)
        );
        return inTitle || inMessages;
    });

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.textContent = query
            ? 'Tidak ada riwayat yang cocok dengan pencarian.'
            : 'Belum ada riwayat percakapan.';
        historyList.appendChild(empty);
        return;
    }

    filtered.forEach((session) => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === activeSessionId ? 'active' : ''}`;
        item.addEventListener('click', () => switchSession(session.id));

        const msgCount = session.messages.length;
        const metaText = `${msgCount} pesan • ${formatSessionDate(session.updatedAt)}`;

        item.innerHTML = `
            <div class="history-item-left">
                <svg class="history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="history-text-wrap">
                    <div class="history-title">${escapeHtml(session.title)}</div>
                    <div class="history-meta">${escapeHtml(metaText)}</div>
                </div>
            </div>
            <button type="button" class="history-delete-btn" title="Hapus percakapan ini" aria-label="Hapus">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                </svg>
            </button>
        `;

        const delBtn = item.querySelector('.history-delete-btn');
        delBtn.addEventListener('click', (e) => deleteSession(session.id, e));

        historyList.appendChild(item);
    });
}

function renderActiveSessionMessages() {
    const session = getActiveSession();
    messagesList.innerHTML = '';

    if (!session || session.messages.length === 0) {
        activeChatTitle.textContent = 'Percakapan Baru';
        welcomeScreen.classList.remove('hidden');
        return;
    }

    activeChatTitle.textContent = session.title;
    welcomeScreen.classList.add('hidden');

    session.messages.forEach((msg) => {
        appendMessageElementToDOM(msg.role, msg.content, msg.time, msg.isError);
    });

    scrollToBottom();
}

// ==========================================
// 3. HELPER MARKDOWN & UI ELEMENT
// ==========================================
function getTimeString() {
    return new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderMarkdown(rawText) {
    if (!rawText) return '';

    let text = escapeHtml(rawText);

    // Code blocks ```lang ... ```
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
        const language = lang || 'code';
        return `
            <div class="code-block-wrapper">
                <div class="code-block-header">
                    <span>${language}</span>
                    <button type="button" class="copy-code-btn" onclick="copyCodeBlock(this)">Salin Kode</button>
                </div>
                <pre><code>${code.trim()}</code></pre>
            </div>
        `;
    });

    // Inline code
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    // Paragraphs
    const paragraphs = text.split(/\n{2,}/).map((block) => {
        if (block.trim().startsWith('<div class="code-block-wrapper">')) {
            return block;
        }
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    });

    return paragraphs.join('');
}

window.copyCodeBlock = function (btn) {
    const codeEl = btn.closest('.code-block-wrapper')?.querySelector('code');
    if (!codeEl) return;
    navigator.clipboard.writeText(codeEl.innerText).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Tersalin ✓';
        setTimeout(() => {
            btn.textContent = original;
        }, 1800);
    });
};

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessageElementToDOM(role, content = '', timeStr = '', isError = false) {
    welcomeScreen.classList.add('hidden');

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (role === 'user') {
        avatar.textContent = getInitials(userProfile.name);
    } else {
        avatar.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" stroke-linejoin="round"/>
                <polyline points="2 17 12 22 22 17" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="2 12 12 17 22 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }

    const wrap = document.createElement('div');
    wrap.className = 'message-bubble-wrap';

    const displayTime = timeStr || getTimeString();
    const senderName = role === 'user' ? userProfile.name : 'Lumina AI';

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = `${senderName} • ${displayTime}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (isError) {
        bubble.classList.add('error-bubble');
    }

    if (role === 'user') {
        bubble.textContent = content;
    } else if (!content) {
        bubble.innerHTML = `
            <div class="typing-indicator" aria-label="Sedang mengetik">
                <span></span><span></span><span></span>
            </div>
        `;
    } else {
        bubble.innerHTML = renderMarkdown(content);
    }

    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesList.appendChild(row);
    scrollToBottom();

    return bubble;
}

function setStreamingState(active) {
    isStreaming = active;
    stopBtn.classList.toggle('hidden', !active);
    sendBtn.classList.toggle('hidden', active);
    sendBtn.disabled = active || !messageInput.value.trim();
}

// ==========================================
// 4. EVENT LISTENERS & STREAMING KE /api/chat
// ==========================================
function toggleSidebar(open) {
    sidebar.classList.toggle('open', open);
    sidebarOverlay.classList.toggle('open', open);
}

openSidebarBtn.addEventListener('click', () => toggleSidebar(true));
closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

newChatBtn.addEventListener('click', () => createNewSession(true));
deleteCurrentChatBtn.addEventListener('click', () => {
    if (activeSessionId) {
        deleteSession(activeSessionId);
    }
});
clearAllHistoryBtn.addEventListener('click', clearAllSessions);
historySearchInput.addEventListener('input', renderHistorySidebar);

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
    sendBtn.disabled = !messageInput.value.trim() || isStreaming;
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            chatForm.requestSubmit();
        }
    }
});

stopBtn.addEventListener('click', () => {
    if (abortController) {
        abortController.abort();
    }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userText = messageInput.value.trim();
    if (!userText || isStreaming) return;

    let session = getActiveSession();
    if (!session) {
        session = createNewSession(false);
    }

    // Reset input box
    messageInput.value = '';
    messageInput.style.height = 'auto';

    const userTime = getTimeString();

    // Otomatis beri judul percakapan dari pesan pertama pengguna
    if (session.messages.length === 0) {
        session.title =
            userText.length > 36 ? userText.slice(0, 36).trim() + '...' : userText;
        activeChatTitle.textContent = session.title;
    }

    // Simpan pesan pengguna ke sesi & localStorage
    session.messages.push({
        role: 'user',
        content: userText,
        time: userTime
    });
    session.updatedAt = Date.now();

    // Pindahkan sesi yang baru aktif ke urutan paling atas di sidebar
    chatSessions = [session, ...chatSessions.filter((s) => s.id !== session.id)];
    saveSessionsToStorage();
    renderHistorySidebar();

    appendMessageElementToDOM('user', userText, userTime);

    // Siapkan payload messages hanya untuk pesan valid (bukan bubble error)
    const apiMessages = session.messages
        .filter((m) => !m.isError)
        .map((m) => ({
            role: m.role,
            content: m.content
        }));

    const aiTime = getTimeString();
    const aiBubble = appendMessageElementToDOM('assistant', '', aiTime);

    setStreamingState(true);
    abortController = new AbortController();

    let assistantReply = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: apiMessages
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson?.error) {
                    errorMessage =
                        typeof errJson.error === 'string'
                            ? errJson.error
                            : JSON.stringify(errJson.error);
                }
            } catch (_) {
                // Abaikan jika gagal parse JSON
            }
            throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(dataStr);

                    if (typeof parsed === 'string') {
                        assistantReply += parsed;
                        aiBubble.innerHTML = renderMarkdown(assistantReply);
                        scrollToBottom();
                    } else if (parsed && typeof parsed === 'object') {
                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                        if (parsed.content) {
                            assistantReply += parsed.content;
                            aiBubble.innerHTML = renderMarkdown(assistantReply);
                            scrollToBottom();
                        }
                    }
                } catch (parseErr) {
                    if (parseErr.message && !parseErr.message.includes('JSON')) {
                        throw parseErr;
                    }
                }
            }
        }

        const finalReply =
            assistantReply || '*Tidak ada teks respons yang diterima dari server.*';
        aiBubble.innerHTML = renderMarkdown(finalReply);

        session.messages.push({
            role: 'assistant',
            content: finalReply,
            time: getTimeString()
        });
        session.updatedAt = Date.now();
        saveSessionsToStorage();
        renderHistorySidebar();
    } catch (error) {
        if (error.name === 'AbortError') {
            const partial = assistantReply
                ? `${assistantReply}\n\n*(Respons dihentikan oleh pengguna)*`
                : '*(Respons dihentikan oleh pengguna)*';
            aiBubble.innerHTML = renderMarkdown(partial);
            session.messages.push({
                role: 'assistant',
                content: partial,
                time: getTimeString()
            });
        } else {
            const errText = `**Gagal mendapatkan respons dari server:**\n\`${error.message}\``;
            aiBubble.classList.add('error-bubble');
            aiBubble.innerHTML = renderMarkdown(errText);
            session.messages.push({
                role: 'assistant',
                content: errText,
                time: getTimeString(),
                isError: true
            });
        }
        session.updatedAt = Date.now();
        saveSessionsToStorage();
        renderHistorySidebar();
    } finally {
        setStreamingState(false);
        abortController = null;
        messageInput.focus();
    }
});

// ==========================================
// 5. JALANKAN SAAT HALAMAN DIMUAT
// ==========================================
initTheme();
loadUserProfile();
loadSessionsFromStorage();
renderHistorySidebar();
renderActiveSessionMessages();
