// =======================================================
// 1. نظام إدارة الحسابات والذاكرة المحلية
// =======================================================
let currentAccount = JSON.parse(localStorage.getItem('active_discord_account'));

if (!currentAccount) {
    let inputName = prompt("مرحباً بك! اكتب الاسم ديالك ف السيرفر:");
    if (!inputName || inputName.trim() === "") inputName = "مستخدم_" + Math.floor(Math.random()*1000);
    
    // توليد الكود محلياً فوراً لتجنب تعليق السيرفر
    let uniqueSecretCode = "peer-" + Math.floor(100000 + Math.random() * 900000);

    currentAccount = {
        username: inputName.trim(),
        userCode: uniqueSecretCode
    };
    
    localStorage.setItem('active_discord_account', JSON.stringify(currentAccount));
}

const username = currentAccount.username;
const userCode = currentAccount.userCode;

// إظهار الكود والاسم فوراً وبشكل أسرع
document.getElementById('user-display-top').innerText = "👤 " + username;
document.getElementById('user-code-top').innerText = "🔑 الكود: " + userCode;

// =======================================================
// 2. إعداد الـ PeerJS السريع (مباشر ومحمي من التعليق)
// =======================================================
// ربط الـ ID محلياً قبل انتظار استجابة السيرفر بالكامل
const myIdBox = document.getElementById('my-id');
myIdBox.innerText = userCode; 

const peer = new Peer(userCode, {
    host: 'peerjs.com',
    port: 443,
    secure: true,
    pingInterval: 5000,
    debug: 1 // تقليص الأخطاء الجانبية لزيادة السرعة
}); 

const peerIdInput = document.getElementById('peer-id-input');
const friendNameInput = document.getElementById('friend-name-input');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const statusText = document.getElementById('status');
const statusLed = document.getElementById('status-led');
const remoteAudio = document.getElementById('remote-audio');
const addFriendZone = document.getElementById('add-friend-zone');

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatBox = document.getElementById('chat-box');

const voiceUsersContainer = document.getElementById('voice-users-container');
const voiceGrid = document.getElementById('voice-grid');
const friendsListContainer = document.getElementById('friends-list-container');

const btnChannelVoice = document.getElementById('btn-channel-voice');
const voiceRoomView = document.getElementById('voice-room-view');
const textChatView = document.getElementById('text-chat-view');
const btnChannelGeneral = document.getElementById('btn-channel-general');

let localStream = null;
let currentCall = null;
let currentDataConn = null; 
let friendName = ""; 
let isMuted = false;
let isDeafened = false;
let isInVoiceRoom = false; 

let audioContext, analyser, microphone, javascriptNode;
let remoteAudioContext, remoteAnalyser, remoteSource, remoteJavascriptNode;

const avatarColors = ["#5865f2", "#23a55a", "#e67e22", "#9b59b6", "#e74c3c", "#1abc9c"];
const myAvatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
const friendAvatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

// تحديث الليد عند نجاح الاتصال الكامل بالسيرفر العالمي
peer.on('open', (id) => {
    updateStatus("متصل ومستعد", "success");
    loadLocalChatHistory(); 
    loadPermanentFriends(); 
    updateVoiceRoomUI(false); 
});

// معالجة خطأ السيرفر المشهور لمنع تجمد التطبيق
peer.on('error', (err) => {
    console.warn("PeerJS Warning/Error:", err.type);
    updateStatus("اتصال احتياطي نشط", "warning");
});

