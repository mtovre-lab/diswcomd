// 1. طلب اسم المستخدم عند الدخول للموقع
let username = prompt("شنو هو الاسم ديالك ف السيرفر؟");
if (!username || username.trim() === "") {
    username = "مستخدم_مجهول";
}

const peer = new Peer(); 

const myIdBox = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const statusText = document.getElementById('status');
const statusLed = document.getElementById('status-led');
const remoteAudio = document.getElementById('remote-audio');

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatBox = document.getElementById('chat-box');

const voiceUsersContainer = document.getElementById('voice-users-container');
const voiceGrid = document.getElementById('voice-grid');

// عناصر الواجهة للتحكم ف القفل والقنوات
const btnChannelVoice = document.getElementById('btn-channel-voice');
const voiceRoomView = document.getElementById('voice-room-view');
const textChatView = document.getElementById('text-chat-view');
const btnChannelGeneral = document.getElementById('btn-channel-general');

let localStream = null;
let currentCall = null;
let currentDataConn = null; // هادا هو المسؤول على الشات والسميات بيناتكم
let friendName = ""; 
let isMuted = false;
let isDeafened = false;
let isInVoiceRoom = false; 

let audioContext, analyser, microphone, javascriptNode;
let remoteAudioContext, remoteAnalyser, remoteSource, remoteJavascriptNode;

// دالة تحديث واجهة الصوت
function updateVoiceRoomUI(isFriendConnected = false) {
    if (!isInVoiceRoom) {
        voiceUsersContainer.innerHTML = "";
        voiceGrid.innerHTML = "";
        return;
    }

    voiceUsersContainer.innerHTML = "";
    voiceGrid.innerHTML = "";

    // المربع الكبير ديالك
    const myCard = document.createElement('div');
    myCard.classList.add('voice-card'); 
    myCard.id = "card-me";
    myCard.innerHTML = `
        <div class="voice-card-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="voice-card-name">${username}</div>
    `;
    voiceGrid.appendChild(myCard);

    // الاسم تحت القناة
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
        
        callBtn.style.display = "none";
        hangupBtn.style.display = "block";
    } else {
        callBtn.style.display = "block";
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
    updateVoiceRoomUI(false); 
});

myIdBox.addEventListener('click', () => {
    if(myIdBox.innerText !== "جاري جلب الكود...") {
        navigator.clipboard.writeText(myIdBox.innerText);
        alert("📋 تم نسخ كود الاتصال الخاص بك!");
    }
});

function startMyMicrophone() {
    if (localStream) return Promise.resolve(localStream);
    return navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
        video: false 
    })
    .then((stream) => {
        localStream = stream;
        updateStatus("متصل بالصوت", "success");
        setupLocalVoiceDetection(stream);
        return stream;
    })
    .catch(() => { 
        updateStatus("المايك غير متاح", "error"); 
    });
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
            if (average > 12 && !isMuted) {
                myCardDOM.classList.add('speaking');
            } else {
                myCardDOM.classList.remove('speaking');
            }
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
            if (average > 12 && !isDeafened) {
                friendCardDOM.classList.add('speaking');
            } else {
                friendCardDOM.classList.remove('speaking');
            }
        }
    };
}

function monitorConnectionState(call) {
    const pc = call.peerConnection;
    if (pc) {
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || 
                pc.iceConnectionState === 'failed' || 
                pc.iceConnectionState === 'closed') {
                handleFriendDisconnect();
            }
        };
    }
}

/* =======================================================
   💬 دالة استقبال ومعالجة البيانات (السميات + الميساجات)
======================================================= */
function setupDataConnectionHandlers(conn) {
    conn.on('data', (data) => {
        // 1. استقبال تبادل الأسماء
        if (data.type === 'exchange-name') {
            friendName = data.name;
            if (currentCall) updateVoiceRoomUI(true);
        }
        
        // 2. استقبال ميساج جديد ف الشات من عند صاحبك
        if (data.type === 'chat-message') {
            displayReceivedMessage(data.sender, data.text);
        }
    });
    
    conn.on('close', () => { handleFriendDisconnect(); });
}

// دالة لإظهار الميساج اللي جاي من عند صاحبك ف الشات
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


