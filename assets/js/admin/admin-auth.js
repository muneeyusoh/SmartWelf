// =========================================================
// 🔐 admin/admin-auth.js: ระบบยืนยันตัวตนและการจัดการสิทธิ์ (RBAC V2)
// =========================================================

window.AdminState = window.AdminState || {
    currentAdmin: null,
    fundSettings: {},
    currentPin: ""
};

document.addEventListener("DOMContentLoaded", async () => { 
    try {
        const sysSnap = await db.collection("settings").doc("master").get();
        if(sysSnap.exists) { AdminState.fundSettings = sysSnap.data(); }
        
        updatePinDisplay();

        try { await liff.init({ liffId: ADMIN_LIFF_ID }); } 
        catch(liffErr) { console.warn("LIFF Init Error:", liffErr); }

        if(auth) {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const adminDoc = await db.collection("admins").doc(user.email).get();
                        if (adminDoc.exists && adminDoc.data().status === 'ใช้งาน') {
                            AppHelper.showLoader(false);
                            document.getElementById('loginGate').style.display = 'flex';
                            document.getElementById('adminApp').style.display = 'none';
                            switchLoginMode('pin'); 
                        } else {
                            await auth.signOut();
                            showLoginForm();
                            Swal.fire('ระงับการใช้งาน', 'บัญชีถูกระงับ หรือยังไม่ได้รับการอนุมัติ', 'error');
                        }
                    } catch (error) {
                        await auth.signOut();
                        showLoginForm();
                        if(error.code === 'permission-denied') Swal.fire('ข้อผิดพลาดสิทธิ์', 'คุณไม่มีสิทธิ์เข้าถึงฐานข้อมูล', 'error');
                    }
                } else {
                    showLoginForm();
                }
            });
        }
    } catch(e) { document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4"><h6>System Error</h6><p class="small">${e.message}</p></div>`; }
});

function showLoginForm() {
    AppHelper.showLoader(false);
    document.getElementById('loginGate').style.display = 'flex';
    document.getElementById('adminApp').style.display = 'none';
    switchLoginMode('email');
}

async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim(); 
    const pass = document.getElementById('adminPass').value.trim();
    if(!email || !pass) return Swal.fire('เตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    
    AppHelper.showLoader(true, "กำลังยืนยันตัวตน...");
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        Swal.fire({ icon: 'success', title: 'อีเมลถูกต้อง', text: 'กรุณากรอกรหัส PIN 6 หลัก', showConfirmButton: false, timer: 1500 });
    } catch (e) { 
        AppHelper.showLoader(false); 
        let msg = "อีเมล หรือ รหัสผ่านไม่ถูกต้อง";
        if(e.code === 'auth/too-many-requests') msg = "ล็อกอินล้มเหลวหลายครั้ง กรุณารอสักครู่";
        Swal.fire('ปฏิเสธการเข้าถึง', msg, 'error'); 
    }
}

