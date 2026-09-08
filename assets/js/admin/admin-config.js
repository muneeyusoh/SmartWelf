// =========================================================
// 🛡️ admin/admin-config.js: ตัวแปรส่วนกลางสำหรับแอดมิน
// =========================================================
const ADMIN_LIFF_ID = "2011183541-zDAQXVLM"; // LIFF ของฝั่งแอดมิน
const MASTER_EMAIL = "mr.munee@gmail.com";

// 🌟 สร้าง "กล่องเก็บข้อมูล (Namespace)" ชื่อ AdminState 
// เพื่อให้ข้อมูลเป็นระเบียบ ไม่หลุดไปกวนไฟล์อื่น
const AdminState = {
    currentAdmin: null, 
    currentPin: "",
    membersCache: [],
    fundSettings: { inZoneVillages: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" },
    townPopulation: localStorage.getItem('cwf_town_pop') ? parseInt(localStorage.getItem('cwf_town_pop')) : 20000,
    
    // ข้อมูล Dropdown ตัวเลือกต่างๆ
    uiOptions: {
        memberTypes: [],
        villages: [],
        centers: [],
        committee: [],
        rules: [],
        welfareTypes: [],
        conditionTypes: [],
        objectives: [],
        incomeNotes: [],
        expenseNotes: []
    }
};