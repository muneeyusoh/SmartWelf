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
// 🗺️ ส่วนที่ 5: ระบบแผนที่พิกัดสมาชิก GIS 
// ============================================================================
let gisMapInstance = null; let gisMarkers = []; let gisHeatmapLayer = null;
window.loadGISMap = function() {
    const mapDiv = document.getElementById('adminGISMap'); if (!mapDiv) return;
    if (typeof google === 'undefined' || !google.maps) { mapDiv.innerHTML = '<div class="text-center text-muted p-4">กำลังโหลด Google Maps API...</div>'; return; }

    const defaultLat = parseFloat(AdminState.fundSettings?.fundLat) || 5.92159; 
    const defaultLng = parseFloat(AdminState.fundSettings?.fundLng) || 101.76996;
    gisMapInstance = new google.maps.Map(mapDiv, { center: { lat: defaultLat, lng: defaultLng }, zoom: 12, mapTypeId: 'hybrid', streetViewControl: false, fullscreenControl: true });

    gisMarkers.forEach(m => m.setMap(null)); gisMarkers = [];
    const heatmapData = []; const membersWithLoc = (typeof allMembersCache !== 'undefined' ? allMembersCache : []).filter(m => m.latitude && m.longitude);

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
// 👥 ส่วนที่ 6: ระบบจัดการผู้ดูแลระบบ (พร้อมกรองสิทธิ์ Client-Side)
// ============================================================================

window.loadAdminsData = async function() {
    const container = document.getElementById('list-admins');
    const btnAdd = document.getElementById('btnAddAdmin');
    if (!container) return;

    const myRole = AdminState.currentAdmin?.role || 'Admin-Master';
    const myCenter = AdminState.currentAdmin?.center || '';
    const myEmail = AdminState.currentAdmin?.email || '';

    if (['Admin-Master', 'Admin-ศูนย์ประสานงาน', 'Admin-ผู้ดูแล'].includes(myRole)) {
        if (btnAdd) btnAdd.style.display = 'block';
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
    }

    AppHelper.showLoader(true, "กำลังดึงข้อมูลแอดมิน...");
    try {
        // 🌟 ดึงข้อมูลทั้งหมดมาก่อน แล้วค่อยใช้ JavaScript กรอง (เพื่อเลี่ยงบั๊ก Missing Index ใน Firebase)
        const snap = await db.collection("admins").get(); 
        let html = "";
        
        snap.forEach(doc => {
            const adm = doc.data(); 
            const email = doc.id; 
            
            // 🛡️ กรองสิทธิ์การมองเห็นบนหน้าจอ
            let isVisible = false;
            if (myRole === 'Admin-Master') {
                isVisible = true; // Master เห็นหมด
            } else if (myRole === 'Admin-ศูนย์ประสานงาน') {
                if (email === myEmail) isVisible = true; // เห็นตัวเอง
                else if (adm.role === 'Admin-ผู้ดูแล' && adm.center === myCenter) isVisible = true; // เห็นลูกข่ายในศูนย์
            } else if (myRole === 'Admin-ผู้ดูแล') {
                if (email === myEmail) isVisible = true; // เห็นตัวเอง
                else if (adm.createdBy === myEmail) isVisible = true; // เห็นคนที่ตัวเองเพิ่มมาช่วยงาน
            }

            // ถ้าคนนี้อยู่นอกเหนือสิทธิ์การมองเห็น ให้ข้ามไปเลย
            if (!isVisible) return; 

            const isMaster = adm.role === 'Admin-Master'; 
            const isActive = adm.status !== 'ระงับการใช้งาน' && adm.status !== 'ระงับ'; 

            const roleBadge = isMaster 
                ? '<span class="badge bg-danger shadow-sm px-2 py-1"><i class="fa-solid fa-crown me-1"></i> Master</span>' 
                : `<span class="badge bg-info text-dark shadow-sm px-2 py-1">${adm.role || 'Admin'}</span>`;
            
            const isMe = myEmail === email;
            
            // 🛡️ เช็กสิทธิ์ว่าปุ่ม "จัดการสิทธิ์" จะโผล่ไหม
            let canManage = false;
            if (myRole === 'Admin-Master' && !isMe) canManage = true;
            if (myRole === 'Admin-ศูนย์ประสานงาน' && adm.role === 'Admin-ผู้ดูแล' && adm.center === myCenter) canManage = true;
            
            const actionBtns = canManage ? `
                <button class="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3 shadow-sm mt-2" onclick="manageAdminAccount('${email}', '${adm.role}', '${adm.center}')">
                    <i class="fa-solid fa-gear me-1"></i> จัดการสิทธิ์
                </button>
            ` : '';

            html += `
            <div class="admin-card p-3 mb-3 d-flex justify-content-between align-items-center bg-white rounded-4 border shadow-sm ${!isActive ? 'opacity-50' : ''}">
                <div class="d-flex align-items-center gap-3 w-100">
                    <div class="icon-box ${isActive ? 'bg-primary text-primary' : 'bg-secondary text-secondary'} bg-opacity-10 rounded-circle flex-shrink-0" style="width: 50px; height: 50px;">
                        <i class="fa-solid fa-user-shield fs-5"></i>
                    </div>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <strong class="text-dark d-block text-truncate" style="font-size: 0.95rem;">${adm.name || email} ${isMe ? '<span class="badge bg-success ms-1">คุณ</span>' : ''}</strong>
                        <small class="text-muted d-block text-truncate mb-1">${email} | ศูนย์: ${adm.center || '-'}</small>
                        <div class="d-flex gap-2 align-items-center flex-wrap">
                            ${roleBadge}
                            <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${isActive ? 'text-success' : 'text-danger'} border" style="font-size: 0.65rem;">${isActive ? 'ใช้งาน' : 'ระงับ'}</span>
                        </div>
                    </div>
                </div>
                <div class="text-end flex-shrink-0 ms-2">
                    ${actionBtns}
                </div>
            </div>`;
        });
        
        container.innerHTML = html || '<div class="text-center text-muted small p-3">ไม่พบรายชื่อในเครือข่ายของคุณ</div>'; 
        AppHelper.showLoader(false);
    } catch (e) { 
        AppHelper.showLoader(false); console.error(e); 
        container.innerHTML = `<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาด: ${e.message}</div>`; 
    }
};

window.openAddAdminModal = async function() {
    const myRole = AdminState.currentAdmin.role;
    const myCenter = AdminState.currentAdmin.center || '';
    
    if(!['Admin-Master', 'Admin-ศูนย์ประสานงาน', 'Admin-ผู้ดูแล'].includes(myRole)) {
        return Swal.fire('ไม่อนุญาต', 'คุณไม่มีสิทธิ์เพิ่มผู้ดูแลระบบ', 'error');
    }

    const { value: searchKey } = await Swal.fire({
        title: 'ค้นหาสมาชิก',
        html: '<p class="small text-muted mb-2">ระบุ <b>เลขประจำตัวประชาชน</b> หรือ <b>เบอร์โทรศัพท์</b> ของสมาชิกที่ต้องการแต่งตั้งเป็นแอดมิน</p>',
        input: 'text', inputPlaceholder: 'กรอกเลข ปชช. หรือ เบอร์โทร...',
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-search"></i> ค้นหา', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563EB'
    });

    if (!searchKey) return;

    AppHelper.showLoader(true, "กำลังค้นหาข้อมูลสมาชิก...");
    let targetMember = null; let targetUid = null;

    try {
        const membersRef = db.collection("members");
        let snap = await membersRef.where("phone", "==", searchKey.trim()).limit(1).get();
        if (snap.empty) { snap = await membersRef.where("nationalId", "==", searchKey.trim()).limit(1).get(); }

        if (snap.empty) {
            AppHelper.showLoader(false);
            return Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ไม่พบสมาชิกที่ระบุ กรุณาตรวจสอบความถูกต้อง', confirmButtonText: 'ลองใหม่' }).then(() => window.openAddAdminModal());
        }

        targetUid = snap.docs[0].id; targetMember = snap.docs[0].data();
        AppHelper.showLoader(false);
    } catch (e) { AppHelper.showLoader(false); return Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ' + e.message, 'error'); }

    if (myRole !== 'Admin-Master' && targetMember.center !== myCenter) {
        return Swal.fire('ไม่อนุญาต', `สมาชิกท่านนี้อยู่ศูนย์ "${targetMember.center || 'ไม่ระบุ'}" ซึ่งอยู่นอกเขตรับผิดชอบของคุณ`, 'error');
    }

    let roleOpts = ''; let centerOpts = '';
    
    if (myRole === 'Admin-Master') {
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล</option><option value="Admin-ศูนย์ประสานงาน">Admin-ศูนย์ประสานงาน</option><option value="Admin-การเงิน">Admin-การเงิน</option><option value="Admin-สวัสดิการ">Admin-สวัสดิการ</option><option value="Admin-Master">Admin-Master</option>`;
        centerOpts = '<option value="">ไม่มีศูนย์ / ส่วนกลาง</option>';
        const centersList = AdminState.uiOptions?.centers || AdminState.fundSettings?.centers || [];
        centersList.forEach(c => { const selected = c === targetMember.center ? 'selected' : ''; centerOpts += `<option value="${c}" ${selected}>${c}</option>`; });
    } else {
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล (ผู้ช่วยระดับหมู่บ้าน)</option>`;
        centerOpts = `<option value="${myCenter}" selected>${myCenter}</option>`;
    }

    Swal.fire({
        title: 'ยืนยันการตั้งแอดมิน',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <div class="alert alert-success border-success border-opacity-25 rounded-4 py-2 px-3 mb-3 d-flex align-items-center shadow-sm bg-opacity-10">
                    <div class="bg-success text-white rounded-circle d-flex justify-content-center align-items-center me-3" style="width: 40px; height: 40px;"><i class="fa-solid fa-user-check"></i></div>
                    <div style="min-width: 0;"><strong class="d-block text-success text-truncate">${targetMember.fullName}</strong><small class="text-muted text-truncate d-block">รหัสอ้างอิง: ${targetMember.memberId || targetUid.substring(0,8)}</small></div>
                </div>
                
                <label class="small fw-bold text-muted mb-1">อีเมลแอดมิน (ใช้ล็อกอิน) *</label>
                <input type="email" id="newAdminEmail" class="form-control-modern w-100 mb-3" value="${targetMember.email || ''}" placeholder="จำเป็นต้องใช้อีเมลเพื่อเข้าระบบ">
                <input type="hidden" id="newAdminName" value="${targetMember.fullName}">
                <input type="hidden" id="newAdminUid" value="${targetUid}">
                
                <label class="small fw-bold text-muted mb-1">สิทธิ์การใช้งาน (Role) *</label>
                <select id="newAdminRole" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white" ${myRole !== 'Admin-Master' ? 'disabled' : ''}>${roleOpts}</select>
                <label class="small fw-bold text-muted mb-1">ศูนย์ประสานงานประจำตัว</label>
                <select id="newAdminCenter" class="form-select-modern w-100 mb-3 shadow-sm border-0 bg-white" ${myRole !== 'Admin-Master' ? 'disabled' : ''}>${centerOpts}</select>
                <label class="small fw-bold text-muted mb-1">รหัส PIN 6 หลักเริ่มต้น *</label>
                <input type="text" id="newAdminPin" class="form-control-modern w-100 text-center fw-bold fs-5" maxlength="6" value="123456">
                <small class="text-danger d-block mt-2" style="font-size:0.75rem;"><i class="fa-solid fa-circle-exclamation me-1"></i> ต้องนำอีเมลไปเพิ่มใน Authentication ของ Firebase ด้วย</small>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const email = document.getElementById('newAdminEmail').value.trim(); const name = document.getElementById('newAdminName').value.trim();
            const uid = document.getElementById('newAdminUid').value.trim(); const role = document.getElementById('newAdminRole').value; 
            const center = document.getElementById('newAdminCenter').value; const pin = document.getElementById('newAdminPin').value.trim();
            if (!email || pin.length !== 6 || isNaN(pin)) { Swal.showValidationMessage('กรุณาระบุอีเมล และ PIN ต้องเป็นตัวเลข 6 หลัก'); return false; }
            return { email, name, role, center, pin, uid, status: 'ใช้งาน', createdBy: AdminState.currentAdmin.email };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังบันทึกข้อมูล...");
            try {
                const payload = res.value; const emailKey = payload.email; delete payload.email; payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const batch = db.batch();
                batch.set(db.collection("admins").doc(emailKey), payload);
                batch.update(db.collection("members").doc(payload.uid), { email: emailKey, isAdmin: true, adminRole: payload.role });
                await batch.commit();

                if(typeof window.createAuditLog === 'function') await window.createAuditLog("เพิ่มแอดมินใหม่", `ตั้ง ${payload.name} เป็น ${payload.role}`);

                AppHelper.showLoader(false); Swal.fire('สำเร็จ', `แต่งตั้ง ${payload.name} เป็นแอดมินเรียบร้อยแล้ว`, 'success'); 
                window.loadAdminsData();
            } catch (e) { AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', e.message, 'error'); }
        }
    });
};
