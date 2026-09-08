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

// 🌟 แยกรหัส LIFF ID สำหรับแต่ละหน้า (LINE บังคับ 1 ลิงก์ ต่อ 1 LIFF ID)
const LIFF_ID_MAIN = "2011183541-9UDIqf8P";   // สำหรับหน้า index.html
const LIFF_ID_CLAIM = "2011183541-uvW1j86T";  // 👈 อัปเดตใหม่ สำหรับหน้า claim.html
const LIFF_ID_CONTRIB = "2011183541-lPBacDBx"; // สำหรับหน้า contribution.html (ใส่ของเดิมไว้ก่อน ถ้ามีของใหม่เดี๋ยวค่อยมาแก้ครับ)

// ตัวแปรเดิมสำหรับหน้าหลัก (เพื่อไม่ให้โค้ดเก่าในหน้าอื่น Error)
const LIFF_ID = LIFF_ID_MAIN;

// 🌟 สร้าง "กล่องเก็บข้อมูล (Namespace)" ชื่อ MemberState
const MemberState = {
    cachedData: null,
    unmaskedData: { natId: '', phone: '' },
    isDataMasked: { natId: true, phone: true },
    fundSettings: { inZoneVillages: [], centers: [], committee: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" },
    currentShareMode: 'news'
};
