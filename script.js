// 1. إدارة اسم المستخدم وحفظه ف المتصفح باش ما يسولكش كل مرة
let username = localStorage.getItem('discord_username');
if (!username) {
    username = prompt("شنو هو الاسم ديالك ف السيرفر؟");
    if (!username || username.trim() === "") username = "مستخدم_" + Math.floor(Math.random()*1000);
    localStorage.setItem('discord_username', username);
}

const peer = new Peer(); 

const myIdBox = document.getElementById('my-id');
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

// 2. دالة جلب قائمة الأصدقاء الدائمين من الذاكرة (Local Storage)
function loadPermanentFriends() {
    friendsListContainer.innerHTML = "";
    const savedFriends = JSON.parse(localStorage.getItem('permanent_friends')) || [];
    
    savedFriends.forEach(f => {
        const item = document.createElement('div');
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.justifyContent = "space-between";
        item.style.padding = "6px 8px";
        item.style.backgroundColor = "#1e1f22";
        item.style.borderRadius = "4px";
        item.style.fontSize = "14px";
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="voice-avatar-mini friend" style="background-color: #5865f2;">${f.name.charAt(0).toUpperCase()}</div>
                <span style="font-weight: 500;">${f.name}</span>
            </div>
            <button onclick="startVoiceRoomWithKey('${f.id}', '${f.name}')" style="background-color: #23a55a; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">بدء الروم</button>
        `;
        friendsListContainer.appendChild(item);
    });
}

// دالة حفظ صديق جديد ف العقد للابد
function saveFriendToContract(id, name) {
    let savedFriends = JSON.parse(localStorage.getItem('permanent_friends')) || [];
    // التأكد من أن الصديق غير مسجل سابقا
    if (!savedFriends.some(f => f.id === id)) {
        savedFriends.push({ id: id, name: name });
        localStorage.setItem('permanent_friends', JSON.stringify(savedFriends));
        loadPermanentFriends();
    }
}

// 3. دالة تحديث واجهة الروم الصوتي
function updateVoiceRoomUI(isFriendConnected = false) {
    if (!isInVoiceRoom) {
        voiceUsersContainer.innerHTML = "";
        voiceGrid.innerHTML = "";
        return;
    }

    voiceUsersContainer.innerHTML = "";
    voiceGrid.innerHTML = "";

    // مربعك الكبير
    const myCard = document.createElement('div');
    myCard.classList.add('voice-card'); 
    myCard.id = "card-me";
    myCard.innerHTML = `
        <div class="voice-card-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="voice-card-name">${username}</div>
    `;
    voiceGrid.appendChild(myCard);

    // اسمك الصغير تحت القناة
    const myTag = document.createElement('div');
    myTag.classList.add('voice-user-tag');
    myTag.innerHTML = `
        <div class="voice-avatar-mini">${username.charAt(0).toUpperCase()}</div>
        <span>${username}</span>
    `;
    voiceUsersContainer.appendChild(myTag);

    if (isFriendConnected && friendName) {
        const friendCard = document.createElement('div');
        friendCard.classList.add('voice-card');
        friendCard.id = "card-friend";
        friendCard.innerHTML = `
            <div class="voice-card-avatar friend">${friendName.charAt(0).toUpperCase()}</div>
            <div class="voice-card-name">${friendName}</div>
        `;
        voiceGrid.appendChild(friendCard);

        const friendTag = document.createElement('div');
        friendTag.classList.add('voice-user-tag');
        friendTag.innerHTML = `
            <div class="voice-avatar-mini friend">${friendName.charAt(0).toUpperCase()}</div>
            <span>${friendName}</span>
        `;
        voiceUsersContainer.appendChild(friendTag);
        
        addFriendZone.style.display = "none";
        hangupBtn.style.display = "block";
    } else {
        addFriendZone.style.display = "flex";
        hangupBtn.style.display = "none";
    }
}

function updateStatus(text, colorClass) {
    statusText.innerText = text;
    if(colorClass === 'error') statusLed.style.backgroundColor = '#f23f43';
    else if(colorClass === 'warning') statusLed.style.backgroundColor = '#f1c40f';
    else statusLed.style.backgroundColor = '#23a55a';
}

peer.on('open', (id) => {
    myIdBox.innerText = id;
    loadPermanentFriends(); // تحميل الأصدقاء المعقود معهم الصداقة فوراً
    updateVoiceRoomUI(false); 
});

myIdBox.addEventListener('click', () => {
    if(myIdBox.innerText !== "جاري جلب الكود...") {
        navigator.clipboard.writeText(myIdBox.innerText);
        alert("📋 تم نسخ كودك الثابت! صيفطو لصاحبك يديرو مرة وحدة ف حياتو.");
    }
});

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

function setupDataConnectionHandlers(conn) {
    conn.on('data', (data) => {
        if (data.type === 'exchange-name') {
            friendName = data.name;
            saveFriendToContract(conn.peer, data.name); // حفظ التوأم للابد ف اللائحة
            if (currentCall) updateVoiceRoomUI(true);
        }
        if (data.type === 'chat-message') {
            displayReceivedMessage(data.sender, data.text);
        }
    });
    conn.on('close', () => { handleFriendDisconnect(); });
}

function displayReceivedMessage(senderName, text) {
    const row = document.createElement('div');
    row.classList.add('message-row');
    row.innerHTML = `
        <div class="avatar" style="background-color: #e67e22;">${senderName.charAt(0).toUpperCase()}</div>
        <div class="message-content">
            <span class="username">${senderName}</span>
            <p class="message-text">${text}</p>
        </div>
    `;
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 📡 استقبال الاتصالات الدائمة (تلقائياً)
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
            if (friendName) updateVoiceRoomUI(true);
        });
    }
    call.on('close', () => { handleFriendDisconnect(); });
});

/* =======================================================
   🚀 ميزة "بدء الروم بضغطة زر" الدائمة (عقد الصداقة)
======================================================= */
async function startVoiceRoomWithKey(targetPeerId, savedFriendName) {
    updateStatus("جاري بدء الروم...", "warning");
    const stream = await startMyMicrophone();
    if(!stream) return;

    isInVoiceRoom = true; 
    friendName = savedFriendName;

    // الاتصال بالبيانات والشات
    const conn = peer.connect(targetPeerId);
    currentDataConn = conn;
    conn.on('open', () => {
        conn.send({ type: 'exchange-name', name: username });
    });
    setupDataConnectionHandlers(conn);

    // الاتصال بالمايك
    const call = peer.call(targetPeerId, stream);
    currentCall = call;
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        updateStatus("في الروم الصوتي 🟢", "success");
        updateVoiceRoomUI(true);
        setupRemoteVoiceDetection(remoteStream);
    });
    call.on('close', () => { handleFriendDisconnect(); });
    
    // تحويل الواجهة لغرفة الصوت تلقائياً
    btnChannelVoice.click();
}

// زر ربط الصداقة لأول مرة عادي
callBtn.addEventListener('click', () => {
    const remoteId = peerIdInput.value.trim();
    const fName = friendNameInput.value.trim() || "صديق";
    if (remoteId) {
        saveFriendToContract(remoteId, fName);
        startVoiceRoomWithKey(remoteId, fName);
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

/* =======================================================
   🎮 التحكم ف القنوات والشات
======================================================= */
btnChannelGeneral.addEventListener('click', () => {
    btnChannelGeneral.classList.add('active');
    btnChannelVoice.classList.remove('active');
    textChatView.style.display = "flex";
    voiceRoomView.style.display = "none";
});

btnChannelVoice.addEventListener('click', () => {
    if (!isInVoiceRoom) {
        alert("🔒 كليكي على زر 'بدء الروم' حدا سمية صاحبك لتحت باش تدخل!");
        return; 
    }
    btnChannelVoice.classList.add('active');
    btnChannelGeneral.classList.remove('active');
    textChatView.style.display = "none";
    voiceRoomView.style.display = "flex";
});

function appendMessage() {
    const text = messageInput.value.trim();
    if(text !== "") {
        const row = document.createElement('div');
        row.classList.add('message-row');
        row.innerHTML = `
            <div class="avatar">${username.charAt(0).toUpperCase()}</div>
            <div class="message-content">
                <span class="username">${username}</span>
                <p class="message-text">${text}</p>
            </div>
        `;
        chatBox.appendChild(row);
        if (currentDataConn && currentDataConn.open) {
            currentDataConn.send({ type: 'chat-message', sender: username, text: text });
        }
        messageInput.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}
sendBtn.addEventListener('click', appendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') appendMessage(); });

// أزرار كتم المايك والسمع
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
muteBtn.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted; localStream.getAudioTracks()[0].enabled = !isMuted;
        muteBtn.className = isMuted ? "muted" : "unmuted";
        muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
        const myCardDOM = document.getElementById('card-me');
        if(myCardDOM && isMuted) myCardDOM.classList.remove('speaking');
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
    const myCardDOM = document.getElementById('card-me');
    if(myCardDOM && isMuted) myCardDOM.classList.remove('speaking');
});