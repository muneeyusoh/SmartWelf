// =========================================================
// 🔐 admin/admin-auth.js: ระบบยืนยันตัวตนแอดมิน (อัปเดตระบบจัดการสิทธิ์)
// =========================================================

document.addEventListener("DOMContentLoaded", async () => { 
    try {
        // โหลดตั้งค่าระบบเบื้องต้นจากส่วนกลาง
        const sysSnap = await db.collection("settings").doc("master").get();
        if(sysSnap.exists) { AdminState.fundSettings = sysSnap.data(); }
        
        updatePinDisplay();

        try {
            await liff.init({ liffId: ADMIN_LIFF_ID });
        } catch(liffErr) {
            console.warn("LIFF Init Error:", liffErr);
        }

        // ดักจับสถานะการล็อกอิน Firebase
        if(auth) {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const adminDoc = await db.collection("admins").doc(user.email).get();
                        if (adminDoc.exists && adminDoc.data().status === 'ใช้งาน') {
                            grantAccess(adminDoc.data(), adminDoc.id);
                        } else {
                            await auth.signOut();
                            showLoginForm();
                            Swal.fire('ระงับการใช้งาน', 'บัญชีของคุณถูกระงับการเข้าถึงชั่วคราว หรือยังไม่ได้รับการอนุมัติ', 'error');
                        }
                    } catch (error) {
                        console.error("Error fetching admin role:", error);
                        await auth.signOut();
                        showLoginForm();
                        if(error.code === 'permission-denied') {
                            Swal.fire('ข้อผิดพลาดสิทธิ์', 'คุณไม่มีสิทธิ์เข้าถึงฐานข้อมูลนี้', 'error');
                        }
                    }
                } else {
                    showLoginForm();
                }
            });
        }

    } catch(e) { 
        document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4"><h6>System Error</h6><p class="small">${e.message}</p></div>`; 
    }
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
        Swal.fire({ icon: 'success', title: 'ล็อกอินสำเร็จ', text: 'กำลังเข้าสู่ระบบ...', showConfirmButton: false, timer: 1500 });
    } catch (e) { 
        AppHelper.showLoader(false); 
        console.error("Login Error:", e);
        let msg = "อีเมล หรือ รหัสผ่านไม่ถูกต้อง";
        if(e.code === 'auth/too-many-requests') msg = "ล็อกอินล้มเหลวหลายครั้ง กรุณารอสักครู่";
        Swal.fire('ปฏิเสธการเข้าถึง', msg, 'error'); 
    }
}

