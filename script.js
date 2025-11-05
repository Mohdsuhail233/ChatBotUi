const userInput = document.getElementById('userInput');
const chatContainer = document.getElementById('chatContainer');
const sendBtn = document.getElementById('sendBtn');
const chatList = document.getElementById('chatList');
let ws = null, isConnected = false, currentChatId = null;
let chats = JSON.parse(localStorage.getItem('chats') || '{}');
let loadingMessageElement = null;

// ✅ Connect WebSocket (for text chat)
function connectWebSocket() {
    try {
        ws = new WebSocket('wss://nonirritating-judi-violably.ngrok-free.dev/chat');
        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            isConnected = true;
            sendBtn.disabled = false;
        };
        ws.onmessage = (event) => {
            if (loadingMessageElement) loadingMessageElement.remove();
            try {
                const data = JSON.parse(event.data);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not parse response.";
                addMessage(text, 'assistant');
            } catch (e) {
                addMessage('Error: Malformed response from server.', 'assistant');
            }
            sendBtn.disabled = false;
        };
        ws.onerror = () => {
            if (loadingMessageElement) loadingMessageElement.remove();
            addMessage('Error: Connection failed.', 'assistant');
            sendBtn.disabled = true;
        };
        ws.onclose = () => {
            isConnected = false;
            sendBtn.disabled = true;
            setTimeout(connectWebSocket, 3000);
        };
    } catch (e) {
        console.error('Connection failed:', e);
    }
}

// ✅ Display chat message
function displayMessage(text, role) {
    const welcomeSection = chatContainer.querySelector('.welcome-section');
    if (welcomeSection) welcomeSection.remove();

    const msgElement = document.createElement('div');
    msgElement.className = `message ${role}`;

    const content = (role === 'assistant') ? parseMarkdown(text) : text;
    const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-star-of-life"></i>';

    if (role === 'user') {
        msgElement.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-avatar">${avatarIcon}</div>`;
    } else {
        msgElement.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">${content}</div>`;
    }

    chatContainer.appendChild(msgElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ✅ Send text message
function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
    addMessage(escapeHtml(message).replace(/\n/g, '<br>'), 'user');
    userInput.value = '';
    sendBtn.disabled = true;

    // Loading animation
    loadingMessageElement = document.createElement('div');
    loadingMessageElement.className = 'message assistant';
    loadingMessageElement.innerHTML = `
        <div class="message-avatar"><i class="fa-solid fa-star-of-life"></i></div>
        <div class="message-content">
            <div class="loading">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>`;
    chatContainer.appendChild(loadingMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    ws.send(message);
}

// ✅ Image Upload & Analyze (with preview)
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 🖼️ Image preview
    const fileURL = URL.createObjectURL(file);
    const previewHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
            <strong>📎 Attached:</strong> ${escapeHtml(file.name)}
            <img src="${fileURL}" alt="${escapeHtml(file.name)}" 
                 style="max-width:220px; border-radius:10px; margin-top:5px; box-shadow:0 0 5px rgba(0,0,0,0.2);" />
        </div>`;
    addMessage(previewHTML, 'user');

    // 🌀 Loading animation
    loadingMessageElement = document.createElement('div');
    loadingMessageElement.className = 'message assistant';
    loadingMessageElement.innerHTML = `
        <div class="message-avatar"><i class="fa-solid fa-star-of-life"></i></div>
        <div class="message-content">
            <p><strong>Analyzing image...</strong></p>
            <div class="loading">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>`;
    chatContainer.appendChild(loadingMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch("http://localhost:8080/image-analyze/image", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        if (loadingMessageElement) loadingMessageElement.remove();

        if (data.success) {
            let responseText = "";
            try {
                const parsed = JSON.parse(data.aiResponse);
                responseText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "No description found.";
            } catch {
                responseText = data.aiResponse;
            }
            addMessage(responseText, 'assistant');
        } else {
            addMessage(`Error: ${data.error}`, 'assistant');
        }
    } catch (error) {
        if (loadingMessageElement) loadingMessageElement.remove();
        addMessage("Error uploading image: " + error.message, 'assistant');
    }

    event.target.value = ''; // reset input
}

// ✅ Chat Management
function startNewChat() {
    const chatId = Date.now().toString();
    currentChatId = chatId;
    chats[chatId] = {
        id: chatId,
        title: 'New Chat',
        messages: [],
        created: new Date().toISOString()
    };
    saveChats();
    loadChat(chatId);
}

function loadChat(chatId) {
    if (!chats[chatId]) return;
    currentChatId = chatId;
    chatContainer.innerHTML = '';
    const chat = chats[chatId];
    if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => displayMessage(msg.text, msg.role));
    } else {
        displayWelcomeScreen();
    }
    updateChatList();
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function deleteChat(chatId, event) {
    event.stopPropagation();
    if (confirm('Are you sure?')) {
        delete chats[chatId];
        saveChats();
        if (currentChatId === chatId) {
            const remainingChats = Object.values(chats).sort((a, b) => new Date(b.created) - new Date(a.created));
            if (remainingChats.length > 0) {
                loadChat(remainingChats[0].id);
            } else {
                currentChatId = null;
                displayWelcomeScreen();
            }
        }
        updateChatList();
    }
}

function updateChatList() {
    chatList.innerHTML = '';
    const sortedChats = Object.values(chats).sort((a, b) => new Date(b.created) - new Date(a.created));
    sortedChats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item' + (currentChatId === chat.id ? ' active' : '');
        chatItem.onclick = () => loadChat(chat.id);
        chatItem.innerHTML = `
            <span style="flex-grow: 1; text-overflow: ellipsis; overflow: hidden;">${escapeHtml(chat.title)}</span>
            <button class="delete-chat-btn" onclick="deleteChat('${chat.id}', event)" title="Delete chat">
                <i class="fa-solid fa-trash-can"></i>
            </button>`;
        chatList.appendChild(chatItem);
    });
}

function addMessage(text, role) {
    if (!currentChatId) startNewChat();
    const chat = chats[currentChatId];
    chat.messages.push({ role, text });
    if (chat.messages.length === 1 && role === 'user') {
        chat.title = text.replace(/<[^>]+>/g, '').substring(0, 35) + (text.length > 35 ? '...' : '');
    }
    saveChats();
    displayMessage(text, role);
    updateChatList();
}

function displayWelcomeScreen() {
    chatContainer.innerHTML = `
        <div class="welcome-section" style="text-align:center; flex-grow:1; display:flex; flex-direction:column; justify-content:center;">
            <h2>MiraAI</h2>
            <p>How can I help you today?</p>
        </div>`;
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function saveChats() { localStorage.setItem('chats', JSON.stringify(chats)); }

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

function parseMarkdown(text) { return marked.parse(text); }

// ✅ Initialize
function initialize() {
    console.log('🚀 Initializing MiraAI...');
    connectWebSocket();
    const chatIds = Object.keys(chats);
    if (chatIds.length > 0) {
        const lastChat = Object.values(chats).sort((a, b) => new Date(b.created) - new Date(a.created))[0];
        loadChat(lastChat.id);
    } else {
        displayWelcomeScreen();
    }
}

initialize();
