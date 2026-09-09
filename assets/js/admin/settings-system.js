// ============================================================================
// 🔒 ส่วนที่ 3: ระบบบันทึก ธนาคาร / API / ความปลอดภัย
// ============================================================================
window.saveBankSettings = async function() { /* ...คงฟังก์ชันเดิม... */ };
window.saveConnectionSettings = async function() { /* ...คงฟังก์ชันเดิม... */ };
window.savePrivacySettings = async function() { /* ...คงฟังก์ชันเดิม... */ };
window.deleteDocument = function(collection, docId) { /* ...คงฟังก์ชันเดิม... */ };

// ============================================================================
// 🗺️ ส่วนที่ 5: ระบบแผนที่พิกัดสมาชิก GIS 
// ============================================================================
let gisMapInstance = null; let gisMarkers = []; let gisHeatmapLayer = null;
window.loadGISMap = function() { /* ...คงฟังก์ชันเดิม... */ };
window.switchMapMode = function(mode) { /* ...คงฟังก์ชันเดิม... */ };

// ============================================================================
// 👥 ส่วนที่ 6: ระบบจัดการผู้ดูแลระบบ (ตามสายการบังคับบัญชา)
// ============================================================================

window.loadAdminsData = async function() {
    const container = document.getElementById('list-admins');
    const btnAdd = document.getElementById('btnAddAdmin');
    if (!container) return;

    const myRole = AdminState.currentAdmin?.role;
    const myCenter = AdminState.currentAdmin?.center;
    const myEmail = AdminState.currentAdmin?.email;

    // Master, ศูนย์ประสานงาน, ผู้ดูแล สามารถเห็นปุ่มเพิ่มแอดมินได้
    if (['Admin-Master', 'Admin-ศูนย์ประสานงาน', 'Admin-ผู้ดูแล'].includes(myRole)) {
        if (btnAdd) btnAdd.style.display = 'block';
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
    }

    AppHelper.showLoader(true, "กำลังดึงข้อมูลแอดมิน...");
    try {
        // ดึงเฉพาะ Admin-ผู้ดูแล ในศูนย์ของตัวเองมาแสดง ถ้าไม่ใช่ Master
        let query = db.collection("admins");
        if (myRole === 'Admin-ศูนย์ประสานงาน') {
            query = query.where("center", "==", myCenter).where("role", "==", "Admin-ผู้ดูแล");
        } else if (myRole === 'Admin-ผู้ดูแล') {
            query = query.where("createdBy", "==", myEmail); // ให้เห็นแค่คนที่ตัวเองตั้งขึ้นมาช่วยงาน
        }
        
        const snap = await query.get(); 
        let html = "";
        
        snap.forEach(doc => {
            const adm = doc.data(); 
            const email = doc.id; 
            const isMaster = adm.role === 'Admin-Master'; 
            const isActive = adm.status !== 'ระงับการใช้งาน'; 

            const roleBadge = isMaster 
                ? '<span class="badge bg-danger shadow-sm px-2 py-1"><i class="fa-solid fa-crown me-1"></i> Master</span>' 
                : `<span class="badge bg-info text-dark shadow-sm px-2 py-1">${adm.role || 'Admin'}</span>`;
            
            const isMe = myEmail === email;
            // เช็กสิทธิ์จัดการผ่านปุ่ม
            let canManage = false;
            if (myRole === 'Admin-Master' && !isMe) canManage = true;
            if (myRole === 'Admin-ศูนย์ประสานงาน' && adm.role === 'Admin-ผู้ดูแล' && adm.center === myCenter) canManage = true;
            
            // ใช้คำสั่ง manageAdminAccount ที่เราสร้างไว้ใน admin-auth.js
            const actionBtns = canManage ? `
                <button class="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3 shadow-sm" onclick="manageAdminAccount('${email}', '${adm.role}', '${adm.center}')">
                    <i class="fa-solid fa-gear me-1"></i> จัดการสิทธิ์
                </button>
            ` : '';

            html += `
            <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center bg-white rounded-4 border shadow-sm ${!isActive ? 'opacity-50' : ''}">
                <div class="d-flex align-items-center gap-3">
                    <div class="icon-box ${isActive ? 'bg-primary text-primary' : 'bg-secondary text-secondary'} bg-opacity-10 rounded-circle flex-shrink-0" style="width: 45px; height: 45px;">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div style="min-width: 0;">
                        <strong class="text-dark d-block text-truncate" style="font-size: 0.95rem;">${adm.name || email} ${isMe ? '<span class="badge bg-success ms-1">คุณ</span>' : ''}</strong>
                        <small class="text-muted d-block text-truncate">${email} | ศูนย์: ${adm.center || '-'}</small>
                        <div class="mt-1 d-flex gap-2 align-items-center">
                            ${roleBadge}
                            <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${isActive ? 'text-success' : 'text-danger'} border" style="font-size: 0.65rem;">${isActive ? 'ใช้งาน' : 'ระงับ'}</span>
                        </div>
                    </div>
                </div>
                <div class="text-end text-nowrap">${actionBtns}</div>
            </div>`;
        });
        
        container.innerHTML = html || '<div class="text-center text-muted small p-3">ไม่พบรายชื่อในเครือข่ายของคุณ</div>'; 
        AppHelper.showLoader(false);
    } catch (e) { 
        AppHelper.showLoader(false); console.error(e); 
        container.innerHTML = '<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>'; 
    }
};

