// =========================================================
// 🎨 admin/admin-ui.js: ฟังก์ชันควบคุมหน้าต่างและการแสดงผล
// =========================================================

function switchAdminTab(tabId, btn) {
    document.querySelectorAll('.admin-tab-pane').forEach(el => { 
        el.classList.remove('d-block'); 
        el.classList.add('d-none'); 
    });
    document.getElementById(tabId).classList.replace('d-none', 'd-block');
    
    const trendChartEl = document.getElementById('sharedTrendChart');
    if(trendChartEl) {
        if(tabId === 'admin-view-overview') { 
            document.getElementById('overviewChartArea').appendChild(trendChartEl); 
            trendChartEl.style.display = 'block'; 
            if(typeof renderTrendChart === 'function') renderTrendChart(); 
        } 
        else if (tabId === 'admin-view-ledger') { 
            document.getElementById('ledgerChartArea').appendChild(trendChartEl); 
            trendChartEl.style.display = 'block'; 
            if(typeof renderTrendChart === 'function') renderTrendChart(); 
        } 
        else { 
            trendChartEl.style.display = 'none'; 
        }
    }

    if(btn) { 
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); 
        btn.classList.add('active'); 
        window.scrollTo(0,0); 
    }
}

function closeMenuAndSwitchTab(tabId) {
    const menuEl = document.getElementById('menuOffcanvas');
    if (menuEl && typeof bootstrap !== 'undefined') {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(menuEl) || bootstrap.Offcanvas.getOrCreateInstance(menuEl);
        offcanvasInstance.hide();
    }
    setTimeout(() => { switchAdminTab(tabId, null); }, 150);
}

// เปลี่ยนจาก function toggleCollapse(detailId, arrowId) ให้เป็นแบบนี้ครับ:
window.toggleCollapse = function(detailId, arrowId) {
    const dObj = document.getElementById(detailId); 
    const aObj = document.getElementById(arrowId);
    if(dObj && aObj) {
        if(dObj.classList.contains('show')) { 
            dObj.classList.remove('show'); 
            aObj.classList.remove('fa-rotate-180'); 
        } else { 
            dObj.classList.add('show'); 
            aObj.classList.add('fa-rotate-180'); 
        }
    }
};

// =========================================================
// 🔀 ระบบควบคุมการสลับหน้าจอ (UI Navigation Routing)
// =========================================================

window.switchAdminTab = function(tabId, btnElement) {
    // 1. ซ่อนทุกหน้าต่าง (Tab)
    document.querySelectorAll('.admin-tab-pane').forEach(el => {
        el.classList.add('d-none');
        el.classList.remove('d-block');
    });
    
    // 2. โชว์หน้าต่างที่เลือกเป้าหมาย
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('d-none');
        target.classList.add('d-block');
    }

    // 3. จัดการสีของปุ่มเมนูที่แถบด้านล่าง (Bottom Nav)
    if (btnElement) {
        // กรณีคลิกจากปุ่มด้านล่างโดยตรง
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        // กรณีคลิกเลือกจากเมนู Offcanvas ให้ไฮไลต์ที่ปุ่ม "เมนู" (☰)
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => btn.classList.remove('active'));
        const navMenuBtn = document.getElementById('nav-menu');
        if(navMenuBtn) navMenuBtn.classList.add('active');
    }
    
    // 4. เลื่อนหน้าจอกลับไปบนสุดเสมอเมื่อสลับหน้า
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.closeMenuAndSwitchTab = function(tabId) {
    // 1. สั่งปิดหน้าต่างเมนูสไลด์ (Offcanvas) ก่อน
    const offcanvasEl = document.getElementById('menuOffcanvas');
    if (offcanvasEl) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
        bsOffcanvas.hide();
    }
    
    // 2. เรียกใช้ฟังก์ชันสลับแท็บไปยังหน้าที่ต้องการ
    window.switchAdminTab(tabId, null);
};