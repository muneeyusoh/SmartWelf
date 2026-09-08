// =========================================================
// 🌐 shared/firebase-init.js: ศูนย์กลางเชื่อมต่อฐานข้อมูล
// =========================================================
const firebaseConfig = { 
    apiKey: "AIzaSyBs1G5k31100g6PeVvU5nUyz0QDB21jHpI", 
    authDomain: "smartwelf-f7d81.firebaseapp.com", 
    projectId: "smartwelf-f7d81", 
    storageBucket: "smartwelf-f7d81.firebasestorage.app", 
    messagingSenderId: "114126831149", 
    appId: "1:114126831149:web:66ea766f6c558b159442a4" 
};

// ตรวจสอบว่าแอปถูกเริ่มไปแล้วหรือยัง เพื่อป้องกัน Error Initialized Twice
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// ประกาศตัวแปร ฐานข้อมูล ไว้เป็น Global ให้ทุกหน้าเรียกใช้ได้
const db = firebase.firestore();

// ประกาศตัวแปร Auth (ถ้ามีฟังก์ชัน firebase.auth โหลดมาด้วย)
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;