// ==========================================
// 🚀 ฟังก์ชัน: ลืมรหัสผ่าน (ส่งลิงก์รีเซ็ตเข้าอีเมล)
// ==========================================
async function requestPasswordReset() {
    const { value: email } = await Swal.fire({
        title: 'ลืมรหัสผ่าน?',
        text: 'กรุณากรอกอีเมลแอดมินที่ลงทะเบียนไว้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้ครับ',
        input: 'email',
        inputPlaceholder: 'admin@example.com',
        showCancelButton: true,
        confirmButtonText: 'ส่งลิงก์รีเซ็ต',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563EB'
    });

    if (email) {
        AppHelper.showLoader(true, "กำลังส่งข้อมูล...");
        try {
            const adminDoc = await db.collection("admins").doc(email.trim()).get();
            if (adminDoc.exists && adminDoc.data().status === 'ใช้งาน') {
                await auth.sendPasswordResetEmail(email.trim());
                AppHelper.showLoader(false);
                Swal.fire('สำเร็จ', 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว (โปรดเช็กกล่องจดหมาย หรือ Junk mail)', 'success');
            } else {
                AppHelper.showLoader(false);
                Swal.fire('ปฏิเสธ', 'ไม่พบอีเมลนี้ในระบบ หรือบัญชียังไม่ได้รับการอนุมัติ', 'error');
            }
        } catch (error) {
            AppHelper.showLoader(false);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งอีเมลได้: ' + error.message, 'error');
        }
    }
}

function switchLoginMode(mode) {
    document.getElementById('tabEmail').classList.remove('active'); 
    document.getElementById('tabPin').classList.remove('active');
    
    if(mode === 'email') {
        document.getElementById('tabEmail').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'block'; 
        document.getElementById('pinLoginSection').style.display = 'none';
    } else {
        if (!auth.currentUser) {
            Swal.fire({ icon: 'info', title: 'ไม่สามารถใช้ PIN ได้', text: 'กรุณาล็อกอินด้วยอีเมลและรหัสผ่านสำหรับการเข้าระบบครั้งแรกก่อนครับ' });
            return switchLoginMode('email');
        }
        document.getElementById('tabPin').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'none'; 
        document.getElementById('pinLoginSection').style.display = 'block'; 
        clearPin();
    }
}

function pressPin(num) { 
    if(AdminState.currentPin.length < 6) { 
        AdminState.currentPin += num; updatePinDisplay(); 
        if(AdminState.currentPin.length === 6) verifyPinLogin(); 
    } 
}
function deletePin() { if(AdminState.currentPin.length > 0) { AdminState.currentPin = AdminState.currentPin.slice(0, -1); updatePinDisplay(); } }
function clearPin() { AdminState.currentPin = ""; updatePinDisplay(); }

function updatePinDisplay() { 
    const dots = document.querySelectorAll('.pin-dot'); 
    dots.forEach((dot, idx) => { 
        dot.style.width = '18px'; dot.style.height = '18px'; dot.style.borderRadius = '50%'; dot.style.border = '2px solid #ffffff'; dot.style.display = 'inline-block'; dot.style.transition = 'background-color 0.2s';
        if(idx < AdminState.currentPin.length) { dot.style.backgroundColor = '#ffffff'; } else { dot.style.backgroundColor = 'transparent'; }
    }); 
}

async function verifyPinLogin() {
    if (!auth.currentUser) return clearPin();

    Swal.fire({ title: 'กำลังตรวจสอบ PIN...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const adminDoc = await db.collection("admins").doc(auth.currentUser.email).get();
        
        if(adminDoc.exists && adminDoc.data().pin === AdminState.currentPin && adminDoc.data().status === 'ใช้งาน') { 
            Swal.fire({ icon: 'success', title: 'ปลดล็อกสำเร็จ', showConfirmButton: false, timer: 1500 });
            setTimeout(() => { grantAccess(adminDoc.data(), adminDoc.id); }, 1000);
        } else { 
            Swal.fire('ปฏิเสธการเข้าถึง', 'รหัส PIN 6 หลักไม่ถูกต้อง หรือบัญชีถูกระงับ', 'error'); 
            clearPin(); 
        }
    } catch(e) { 
        Swal.fire('Error', 'การเชื่อมต่อขัดข้อง หรือ Session หมดอายุ', 'error'); 
        clearPin(); 
    }
}

// ==========================================
// 🚀 ฟังก์ชัน: เปลี่ยนรหัส PIN ของตนเอง
// ==========================================
async function changeAdminPin() {
    if (!AdminState.currentAdmin) return;

    const { value: oldPin } = await Swal.fire({
        title: 'ยืนยันรหัส PIN เดิม',
        text: 'กรุณากรอกรหัส PIN 6 หลัก ปัจจุบันของคุณ',
        input: 'password',
        inputAttributes: { maxlength: 6, inputmode: 'numeric' },
        showCancelButton: true,
        confirmButtonText: 'ถัดไป',
        cancelButtonText: 'ยกเลิก'
    });

    if (!oldPin) return;
    if (oldPin !== AdminState.currentAdmin.pin) {
        return Swal.fire('ผิดพลาด', 'รหัส PIN เดิมไม่ถูกต้อง', 'error');
    }

    const { value: newPin } = await Swal.fire({
        title: 'ตั้งรหัส PIN ใหม่',
        text: 'กรุณากรอกรหัส PIN ใหม่ 6 หลัก',
        input: 'password',
        inputAttributes: { maxlength: 6, inputmode: 'numeric' },
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        confirmButtonColor: '#10B981'
    });

    if (newPin && newPin.length === 6) {
        AppHelper.showLoader(true, "กำลังบันทึก PIN...");
        try {
            await db.collection("admins").doc(AdminState.currentAdmin.id).update({ pin: newPin });
            AdminState.currentAdmin.pin = newPin; 
            await createAuditLog("เปลี่ยนรหัส PIN", "เปลี่ยนรหัส PIN เพื่อเข้าใช้งานระบบสำเร็จ");
            AppHelper.showLoader(false);
            Swal.fire('สำเร็จ', 'อัปเดตข้อรหัส PIN เรียบร้อยแล้ว', 'success');
        } catch (e) {
            AppHelper.showLoader(false);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปลี่ยน PIN ได้', 'error');
        }
    } else if (newPin) {
        Swal.fire('ผิดพลาด', 'รหัส PIN ต้องมี 6 หลักถ้วน', 'warning');
    }
}

// ==========================================
// 🚀 ฟังก์ชัน: การจัดการแอดมิน (เฉพาะ Admin-Master)
// ==========================================
window.masterManageAdmin = async function(targetAdminEmail) {
    if (!AdminState.currentAdmin || AdminState.currentAdmin.role !== 'Admin-Master') {
        return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะ Admin-Master เท่านั้นที่สามารถจัดการผู้ดูแลระบบท่านอื่นได้', 'error');
    }

    const { value: action } = await Swal.fire({
        title: `จัดการบัญชี ${targetAdminEmail}`,
        input: 'select',
        inputOptions: {
            'reset_pin': 'รีเซ็ตรหัส PIN เป็น 000000',
            'change_role': 'เปลี่ยนตำแหน่ง (Role)',
            'suspend': 'ระงับบัญชี (ไม่ให้เข้าระบบ)',
            'activate': 'เปิดใช้งานบัญชี'
        },
        inputPlaceholder: 'เลือกการจัดการ',
        showCancelButton: true,
        confirmButtonText: 'ดำเนินการ'
    });

    if (!action) return;

    AppHelper.showLoader(true, "กำลังดำเนินการ...");
    try {
        const adminRef = db.collection("admins").doc(targetAdminEmail);
        
        if (action === 'reset_pin') {
            await adminRef.update({ pin: "000000" });
            await createAuditLog("รีเซ็ต PIN แอดมิน", `รีเซ็ต PIN ของ ${targetAdminEmail} เป็นค่าเริ่มต้น`);
            Swal.fire('สำเร็จ', 'รีเซ็ต PIN เป็น 000000 เรียบร้อยแล้ว', 'success');
            
        } else if (action === 'change_role') {
            AppHelper.showLoader(false);
            const { value: newRole } = await Swal.fire({
                title: 'เลือกตำแหน่งใหม่',
                input: 'select',
                inputOptions: {
                    'Admin-การเงิน': 'การเงิน',
                    'Admin-ศูนย์ประสานงาน': 'ศูนย์ประสานงาน',
                    'Admin-สวัสดิการ': 'สวัสดิการ',
                    'Admin-ผู้ดูแล': 'ผู้ดูแลระดับหมู่บ้าน'
                },
                showCancelButton: true
            });
            if (newRole) {
                AppHelper.showLoader(true, "กำลังบันทึก...");
                await adminRef.update({ role: newRole });
                await createAuditLog("เปลี่ยน Role แอดมิน", `ปรับตำแหน่งของ ${targetAdminEmail} เป็น ${newRole}`);
                Swal.fire('สำเร็จ', 'เปลี่ยนตำแหน่งเรียบร้อยแล้ว', 'success');
            }
            
        } else if (action === 'suspend') {
            await adminRef.update({ status: "ระงับการใช้งาน" });
            await createAuditLog("ระงับบัญชีแอดมิน", `ระงับบัญชีของ ${targetAdminEmail}`);
            Swal.fire('สำเร็จ', 'ระงับบัญชีเรียบร้อยแล้ว', 'success');
            
        } else if (action === 'activate') {
            await adminRef.update({ status: "ใช้งาน" });
            await createAuditLog("เปิดใช้บัญชีแอดมิน", `เปิดใช้งานบัญชีของ ${targetAdminEmail} อีกครั้ง`);
            Swal.fire('สำเร็จ', 'บัญชีพร้อมใช้งานแล้ว', 'success');
        }
        
        AppHelper.showLoader(false);
    } catch (e) {
        AppHelper.showLoader(false);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถดำเนินการได้: ' + e.message, 'error');
    }
};

async function forceLiffLogin() { 
    try {
        if (!liff.isLoggedIn()) { 
            liff.login({ redirectUri: window.location.href }); 
        } else {
            AppHelper.showLoader(true, "กำลังตรวจสอบสิทธิ์ LINE...");
            const idToken = liff.getDecodedIDToken();
            const lineEmail = idToken?.email;

            if (!lineEmail) {
                AppHelper.showLoader(false);
                Swal.fire({ 
                    icon: 'warning', 
                    title: 'กำลังอัปเดตสิทธิ์การเข้าถึง', 
                    html: 'ระบบมีการอัปเดตความปลอดภัย โปรดกดยืนยันเพื่อรีเซ็ตการเชื่อมต่อ<br><br><small class="text-danger">เมื่อรีเซ็ตแล้ว ระบบจะโหลดหน้าใหม่ ให้คุณกด "เข้าสู่ระบบด้วย LINE" อีกครั้งครับ</small>',
                    confirmButtonText: '<i class="fa-solid fa-rotate"></i> รีเซ็ตและเริ่มใหม่',
                    confirmButtonColor: '#F59E0B'
                }).then(() => {
                    liff.logout(); 
                    location.reload(); 
                });
                return; 
            }

            AppHelper.showLoader(false);

            Swal.fire({
                icon: 'info',
                title: 'พบข้อมูล LINE ของคุณ',
                text: `ระบบพบอีเมล ${lineEmail} เพื่อความปลอดภัยขั้นสูงสุด กรุณากรอกรหัสผ่าน 1 ครั้งเพื่อเข้าสู่ระบบครับ`,
                input: 'password',
                inputPlaceholder: 'กรอกรหัสผ่าน',
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-key"></i> ยืนยัน',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#2563EB'
            }).then(async (result) => {
                if (result.isConfirmed && result.value) {
                    AppHelper.showLoader(true, "กำลังยืนยันตัวตน...");
                    try {
                        await auth.signInWithEmailAndPassword(lineEmail, result.value);
                        Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ!', showConfirmButton: false, timer: 1500 });
                    } catch (e) {
                        AppHelper.showLoader(false);
                        console.error(e);
                        Swal.fire('ผิดพลาด', 'รหัสผ่านไม่ถูกต้อง หรืออีเมลนี้ยังไม่ได้เพิ่มใน Firebase Authentication', 'error');
                    }
                }
            });
        }
    } catch(e) { 
        Swal.fire('แจ้งเตือน', 'การดึงข้อมูลจาก LINE ผิดพลาด หรือเบราว์เซอร์ไม่รองรับ', 'warning'); 
        AppHelper.showLoader(false); 
    }
}

function logoutApp() {
    Swal.fire({
        title: 'ออกจากระบบ?', text: "คุณต้องการออกจากระบบการจัดการใช่หรือไม่", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => { 
        if (result.isConfirmed) { 
            AppHelper.showLoader(true, "กำลังออกจากระบบ...");
            await auth.signOut();
            location.reload(); 
        } 
    });
}

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

    if (r === 'Admin-ผู้ดูแล') {
        if(document.getElementById('nav-members')) document.getElementById('nav-members').style.display = 'block';
        if(document.getElementById('nav-ledger')) document.getElementById('nav-ledger').style.display = 'block';
        if(document.getElementById('nav-claims')) document.getElementById('nav-claims').style.display = 'block';
        switchAdminTab('admin-view-members', document.getElementById('nav-members'));
        if(typeof loadMembersData === 'function') loadMembersData();
        const manualLedgerCard = document.querySelector('#admin-view-ledger .admin-card');
        if(manualLedgerCard) manualLedgerCard.style.display = 'none';
    } 
    else if (r === 'Admin-ศูนย์ประสานงาน') {
        navs.forEach(n => { if(document.getElementById(n)) document.getElementById(n).style.display = 'block'; });
        switchAdminTab('admin-view-members', document.getElementById('nav-members'));
        if(typeof loadMembersData === 'function') loadMembersData();
    } 
    else if (r === 'Admin-การเงิน') {
        if(document.getElementById('nav-overview')) document.getElementById('nav-overview').style.display = 'block';
        if(document.getElementById('nav-ledger')) document.getElementById('nav-ledger').style.display = 'block';
        if(document.getElementById('nav-members')) document.getElementById('nav-members').style.display = 'block';
        switchAdminTab('admin-view-ledger', document.getElementById('nav-ledger'));
        if(typeof loadLedgerData === 'function') loadLedgerData();
        if(typeof loadReceiptHistory === 'function') loadReceiptHistory();
    } 
    else if (r === 'Admin-สวัสดิการ') {
        if(document.getElementById('nav-claims')) document.getElementById('nav-claims').style.display = 'block';
        if(document.getElementById('nav-menu')) document.getElementById('nav-menu').style.display = 'block';
        switchAdminTab('admin-view-claims', document.getElementById('nav-claims'));
        if(typeof loadClaims === 'function') loadClaims();
    } 
    else { 
        navs.forEach(n => { if(document.getElementById(n)) document.getElementById(n).style.display = 'block'; });
        if(document.getElementById('btnAddAdmin')) document.getElementById('btnAddAdmin').style.display = 'block';
        switchAdminTab('admin-view-overview', document.getElementById('nav-overview'));
        if(typeof loadDashboardOverview === 'function') loadDashboardOverview();
    }

    const menus = ['settings', 'gis', 'rules', 'admins', 'bank', 'connection', 'privacy', 'support', 'shops', 'news'];
    menus.forEach(m => {
        const btn = document.getElementById(`btn-menu-${m}`);
        if(!btn) return;
        if(r === 'Admin-Master') btn.style.display = 'flex'; 
        else if(m === 'support') btn.style.display = 'flex';
        else if(m === 'gis' && r === 'Admin-ศูนย์ประสานงาน') btn.style.display = 'flex';
        else if(m === 'rules' && r === 'Admin-สวัสดิการ') btn.style.display = 'flex';
        else if(m === 'shops' && r === 'Admin-ศูนย์ประสานงาน') btn.style.display = 'flex';
        else if(m === 'news' && r === 'Admin-ศูนย์ประสานงาน') btn.style.display = 'flex';
        else btn.style.display = 'none';
    });

    const historyBox = document.getElementById('finance-only-history');
    if (historyBox) { historyBox.style.display = (r === 'Admin-การเงิน' || r === 'Admin-Master') ? 'block' : 'none'; }
    if(typeof checkFinanceButtons === 'function') checkFinanceButtons();
}

// สร้าง Audit Log และดึง AdminState มาใช้งาน
window.createAuditLog = async function(actionTitle, detailDesc) {
    if (!AdminState.currentAdmin) return;
    try {
        await db.collection("audit_logs").add({
            adminEmail: AdminState.currentAdmin.email,
            adminName: AdminState.currentAdmin.name,
            role: AdminState.currentAdmin.role,
            action: actionTitle,
            details: detailDesc,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Audit Log Error:", e); }
};
