document.addEventListener("DOMContentLoaded", async () => { 
    try {
        const sysSnap = await db.collection("settings").doc("master").get();
        if(sysSnap.exists) { fundSettings = sysSnap.data(); }
        
        const adminRef = db.collection("admins").doc(MASTER_EMAIL);
        if (!(await adminRef.get()).exists) await adminRef.set({ email: MASTER_EMAIL, password: "8ZOYrtqO", pin: "123456", name: "มุนี ยูโซ๊ะ", role: "Admin-Master", center: "ALL", status: "ใช้งาน" });

        const urlParams = new URLSearchParams(window.location.search);
        const actionParam = urlParams.get('action');
        const emailParam = urlParams.get('email');

        if (actionParam === 'setupAdmin' && emailParam) {
            document.getElementById('loginGate').style.display = 'none';
            document.getElementById('systemLoading').style.display = 'none';
            if(typeof setupAdminCredentials === 'function') setupAdminCredentials(emailParam); 
            return;
        }

        updatePinDisplay();
        let liffLoggedIn = false;
        try {
            await liff.init({ liffId: LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                const adminSnap = await db.collection("admins").where("lineUid", "==", profile.userId).where("status", "==", "ใช้งาน").get();
                if(!adminSnap.empty) {
                    liffLoggedIn = true;
                    document.getElementById('loginGate').style.display = 'none';
                    Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบด้วย LINE สำเร็จ', showConfirmButton: false, timer: 1500 });
                    setTimeout(() => { grantAccess(adminSnap.docs[0].data(), adminSnap.docs[0].id); }, 1000);
                }
            }
        } catch(liffErr) { console.warn("LIFF Error:", liffErr); }

        if (!liffLoggedIn) {
            showLoader(false);
            document.getElementById('loginGate').style.display = 'flex';
        }
        
        setTimeout(() => { if(typeof addRuleConditionRow === 'function') addRuleConditionRow(); }, 1500);
        
    } catch(e) { 
        document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4"><h6>System Error</h6><p class="small">${e.message}</p></div>`; 
    }
});

async function forceLiffLogin() { 
    try {
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); } 
        else {
            showLoader(true, "กำลังตรวจสอบสิทธิ์ LINE...");
            const profile = await liff.getProfile();
            const adminSnap = await db.collection("admins").where("lineUid", "==", profile.userId).where("status", "==", "ใช้งาน").get();
            showLoader(false);
            if(!adminSnap.empty) {
                Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบด้วย LINE สำเร็จ', showConfirmButton: false, timer: 1500 });
                setTimeout(() => { grantAccess(adminSnap.docs[0].data(), adminSnap.docs[0].id); }, 1000);
            } else {
                Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์เข้าถึง', text: 'บัญชี LINE ของท่านไม่ได้ผูกสิทธิ์แอดมิน' });
            }
        }
    } catch(e) { Swal.fire('แจ้งเตือน', 'เบราว์เซอร์นี้ไม่รองรับการล็อกอินด้วย LINE', 'warning'); }
}

function switchLoginMode(mode) {
    document.getElementById('tabEmail').classList.remove('active'); 
    document.getElementById('tabPin').classList.remove('active');
    if(mode === 'email') {
        document.getElementById('tabEmail').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'block'; 
        document.getElementById('pinLoginSection').style.display = 'none';
    } else {
        document.getElementById('tabPin').classList.add('active'); 
        document.getElementById('emailLoginSection').style.display = 'none'; 
        document.getElementById('pinLoginSection').style.display = 'block'; 
        clearPin();
    }
}

async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim(); 
    const pass = document.getElementById('adminPass').value.trim();
    if(!email || !pass) return Swal.fire('เตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    showLoader(true, "กำลังตรวจสอบข้อมูล...");
    try {
        const doc = await db.collection("admins").doc(email).get();
        showLoader(false);
        if (doc.exists && doc.data().password === pass) { 
            if (doc.data().status === 'ใช้งาน') {
                Swal.fire({ icon: 'success', title: 'ล็อกอินสำเร็จ', text: 'กำลังเข้าสู่ระบบ...', showConfirmButton: false, timer: 1500 });
                setTimeout(() => { grantAccess(doc.data(), doc.id); }, 1000);
            } else { throw new Error("บัญชีของคุณถูกระงับ หรือรอตั้งรหัสผ่าน"); }
        } else { throw new Error("อีเมล หรือ รหัสผ่านไม่ถูกต้อง"); }
    } catch (e) { showLoader(false); Swal.fire('ปฏิเสธการเข้าถึง', e.message, 'error'); }
}

function pressPin(num) { 
    if(currentPin.length < 6) { 
        currentPin += num; updatePinDisplay(); 
        if(currentPin.length === 6) verifyPinLogin(); 
    } 
}
function deletePin() { if(currentPin.length > 0) { currentPin = currentPin.slice(0, -1); updatePinDisplay(); } }
function clearPin() { currentPin = ""; updatePinDisplay(); }
function updatePinDisplay() { 
    const dots = document.querySelectorAll('.pin-dot'); 
    dots.forEach((dot, idx) => { 
        dot.style.width = '18px'; dot.style.height = '18px'; dot.style.borderRadius = '50%'; dot.style.border = '2px solid #ffffff'; dot.style.display = 'inline-block'; dot.style.transition = 'background-color 0.2s';
        if(idx < currentPin.length) { dot.style.backgroundColor = '#ffffff'; } else { dot.style.backgroundColor = 'transparent'; }
    }); 
}

async function verifyPinLogin() {
    Swal.fire({ title: 'กำลังตรวจสอบ PIN...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const snap = await db.collection("admins").where("pin", "==", currentPin).where("status", "==", "ใช้งาน").get();
        if(!snap.empty) { 
            Swal.fire({ icon: 'success', title: 'รหัส PIN ถูกต้อง', showConfirmButton: false, timer: 1500 });
            setTimeout(() => { grantAccess(snap.docs[0].data(), snap.docs[0].id); }, 1000);
        } else { 
            Swal.fire('ปฏิเสธการเข้าถึง', 'รหัส PIN 6 หลักไม่ถูกต้อง', 'error'); clearPin(); 
        }
    } catch(e) { Swal.fire('Error', 'การเชื่อมต่อฐานข้อมูลขัดข้อง', 'error'); clearPin(); }
}

function logoutApp() {
    Swal.fire({
        title: 'ออกจากระบบ?', text: "คุณต้องการออกจากระบบการจัดการใช่หรือไม่", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก'
    }).then((result) => { if (result.isConfirmed) { location.reload(); } });
}

function grantAccess(adminData, docId) {
    currentAdminData = { id: docId, ...adminData };
    let displayRole = (adminData.role || 'Admin-Master').replace('Admin-', '');
    document.getElementById('adminNameDisplay').innerText = `${adminData.name} [${displayRole}]`;
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    showLoader(false);
    applyRoleRestrictions();
}

function applyRoleRestrictions() {
    const r = currentAdminData.role || 'Admin-Master';
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