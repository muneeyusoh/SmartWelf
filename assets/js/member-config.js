// =========================================================
// ⚙️ member-config.js: ตั้งค่า Firebase สำหรับฝั่งสมาชิก (มีระบบดัก Error)
// =========================================================

// 🚨 เพิ่มระบบดักจับ Error เพื่อให้แสดงบนหน้าจอโทรศัพท์ 🚨
window.onerror = function(msg, url, line) {
    const loaderText = document.getElementById('systemLoadingText');
    if(loaderText) {
        loaderText.innerHTML = `<span class="text-danger fw-bold" style="font-size: 0.8rem;">JS Error: ${msg} (บรรทัด ${line})</span>`;
    }
};
window.onunhandledrejection = function(e) {
    const loaderText = document.getElementById('systemLoadingText');
    if(loaderText) {
        loaderText.innerHTML = `<span class="text-danger fw-bold" style="font-size: 0.8rem;">DB Error: ${e.reason?.message || e.reason}</span>`;
    }
};
// ---------------------------------------------------------

const firebaseConfig = { 
    apiKey: "AIzaSyBs1G5k31100g6PeVvU5nUyz0QDB21jHpI", 
    authDomain: "smartwelf-f7d81.firebaseapp.com", 
    projectId: "smartwelf-f7d81", 
    storageBucket: "smartwelf-f7d81.firebasestorage.app", 
    messagingSenderId: "114126831149", 
    appId: "1:114126831149:web:66ea766f6c558b159442a4" 
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ประกาศตัวแปร Global
var LIFF_ID = "2010764982-wudH3EsZ"; // เปลี่ยนจาก const เป็น var ป้องกันการพังกรณีประกาศซ้ำในไฟล์อื่น
let cachedUserData = null;
let fundSettings = { inZoneVillages: [], centers: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" };

function showLoader(show, text="กำลังประมวลผล...") { 
    const loader = document.getElementById('systemLoading');
    if(loader) {
        if(show) { 
            const txt = document.getElementById('systemLoadingText');
            // อัปเดตข้อความเฉพาะตอนที่ยังไม่มี Error สีแดงแสดงอยู่
            if(txt && !txt.innerHTML.includes('Error')) txt.innerText = text;
            loader.style.display = 'flex'; 
        } else { 
            loader.style.display = 'none'; 
        }
    }
}
