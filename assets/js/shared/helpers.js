// =========================================================
// 🛠️ shared/helpers.js: ฟังก์ชันตัวช่วยที่ใช้ร่วมกันทั้งระบบ
// =========================================================
const AppHelper = {
    // 1. จัดฟอร์แมตตัวเลขให้มีคอมม่าและทศนิยม 2 ตำแหน่ง
    formatMoney: (val) => {
        return parseFloat(val || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    },

    // 2. ซ่อนข้อความ (เช่น เลข ปชช) ให้เหลือแค่ 4 ตัวท้าย
    maskString: (str) => {
        if (!str) return "-";
        if (str.length <= 4) return str;
        return "*".repeat(str.length - 4) + str.slice(-4);
    },

    // 3. ควบคุมหน้าจอ Loading
    showLoader: (show, text = "กำลังประมวลผล...") => {
        const loader = document.getElementById('systemLoading');
        if (loader) {
            if (show) {
                const txt = document.getElementById('systemLoadingText');
                if (txt && !txt.innerHTML.includes('Error')) txt.innerText = text;
                loader.style.display = 'flex';
            } else {
                loader.style.display = 'none';
            }
        }
    }
};