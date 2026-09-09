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

// =========================================================
// 🚀 ระบบแชร์ชวนเพื่อนแบบ Minimalist (ใช้ร่วมกันทุกหน้า)
// =========================================================
window.openShareModal = function(mode = 'invite') {
    // 1. ดึง LIFF ID และรหัสอ้างอิง (ถ้ามี)
    const currentLiffId = typeof LIFF_ID !== 'undefined' ? LIFF_ID : '2011183541-9UDIqf8P';
    let shareUrl = `https://liff.line.me/${currentLiffId}`;
    
    if (typeof cachedUserData !== 'undefined' && cachedUserData && cachedUserData.memberId) {
        shareUrl += `?ref=${cachedUserData.memberId}`;
    }
    
    const shareText = mode === 'invite' ? 'มาสมัครกองทุนสวัสดิการชุมชนกันเถอะ!' : 'ข่าวสารใหม่จากกองทุนสวัสดิการชุมชน';

    // 2. ออกแบบโครงสร้างปุ่มโทนสี Minimalist
    const minimalUI = `
        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px; margin-bottom: 10px;">
            <!-- ปุ่ม LINE -->
            <div onclick="executeMinimalShare('line', '${shareText}', '${shareUrl}')" style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="width: 55px; height: 55px; border-radius: 16px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #334155; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
                    <i class="fa-brands fa-line"></i>
                </div>
                <span style="font-size: 0.7rem; color: #64748B; font-weight: 600;">LINE</span>
            </div>
            
            <!-- ปุ่ม Messenger -->
            <div onclick="executeMinimalShare('messenger', '${shareText}', '${shareUrl}')" style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="width: 55px; height: 55px; border-radius: 16px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #334155; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
                    <i class="fa-brands fa-facebook-messenger"></i>
                </div>
                <span style="font-size: 0.7rem; color: #64748B; font-weight: 600;">Messenger</span>
            </div>
            
            <!-- ปุ่ม คัดลอกลิงก์ -->
            <div onclick="executeMinimalShare('copy', '${shareText}', '${shareUrl}')" style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="width: 55px; height: 55px; border-radius: 16px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #334155; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
                    <i class="fa-solid fa-link"></i>
                </div>
                <span style="font-size: 0.7rem; color: #64748B; font-weight: 600;">คัดลอก</span>
            </div>
        </div>
    `;

    // 3. เรียกใช้ Popup
    Swal.fire({
        title: '<h6 style="font-weight: 700; color: #1E293B; margin:0;">แชร์ให้เพื่อน</h6>',
        html: minimalUI,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-4 px-3 pb-3' }
    });
};

// =========================================================
// ฟังก์ชันจัดการเมื่อกดแชร์
// =========================================================
window.executeMinimalShare = function(platform, text, url) {
    Swal.close(); // ปิดหน้าต่าง Popup
    if(platform === 'line') {
        window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + " " + url)}`);
    } else if(platform === 'messenger') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    } else {
        navigator.clipboard.writeText(url);
        Swal.fire({
            icon: 'success', 
            title: 'คัดลอกสำเร็จ', 
            text: 'นำลิงก์ไปวางในแชทได้เลยครับ', 
            timer: 1500, 
            showConfirmButton: false
        });
    }
};