/* =======================================================
   📡 استقبال الاتصالات المستقبلة
======================================================= */
peer.on('connection', (conn) => {
    currentDataConn = conn;
    isInVoiceRoom = true; 
    
    // عند فتح الاتصال، صيفط ليه سميتك ديريكت
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
            updateStatus("في مكالمة نشطة", "success");
            monitorConnectionState(call);
            if (friendName) updateVoiceRoomUI(true);
        });
    }
    call.on('close', () => { handleFriendDisconnect(); });
});


/* =======================================================
   📞 إجراء اتصال (عند وضع كود الطرف الآخر)
======================================================= */
callBtn.addEventListener('click', async () => {
    const remoteId = peerIdInput.value.trim();
    if (remoteId) {
        updateStatus("جاري الاتصال...", "warning");
        
        const stream = await startMyMicrophone();
        if(!stream) return; 

        isInVoiceRoom = true; 

        // 1. فتح شات البيانات
        const conn = peer.connect(remoteId);
        currentDataConn = conn;
        
        conn.on('open', () => {
            conn.send({ type: 'exchange-name', name: username });
        });
        
        setupDataConnectionHandlers(conn);

        // 2. صيفط مكالمة المايك
        const call = peer.call(remoteId, stream);
        currentCall = call;
        
        call.on('stream', (remoteStream) => {
            remoteAudio.srcObject = remoteStream;
            updateStatus("في مكالمة نشطة", "success");
            monitorConnectionState(call);
            if (friendName) updateVoiceRoomUI(true);
        });

        call.on('close', () => { handleFriendDisconnect(); });
    }
});

function handleFriendDisconnect() {
    remoteAudio.srcObject = null;
    currentCall = null;
    if (currentDataConn) { currentDataConn.close(); currentDataConn = null; }
    if (remoteJavascriptNode) remoteJavascriptNode.onaudioprocess = null;
    friendName = "";
    isInVoiceRoom = false; 
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    updateStatus("خارج الروم الصوتي", "warning");
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
   🎮 التحكم ف القنوات
======================================================= */
btnChannelGeneral.addEventListener('click', () => {
    btnChannelGeneral.classList.add('active');
    btnChannelVoice.classList.remove('active');
    textChatView.style.display = "flex";
    voiceRoomView.style.display = "none";
});

btnChannelVoice.addEventListener('click', () => {
    if (!isInVoiceRoom) {
        alert("🔒 خاصك تتصل بصاحبك بالكود أولاً باش يتفتحو قنوات السيرفر بالكامل (الشات والصوت)!");
        return; 
    }
    btnChannelVoice.classList.add('active');
    btnChannelGeneral.classList.remove('active');
    textChatView.style.display = "none";
    voiceRoomView.style.display = "flex";
});

/* =======================================================
   💬 ميزة إرسال الميساجات الحقيقية عبر الشبكة لتوصل لصاحبك
======================================================= */
function appendMessage() {
    const text = messageInput.value.trim();
    if(text !== "") {
        // 1. إظهار الميساج عندك أنت الأول ف الشات
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
        
        // 2. صيفط الميساج لصاحبك ف الحين يلا كنتو متصلين
        if (currentDataConn && currentDataConn.open) {
            currentDataConn.send({
                type: 'chat-message',
                sender: username,
                text: text
            });
        }

        messageInput.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}
sendBtn.addEventListener('click', appendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') appendMessage(); });

// أزرار الميوت والديفن
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
muteBtn.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted; 
        localStream.getAudioTracks()[0].enabled = !isMuted;
        muteBtn.className = isMuted ? "muted" : "unmuted";
        muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
        const myCardDOM = document.getElementById('card-me');
        if(myCardDOM && isMuted) myCardDOM.classList.remove('speaking');
    }
});

const deafenBtn = document.getElementById('deafen-btn');
const deafenIcon = document.getElementById('deafen-icon');
deafenBtn.addEventListener('click', () => {
    isDeafened = !isDeafened; 
    remoteAudio.muted = isDeafened;
    deafenBtn.className = isDeafened ? "deafened" : "undeafened";
    deafenIcon.className = isDeafened ? "fa-solid fa-ear-slash" : "fa-solid fa-headphones";
    isMuted = isDeafened;
    if (localStream) localStream.getAudioTracks()[0].enabled = !isMuted;
    muteBtn.className = isMuted ? "muted" : "unmuted";
    muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
    const myCardDOM = document.getElementById('card-me');
    if(myCardDOM && isMuted) myCardDOM.classList.remove('speaking');
});