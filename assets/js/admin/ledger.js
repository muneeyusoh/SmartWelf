// =========================================================
// 💸 ledger.js: ระบบการเงินและบัญชี (Chain of Custody V2 & Daily Ledger)
// =========================================================

// --- ส่วนที่ 1: การกรอกเงินสมาชิกในตาราง ---
window.toggleContributionInput = function(checkbox, memberId) {
    const row = document.getElementById(`row-${memberId}`); 
    const input = document.getElementById(`input-${memberId}`); 
    const badgeWrapper = row.querySelector('.amount-badge-wrapper');
    if (checkbox.checked) { 
        row.classList.add('show-input'); 
        badgeWrapper.style.display = 'none'; 
        setTimeout(() => input.focus(), 300); 
    } else { 
        row.classList.remove('show-input'); 
        input.value = ''; 
        badgeWrapper.style.display = 'none'; 
    }
};

window.confirmAmountLocal = function(memberId) {
    const row = document.getElementById(`row-${memberId}`); 
    const input = document.getElementById(`input-${memberId}`); 
    const badgeWrapper = row.querySelector('.amount-badge-wrapper'); 
    const displayAmount = row.querySelector('.display-amount'); 
    const checkbox = row.querySelector('.member-check');
    const amount = parseFloat(input.value);
    
    if (amount > 0) { 
        row.classList.remove('show-input'); 
        displayAmount.textContent = amount.toLocaleString(); 
        badgeWrapper.style.display = 'block'; 
        checkbox.checked = true; 
    } else { 
        row.classList.remove('show-input'); 
        checkbox.checked = false; 
        badgeWrapper.style.display = 'none'; 
    }
};

window.handleEnter = function(event, memberId) { 
    if (event.key === 'Enter') { 
        event.preventDefault(); 
        window.confirmAmount(memberId, 'รอตรวจสอบ'); 
    } 
};

window.reopenInput = function(memberId) {
    const row = document.getElementById(`row-${memberId}`); 
    const badgeWrapper = row.querySelector('.amount-badge-wrapper'); 
    const input = document.getElementById(`input-${memberId}`);
    row.classList.add('show-input'); 
    badgeWrapper.style.display = 'none'; 
    input.focus();
};

// =========================================================
// 🌟 ส่วนที่ 2: ระบบเส้นทางการเงิน (Chain of Custody Logic)
// =========================================================
function getNextFinancialStatusAndHolder(currentRole, myEmail) {
    if (currentRole === 'Admin-ผู้ดูแล') {
        return { status: "รอส่งศูนย์", holder: myEmail };
    } else if (currentRole === 'Admin-ศูนย์ประสานงาน') {
        return { status: "รอส่งการเงิน", holder: myEmail };
    } else if (currentRole === 'Admin-การเงิน' || currentRole === 'Admin-Master') {
        return { status: "เข้าคลังแล้ว", holder: "CENTRAL_BANK" };
    } else {
        return { status: "รอตรวจสอบ", holder: myEmail };
    }
}

window.confirmAmount = async function(memberId, currentStatus) {
    const inputElement = document.getElementById(`input-${memberId}`);
    const amount = parseFloat(inputElement.value);
    if (isNaN(amount) || amount <= 0) return Swal.fire('แจ้งเตือน', 'กรุณาระบุจำนวนเงินที่ถูกต้อง', 'warning');

    AppHelper.showLoader(true, "กำลังบันทึกยอดเงิน...");
    try {
        const memberRef = db.collection('members').doc(memberId);
        const txRef = db.collection('transactions').doc(); 
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(memberRef);
            if (!doc.exists) throw "ไม่พบข้อมูลสมาชิก";

            let memberName = doc.data().fullName; 
            let currentTotal = parseFloat(doc.data().totalContribution || 0);
            let currentOutstanding = parseFloat(doc.data().outstandingBalance || 0);
            
            let newTotal = currentTotal + amount;
            let newOutstanding = currentOutstanding - amount;
            if (newOutstanding < 0) newOutstanding = 0; 
            
            let updatePayload = { 
                totalContribution: newTotal, outstandingBalance: newOutstanding, 
                lastContributionDate: new Date().toISOString() 
            };

            if (currentStatus.includes('รอ') || doc.data().status.includes('รอ')) {
                updatePayload.status = 'เป็นสมาชิก';
                if(!doc.data().registerDateObj) updatePayload.registerDateObj = new Date().toISOString();
            }
            
            transaction.update(memberRef, updatePayload);

            const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
            const myRole = AdminState.currentAdmin.role;
            const routeData = getNextFinancialStatusAndHolder(myRole, AdminState.currentAdmin.email);

            transaction.set(txRef, { 
                txId: txId, type: 'สมทบเงินกองทุน', amount: amount, paymentMethod: 'เงินสด', 
                transactionDate: new Date().toISOString().split('T')[0], fullName: 'แอดมิน: ' + AdminState.currentAdmin.name, 
                status: routeData.status, currentHolder: routeData.holder, note: `รับเงินสมทบจาก: ${memberName}`, uid: memberId, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp() 
            });
        });

        inputElement.closest('.input-overlay').style.display = 'none';
        let badgeWrapper = document.querySelector(`#row-${memberId} .amount-badge-wrapper`);
        if(badgeWrapper) { 
            badgeWrapper.querySelector('.display-amount').innerText = amount.toLocaleString('en-US'); 
            badgeWrapper.style.display = 'block'; 
        }

        AppHelper.showLoader(false);
        Swal.fire({ title: 'บันทึกสำเร็จ!', text: `รับสมทบ ${amount} บาท และเก็บไว้ที่คุณ (รอส่งมอบต่อไป)`, icon: 'success', timer: 1500, showConfirmButton: false });

        setTimeout(() => { 
            if(typeof window.loadMembersData === 'function') window.loadMembersData(); 
            if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview(); 
        }, 1500); 

    } catch (error) { 
        AppHelper.showLoader(false); 
        console.error("Ledger Transaction Error:", error); 
        Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกเงินสมทบ', 'error'); 
    }
};

/**
 * 🌟 รับเงินสมทบแบบกลุ่ม Bulk (Batch Write / QR)
 */
