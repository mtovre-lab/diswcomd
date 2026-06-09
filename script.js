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
// إعدادات زر الميوت
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
let isMuted = false;

muteBtn.addEventListener('click', () => {
    // التأكد أولا واش المايك خدام ومتاح
    if (localStream) {
        // قلب حالة الميوت (إذا كان true يرجع false والعكس)
        isMuted = !isMuted;
        
        // التحكم في مسار الصوت (Audio Track) وتوقيفه أو تشغيله
        localStream.getAudioTracks()[0].enabled = !isMuted;
        
        // تغيير شكل وتصميم الزر بناءً على الحالة
        if (isMuted) {
            muteBtn.className = "muted";
            muteIcon.className = "fa-solid fa-microphone-slash"; // أيقونة المايك مشطوب عليه
            updateStatus("أنت في وضع كتم الصوت (Mute)", "warning");
        } else {
            muteBtn.className = "unmuted";
            muteIcon.className = "fa-solid fa-microphone"; // أيقونة المايك العادي
            // نرجعو الحالة على حسب واش متصلين أولا لا
            if (remoteAudio.srcObject) {
                updateStatus("متصل بالصوت 🎙️", "success");
            } else {
                updateStatus("المايك واجد للاتصال", "warning");
            }
        }
    } else {
        alert("لم يتم العثور على المايك بعد! تأكد من إعطاء الصلاحية.");
    }
});
// إعدادات زر Deafen
const deafenBtn = document.getElementById('deafen-btn');
const deafenIcon = document.getElementById('deafen-icon');
let isDeafened = false;

deafenBtn.addEventListener('click', () => {
    isDeafened = !isDeafened;

    if (isDeafened) {
        // 1. كتم الصوت اللي جاي من صاحبك (ما تسمعوش)
        remoteAudio.muted = true;
        
        // 2. كتم المايك ديالك تلقائياً (بحال ديسكورد الحقيقي)
        if (localStream) localStream.getAudioTracks()[0].enabled = false;
        
        // تغيير الستايل للأحمر
        deafenBtn.className = "deafened";
        deafenIcon.className = "fa-solid fa-ear-slash"; // أيقونة السمع مشطوب عليه
        
        // تحديث شكل زر الميوت حتى هو حيت ديسكورد كيميتيهم بجوج
        muteBtn.className = "muted";
        muteIcon.className = "fa-solid fa-microphone-slash";
        
        updateStatus("تم كتم السمع والصوت بالكامل", "error");
    } else {
        // 1. إرجاع الصوت اللي جاي من صاحبك
        remoteAudio.muted = false;
        
        // 2. إرجاع المايك ديالك (إلا إذا كنتي داير ليه ميوت بوحدو من قبل)
        if (!isMuted && localStream) {
            localStream.getAudioTracks()[0].enabled = true;
            muteBtn.className = "unmuted";
            muteIcon.className = "fa-solid fa-microphone";
        }
        
        // إرجاع ستايل زر الكاسك للطبيعي
        deafenBtn.className = "undeafened";
        deafenIcon.className = "fa-solid fa-headphones";
        
        if (remoteAudio.srcObject) {
            updateStatus("متصل بالصوت 🎙️", "success");
        } else {
            updateStatus("المايك واجد للاتصال", "warning");
        }
    }
});