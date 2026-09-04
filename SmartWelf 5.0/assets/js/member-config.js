// =========================================================
// ⚙️ member-config.js: ตั้งค่า Firebase สำหรับฝั่งสมาชิก
// =========================================================
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

// ตัวแปรที่ใช้ร่วมกันในฝั่งสมาชิก
let cachedUserData = null;
let fundSettings = { inZoneVillages: [], centers: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" };