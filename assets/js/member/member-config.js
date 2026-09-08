// =========================================================
// 👤 member/member-config.js: ตัวแปรส่วนกลางสำหรับสมาชิก
// =========================================================

// ระบบดักจับ Error หน้าจอมือถือ
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

const LIFF_ID = "2011183541-9UDIqf8P"; // LIFF ของฝั่งสมาชิก (ใช้รหัสนี้รหัสเดียวทั้งระบบสมาชิก)

// 🌟 สร้าง "กล่องเก็บข้อมูล (Namespace)" ชื่อ MemberState
const MemberState = {
    cachedData: null,
    unmaskedData: { natId: '', phone: '' },
    isDataMasked: { natId: true, phone: true },
    fundSettings: { inZoneVillages: [], centers: [], committee: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" },
    currentShareMode: 'news'
};