window.bulkCollectContribution = async function() {
    const checkedBoxes = document.querySelectorAll('.member-check:checked');
    const collectionData = [];
    
    checkedBoxes.forEach(box => {
        const memberId = box.value; 
        const memberName = box.getAttribute('data-name'); 
        const input = document.getElementById(`input-${memberId}`); 
        const amount = parseFloat(input.value);
        if (amount > 0) { collectionData.push({ id: memberId, name: memberName, amount: amount }); }
    });

    if (collectionData.length === 0) { 
        Swal.fire({ icon: 'warning', title: 'ยังไม่ได้ระบุยอดเงิน', text: 'กรุณาเลือกสมาชิกและระบุยอดเงินสมทบก่อนกดทำรายการ' }); 
        return; 
    }
    
    const totalAmount = collectionData.reduce((sum, item) => sum + item.amount, 0);
    const today = new Date().toISOString().split('T')[0];
    
    const { value: formValues } = await Swal.fire({
        title: `เก็บเงินสมทบกลุ่ม (${collectionData.length} คน)`,
        html: `<div class="text-start" style="font-family: 'Prompt', sans-serif;">
                <div class="d-flex justify-content-between align-items-center mb-4 px-2 py-2 bg-success bg-opacity-10 rounded-3 border border-success border-opacity-25">
                    <strong class="text-success small"><i class="fa-solid fa-calculator me-1"></i> ยอดรวมทั้งหมด:</strong>
                    <strong class="text-success fs-4 mb-0" style="line-height:1;">฿${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                </div>
                <label class="small text-muted fw-bold mb-1">วันที่รับเงิน</label>
                <input type="date" id="bulkDate" class="form-control-modern w-100 mb-3" value="${today}" required>
                <label class="small text-muted fw-bold mb-1">หมายเหตุ (ถ้ามี)</label>
                <input type="text" id="bulkNote" class="form-control-modern w-100" placeholder="เช่น ประจำเดือน ส.ค.">
            </div>`,
        showDenyButton: true, showCancelButton: true, confirmButtonText: 'บันทึกรับเงินสด', 
        denyButtonText: '<i class="fa-solid fa-qrcode"></i> ให้สมาชิกสแกน QR', cancelButtonText: 'ยกเลิก', 
        confirmButtonColor: '#10B981', denyButtonColor: '#2563EB',
        preConfirm: () => { 
            return { membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: false }; 
        }
    }).then(result => {
        if (result.isDenied) return { isConfirmed: true, value: { membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: true } }; 
        return result;
    });

    if (formValues) {
        try {
            const adminName = AdminState.currentAdmin.name; 
            const adminEmail = AdminState.currentAdmin.email; 
            const totalAmt = formValues.totalAmount;
            
            let bulkTxId = "BLK" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0'); 
            let bulkDataArr = [];
            
            for (let member of formValues.membersData) {
                let individualTxId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0'); 
                bulkDataArr.push({ uid: member.id, name: member.name, amt: member.amount, txId: individualTxId });
            }
            
            const finalNote = formValues.note ? `เก็บเงินกลุ่ม ${formValues.membersData.length} คน (${formValues.note})` : `เก็บเงินกลุ่ม ${formValues.membersData.length} คน`;

            // 🌟 สร้างระบบ QR Code ตรงนี้
            if (formValues.isQR) {
                const qrPayload = JSON.stringify({
                    action: "bulk_pay_to_fund",
                    amount: totalAmt,
                    ref: bulkTxId,
                    adminName: adminName,
                    note: finalNote
                });

                Swal.fire({
                    title: 'QR Code เก็บเงินกลุ่ม',
                    html: `
                        <div class="text-center" style="font-family:'Prompt';">
                            <p class="text-muted small mb-1">ยอดรวม (${formValues.membersData.length} คน)</p>
                            <h2 class="text-primary fw-bold mb-3">฿${totalAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</h2>
                            <div id="bulkQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3 border" style="width: 220px; height: 220px;"></div>
                            <p class="small text-muted"><i class="fa-solid fa-mobile-screen me-1"></i> ให้ตัวแทนกลุ่มสแกนจ่าย</p>
                        </div>
                    `,
                    didOpen: () => {
                        new QRCode(document.getElementById("bulkQrBox"), { 
                            text: qrPayload, 
                            width: 180, 
                            height: 180,
                            colorDark : "#0F172A",
                            colorLight : "#ffffff"
                        });
                    },
                    confirmButtonText: 'ปิดหน้าต่าง'
                });
            } else {
                // บันทึกเงินสด
                AppHelper.showLoader(true, "กำลังบันทึกรายการกลุ่ม...");
                const routeData = getNextFinancialStatusAndHolder(AdminState.currentAdmin.role, adminEmail);
                const batch = db.batch();
                const txRef = db.collection("transactions").doc();
                batch.set(txRef, { 
                    txId: bulkTxId, type: 'สมทบเงินกองทุน', amount: totalAmt, paymentMethod: 'เงินสด', 
                    transactionDate: formValues.date, fullName: 'แอดมิน: ' + adminName, status: routeData.status, 
                    currentHolder: routeData.holder, note: finalNote, uid: "BULK", bulkMembers: bulkDataArr, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                });

                if(routeData.status === 'เข้าคลังแล้ว') {
                    for (let member of formValues.membersData) {
                        const memRef = db.collection("members").doc(member.id);
                        batch.update(memRef, { 
                            totalContribution: firebase.firestore.FieldValue.increment(member.amount), 
                            outstandingBalance: firebase.firestore.FieldValue.increment(-member.amount),
                            lastContributionDate: new Date().toISOString()
                        });
                    }
                }
                await batch.commit();
                Swal.fire('สำเร็จ', routeData.status === 'เข้าคลังแล้ว' ? 'ส่งยอดเข้าส่วนกลางเรียบร้อย' : 'บันทึกเข้ากระเป๋าของคุณ (รอส่งมอบขั้นต่อไป)', 'success');
                if(typeof window.loadMembersData === 'function') window.loadMembersData();
            }
        } catch(e) { AppHelper.showLoader(false); Swal.fire('Error', 'ไม่สามารถจัดเก็บเงินกลุ่มได้', 'error'); }
    }
};

