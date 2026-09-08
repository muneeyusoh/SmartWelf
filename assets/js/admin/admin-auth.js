// =========================================================
// 🔐 admin/admin-auth.js: ระบบยืนยันตัวตนแอดมิน
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
                            Swal.fire('ระงับการใช้งาน', 'บัญชีของคุณถูกระงับการเข้าถึงชั่วคราว', 'error');
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
            Swal.fire('ปฏิเสธการเข้าถึง', 'รหัส PIN 6 หลักไม่ถูกต้อง', 'error'); 
            clearPin(); 
        }
    } catch(e) { 
        Swal.fire('Error', 'การเชื่อมต่อขัดข้อง หรือ Session หมดอายุ', 'error'); 
        clearPin(); 
    }
}

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