async function requestPasswordReset() {
    const { value: email } = await Swal.fire({
        title: 'ลืมรหัสผ่าน?', text: 'กรุณากรอกอีเมลแอดมินที่ลงทะเบียนไว้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้', input: 'email',
        showCancelButton: true, confirmButtonText: 'ส่งลิงก์รีเซ็ต', confirmButtonColor: '#2563EB'
    });

    if (email) {
        AppHelper.showLoader(true, "กำลังส่งข้อมูล...");
        try {
            const adminDoc = await db.collection("admins").doc(email.trim()).get();
            if (adminDoc.exists && adminDoc.data().status === 'ใช้งาน') {
                await auth.sendPasswordResetEmail(email.trim());
                AppHelper.showLoader(false);
                Swal.fire('สำเร็จ', 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว', 'success');
            } else {
                AppHelper.showLoader(false); Swal.fire('ปฏิเสธ', 'ไม่พบอีเมลนี้ในระบบ', 'error');
            }
        } catch (error) {
            AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', error.message, 'error');
        }
    }
}

function switchLoginMode(mode) {
    document.getElementById('tabEmail').classList.remove('active'); document.getElementById('tabPin').classList.remove('active');
    if(mode === 'email') {
        document.getElementById('tabEmail').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'block'; document.getElementById('pinLoginSection').style.display = 'none';
    } else {
        if (!auth.currentUser) return switchLoginMode('email');
        document.getElementById('tabPin').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'none'; document.getElementById('pinLoginSection').style.display = 'block'; 
        clearPin();
    }
}

function pressPin(num) { if(AdminState.currentPin.length < 6) { AdminState.currentPin += num; updatePinDisplay(); if(AdminState.currentPin.length === 6) verifyPinLogin(); } }
function deletePin() { if(AdminState.currentPin.length > 0) { AdminState.currentPin = AdminState.currentPin.slice(0, -1); updatePinDisplay(); } }
function clearPin() { AdminState.currentPin = ""; updatePinDisplay(); }

function updatePinDisplay() { 
    const dots = document.querySelectorAll('.pin-dot'); 
    dots.forEach((dot, idx) => { 
        dot.style.width = '18px'; dot.style.height = '18px'; dot.style.borderRadius = '50%'; dot.style.border = '2px solid #ffffff'; dot.style.display = 'inline-block'; dot.style.transition = '0.2s';
        dot.style.backgroundColor = (idx < AdminState.currentPin.length) ? '#ffffff' : 'transparent'; 
    }); 
}

async function verifyPinLogin() {
    if (!auth.currentUser) return clearPin();
    Swal.fire({ title: 'กำลังตรวจสอบ PIN...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const adminDoc = await db.collection("admins").doc(auth.currentUser.email).get();
        if(adminDoc.exists && adminDoc.data().pin === AdminState.currentPin && adminDoc.data().status === 'ใช้งาน') { 
            Swal.fire({ icon: 'success', title: 'ปลดล็อกสำเร็จ', showConfirmButton: false, timer: 1000 });
            setTimeout(() => { grantAccess(adminDoc.data(), adminDoc.id); clearPin(); }, 1000);
        } else { 
            Swal.fire('ปฏิเสธการเข้าถึง', 'รหัส PIN ไม่ถูกต้อง หรือบัญชีถูกระงับ', 'error'); clearPin(); 
        }
    } catch(e) { Swal.fire('Error', 'การเชื่อมต่อขัดข้อง', 'error'); clearPin(); }
}

async function changeAdminPin() {
    if (!AdminState.currentAdmin) return;
    const { value: oldPin } = await Swal.fire({ title: 'ยืนยันรหัส PIN เดิม', input: 'password', inputAttributes: { maxlength: 6, inputmode: 'numeric' }, showCancelButton: true, confirmButtonText: 'ถัดไป' });
    if (!oldPin) return;
    if (oldPin !== AdminState.currentAdmin.pin) return Swal.fire('ผิดพลาด', 'รหัส PIN เดิมไม่ถูกต้อง', 'error');

    const { value: newPin } = await Swal.fire({ title: 'ตั้งรหัส PIN ใหม่ 6 หลัก', input: 'password', inputAttributes: { maxlength: 6, inputmode: 'numeric' }, showCancelButton: true, confirmButtonText: 'บันทึก', confirmButtonColor: '#10B981' });
    if (newPin && newPin.length === 6) {
        AppHelper.showLoader(true, "กำลังบันทึก PIN...");
        try {
            await db.collection("admins").doc(AdminState.currentAdmin.id).update({ pin: newPin });
            AdminState.currentAdmin.pin = newPin; 
            await createAuditLog("เปลี่ยนรหัส PIN", "แอดมินเปลี่ยนรหัส PIN ของตนเอง");
            AppHelper.showLoader(false); Swal.fire('สำเร็จ', 'อัปเดต PIN เรียบร้อยแล้ว', 'success');
        } catch (e) { AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปลี่ยน PIN ได้', 'error'); }
    } else if (newPin) { Swal.fire('ผิดพลาด', 'รหัส PIN ต้องมี 6 หลัก', 'warning'); }
}

// 🌟 อัปเดตฟังก์ชันจัดการสิทธิ์แบบลำดับขั้น (Hierarchical Management)
window.manageAdminAccount = async function(targetAdminEmail, targetRole, targetCenter) {
    const myRole = AdminState.currentAdmin.role;
    const myCenter = AdminState.currentAdmin.center;

    // เช็คสิทธิ์การจัดการ
    let canManage = false;
    if (myRole === 'Admin-Master') canManage = true;
    else if (myRole === 'Admin-ศูนย์ประสานงาน' && targetRole === 'Admin-ผู้ดูแล' && targetCenter === myCenter) canManage = true;
    
    if (!canManage) return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่สามารถจัดการบัญชีนี้ได้', 'error');

    let inputOptions = {};
    if (myRole === 'Admin-Master') {
        inputOptions = { 'reset_pin': 'รีเซ็ตรหัส PIN เป็น 000000', 'change_role': 'เปลี่ยนตำแหน่ง (Role)', 'suspend': 'ระงับบัญชี (ห้ามเข้าระบบ)', 'activate': 'เปิดใช้งานบัญชี' };
    } else if (myRole === 'Admin-ศูนย์ประสานงาน') {
        inputOptions = { 'reset_pin': 'รีเซ็ตรหัส PIN ให้ผู้ดูแลเป็น 000000', 'suspend': 'ระงับสิทธิ์ผู้ดูแล', 'activate': 'คืนสิทธิ์ผู้ดูแล' };
    }

    const { value: action } = await Swal.fire({
        title: `จัดการบัญชี ${targetAdminEmail}`, input: 'select', inputOptions: inputOptions,
        inputPlaceholder: 'เลือกการจัดการ', showCancelButton: true, confirmButtonText: 'ดำเนินการ'
    });

    if (!action) return;
    AppHelper.showLoader(true, "กำลังดำเนินการ...");

    try {
        const adminRef = db.collection("admins").doc(targetAdminEmail);
        
        if (action === 'reset_pin') {
            await adminRef.update({ pin: "000000" });
            await createAuditLog("รีเซ็ต PIN", `รีเซ็ต PIN ของ ${targetAdminEmail}`);
            Swal.fire('สำเร็จ', 'รีเซ็ต PIN เป็น 000000 เรียบร้อย', 'success');
            
        } else if (action === 'change_role' && myRole === 'Admin-Master') {
            AppHelper.showLoader(false);
            const { value: newRole } = await Swal.fire({
                title: 'เลือกตำแหน่งใหม่', input: 'select',
                inputOptions: { 'Admin-การเงิน': 'การเงิน', 'Admin-ศูนย์ประสานงาน': 'ศูนย์ประสานงาน', 'Admin-สวัสดิการ': 'สวัสดิการ', 'Admin-ผู้ดูแล': 'ผู้ดูแลระดับหมู่บ้าน' },
                showCancelButton: true
            });
            if (newRole) {
                AppHelper.showLoader(true);
                await adminRef.update({ role: newRole });
                await createAuditLog("เปลี่ยน Role", `เปลี่ยน ${targetAdminEmail} เป็น ${newRole}`);
                Swal.fire('สำเร็จ', 'เปลี่ยนตำแหน่งเรียบร้อย', 'success');
            }
            
        } else if (action === 'suspend') {
            await adminRef.update({ status: "ระงับการใช้งาน" });
            await createAuditLog("ระงับบัญชี", `ระงับ ${targetAdminEmail}`);
            Swal.fire('สำเร็จ', 'ระงับบัญชีเรียบร้อย', 'success');
            
        } else if (action === 'activate') {
            await adminRef.update({ status: "ใช้งาน" });
            await createAuditLog("เปิดใช้บัญชี", `เปิดใช้งาน ${targetAdminEmail}`);
            Swal.fire('สำเร็จ', 'บัญชีพร้อมใช้งาน', 'success');
        }
        
        AppHelper.showLoader(false);
        if(typeof loadAdminsData === 'function') loadAdminsData(); // รีเฟรชตาราง
    } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
};

function grantAccess(adminData, docId) {
    AdminState.currentAdmin = { id: docId, ...adminData };
    let displayRole = (adminData.role || 'Admin-Master').replace('Admin-', '');
    document.getElementById('adminNameDisplay').innerText = `${adminData.name} [${displayRole}]`;
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    AppHelper.showLoader(false);
    applyRoleRestrictions();
}

function applyRoleRestrictions() {
    const r = AdminState.currentAdmin.role || 'Admin-Master';
    const navs = ['nav-overview', 'nav-members', 'nav-ledger', 'nav-claims', 'nav-menu'];
    navs.forEach(n => { if(document.getElementById(n)) document.getElementById(n).style.display = 'none'; });

    // กำหนดการมองเห็น Tab หลัก
    if (r === 'Admin-ผู้ดูแล') {
        ['nav-members', 'nav-ledger', 'nav-menu'].forEach(n => document.getElementById(n).style.display = 'block');
        switchAdminTab('admin-view-members', document.getElementById('nav-members'));
        if(typeof loadMembersData === 'function') loadMembersData();
    } 
    else if (r === 'Admin-ศูนย์ประสานงาน') {
        navs.forEach(n => { if(document.getElementById(n)) document.getElementById(n).style.display = 'block'; });
        switchAdminTab('admin-view-members', document.getElementById('nav-members'));
        if(typeof loadMembersData === 'function') loadMembersData();
    } 
    else if (r === 'Admin-การเงิน') {
        ['nav-overview', 'nav-ledger', 'nav-members', 'nav-menu'].forEach(n => document.getElementById(n).style.display = 'block');
        switchAdminTab('admin-view-ledger', document.getElementById('nav-ledger'));
        if(typeof loadLedgerData === 'function') loadLedgerData();
    } 
    else if (r === 'Admin-สวัสดิการ') {
        ['nav-claims', 'nav-menu'].forEach(n => document.getElementById(n).style.display = 'block');
        switchAdminTab('admin-view-claims', document.getElementById('nav-claims'));
        if(typeof loadClaims === 'function') loadClaims();
    } 
    else { 
        navs.forEach(n => { if(document.getElementById(n)) document.getElementById(n).style.display = 'block'; });
        switchAdminTab('admin-view-overview', document.getElementById('nav-overview'));
        if(typeof loadDashboardOverview === 'function') loadDashboardOverview();
    }

    // กำหนดการมองเห็นเมนูย่อย (Offcanvas)
    const menus = ['settings', 'gis', 'rules', 'admins', 'bank', 'connection', 'privacy', 'support', 'shops', 'news'];
    menus.forEach(m => {
        const btn = document.getElementById(`btn-menu-${m}`);
        if(!btn) return;
        
        btn.style.display = 'none'; // ซ่อนก่อน
        if(r === 'Admin-Master') btn.style.display = 'flex'; 
        else if (r === 'Admin-ศูนย์ประสานงาน' && ['gis', 'shops', 'news', 'admins', 'support'].includes(m)) btn.style.display = 'flex';
        else if (r === 'Admin-ผู้ดูแล' && ['admins', 'support'].includes(m)) btn.style.display = 'flex';
        else if (r === 'Admin-สวัสดิการ' && ['rules', 'support'].includes(m)) btn.style.display = 'flex';
        else if (r === 'Admin-การเงิน' && ['support'].includes(m)) btn.style.display = 'flex';
    });
}

window.createAuditLog = async function(actionTitle, detailDesc) {
    if (!AdminState.currentAdmin) return;
    try {
        await db.collection("audit_logs").add({
            adminEmail: AdminState.currentAdmin.email, adminName: AdminState.currentAdmin.name,
            role: AdminState.currentAdmin.role, action: actionTitle, details: detailDesc, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error(e); }
};

async function forceLiffLogin() { /* ฟังก์ชันเดิมคงไว้... */ }
function logoutApp() { /* ฟังก์ชันเดิมคงไว้... */ }