// =========================================================
// 🌟 ส่วนที่ 3: ระบบส่งต่อเงิน / สแกนรับเงิน 
// =========================================================
window.generateTransferAdminQR = async function() {
    AppHelper.showLoader(true, "กำลังประมวลผล...");
    try {
        const myEmail = AdminState.currentAdmin?.email || "";
        const myRole = AdminState.currentAdmin?.role || "";
        let searchStatus = myRole === 'Admin-ผู้ดูแล' ? "รอส่งศูนย์" : "รอส่งการเงิน";

        const snap = await db.collection("transactions").where("currentHolder", "==", myEmail).where("status", "==", searchStatus).get();
        AppHelper.showLoader(false);

        let totalHold = 0; let billsCount = snap.size;
        snap.forEach(doc => { totalHold += parseFloat(doc.data().amount) || 0; });

        if (totalHold <= 0) return Swal.fire({ icon: 'info', title: 'ไม่มียอดเงินค้าง', text: 'คุณไม่มียอดเงินสดที่รอส่งมอบในขณะนี้' });

        const transferRefId = "TRF-" + Date.now().toString().slice(-8);
        const qrPayload = JSON.stringify({ action: "admin_transfer_handover", sender: myEmail, senderName: AdminState.currentAdmin?.name || "Admin", senderRole: myRole, amount: totalHold, ref: transferRefId });

        Swal.fire({
            title: 'QR ส่งมอบเงินสด',
            html: `<div class="text-center" style="font-family:'Prompt';"><p class="small text-muted mb-2">ยอดเงินสดที่ถืออยู่ (${billsCount} รายการ):</p><h2 class="fw-bold text-success mb-3">฿${totalHold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2><div id="transferAdminQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3" style="width: 200px; height: 200px;"></div><p class="small text-muted mb-0">${myRole === 'Admin-ผู้ดูแล' ? 'ให้ <b>Admin-ศูนย์</b> สแกนรับยอด' : 'ให้ <b>Admin-การเงิน</b> สแกนรับยอด'}</p></div>`,
            didOpen: () => { new QRCode(document.getElementById("transferAdminQrBox"), { text: qrPayload, width: 170, height: 170 }); },
            showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง'
        });
    } catch (e) { AppHelper.showLoader(false); console.error(e); Swal.fire('Error', e.message, 'error'); }
};

window.scanToReceiveAdminFunds = function() {
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        liff.scanCodeV2().then(res => { if (res && res.value) { window.handleScannedAdminQR(res.value); } }).catch(err => { window.promptManualCodeInput(); });
    } else { window.promptManualCodeInput(); }
};

window.promptManualCodeInput = function() {
    Swal.fire({ title: 'ระบุรหัสธุรกรรม / สแกน', input: 'text', inputPlaceholder: 'เช่น TRF-123456', showCancelButton: true, confirmButtonText: 'ตรวจสอบ', cancelButtonText: 'ยกเลิก' })
    .then(res => { if (res.isConfirmed && res.value) { window.handleScannedAdminQR(res.value.trim()); } });
};

