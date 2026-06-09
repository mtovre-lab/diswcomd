const peer = new Peer(); 

const myIdBox = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const statusText = document.getElementById('status');
const statusLed = document.getElementById('status-led');
const remoteAudio = document.getElementById('remote-audio');

let localStream;

// تحديث حالة الواجهة (ألوان الليد)
function updateStatus(text, type) {
    statusText.innerText = text;
    statusLed.className = "status-dot"; // ريسيت
    
    if (type === 'success') {
        statusLed.classList.add('status-active');
    } else if (type === 'warning') {
        statusLed.classList.add('status-warning');
    }
    // إلا كان خطأ كيبقى أحمر ديفولت
}

// 1. جلب الكود وعرضه
peer.on('open', (id) => {
    myIdBox.innerText = id;
});

// ميزة الكليك للنسخ التلقائي للكود
myIdBox.addEventListener('click', () => {
    if(myIdBox.innerText !== "جاري جلب الكود...") {
        navigator.clipboard.writeText(myIdBox.innerText);
        alert("📋 تم نسخ الكود بنجاح! صيفطو لصاحبك.");
    }
});

// 2. طلب إذن المايك
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
        localStream = stream;
        updateStatus("المايك واجد للاتصال", "warning");
    })
    .catch((err) => {
        console.error(err);
        updateStatus("فشل الوصول للمايك!", "error");
        alert("خاصك تعطي صلاحية المايك للمتصفح باش يخدم الصوت.");
    });

// 3. استقبال مكالمة قادمة
peer.on('call', (call) => {
    updateStatus("مكالمة قادمة...", "warning");
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        updateStatus("متصل بالصوت 🎙️", "success");
    });
});

// 4. ضغط زر الاتصال
callBtn.addEventListener('click', () => {
    const remoteId = peerIdInput.value.trim();
    if (!remoteId) {
        alert("حط كود صاحبك هو الأول فالبلاصة الرمادية!");
        return;
    }
    
    updateStatus("جاري الاتصال...", "warning");
    const call = peer.call(remoteId, localStream);
    
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        updateStatus("متصل بالصوت 🎙️", "success");
    });
    
    call.on('error', (err) => {
        updateStatus("فشل الاتصال!", "error");
    });
});