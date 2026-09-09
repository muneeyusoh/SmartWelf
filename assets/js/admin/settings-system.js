window.openAddAdminModal = async function() {
    const myRole = AdminState.currentAdmin.role;
    const myCenter = AdminState.currentAdmin.center || '';
    
    // เช็คสิทธิ์ว่าใครมีสิทธิ์เพิ่มแอดมินบ้าง
    if(!['Admin-Master', 'Admin-ศูนย์ประสานงาน', 'Admin-ผู้ดูแล'].includes(myRole)) {
        return Swal.fire('ไม่อนุญาต', 'คุณไม่มีสิทธิ์เพิ่มผู้ดูแลระบบ', 'error');
    }

    // 🌟 ขั้นตอนที่ 1: ค้นหาสมาชิกจากฐานข้อมูล
    const { value: searchKey } = await Swal.fire({
        title: 'ค้นหาสมาชิก',
        html: '<p class="small text-muted mb-2">ระบุ <b>เลขประจำตัวประชาชน</b> หรือ <b>เบอร์โทรศัพท์</b> ของสมาชิกที่ต้องการแต่งตั้งเป็นแอดมิน</p>',
        input: 'text',
        inputPlaceholder: 'กรอกเลข ปชช. หรือ เบอร์โทร...',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-search"></i> ค้นหา',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563EB'
    });

    if (!searchKey) return;

    AppHelper.showLoader(true, "กำลังค้นหาข้อมูลสมาชิก...");
    let targetMember = null;
    let targetUid = null;

    try {
        const membersRef = db.collection("members");
        
        // ค้นหาจากเบอร์โทรศัพท์ก่อน
        let snap = await membersRef.where("phone", "==", searchKey.trim()).limit(1).get();
        
        // ถ้าไม่เจอ ค้นหาจากเลข ปชช. ต่อ
        if (snap.empty) {
            snap = await membersRef.where("nationalId", "==", searchKey.trim()).limit(1).get();
        }

        if (snap.empty) {
            AppHelper.showLoader(false);
            return Swal.fire({
                icon: 'warning',
                title: 'ไม่พบข้อมูล',
                text: 'ไม่พบสมาชิกที่ระบุ กรุณาตรวจสอบความถูกต้องและลองใหม่อีกครั้ง',
                confirmButtonText: 'ลองใหม่'
            }).then(() => window.openAddAdminModal());
        }

        targetUid = snap.docs[0].id;
        targetMember = snap.docs[0].data();
        AppHelper.showLoader(false);

    } catch (e) {
        AppHelper.showLoader(false);
        return Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลสมาชิกได้: ' + e.message, 'error');
    }

    // 🛡️ ป้องกันแอดมินศูนย์ ดึงสมาชิกข้ามศูนย์มาเป็นแอดมินตัวเอง
    if (myRole !== 'Admin-Master' && targetMember.center !== myCenter) {
        return Swal.fire('ไม่อนุญาต', `สมาชิกท่านนี้อยู่ศูนย์ "${targetMember.center || 'ไม่ระบุ'}" ซึ่งอยู่นอกเขตรับผิดชอบของคุณ`, 'error');
    }

    // 🌟 ขั้นตอนที่ 2: ตั้งค่าสิทธิ์และรหัสผ่านให้สมาชิกที่ค้นพบ
    let roleOpts = ''; let centerOpts = '';
    
    if (myRole === 'Admin-Master') {
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล</option><option value="Admin-ศูนย์ประสานงาน">Admin-ศูนย์ประสานงาน</option><option value="Admin-การเงิน">Admin-การเงิน</option><option value="Admin-สวัสดิการ">Admin-สวัสดิการ</option><option value="Admin-Master">Admin-Master</option>`;
        centerOpts = '<option value="">ไม่มีศูนย์ / ส่วนกลาง</option>';
        (AdminState.uiOptions?.centers || AdminState.fundSettings?.centers || []).forEach(c => { 
            const selected = c === targetMember.center ? 'selected' : '';
            centerOpts += `<option value="${c}" ${selected}>${c}</option>`; 
        });
    } else {
        roleOpts = `<option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล (ผู้ช่วยระดับหมู่บ้าน)</option>`;
        centerOpts = `<option value="${myCenter}" selected>${myCenter}</option>`;
    }

    Swal.fire({
        title: 'ยืนยันการตั้งแอดมิน',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <!-- โชว์การ์ดชื่อสมาชิกที่ดึงมาได้ -->
                <div class="alert alert-success border-success border-opacity-25 rounded-4 py-2 px-3 mb-3 d-flex align-items-center shadow-sm bg-opacity-10">
                    <div class="bg-success text-white rounded-circle d-flex justify-content-center align-items-center me-3" style="width: 40px; height: 40px;">
                        <i class="fa-solid fa-user-check"></i>
                    </div>
                    <div style="min-width: 0;">
                        <strong class="d-block text-success text-truncate">${targetMember.fullName}</strong>
                        <small class="text-muted text-truncate d-block">รหัสอ้างอิง: ${targetMember.memberId || targetUid.substring(0,8)}</small>
                    </div>
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
                
                <small class="text-danger d-block mt-2" style="font-size:0.75rem;"><i class="fa-solid fa-circle-exclamation me-1"></i> <b>สำคัญมาก:</b> ต้องนำอีเมลด้านบนไปเพิ่มในแถบ Authentication ของ Firebase Console ก่อน แอดมินใหม่ถึงจะล็อกอินได้นะครับ</small>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> ยืนยันการแต่งตั้ง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const email = document.getElementById('newAdminEmail').value.trim(); 
            const name = document.getElementById('newAdminName').value.trim();
            const uid = document.getElementById('newAdminUid').value.trim();
            const role = document.getElementById('newAdminRole').value; 
            const center = document.getElementById('newAdminCenter').value; 
            const pin = document.getElementById('newAdminPin').value.trim();
            
            if (!email || pin.length !== 6 || isNaN(pin)) { 
                Swal.showValidationMessage('กรุณาระบุอีเมล และ PIN ต้องเป็นตัวเลข 6 หลักถ้วน'); 
                return false; 
            }
            return { email, name, role, center, pin, uid, status: 'ใช้งาน', createdBy: AdminState.currentAdmin.email };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังบันทึกข้อมูล...");
            try {
                const payload = res.value; 
                const emailKey = payload.email; 
                delete payload.email; 
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                
                const batch = db.batch();
                
                // 1. บันทึกข้อมูลเข้าตาราง admins
                const adminRef = db.collection("admins").doc(emailKey);
                batch.set(adminRef, payload);
                
                // 2. อัปเดตข้อมูลอีเมลกลับไปที่ตาราง members เพื่อให้เชื่อมกันสมบูรณ์
                const memberRef = db.collection("members").doc(payload.uid);
                batch.update(memberRef, { 
                    email: emailKey, 
                    isAdmin: true,
                    adminRole: payload.role 
                });

                await batch.commit();

                // 3. เก็บ Audit Log
                await window.createAuditLog("เพิ่มแอดมินใหม่", `ตั้ง ${payload.name} เป็น ${payload.role}`);

                AppHelper.showLoader(false); 
                Swal.fire('สำเร็จ', `แต่งตั้ง ${payload.name} เป็นแอดมินเรียบร้อยแล้ว`, 'success'); 
                window.loadAdminsData();
            } catch (e) { 
                AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', e.message, 'error'); 
            }
        }
    });
};