// =======================================================
// 3. حفظ وعرض الشات المحلي للأبد
// =======================================================
function loadLocalChatHistory() {
    chatBox.innerHTML = "";
    const history = JSON.parse(localStorage.getItem('discord_chat_history')) || [];
    history.forEach(msg => {
        renderMessageRow(msg.sender, msg.text, msg.color || "#5865f2");
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

function saveMessageToLocalHistory(senderName, textMessage, colorHex) {
    const history = JSON.parse(localStorage.getItem('discord_chat_history')) || [];
    history.push({ sender: senderName, text: textMessage, color: colorHex });
    localStorage.setItem('discord_chat_history', JSON.stringify(history));
}

function renderMessageRow(senderName, text, colorHex) {
    const row = document.createElement('div');
    row.classList.add('message-row');
    row.innerHTML = `
        <div class="message-avatar" style="background-color: ${colorHex};">${senderName.charAt(0).toUpperCase()}</div>
        <div class="message-details">
            <span class="message-username">${senderName}</span>
            <p class="message-text">${text}</p>
        </div>
    `;
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// =======================================================
// 4. إدارة قائمة الأصدقاء الدائمين
// =======================================================
function loadPermanentFriends() {
    friendsListContainer.innerHTML = "";
    const allStorageFriends = JSON.parse(localStorage.getItem('permanent_friends_list')) || [];
    const myFriends = allStorageFriends.filter(f => f.belongsTo === userCode);
    
    if (myFriends.length === 0) {
        friendsListContainer.innerHTML = `<span style="color: #949ba4; font-size: 12px; padding: 4px 8px;">لا يوجد أصدقاء محفوظين.</span>`;
        return;
    }

    myFriends.forEach(f => {
        const item = document.createElement('div');
        item.classList.add('friend-row');
        item.innerHTML = `
            <div class="friend-info">
                <div class="voice-avatar-mini" style="background-color: ${f.color || '#23a55a'};">${f.name.charAt(0).toUpperCase()}</div>
                <span class="friend-name-text">${f.name}</span>
            </div>
            <div class="friend-actions">
                <button onclick="startVoiceRoomWithKey('${f.id}', '${f.name}')" class="btn-friend-call">بدء الروم</button>
                <button onclick="deletePermanentFriend('${f.id}')" class="btn-friend-delete">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        friendsListContainer.appendChild(item);
    });
}

function saveFriendToContract(id, name) {
    let allStorageFriends = JSON.parse(localStorage.getItem('permanent_friends_list')) || [];
    if (!allStorageFriends.some(f => f.id === id && f.belongsTo === userCode)) {
        const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
        allStorageFriends.push({ id: id, name: name, belongsTo: userCode, color: randomColor });
        localStorage.setItem('permanent_friends_list', JSON.stringify(allStorageFriends));
        loadPermanentFriends();
    }
}

function deletePermanentFriend(friendId) {
    if (confirm("واش بغيتي تحيد هاد الصديق من الحساب ديالك؟")) {
        let allStorageFriends = JSON.parse(localStorage.getItem('permanent_friends_list')) || [];
        allStorageFriends = allStorageFriends.filter(f => !(f.id === friendId && f.belongsTo === userCode));
        localStorage.setItem('permanent_friends_list', JSON.stringify(allStorageFriends));
        loadPermanentFriends();
    }
}

// =======================================================
// 5. واجهة الروم الصوتي والمربعات الكبيرة (بدون ستايل مباشر)
// =======================================================
function updateVoiceRoomUI(isFriendConnected = false) {
    if (!isInVoiceRoom) {
        voiceUsersContainer.innerHTML = "";
        voiceGrid.innerHTML = "";
        return;
    }

    voiceUsersContainer.innerHTML = "";
    voiceGrid.innerHTML = "";

    const myCard = document.createElement('div');
    myCard.classList.add('voice-card'); 
    myCard.id = "card-me";
    myCard.innerHTML = `
        <div class="voice-card-avatar" style="background-color: ${myAvatarColor};">${username.charAt(0).toUpperCase()}</div>
        <div class="voice-card-name">${username}</div>
    `;
    voiceGrid.appendChild(myCard);

    const myTag = document.createElement('div');
    myTag.classList.add('voice-user-tag');
    myTag.innerHTML = `
        <div class="voice-avatar-mini" style="background-color: ${myAvatarColor};">${username.charAt(0).toUpperCase()}</div>
        <span>${username} (أنت)</span>
    `;
    voiceUsersContainer.appendChild(myTag);

    if (isFriendConnected && friendName) {
        const friendCard = document.createElement('div');
        friendCard.classList.add('voice-card');
        friendCard.id = "card-friend";
        friendCard.innerHTML = `
            <div class="voice-card-avatar friend" style="background-color: ${friendAvatarColor};">${friendName.charAt(0).toUpperCase()}</div>
            <div class="voice-card-name">${friendName}</div>
        `;
        voiceGrid.appendChild(friendCard);

        const friendTag = document.createElement('div');
        friendTag.classList.add('voice-user-tag');
        friendTag.innerHTML = `
            <div class="voice-avatar-mini friend" style="background-color: ${friendAvatarColor};">${friendName.charAt(0).toUpperCase()}</div>
            <span>${friendName}</span>
        `;
        voiceUsersContainer.appendChild(friendTag);
        
        addFriendZone.classList.add('hidden-element');
        hangupBtn.classList.remove('hidden-element');
    } else {
        addFriendZone.classList.remove('hidden-element');
        hangupBtn.classList.add('hidden-element');
    }
}

function updateStatus(text, colorClass) {
    statusText.innerText = text;
    if(colorClass === 'error') statusLed.style.backgroundColor = '#f23f43';
    else if(colorClass === 'warning') statusLed.style.backgroundColor = '#f1c40f';
    else statusLed.style.backgroundColor = '#23a55a';
}

myIdBox.addEventListener('click', () => {
    navigator.clipboard.writeText(userCode);
    alert("📋 تم نسخ كود حسابك الثابت بنجاح!");
});

document.getElementById('user-profile-card').addEventListener('click', () => {
    navigator.clipboard.writeText(userCode);
    alert("📋 تم نسخ كود حسابك الثابت بنجاح!");
});

// =======================================================
// 6. التقاط الصوت ونظام الـ Speaking Ring الأخضر
// =======================================================
async function startMyMicrophone() {
    if (localStream) return localStream;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
            video: false 
        });
        localStream = stream;
        updateStatus("متصل بالصوت", "success");
        setupLocalVoiceDetection(stream);
        return stream;
    } catch (e) {
        updateStatus("المايك غير متاح", "error");
    }
}

function setupLocalVoiceDetection(stream) {
    if (audioContext) audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    analyser.smoothingTimeConstant = 0.4;
    analyser.fftSize = 1024;
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;
        for (let i = 0; i < array.length; i++) { values += array[i]; }
        let average = values / array.length;
        const myCardDOM = document.getElementById('card-me');
        if (myCardDOM) {
            if (average > 12 && !isMuted) myCardDOM.classList.add('speaking');
            else myCardDOM.classList.remove('speaking');
        }
    };
}

function setupRemoteVoiceDetection(remoteStream) {
    if (remoteAudioContext) remoteAudioContext.close();
    remoteAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    remoteAnalyser = remoteAudioContext.createAnalyser();
    remoteSource = remoteAudioContext.createMediaStreamSource(remoteStream);
    remoteJavascriptNode = remoteAudioContext.createScriptProcessor(2048, 1, 1);
    remoteAnalyser.smoothingTimeConstant = 0.4;
    remoteAnalyser.fftSize = 1024;
    remoteSource.connect(remoteAnalyser);
    remoteAnalyser.connect(remoteJavascriptNode);
    remoteJavascriptNode.connect(remoteAudioContext.destination);

    remoteJavascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(remoteAnalyser.frequencyBinCount);
        remoteAnalyser.getByteFrequencyData(array);
        let values = 0;
        for (let i = 0; i < array.length; i++) { values += array[i]; }
        let average = values / array.length;
        const friendCardDOM = document.getElementById('card-friend');
        if (friendCardDOM) {
            if (average > 12 && !isDeafened) friendCardDOM.classList.add('speaking');
            else friendCardDOM.classList.remove('speaking');
        }
    };
}

// =======================================================
// 7. إدارة الاتصال والتبديل
// =======================================================
function setupDataConnectionHandlers(conn) {
    conn.on('data', (data) => {
        if (data.type === 'exchange-name') {
            friendName = data.name;
            saveFriendToContract(conn.peer, data.name); 
            if (currentCall) updateVoiceRoomUI(true);
        }
        if (data.type === 'chat-message') {
            renderMessageRow(data.sender, data.text, data.color || "#23a55a");
            saveMessageToLocalHistory(data.sender, data.text, data.color || "#23a55a");
        }
    });
    conn.on('close', () => { handleFriendDisconnect(); });
}

peer.on('connection', (conn) => {
    currentDataConn = conn;
    isInVoiceRoom = true; 
    conn.on('open', () => {
        conn.send({ type: 'exchange-name', name: username });
    });
    setupDataConnectionHandlers(conn);
});

peer.on('call', async (call) => {
    currentCall = call;
    isInVoiceRoom = true; 
    const stream = await startMyMicrophone();
    if(stream) {
        call.answer(stream);
        call.on('stream', (remoteStream) => {
            remoteAudio.srcObject = remoteStream;
            updateStatus("في الروم الصوتي 🟢", "success");
            setupRemoteVoiceDetection(remoteStream);
            if (friendName) updateVoiceRoomUI(true);
        });
    }
    call.on('close', () => { handleFriendDisconnect(); });
});

async function startVoiceRoomWithKey(targetPeerId, savedFriendName) {
    updateStatus("جاري بدء الروم...", "warning");
    const stream = await startMyMicrophone();
    if(!stream) return;

    isInVoiceRoom = true; 
    friendName = savedFriendName;

    const conn = peer.connect(targetPeerId);
    currentDataConn = conn;
    conn.on('open', () => {
        conn.send({ type: 'exchange-name', name: username });
    });
    setupDataConnectionHandlers(conn);

    const call = peer.call(targetPeerId, stream);
    currentCall = call;
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        updateStatus("في الروم الصوتي 🟢", "success");
        updateVoiceRoomUI(true);
        setupRemoteVoiceDetection(remoteStream);
    });
    call.on('close', () => { handleFriendDisconnect(); });
    btnChannelVoice.click();
}

callBtn.addEventListener('click', () => {
    const remoteId = peerIdInput.value.trim();
    let typedName = friendNameInput ? friendNameInput.value.trim() : "";
    if (!typedName || typedName === "") typedName = "صديق_جديد";

    if (remoteId) {
        friendName = typedName; 
        startVoiceRoomWithKey(remoteId, friendName);
        peerIdInput.value = "";
        if(friendNameInput) friendNameInput.value = "";
    }
});

function handleFriendDisconnect() {
    remoteAudio.srcObject = null;
    currentCall = null;
    if (currentDataConn) { currentDataConn.close(); currentDataConn = null; }
    if (remoteJavascriptNode) remoteJavascriptNode.onaudioprocess = null;
    isInVoiceRoom = false; 
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    updateStatus("خارج الروم", "warning");
    updateVoiceRoomUI(false);
    btnChannelGeneral.click();
}

hangupBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
        handleFriendDisconnect();
    }
});

document.getElementById('switch-account-btn').addEventListener('click', () => {
    if (confirm("واش بغيتي تخرج من هاد الحساب وتبدلو بحساب آخر؟")) {
        localStorage.removeItem('active_discord_account');
        window.location.reload();
    }
});

btnChannelGeneral.addEventListener('click', () => {
    btnChannelGeneral.classList.add('active');
    btnChannelVoice.classList.remove('active');
    textChatView.classList.remove('hidden-element');
    voiceRoomView.classList.add('hidden-element');
    document.getElementById('current-channel-title').innerText = "عام";
});

btnChannelVoice.addEventListener('click', () => {
    if (!isInVoiceRoom) {
        alert("🔒 كليكي على زر 'بدء الروم' حدا سمية صاحبك لتحت، أو حط كود جديد باش تدخل للروم الصوتي!");
        return; 
    }
    btnChannelVoice.classList.add('active');
    btnChannelGeneral.classList.remove('active');
    textChatView.classList.add('hidden-element');
    voiceRoomView.classList.remove('hidden-element');
    document.getElementById('current-channel-title').innerText = "روم_المايك";
});

function appendMessage() {
    const text = messageInput.value.trim();
    if(text !== "") {
        renderMessageRow(username, text, myAvatarColor);
        saveMessageToLocalHistory(username, text, myAvatarColor);
        
        if (currentDataConn && currentDataConn.open) {
            currentDataConn.send({ type: 'chat-message', sender: username, text: text, color: myAvatarColor });
        }
        messageInput.value = "";
    }
}
sendBtn.addEventListener('click', appendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') appendMessage(); });

const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebar = document.getElementById('sidebar');
if (openSidebarBtn && sidebar) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('active-menu'));
if (closeSidebarBtn && sidebar) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active-menu'));

const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
muteBtn.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted; localStream.getAudioTracks()[0].enabled = !isMuted;
        muteBtn.className = isMuted ? "muted" : "unmuted";
        muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
    }
});
const deafenBtn = document.getElementById('deafen-btn');
const deafenIcon = document.getElementById('deafen-icon');
deafenBtn.addEventListener('click', () => {
    isDeafened = !isDeafened; remoteAudio.muted = isDeafened;
    deafenBtn.className = isDeafened ? "deafened" : "undeafened";
    deafenIcon.className = isDeafened ? "fa-solid fa-ear-slash" : "fa-solid fa-headphones";
    isMuted = isDeafened; if (localStream) localStream.getAudioTracks()[0].enabled = !isMuted;
    muteBtn.className = isMuted ? "muted" : "unmuted";
    muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
});