window.handleScannedAdminQR = async function(codeValue) {
    let payload = {};
    try { payload = JSON.parse(codeValue); } catch (e) { return Swal.fire('QR ไม่ถูกต้อง', 'รหัส QR นี้ไม่ใช่รหัสโอนย้ายเงินของกองทุน', 'error'); }
    if(payload.action !== 'admin_transfer_handover') return Swal.fire('QR ไม่ถูกต้อง', 'กรุณาสแกน QR สำหรับรับมอบเงิน', 'error');
    const myRole = AdminState.currentAdmin.role;
    
    if (payload.senderRole === 'Admin-ผู้ดูแล' && (myRole !== 'Admin-ศูนย์ประสานงาน' && myRole !== 'Admin-Master' && myRole !== 'Admin-การเงิน')) {
        return Swal.fire('สิทธิ์ไม่เพียงพอ', 'เฉพาะ Admin-ศูนย์ประสานงาน หรือการเงิน เท่านั้นที่รับยอดนี้ได้', 'error');
    }
    if (payload.senderRole === 'Admin-ศูนย์ประสานงาน' && (myRole !== 'Admin-การเงิน' && myRole !== 'Admin-Master')) {
        return Swal.fire('สิทธิ์ไม่เพียงพอ', 'เฉพาะ Admin-การเงิน หรือ Master เท่านั้นที่รับยอดจากศูนย์ได้', 'error');
    }

    Swal.fire({
        title: 'รับมอบเงินสด?',
        html: `<div class="text-start" style="font-family:'Prompt';"><p class="mb-1 text-muted small">รับมอบจาก: <strong>${payload.senderName} (${payload.senderRole})</strong></p><p class="mb-1 text-muted small">จำนวนเงินรวม: <strong class="text-success fs-4">฿${parseFloat(payload.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></p></div>`,
        showCancelButton: true, confirmButtonText: 'ยืนยันรับเงิน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
    }).then(async r => {
        if (r.isConfirmed) {
            AppHelper.showLoader(true, "กำลังย้ายสิทธิ์การถือเงิน...");
            try {
                let searchStatus = payload.senderRole === 'Admin-ผู้ดูแล' ? "รอส่งศูนย์" : "รอส่งการเงิน";
                const snap = await db.collection("transactions").where("currentHolder", "==", payload.sender).where("status", "==", searchStatus).get();
                const batch = db.batch();
                const routeData = getNextFinancialStatusAndHolder(myRole, AdminState.currentAdmin.email);

                snap.forEach(doc => {
                    batch.update(doc.ref, { currentHolder: routeData.holder, status: routeData.status, receivedBy: AdminState.currentAdmin.name, receivedAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch.commit(); AppHelper.showLoader(false); 
                Swal.fire('สำเร็จ', routeData.status === 'เข้าคลังแล้ว' ? 'เงินเข้าสู่คลังส่วนกลางแล้ว' : 'เงินถูกย้ายมาอยู่ที่คุณแล้ว (รอส่งการเงิน)', 'success');
                if(typeof window.loadLedgerData === 'function') window.loadLedgerData();
            } catch(e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
        }
    });
};

// =========================================================
// 🌟 ส่วนที่ 4: ฟังก์ชันบัญชีกลาง (สำหรับ Admin-การเงิน)
// =========================================================
window.loadLedgerData = function() {
    if (typeof window.loadTransactions === 'function') window.loadTransactions(); 
    if (typeof window.checkFinanceButtons === 'function') window.checkFinanceButtons(); 
    if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
};

window.checkFinanceButtons = async function() {
    const btnBox = document.getElementById('financeApproveBtnBox');
    if (!btnBox) return;

    const role = AdminState.currentAdmin?.role || '';
    if (role !== 'Admin-Master' && role !== 'Admin-การเงิน') { btnBox.style.display = 'none'; return; }

    try {
        const snap = await db.collection("transactions").where("status", "==", "รอส่งการเงิน").limit(1).get();
        btnBox.style.display = !snap.empty ? 'block' : 'none';
    } catch (e) { btnBox.style.display = 'none'; }
};

window.approveFundsToCentralBank = async function() {
    Swal.fire({
        title: 'ดึงยอดเงินเข้าคลังส่วนกลาง?', 
        text: 'ระบบจะดึงยอดเงินที่ "รอส่งการเงิน" ทั้งหมดเข้าสู่บัญชีกองทุนส่วนกลาง',
        icon: 'question', showCancelButton: true, confirmButtonColor: '#10B981', confirmButtonText: 'ยืนยันรับเข้าคลัง'
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังยืนยันยอดเข้าคลัง...");
            try {
                const snap = await db.collection("transactions").where("status", "==", "รอส่งการเงิน").get();
                if (snap.empty) { AppHelper.showLoader(false); return Swal.fire('แจ้งเตือน', 'ไม่มีบิลรอส่งให้การเงินในขณะนี้', 'info'); }

                const batch = db.batch();
                snap.forEach(doc => { batch.update(doc.ref, { status: "เข้าคลังแล้ว", currentHolder: "CENTRAL_BANK", approvedBy: AdminState.currentAdmin.name, approvedAt: firebase.firestore.FieldValue.serverTimestamp() }); });
                await batch.commit(); AppHelper.showLoader(false);
                Swal.fire('สำเร็จ', `รับยอด ${snap.size} บิล เข้าสู่คลังส่วนกลางเรียบร้อย`, 'success'); window.loadLedgerData();
            } catch (err) { AppHelper.showLoader(false); Swal.fire('Error', err.message, 'error'); }
        }
    });
};

// ============================================================================
// 📊 ส่วนที่ 5: สมุดบัญชีรายวันแบบปฏิทิน (Daily Calendar Ledger)
// ============================================================================
let ledgerTxCache = [];

function getLocalDateString(dateObj) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

let selectedLedgerDate = getLocalDateString(new Date());

window.loadTransactions = async function() {
    try {
        const snap = await db.collection("transactions").orderBy("timestamp", "desc").limit(300).get();
        ledgerTxCache = [];
        snap.forEach(doc => { ledgerTxCache.push({ id: doc.id, ...doc.data() }); });
        
        window.generateCalendarStrip();
        window.updatePendingTransactionsList();
    } catch (e) { console.error("Load Transactions Error:", e); }
};

// 🌟 ตัวช่วย: ฟังก์ชันดึงยอดเงินสด/ธนาคาร ณ ปัจจุบันจากฐานข้อมูลตรงๆ (Real-time Balance Check)
window.getRealtimeBalances = async function() {
    const snap = await db.collection("transactions").where("status", "==", "อนุมัติแล้ว").get();
    let bankBal = 0; let cashBal = 0;
    snap.forEach(doc => {
        const d = doc.data(); const amt = parseFloat(d.amount) || 0;
        if(d.type.includes('รับ') || d.type === 'สมทบเงินกองทุน') {
            if(d.paymentMethod && d.paymentMethod.includes('ธนาคาร')) bankBal += amt; else cashBal += amt;
        } else if(d.type.includes('จ่าย') || d.type === 'จ่ายสวัสดิการ') {
            if(d.paymentMethod && d.paymentMethod.includes('ธนาคาร')) bankBal -= amt; else cashBal -= amt;
        } else if(d.type === 'โอนย้ายสภาพคล่อง') {
            if(d.note && d.note.includes('โอนจาก bank ไป cash')) { bankBal -= amt; cashBal += amt; }
            if(d.note && d.note.includes('โอนจาก cash ไป bank')) { cashBal -= amt; bankBal += amt; }
        }
    });
    return { bankBal, cashBal };
};

window.generateCalendarStrip = function() {
    const container = document.getElementById('calendarStrip');
    if(!container) return;
    
    let html = "";
    const daysThai = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const today = new Date();
    
    for(let i = -1; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const dayName = daysThai[d.getDay()];
        const dateNum = d.getDate();
        
        const isToday = i === 0;
        const activeClass = (dateStr === selectedLedgerDate) ? 'active-date' : '';
        
        html += `<div class="calendar-date-item ${activeClass}" id="cal-date-${dateStr}" onclick="selectLedgerDate('${dateStr}')"><span class="day-name">${isToday ? 'วันนี้' : dayName}</span><span class="date-num">${dateNum}</span></div>`;
    }
    
    container.innerHTML = html;
    setTimeout(() => { const activeEl = document.getElementById(`cal-date-${selectedLedgerDate}`); if(activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 100);
    window.filterTransactionsByDate();
};

window.selectLedgerDate = function(dateStr) {
    selectedLedgerDate = dateStr;
    document.querySelectorAll('.calendar-date-item').forEach(el => el.classList.remove('active-date'));
    const selectedEl = document.getElementById(`cal-date-${dateStr}`);
    if(selectedEl) selectedEl.classList.add('active-date');
    window.filterTransactionsByDate();
};

window.filterTransactionsByDate = function() {
    const container = document.getElementById('list-daily-transactions');
    const displayDate = document.getElementById('selectedDateDisplay');
    if (!container) return;
    
    let html = ""; 
    let totalIn = 0; 
    let totalOut = 0;

    const dailyData = ledgerTxCache.filter(d => d.transactionDate === selectedLedgerDate && d.status === 'อนุมัติแล้ว');

    dailyData.forEach(d => {
        const amt = parseFloat(d.amount || 0); 
        const amtStr = amt.toLocaleString('en-US', { minimumFractionDigits: 2 });
        
        const isTransfer = d.type === 'โอนย้ายสภาพคล่อง';
        const isIncome = d.type.includes('รับ') || d.type === 'สมทบเงินกองทุน';

        if (isTransfer) {
            // 🌟 แก้ไข: เขียนทิศทางให้ชัดเจน ว่าโอนจากไหนไปไหน
            let dirText = "ภายในระบบ";
            if (d.note && d.note.includes('โอนจาก cash ไป bank')) dirText = "เงินสด ➔ ธนาคาร";
            if (d.note && d.note.includes('โอนจาก bank ไป cash')) dirText = "ธนาคาร ➔ เงินสด";

            html += `
                <div class="p-3 mb-2 bg-warning bg-opacity-10 rounded-4 border border-warning border-opacity-50 shadow-sm">
                    <div class="d-flex justify-content-between align-items-center">
                        <div style="min-width: 0;">
                            <strong class="text-dark d-block text-truncate" style="font-size: 0.9rem;">
                                <i class="fa-solid fa-arrow-right-arrow-left text-warning me-1"></i> ${d.type}
                            </strong>
                            <small class="text-dark d-block text-truncate mt-1" style="font-size: 0.75rem;">${d.note || d.fullName}</small>
                        </div>
                        <div class="text-end flex-shrink-0 ms-2">
                            <strong class="text-warning text-dark fs-6 d-block">฿${amtStr}</strong>
                            <span class="badge bg-white text-warning border border-warning mt-1" style="font-size: 0.65rem;">${dirText}</span>
                        </div>
                    </div>
                </div>`;
        } else {
            if(isIncome) totalIn += amt; else totalOut += amt;
            const colorClass = isIncome ? 'text-success' : 'text-danger'; 
            const sign = isIncome ? '+' : '-';
            const icon = isIncome ? '<i class="fa-solid fa-arrow-turn-down me-1"></i>' : '<i class="fa-solid fa-arrow-turn-up me-1"></i>';
            
            html += `
                <div class="p-3 mb-2 bg-light rounded-4 border border-secondary border-opacity-10 shadow-sm">
                    <div class="d-flex justify-content-between align-items-center">
                        <div style="min-width: 0;">
                            <strong class="text-dark d-block text-truncate" style="font-size: 0.9rem;">${icon} ${d.type}</strong>
                            <small class="text-muted d-block text-truncate mt-1" style="font-size: 0.75rem;">${d.note || d.fullName}</small>
                        </div>
                        <div class="text-end flex-shrink-0 ms-2">
                            <strong class="${colorClass} fs-6 d-block">${sign}฿${amtStr}</strong>
                            <span class="badge bg-white text-muted border mt-1" style="font-size: 0.65rem;">${d.paymentMethod || '-'}</span>
                        </div>
                    </div>
                </div>`;
        }
    });

    if (displayDate) {
        const dParts = selectedLedgerDate.split('-');
        if(dParts.length === 3) {
            const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
            const isToday = selectedLedgerDate === getLocalDateString(new Date());
            displayDate.innerHTML = isToday ? `ประวัติ <span class="text-dark">วันนี้</span>` : `ประวัติ <span class="text-dark">${parseInt(dParts[2])} ${thaiMonths[parseInt(dParts[1])-1]} ${parseInt(dParts[0].substring(2))+43}</span>`;
        }
    }

    const netTotal = totalIn - totalOut;
    const netTotalEl = document.getElementById('dailyNetTotal');
    if (netTotalEl) {
        netTotalEl.innerText = `฿${netTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (netTotal > 0) netTotalEl.className = "fw-bold mb-0 mt-1 text-success";
        else if (netTotal < 0) netTotalEl.className = "fw-bold mb-0 mt-1 text-danger";
        else netTotalEl.className = "fw-bold mb-0 mt-1 text-dark";
    }

    document.getElementById('dailyTotalIn').innerText = `฿${totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('dailyTotalOut').innerText = `฿${totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    
    container.innerHTML = html || '<div class="text-center text-muted small py-4 bg-light rounded-4 border border-dashed"><i class="fa-solid fa-file-invoice mb-2 fs-3 text-secondary opacity-50 d-block"></i>ไม่มีรายการธุรกรรมในวันที่เลือก</div>';
};

window.updatePendingTransactionsList = function() {
    const pendingContainer = document.getElementById('list-pending-transactions');
    const badge = document.getElementById('pendingTxBadge');
    if (!pendingContainer) return;
    
    let pendingHtml = "";
    const pendingData = ledgerTxCache.filter(d => d.status !== 'อนุมัติแล้ว');
    
    pendingData.forEach(d => {
        const amt = parseFloat(d.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        pendingHtml += `
            <div class="p-2 mb-2 d-flex justify-content-between align-items-center border-warning border-opacity-50 bg-warning bg-opacity-10 rounded-3">
                <div style="min-width: 0;"><strong class="text-dark d-block text-truncate" style="font-size: 0.85rem;">${d.type} <span class="text-muted small">(${d.currentHolder || '-'})</span></strong><small class="text-muted d-block" style="font-size: 0.7rem;">${d.transactionDate || ''} | ${d.fullName || ''}</small></div>
                <div class="text-end flex-shrink-0 ms-2"><strong class="text-dark fs-6 d-block">฿${amt}</strong><span class="badge bg-warning text-dark rounded-pill shadow-sm mt-1" style="font-size: 0.6rem;">${d.status}</span></div>
            </div>`;
    });
    
    pendingContainer.innerHTML = pendingHtml || '<div class="text-center text-muted small py-2">ไม่มีรายการค้างส่ง</div>';
    if (badge) { if (pendingData.length > 0) { badge.innerText = pendingData.length; badge.style.display = 'block'; } else { badge.style.display = 'none'; } }
};

// 🟢 ป๊อปอัป + รับเงิน / - จ่ายเงิน (Smart Popup พร้อมเช็คยอดเงิน 100%)
window.openDailyLedgerForm = async function(type) {
    const isIncome = type === 'income';
    const title = isIncome ? 'บันทึกรายรับ (+)' : 'บันทึกรายจ่าย (-)';
    const themeColor = isIncome ? '#10B981' : '#EF4444';
    
    const categories = isIncome 
        ? ['รับเงินสมทบ (เก็บตก)', 'ดอกเบี้ยธนาคารรับ', 'เงินอุดหนุนรัฐ/ท้องถิ่น', 'เงินบริจาค', 'รายรับอื่นๆ']
        : ['ค่าบริหารจัดการ', 'วัสดุอุปกรณ์สำนักงาน', 'ค่าใช้จ่ายในการเดินทาง', 'ค่าตอบแทน/เบี้ยเลี้ยง', 'จ่ายสวัสดิการ (เก็บตก)', 'รายจ่ายอื่นๆ'];
        
    let catOptions = '<option value="" disabled selected>-- เลือกลักษณะรายการ --</option>';
    categories.forEach(c => catOptions += `<option value="${c}">${c}</option>`);
    
    const paymentOptions = isIncome 
        ? `<option value="โอนผ่านธนาคาร">รับโอนเข้าธนาคาร</option><option value="เงินสด">รับเป็นเงินสด</option>`
        : `<option value="โอนผ่านธนาคาร">โอนออกธนาคาร</option><option value="เงินสด">จ่ายด้วยเงินสด</option><option value="เครดิต (ค้างจ่าย)">เครดิต (ค้างจ่าย)</option>`;

    const { value: formValues } = await Swal.fire({
        title: `<div style="color:${themeColor}"><i class="fa-solid fa-file-invoice-dollar"></i> ${title}</div>`,
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">วันที่ทำรายการ</label>
                <input type="date" id="popupDate" class="form-control-modern w-100 mb-3" value="${selectedLedgerDate}" readonly style="background-color:#F8FAFC;">
                
                <label class="small fw-bold text-muted mb-1">เลือกรายการ${isIncome ? 'รับ' : 'จ่าย'} *</label>
                <select id="popupCategory" class="form-select-modern w-100 mb-2 border-0 shadow-sm bg-white">
                    ${catOptions}
                    <option value="other">อื่นๆ (พิมพ์ระบุเอง)</option>
                </select>
                <input type="text" id="popupCustomNote" class="form-control-modern w-100 mb-3 d-none border-0 shadow-sm bg-white" placeholder="พิมพ์รายละเอียดรายการ...">
                
                <label class="small fw-bold text-muted mb-1 mt-2">จำนวนเงิน (บาท) *</label>
                <input type="number" id="popupAmount" class="form-control-modern w-100 mb-3 text-center fw-bold fs-3 border-0 shadow-sm" style="color:${themeColor}; background-color:${isIncome ? '#ECFDF5' : '#FEF2F2'};" placeholder="0.00" step="0.01">
                
                <label class="small fw-bold text-muted mb-1">ช่องทางการชำระ *</label>
                <select id="popupMethod" class="form-select-modern w-100 border-0 shadow-sm bg-white">${paymentOptions}</select>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกรายการ', cancelButtonText: 'ยกเลิก', confirmButtonColor: themeColor,
        didOpen: () => {
            const catSelect = document.getElementById('popupCategory');
            const customInput = document.getElementById('popupCustomNote');
            catSelect.addEventListener('change', (e) => {
                if(e.target.value === 'other') { customInput.classList.remove('d-none'); customInput.focus(); } 
                else { customInput.classList.add('d-none'); }
            });
        },
        preConfirm: async () => {
            let cat = document.getElementById('popupCategory').value;
            if(cat === 'other') cat = document.getElementById('popupCustomNote').value.trim();
            const amount = parseFloat(document.getElementById('popupAmount').value);
            const method = document.getElementById('popupMethod').value;
            const date = document.getElementById('popupDate').value;
            
            if(!cat) { Swal.showValidationMessage('กรุณาเลือกหรือระบุรายการ'); return false; }
            if(isNaN(amount) || amount <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวนเงินให้มากกว่า 0'); return false; }
            
            // 🛡️ ตรวจสอบยอดเงินแบบ Real-time ก่อนบันทึกรายจ่าย
            if (!isIncome && !method.includes('เครดิต')) {
                const bals = await window.getRealtimeBalances();
                let availableBal = method.includes('ธนาคาร') ? bals.bankBal : bals.cashBal;
                let sourceName = method.includes('ธนาคาร') ? "ธนาคาร" : "เงินสด";
                
                if (amount > availableBal) {
                    Swal.showValidationMessage(`ยอดเงินไม่เพียงพอ! (ยอด${sourceName}คงเหลือ: ฿${availableBal.toLocaleString('en-US', {minimumFractionDigits: 2})})`);
                    return false;
                }
            }
            return { category: cat, amount, method, date };
        }
    });

    if (formValues) {
        AppHelper.showLoader(true, "กำลังบันทึกรายการ...");
        try {
            const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
            const adminName = AdminState.currentAdmin?.name || "Admin";
            
            const txData = {
                txId: txId, 
                type: isIncome ? 'บันทึกรายรับ' : 'บันทึกรายจ่าย', 
                note: formValues.category, 
                amount: formValues.amount, 
                paymentMethod: formValues.method, 
                transactionDate: formValues.date, 
                fullName: 'แอดมิน: ' + adminName, 
                status: 'อนุมัติแล้ว', 
                currentHolder: formValues.method.includes('ธนาคาร') ? 'CENTRAL_BANK' : 'CASH_ON_HAND', 
                timestamp: new Date()
            };

            await db.collection("transactions").doc(txId).set(txData);
            
            ledgerTxCache.unshift({ id: txId, ...txData });
            window.filterTransactionsByDate();
            if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview(); // อัปเดตยอดภาพรวม

            AppHelper.showLoader(false);
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1500 });
        } catch (error) {
            AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกรายการได้: ' + error.message, 'error');
        }
    }
};

// 🔄 ปุ่มลัดสำหรับโอนย้ายเงิน (แก้ไขปัญหา ID ซ้ำและเช็คยอดเงิน 100%)
window.openTransferForm = async function() {
    const { value: formValues } = await Swal.fire({
        title: `<div style="color:#F59E0B"><i class="fa-solid fa-arrow-right-arrow-left"></i> โอนย้ายเงิน</div>`,
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">วันที่ทำรายการ</label>
                <input type="date" id="popupTfDate" class="form-control-modern w-100 mb-3" value="${selectedLedgerDate}" readonly style="background-color:#F8FAFC;">
                
                <div class="row g-2 mb-3">
                    <div class="col-5">
                        <label class="small fw-bold text-muted mb-1">ต้นทาง (จาก)</label>
                        <!-- 🌟 เปลี่ยน ID เป็น popupTfFrom -->
                        <select id="popupTfFrom" class="form-select-modern w-100 border-0 shadow-sm bg-white text-center fw-bold text-primary">
                            <option value="cash" selected>เงินสด</option>
                            <option value="bank">ธนาคาร</option>
                        </select>
                    </div>
                    <div class="col-2 d-flex align-items-center justify-content-center pt-3">
                        <i class="fa-solid fa-arrow-right text-muted fs-4"></i>
                    </div>
                    <div class="col-5">
                        <label class="small fw-bold text-muted mb-1">ปลายทาง (ไป)</label>
                        <!-- 🌟 เปลี่ยน ID เป็น popupTfTo -->
                        <select id="popupTfTo" class="form-select-modern w-100 border-0 shadow-sm bg-white text-center fw-bold text-success">
                            <option value="bank" selected>ธนาคาร</option>
                            <option value="cash">เงินสด</option>
                        </select>
                    </div>
                </div>
                
                <label class="small fw-bold text-muted mb-1">จำนวนเงิน (บาท) *</label>
                <!-- 🌟 เปลี่ยน ID เป็น popupTfAmount -->
                <input type="number" id="popupTfAmount" class="form-control-modern w-100 mb-3 text-center fw-bold fs-3 border-0 shadow-sm" style="color:#D97706; background-color:#FEF3C7;" placeholder="0.00" step="0.01">
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกโอนย้าย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#F59E0B',
        didOpen: () => {
            const fromEl = document.getElementById('popupTfFrom'); 
            const toEl = document.getElementById('popupTfTo');
            fromEl.addEventListener('change', (e) => { toEl.value = e.target.value === 'cash' ? 'bank' : 'cash'; });
            toEl.addEventListener('change', (e) => { fromEl.value = e.target.value === 'cash' ? 'bank' : 'cash'; });
        },
        preConfirm: async () => {
            const amount = parseFloat(document.getElementById('popupTfAmount').value);
            const from = document.getElementById('popupTfFrom').value;
            const to = document.getElementById('popupTfTo').value;
            const date = document.getElementById('popupTfDate').value;
            
            if(from === to) { Swal.showValidationMessage('ต้นทางและปลายทางต้องไม่ซ้ำกัน'); return false; }
            if(isNaN(amount) || amount <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวนเงินให้มากกว่า 0'); return false; }
            
            // 🛡️ ตรวจสอบยอดเงินแบบ Real-time ก่อนโอนย้าย
            const bals = await window.getRealtimeBalances();
            let availableBal = from === 'bank' ? bals.bankBal : bals.cashBal;
            let sourceName = from === 'bank' ? "ธนาคาร" : "เงินสด";
            
            if (amount > availableBal) {
                Swal.showValidationMessage(`ยอดเงินไม่เพียงพอ! (ยอด${sourceName}คงเหลือ: ฿${availableBal.toLocaleString('en-US', {minimumFractionDigits: 2})})`);
                return false;
            }
            
            return { amount, from, to, date };
        }
    });

    if (formValues) {
        AppHelper.showLoader(true, "กำลังบันทึกรายการ...");
        try {
            const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
            const adminName = AdminState.currentAdmin?.name || "Admin";
            let noteMsg = formValues.from === 'cash' ? 'นำเงินสดฝากเข้าธนาคาร (โอนจาก cash ไป bank)' : 'ถอนเงินสดจากธนาคาร (โอนจาก bank ไป cash)';

            const txData = {
                txId: txId, type: 'โอนย้ายสภาพคล่อง', note: noteMsg, amount: formValues.amount, paymentMethod: 'ภายในระบบ', transactionDate: formValues.date, fullName: 'แอดมิน: ' + adminName, status: 'อนุมัติแล้ว', currentHolder: 'CENTRAL_BANK', timestamp: new Date()
            };

            await db.collection("transactions").doc(txId).set(txData);
            ledgerTxCache.unshift({ id: txId, ...txData });
            window.filterTransactionsByDate();
            if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview(); // อัปเดตยอดภาพรวม

            AppHelper.showLoader(false);
            Swal.fire({ icon: 'success', title: 'โอนย้ายสำเร็จ', showConfirmButton: false, timer: 1500 });
        } catch (error) { AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกรายการได้: ' + error.message, 'error'); }
    }
};

// ============================================================================
// 🧾 ส่วนที่ 6: Export & E-Receipt
// ============================================================================
window.exportTransactionsToCSV = function() {
    AppHelper.showLoader(true, "กำลังสร้างไฟล์ Excel...");
    const dataToExport = ledgerTxCache.filter(d => d.status === 'อนุมัติแล้ว' && d.transactionDate === selectedLedgerDate);
    if (dataToExport.length === 0) { AppHelper.showLoader(false); return Swal.fire('ไม่พบข้อมูล', `ไม่มีรายการธุรกรรมในวันที่ ${selectedLedgerDate} ให้ส่งออก`, 'warning'); }
    
    let csvContent = "\uFEFFรหัสอ้างอิง (TX),วันที่ทำรายการ,ประเภทธุรกรรม,หมวดหมู่/รายละเอียด,จำนวนเงิน (บาท),ช่องทาง,ชื่อผู้ทำรายการ\n";
    dataToExport.forEach(d => { csvContent += `"${d.txId||'-'}","${d.transactionDate||'-'}","${d.type||'-'}","${(d.note||'-').replace(/,/g," ")}","${d.amount||0}","${d.paymentMethod||'-'}","${(d.fullName||'-').replace(/,/g," ")}"\n`; });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url); link.setAttribute("download", `CWF_Daily_${selectedLedgerDate}.csv`); 
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    AppHelper.showLoader(false);
};

window.generateEReceipt = function(txId, type, amount, date, note, name) {
    AppHelper.showLoader(true, "กำลังสร้างสลิปใบเสร็จ...");
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 850; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const isIncome = type.includes('รับ') || type.includes('สมทบ'); const themeColor = isIncome ? '#10B981' : '#EF4444'; 
    ctx.fillStyle = themeColor; ctx.fillRect(0, 0, canvas.width, 140);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px Prompt, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(isIncome ? 'ใบเสร็จรับเงิน' : 'ใบสำคัญจ่าย', canvas.width / 2, 85);
    ctx.textAlign = 'left'; ctx.fillStyle = '#475569'; ctx.font = '22px Prompt, sans-serif';
    const fundName = AdminState.fundSettings?.fundName || "กองทุนสวัสดิการชุมชน";
    
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
    }
    
    ctx.fillStyle = '#F8FAFC'; ctx.roundRect(40, 180, 520, 360, 20); ctx.fill(); ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = 'bold 24px Prompt'; ctx.fillText('ข้อมูลการทำรายการ', 70, 230);
    ctx.font = '22px Prompt'; ctx.fillStyle = '#64748B'; ctx.beginPath(); ctx.moveTo(70, 250); ctx.lineTo(530, 250); ctx.stroke();
    
    ctx.fillText('รหัสอ้างอิง (Ref):', 70, 300); ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(txId, 530, 300);
    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('วันที่ทำรายการ:', 70, 350); ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(date, 530, 350);
    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('ประเภท:', 70, 400); ctx.fillStyle = themeColor; ctx.textAlign = 'right'; ctx.fillText(type, 530, 400);
    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('ชื่อสมาชิก:', 70, 450); ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(name.replace('แอดมิน: ', ''), 530, 450);
    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('รายละเอียด:', 70, 500); ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right';
    
    let shortNote = note; if(shortNote.length > 25) shortNote = shortNote.substring(0, 25) + '...';
    ctx.fillText(shortNote, 530, 500);
    ctx.textAlign = 'center'; ctx.fillStyle = '#94A3B8'; ctx.font = '20px Prompt'; ctx.fillText('จำนวนเงิน (Amount)', canvas.width / 2, 600);
    ctx.fillStyle = themeColor; ctx.font = 'bold 64px Prompt'; ctx.fillText('฿ ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2}), canvas.width / 2, 670);
    ctx.fillStyle = '#CBD5E1'; ctx.font = '18px Prompt'; ctx.fillText('ออกโดย: ' + fundName, canvas.width / 2, 770); ctx.fillText('เอกสารนี้ออกโดยระบบอัตโนมัติ SmartWelf 5.0', canvas.width / 2, 800);

    const imgData = canvas.toDataURL('image/jpeg', 1.0); AppHelper.showLoader(false);
    Swal.fire({ title: 'ใบเสร็จรับเงิน (E-Slip)', imageUrl: imgData, imageWidth: '100%', imageAlt: 'Receipt Image', showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-download"></i> บันทึกรูปลงเครื่อง', cancelButtonText: 'ปิด', confirmButtonColor: '#2563EB', customClass: { image: 'rounded-4 shadow-sm border' } }).then((res) => { if(res.isConfirmed) { const link = document.createElement('a'); link.download = `SmartWelf_Slip_${txId}.jpg`; link.href = imgData; link.click(); Swal.fire({icon: 'success', title: 'บันทึกรูปภาพสำเร็จ!', showConfirmButton: false, timer: 1500}); } });
};
// =========================================================
// 📱 ระบบสร้าง QR Code สำหรับเรียกเก็บเงินจากสมาชิก
// =========================================================
window.generatePaymentQR = function() {
    Swal.fire({
        title: '<div style="color:#2563EB"><i class="fa-solid fa-qrcode"></i> สร้าง QR เรียกเก็บเงิน</div>',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">ระบุจำนวนเงินที่ต้องการเรียกเก็บ (บาท)</label>
                <input type="number" id="qrAmountInput" class="form-control-modern w-100 mb-3 text-center fw-bold fs-3 border-0 shadow-sm" style="color:#2563EB; background-color:#EFF6FF;" placeholder="0.00" step="0.01">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-qrcode me-1"></i> สร้าง QR',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const amount = parseFloat(document.getElementById('qrAmountInput').value);
            if (!amount || amount <= 0) {
                Swal.showValidationMessage('กรุณาระบุจำนวนเงินให้ถูกต้อง');
                return false;
            }
            return amount;
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const amount = res.value;
            const refId = "REQ-" + Date.now().toString().slice(-8);
            
            // ข้อมูลที่จะฝังใน QR Code
            const qrPayload = JSON.stringify({
                action: "pay_to_fund",
                amount: amount,
                ref: refId,
                adminName: AdminState.currentAdmin?.name || "Admin"
            });

            Swal.fire({
                title: 'สแกนเพื่อชำระเงิน',
                html: `
                    <div class="text-center" style="font-family:'Prompt';">
                        <p class="text-muted small mb-1">จำนวนเงินที่ต้องชำระ:</p>
                        <h2 class="text-primary fw-bold mb-3">฿${amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</h2>
                        <div id="paymentQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3 border" style="width: 220px; height: 220px;"></div>
                        <p class="small text-muted mb-0"><i class="fa-solid fa-mobile-screen me-1"></i> ให้สมาชิกใช้ LINE สแกน</p>
                    </div>
                `,
                didOpen: () => {
                    // วาดรูป QR Code
                    new QRCode(document.getElementById("paymentQrBox"), { 
                        text: qrPayload, 
                        width: 180, 
                        height: 180,
                        colorDark : "#0F172A",
                        colorLight : "#ffffff",
                    });
                },
                confirmButtonText: 'ปิดหน้าต่าง'
            });
        }
    });
};