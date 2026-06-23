// 1. طلب اسم المستخدم
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

let localStream;
let currentCall = null;
let friendName = "صاحبك"; 
let isMuted = false;
let isDeafened = false;

// متغيرات لتحليل الصوت
let audioContext, analyser, microphone, javascriptNode;
let remoteAudioContext, remoteAnalyser, remoteSource, remoteJavascriptNode;

// 2. دالة تحديث الواجهة الكاملة (المربعات الكبار والأسماء)
function updateVoiceRoomUI(isFriendConnected = false) {
    voiceUsersContainer.innerHTML = "";
    voiceGrid.innerHTML = "";

    // المربع الكبير ديالك (ف البداية مكيكونش كيشعل حتى نهضرو)
    const myCard = document.createElement('div');
    myCard.classList.add('voice-card'); 
    myCard.id = "card-me";
    myCard.innerHTML = `
        <div class="voice-card-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="voice-card-name">${username}</div>
    `;
    voiceGrid.appendChild(myCard);

    // الاسم الصغير ديالك تحت القناة
    const myTag = document.createElement('div');
    myTag.classList.add('voice-user-tag');
    myTag.innerHTML = `
        <div class="voice-avatar-mini">${username.charAt(0).toUpperCase()}</div>
        <span>${username}</span>
    `;
    voiceUsersContainer.appendChild(myTag);

    if (isFriendConnected) {
        // المربع الكبير ديال صاحبك
        const friendCard = document.createElement('div');
        friendCard.classList.add('voice-card');
        friendCard.id = "card-friend";
        friendCard.innerHTML = `
            <div class="voice-card-avatar friend">${friendName.charAt(0).toUpperCase()}</div>
            <div class="voice-card-name">${friendName}</div>
        `;
        voiceGrid.appendChild(friendCard);

        // الاسم الصغير ديال صاحبك تحت القناة
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

// جلب كود البير عند تشغيل السيرفر
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

// 🎙️ دالة مراقبة صوت المايك ديالك أنت
function setupLocalVoiceDetection(stream) {
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

        for (let i = 0; i < array.length; i++) {
            values += array[i];
        }
        let average = values / array.length; // هادا هو معدل قوة الصوت

        const myCardDOM = document.getElementById('card-me');
        if (myCardDOM) {
            // شعل الضو غير يلا كان الصوت فايت 12 (يعني كاين هضرة) ومدايرش الميوت
            if (average > 12 && !isMuted && !isDeafened) {
                myCardDOM.classList.add('speaking');
            } else {
                myCardDOM.classList.remove('speaking');
            }
        }
    };
}

// 🔊 دالة مراقبة الصوت اللي جاي من عند صاحبك
function setupRemoteVoiceDetection(remoteStream) {
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

        for (let i = 0; i < array.length; i++) {
            values += array[i];
        }
        let average = values / array.length;

        const friendCardDOM = document.getElementById('card-friend');
        if (friendCardDOM) {
            // شعل الإطار لخوك يلا كان كيهضر بصح ف المايك وميديرش هو قطع السمع
            if (average > 12) {
                friendCardDOM.classList.add('speaking');
            } else {
                friendCardDOM.classList.remove('speaking');
            }
        }
    };
}

// جلب صلاحية المايك وتشغيل المحلل
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
        localStream = stream;
        updateStatus("متصل بالصوت", "success");
        setupLocalVoiceDetection(stream); // شغل الحساس ديال المايك ديالك
    })
    .catch(() => { updateStatus("المايك غير متاح", "error"); });

// استقبال اتصال قادم
peer.on('call', (call) => {
    currentCall = call;
    friendName = "صاحبك المتصل";
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        updateStatus("في مكالمة نشطة", "success");
        updateVoiceRoomUI(true);
        setupRemoteVoiceDetection(remoteStream); // شغل الحساس ديال المايك د صاحبك
    });

    call.on('close', () => { handleFriendDisconnect(); });
});

// إجراء اتصال
callBtn.addEventListener('click', () => {
    const remoteId = peerIdInput.value.trim();
    if (remoteId) {
        updateStatus("جاري الاتصال...", "warning");
        const call = peer.call(remoteId, localStream);
        currentCall = call;
        
        call.on('stream', (remoteStream) => {
            remoteAudio.srcObject = remoteStream;
            updateStatus("في مكالمة نشطة", "success");
            updateVoiceRoomUI(true);
            setupRemoteVoiceDetection(remoteStream); // شغل الحساس ديال المايك د صاحبك
        });

        call.on('close', () => { handleFriendDisconnect(); });
    }
});

function handleFriendDisconnect() {
    remoteAudio.srcObject = null;
    currentCall = null;
    if (remoteJavascriptNode) remoteJavascriptNode.onaudioprocess = null; // حبس تحليل صوت صاحبك
    updateStatus("متصل بالصوت (بوحدك)", "success");
    updateVoiceRoomUI(false);
}

hangupBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
        handleFriendDisconnect();
    }
});

/* =======================================================
   🎮 التنقل بين القنوات
======================================================= */
const btnChannelGeneral = document.getElementById('btn-channel-general');
const btnChannelVoice = document.getElementById('btn-channel-voice');
const textChatView = document.getElementById('text-chat-view');
const voiceRoomView = document.getElementById('voice-room-view');

btnChannelGeneral.addEventListener('click', () => {
    btnChannelGeneral.classList.add('active');
    btnChannelVoice.classList.remove('active');
    textChatView.style.display = "flex";
    voiceRoomView.style.display = "none";
});

btnChannelVoice.addEventListener('click', () => {
    btnChannelVoice.classList.add('active');
    btnChannelGeneral.classList.remove('active');
    textChatView.style.display = "none";
    voiceRoomView.style.display = "flex";
});

/* =======================================================
   💬 الشات الكتابي
======================================================= */
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
        messageInput.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}
sendBtn.addEventListener('click', appendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') appendMessage(); });

/* =======================================================
   🎛️ أزرار الميوت والديـفن المحدثة لقطع الوميض فوراً
======================================================= */
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');

muteBtn.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted; 
        localStream.getAudioTracks()[0].enabled = !isMuted;
        muteBtn.className = isMuted ? "muted" : "unmuted";
        muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
        
        // يلا دار ميوت، حيد الوميض الأخضر دغيا بلا ما يتسنى الحساس
        if(isMuted) {
            const myCardDOM = document.getElementById('card-me');
            if(myCardDOM) myCardDOM.classList.remove('speaking');
        }
    }
});

const deafenBtn = document.getElementById('deafen-btn');
const deafenIcon = document.getElementById('deafen-icon');

deafenBtn.addEventListener('click', () => {
    isDeafened = !isDeafened; 
    remoteAudio.muted = isDeafened;
    if (localStream) localStream.getAudioTracks()[0].enabled = !isDeafened;
    
    deafenBtn.className = isDeafened ? "deafened" : "undeafened";
    deafenIcon.className = isDeafened ? "fa-solid fa-ear-slash" : "fa-solid fa-headphones";
    
    // الديفن كيدير ميوت تلقائي حتى هو
    isMuted = isDeafened;
    muteBtn.className = isMuted ? "muted" : "unmuted";
    muteIcon.className = isMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone";
    
    if(isMuted) {
        const myCardDOM = document.getElementById('card-me');
        if(myCardDOM) myCardDOM.classList.remove('speaking');
    }
});