window.openAddAdminModal = function() {
    const myRole = AdminState.currentAdmin.role;
    const myCenter = AdminState.currentAdmin.center || '';
    
    if(!['Admin-Master', 'Admin-ศูนย์ประสานงาน', 'Admin-ผู้ดูแล'].includes(myRole)) {
        return Swal.fire('ไม่อนุญาต', 'คุณไม่มีสิทธิ์เพิ่มผู้ดูแลระบบ', 'error');
    }

    let roleOpts = ''; let centerOpts = '';
    
    // กำหนดตัวเลือกของ Modal อิงตามสิทธิ์
    if (myRole === 'Admin-Master') {
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล</option><option value="Admin-ศูนย์ประสานงาน">Admin-ศูนย์ประสานงาน</option><option value="Admin-การเงิน">Admin-การเงิน</option><option value="Admin-สวัสดิการ">Admin-สวัสดิการ</option><option value="Admin-Master">Admin-Master</option>`;
        centerOpts = '<option value="">ไม่มีศูนย์ / ส่วนกลาง</option>';
        (AdminState.uiOptions?.centers || AdminState.fundSettings?.centers || []).forEach(c => { centerOpts += `<option value="${c}">${c}</option>`; });
    } else {
        // ศูนย์ และ ผู้ดูแล เพิ่มได้เฉพาะผู้ดูแลช่วยงาน และต้องอยู่ศูนย์เดียวกันเท่านั้น
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล (ผู้ช่วยระดับหมู่บ้าน)</option>`;
        centerOpts = `<option value="${myCenter}">${myCenter}</option>`;
    }

    Swal.fire({
        title: 'เพิ่มผู้ดูแลระบบ',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">อีเมลแอดมิน (ใช้ล็อกอิน) *</label>
                <input type="email" id="newAdminEmail" class="form-control-modern w-100 mb-3" placeholder="admin@example.com">
                <label class="small fw-bold text-muted mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" id="newAdminName" class="form-control-modern w-100 mb-3" placeholder="นายสมชาย ใจดี">
                <label class="small fw-bold text-muted mb-1">สิทธิ์การใช้งาน (Role) *</label>
                <select id="newAdminRole" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white" ${myRole !== 'Admin-Master' ? 'disabled' : ''}>${roleOpts}</select>
                <label class="small fw-bold text-muted mb-1">ศูนย์ประสานงานประจำตัว</label>
                <select id="newAdminCenter" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white" ${myRole !== 'Admin-Master' ? 'disabled' : ''}>${centerOpts}</select>
                <label class="small fw-bold text-muted mb-1">รหัส PIN 6 หลักเริ่มต้น *</label>
                <input type="text" id="newAdminPin" class="form-control-modern w-100 text-center fw-bold fs-5" maxlength="6" value="123456">
                <small class="text-muted d-block mt-2" style="font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i> ต้องเพิ่มอีเมลนี้ใน Authentication ของ Firebase ด้วยถึงจะล็อกอินได้</small>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกข้อมูล', confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const email = document.getElementById('newAdminEmail').value.trim(); 
            const name = document.getElementById('newAdminName').value.trim();
            const role = document.getElementById('newAdminRole').value; 
            const center = document.getElementById('newAdminCenter').value; 
            const pin = document.getElementById('newAdminPin').value.trim();
            if (!email || !name || pin.length !== 6 || isNaN(pin)) { Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน และ PIN 6 หลัก'); return false; }
            return { email, name, role, center, pin, status: 'ใช้งาน', createdBy: AdminState.currentAdmin.email };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังบันทึกข้อมูล...");
            try {
                const payload = res.value; const emailKey = payload.email; delete payload.email;
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("admins").doc(emailKey).set(payload); 
                AppHelper.showLoader(false); Swal.fire('สำเร็จ', 'เพิ่มผู้ดูแลเรียบร้อยแล้ว', 'success'); window.loadAdminsData();
            } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
        }
    });
};