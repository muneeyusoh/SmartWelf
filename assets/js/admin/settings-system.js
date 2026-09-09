// ============================================================================
// 🔒 ส่วนที่ 3: ระบบบันทึก ธนาคาร / API / ความปลอดภัย
// ============================================================================

window.saveBankSettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({ bankDetails: { name: document.getElementById('bankName').value.trim(), accountName: document.getElementById('bankAccountName').value.trim(), accountNumber: document.getElementById('bankAccountNumber').value.trim() } }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกข้อมูลบัญชีธนาคารเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

window.saveConnectionSettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({ connectionDetails: { liffId: document.getElementById('settingLiffId').value.trim(), lineAccessToken: document.getElementById('settingLineToken').value.trim() } }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกการเชื่อมต่อบัญชีเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

window.savePrivacySettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({ privacySettings: { requirePdpa: document.getElementById('requirePdpa').checked, maskSensitiveData: document.getElementById('maskSensitiveData').checked } }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าความปลอดภัยเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

window.deleteDocument = function(collection, docId) {
    Swal.fire({ title: 'ยืนยันการลบ?', text: "ข้อมูลนี้จะถูกลบออกจากระบบถาวร", icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ใช่, ลบทิ้ง', cancelButtonText: 'ยกเลิก' })
    .then(async (result) => {
        if (result.isConfirmed) {
            await db.collection(collection).doc(docId).delete();
            if(collection === 'missions') loadMissions();
            if(collection === 'rewards') loadRewards();
        }
    });
};

// ============================================================================
// 🗺️ ส่วนที่ 5: ระบบแผนที่พิกัดสมาชิก GIS (Google Maps & Heatmap)
// ============================================================================

let gisMapInstance = null; let gisMarkers = []; let gisHeatmapLayer = null;

window.loadGISMap = function() {
    const mapDiv = document.getElementById('adminGISMap'); if (!mapDiv) return;
    if (typeof google === 'undefined' || !google.maps) { mapDiv.innerHTML = '<div class="text-center text-muted p-4">กำลังโหลด Google Maps API...</div>'; return; }

    const defaultLat = parseFloat(fundSettings?.fundLat) || 5.92159; const defaultLng = parseFloat(fundSettings?.fundLng) || 101.76996;
    gisMapInstance = new google.maps.Map(mapDiv, { center: { lat: defaultLat, lng: defaultLng }, zoom: 12, mapTypeId: 'hybrid', streetViewControl: false, fullscreenControl: true });

    gisMarkers.forEach(m => m.setMap(null)); gisMarkers = [];
    const heatmapData = []; const membersWithLoc = (allMembersCache || []).filter(m => m.latitude && m.longitude);

    membersWithLoc.forEach(m => {
        const lat = parseFloat(m.latitude); const lng = parseFloat(m.longitude); if (isNaN(lat) || isNaN(lng)) return;
        const pos = new google.maps.LatLng(lat, lng); heatmapData.push(pos);
        const marker = new google.maps.Marker({ position: pos, map: gisMapInstance, title: m.fullName, icon: { url: m.status === 'เป็นสมาชิก' ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' } });
        const infoWindow = new google.maps.InfoWindow({ content: `<div style="font-family:'Prompt'; padding: 5px;"><strong style="font-size:0.9rem;">${m.fullName}</strong><div style="font-size:0.75rem; color:#64748B; margin-top:2px;">รหัส: <strong>${m.memberId || '-'}</strong><br>หมู่บ้าน: ${m.village || '-'}<br>โทร: <a href="tel:${m.phone}">${m.phone || '-'}</a></div><span class="badge ${m.status === 'เป็นสมาชิก' ? 'bg-success' : 'bg-warning'} mt-2" style="font-size:0.65rem;">${m.status}</span></div>` });
        marker.addListener('click', () => { infoWindow.open(gisMapInstance, marker); });
        gisMarkers.push(marker);
    });

    if (google.maps.visualization && google.maps.visualization.HeatmapLayer) { gisHeatmapLayer = new google.maps.visualization.HeatmapLayer({ data: heatmapData, map: null, radius: 30 }); }
    switchMapMode('micro');
};

window.switchMapMode = function(mode) {
    if (!gisMapInstance) return;
    if (mode === 'macro') { gisMarkers.forEach(m => m.setMap(null)); if (gisHeatmapLayer) gisHeatmapLayer.setMap(gisMapInstance); } 
    else { if (gisHeatmapLayer) gisHeatmapLayer.setMap(null); gisMarkers.forEach(m => m.setMap(gisMapInstance)); }
};

// ============================================================================
// 👥 ส่วนที่ 6: ระบบจัดการผู้ดูแลระบบ (Admin Users Management)
// ============================================================================

window.loadAdminsData = async function() {
    const container = document.getElementById('list-admins');
    const btnAdd = document.getElementById('btnAddAdmin');
    if (!container) return;

    // เช็คสิทธิ์การแสดงปุ่มเพิ่มแอดมิน (เฉพาะ Admin-Master)
    if (AdminState.currentAdmin && AdminState.currentAdmin.role === 'Admin-Master') {
        if (btnAdd) btnAdd.style.display = 'block';
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
    }

    AppHelper.showLoader(true, "กำลังโหลดรายชื่อผู้ดูแลระบบ...");
    try {
        const snap = await db.collection("admins").get(); 
        let html = "";
        
        snap.forEach(doc => {
            const adm = doc.data(); 
            const email = doc.id; // ใช้ Email เป็น Document ID
            const isMaster = adm.role === 'Admin-Master'; 
            const isActive = adm.status !== 'ระงับการใช้งาน'; // เช็กจากสถานะจริง

            const roleBadge = isMaster 
                ? '<span class="badge bg-danger shadow-sm px-2 py-1"><i class="fa-solid fa-crown me-1"></i> Master</span>' 
                : `<span class="badge bg-info text-dark shadow-sm px-2 py-1">${adm.role || 'Admin'}</span>`;
            
            // สิทธิ์ในการจัดการ (ตัวเองลบตัวเองไม่ได้)
            const isMe = AdminState.currentAdmin?.email === email;
            const canManage = (AdminState.currentAdmin?.role === 'Admin-Master') && !isMe;
            
            // 🌟 พระเอกของเรา! ปุ่มจัดการสิทธิ์ที่จะไปเรียกใช้ masterManageAdmin ในหน้า admin-auth.js
            const actionBtns = canManage ? `
                <button class="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3 shadow-sm" onclick="masterManageAdmin('${email}')">
                    <i class="fa-solid fa-gear me-1"></i> จัดการบัญชี
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
                        <small class="text-muted d-block text-truncate">${email}</small>
                        <div class="mt-1 d-flex gap-2 align-items-center">
                            ${roleBadge}
                            <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${isActive ? 'text-success' : 'text-danger'} border" style="font-size: 0.65rem;">${isActive ? 'ใช้งาน' : 'ระงับ'}</span>
                        </div>
                    </div>
                </div>
                <div class="text-end text-nowrap">${actionBtns}</div>
            </div>`;
        });
        
        container.innerHTML = html || '<div class="text-center text-muted small p-3">ไม่พบรายชื่อผู้ดูแลระบบ</div>'; 
        AppHelper.showLoader(false);
    } catch (e) { 
        AppHelper.showLoader(false); console.error(e); 
        container.innerHTML = '<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>'; 
    }
};

window.openAddAdminModal = function() {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') {
        return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้นที่ทำได้', 'error');
    }

    // ดึงรายชื่อศูนย์จาก AdminState
    let centerOptsHtml = '<option value="">ไม่มีศูนย์ / ส่วนกลาง</option>';
    // ปรับวิธีดึงศูนย์ให้รองรับหลายรูปแบบ
    const centerList = AdminState.uiOptions?.centers || AdminState.fundSettings?.centers || [];
    centerList.forEach(c => { centerOptsHtml += `<option value="${c}">${c}</option>`; });

    Swal.fire({
        title: 'เพิ่มผู้ดูแลระบบใหม่',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">อีเมลแอดมิน (ใช้ล็อกอิน) *</label>
                <input type="email" id="newAdminEmail" class="form-control-modern w-100 mb-3" placeholder="admin@example.com">
                
                <label class="small fw-bold text-muted mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" id="newAdminName" class="form-control-modern w-100 mb-3" placeholder="นายสมชาย ใจดี">
                
                <label class="small fw-bold text-muted mb-1">สิทธิ์การใช้งาน (Role) *</label>
                <select id="newAdminRole" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white">
                    <option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล (ดูแลสมาชิกในหมู่บ้าน)</option>
                    <option value="Admin-ศูนย์ประสานงาน">Admin-ศูนย์ประสานงาน (ดูแลสมาชิกในศูนย์)</option>
                    <option value="Admin-การเงิน">Admin-การเงิน (ดูแลบัญชี)</option>
                    <option value="Admin-สวัสดิการ">Admin-สวัสดิการ (พิจารณาคำขอ)</option>
                    <option value="Admin-Master">Admin-Master (สิทธิ์สูงสุด)</option>
                </select>
                
                <label class="small fw-bold text-muted mb-1">ศูนย์ประสานงานประจำตัว</label>
                <select id="newAdminCenter" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white">${centerOptsHtml}</select>
                
                <label class="small fw-bold text-muted mb-1">รหัส PIN 6 หลักเริ่มต้น *</label>
                <input type="text" id="newAdminPin" class="form-control-modern w-100 text-center fw-bold fs-5" maxlength="6" value="123456">
                <small class="text-muted d-block mt-2" style="font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i> ต้องเพิ่มอีเมลนี้ใน Authentication ของ Firebase ด้วยถึงจะใช้งานได้</small>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกข้อมูล', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const email = document.getElementById('newAdminEmail').value.trim(); 
            const name = document.getElementById('newAdminName').value.trim();
            const role = document.getElementById('newAdminRole').value; 
            const center = document.getElementById('newAdminCenter').value; 
            const pin = document.getElementById('newAdminPin').value.trim();
            
            if (!email || !name || pin.length !== 6 || isNaN(pin)) { 
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน และ PIN ต้องเป็นตัวเลข 6 หลัก'); 
                return false; 
            }
            return { email, name, role, center, pin, status: 'ใช้งาน' };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังบันทึกข้อมูลผู้ดูแล...");
            try {
                const payload = res.value; 
                const emailKey = payload.email; 
                delete payload.email; // ไม่เก็บ email ซ้ำในฟิลด์เพราะเราใช้เป็น ID แล้ว
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                
                await db.collection("admins").doc(emailKey).set(payload); 
                AppHelper.showLoader(false); 
                Swal.fire('สำเร็จ', 'เพิ่มผู้ดูแลระบบเรียบร้อยแล้ว', 'success'); 
                window.loadAdminsData();
            } catch (e) { 
                AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); 
            }
        }
    });
};