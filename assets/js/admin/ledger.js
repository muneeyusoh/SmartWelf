// =========================================================
// 💸 ledger.js: ระบบการเงินและบัญชี (Chain of Custody V2)
// =========================================================

// --- ส่วนที่ 1: การกรอกเงินสมาชิกในตาราง (เหมือนเดิม) ---
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

// ฟังก์ชันตัวช่วย: ประเมินว่าบิลใบใหม่ที่สร้างขึ้น จะมีสถานะอะไร อิงตาม Role
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

/**
 * 🌟 รับเงินสมทบรายบุคคล (Single Payment)
 */
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
            
            // 🌟 คำนวณสถานะบิลตามสิทธิ์แอดมิน
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
            if(document.getElementById('admin-view-overview') && document.getElementById('admin-view-overview').classList.contains('d-block')) {
                if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview(); 
            }
        }, 1500); 

    } catch (error) { 
        AppHelper.showLoader(false); 
        console.error("Ledger Transaction Error:", error); 
        Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกเงินสมทบ', 'error'); 
    }
};

/**
 * 🌟 รับเงินสมทบแบบกลุ่ม Bulk (Batch Write)
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

            if (formValues.isQR) {
                // QR Flow ... (เหมือนเดิม)
            } else {
                AppHelper.showLoader(true, "กำลังบันทึกรายการกลุ่ม...");
                
                // 🌟 คำนวณเส้นทางการเงิน
                const routeData = getNextFinancialStatusAndHolder(AdminState.currentAdmin.role, adminEmail);

                const batch = db.batch();
                const txRef = db.collection("transactions").doc();
                batch.set(txRef, { 
                    txId: bulkTxId, type: 'สมทบเงินกองทุน', amount: totalAmt, paymentMethod: 'เงินสด', 
                    transactionDate: formValues.date, fullName: 'แอดมิน: ' + adminName, status: routeData.status, 
                    currentHolder: routeData.holder, note: finalNote, uid: "BULK", bulkMembers: bulkDataArr, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                });

                // อัปเดตยอดให้สมาชิกเมื่อเข้าคลังสำเร็จเท่านั้น
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
        } catch(e) { 
            AppHelper.showLoader(false); Swal.fire('Error', 'ไม่สามารถจัดเก็บเงินกลุ่มได้', 'error'); 
        }
    }
};

// =========================================================
// 🌟 ส่วนที่ 3: ระบบส่งต่อเงิน / สแกนรับเงิน (Handover System)
// =========================================================

// ฟังก์ชันสร้าง QR เพื่อ "ส่งเงินที่เราถืออยู่" ให้คนอื่นสแกนรับ
window.generateTransferAdminQR = async function() {
    AppHelper.showLoader(true, "กำลังประมวลผล...");
    try {
        const myEmail = AdminState.currentAdmin?.email || "";
        const myRole = AdminState.currentAdmin?.role || "";
        
        // หาบิลที่เราถืออยู่ (สถานะที่เรารับมาแล้วยังไม่ได้ส่งต่อ)
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
            html: `
                <div class="text-center" style="font-family:'Prompt';">
                    <p class="small text-muted mb-2">ยอดเงินสดที่ถืออยู่ (${billsCount} รายการ):</p>
                    <h2 class="fw-bold text-success mb-3">฿${totalHold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                    <div id="transferAdminQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3" style="width: 200px; height: 200px;"></div>
                    <p class="small text-muted mb-0">${myRole === 'Admin-ผู้ดูแล' ? 'ให้ <b>Admin-ศูนย์</b> สแกนรับยอด' : 'ให้ <b>Admin-การเงิน</b> สแกนรับยอด'}</p>
                </div>
            `,
            didOpen: () => { new QRCode(document.getElementById("transferAdminQrBox"), { text: qrPayload, width: 170, height: 170 }); },
            showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง'
        });
    } catch (e) { AppHelper.showLoader(false); console.error(e); Swal.fire('Error', e.message, 'error'); }
};

// ฟังก์ชัน "สแกนรับเงิน" จากแอดมินคนอื่น
window.scanToReceiveAdminFunds = function() {
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        liff.scanCodeV2().then(res => { if (res && res.value) { window.handleScannedAdminQR(res.value); } }).catch(err => { window.promptManualCodeInput(); });
    } else { window.promptManualCodeInput(); }
};

window.promptManualCodeInput = function() {
    Swal.fire({ title: 'ระบุรหัสธุรกรรม / สแกน', input: 'text', inputPlaceholder: 'เช่น TRF-123456', showCancelButton: true, confirmButtonText: 'ตรวจสอบ', cancelButtonText: 'ยกเลิก' })
    .then(res => { if (res.isConfirmed && res.value) { window.handleScannedAdminQR(res.value.trim()); } });
};

// ประมวลผลสิ่งที่ได้จากการสแกน QR 
window.handleScannedAdminQR = async function(codeValue) {
    let payload = {};
    try { payload = JSON.parse(codeValue); } catch (e) { return Swal.fire('QR ไม่ถูกต้อง', 'รหัส QR นี้ไม่ใช่รหัสโอนย้ายเงินของกองทุน', 'error'); }

    if(payload.action !== 'admin_transfer_handover') return Swal.fire('QR ไม่ถูกต้อง', 'กรุณาสแกน QR สำหรับรับมอบเงิน', 'error');

    const myRole = AdminState.currentAdmin.role;
    
    // Check & Balance: ตรวจสอบสิทธิ์การรับเงินตาม Hierarchy
    if (payload.senderRole === 'Admin-ผู้ดูแล' && (myRole !== 'Admin-ศูนย์ประสานงาน' && myRole !== 'Admin-Master' && myRole !== 'Admin-การเงิน')) {
        return Swal.fire('สิทธิ์ไม่เพียงพอ', 'เฉพาะ Admin-ศูนย์ประสานงาน หรือการเงิน เท่านั้นที่รับยอดนี้ได้', 'error');
    }
    if (payload.senderRole === 'Admin-ศูนย์ประสานงาน' && (myRole !== 'Admin-การเงิน' && myRole !== 'Admin-Master')) {
        return Swal.fire('สิทธิ์ไม่เพียงพอ', 'เฉพาะ Admin-การเงิน หรือ Master เท่านั้นที่รับยอดจากศูนย์ได้', 'error');
    }

    Swal.fire({
        title: 'รับมอบเงินสด?',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <p class="mb-1 text-muted small">รับมอบจาก: <strong>${payload.senderName} (${payload.senderRole})</strong></p>
                <p class="mb-1 text-muted small">จำนวนเงินรวม: <strong class="text-success fs-4">฿${parseFloat(payload.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></p>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'ยืนยันรับเงิน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
    }).then(async r => {
        if (r.isConfirmed) {
            AppHelper.showLoader(true, "กำลังย้ายสิทธิ์การถือเงิน...");
            try {
                // อัปเดตสถานะทุกบิลที่ผู้ส่งคนนั้นถืออยู่
                let searchStatus = payload.senderRole === 'Admin-ผู้ดูแล' ? "รอส่งศูนย์" : "รอส่งการเงิน";
                const snap = await db.collection("transactions").where("currentHolder", "==", payload.sender).where("status", "==", searchStatus).get();
                
                const batch = db.batch();
                const routeData = getNextFinancialStatusAndHolder(myRole, AdminState.currentAdmin.email);

                snap.forEach(doc => {
                    batch.update(doc.ref, {
                        currentHolder: routeData.holder,
                        status: routeData.status,
                        receivedBy: AdminState.currentAdmin.name,
                        receivedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await batch.commit();
                AppHelper.showLoader(false); 
                Swal.fire('สำเร็จ', routeData.status === 'เข้าคลังแล้ว' ? 'เงินเข้าสู่คลังส่วนกลางแล้ว' : 'เงินถูกย้ายมาอยู่ที่คุณแล้ว (รอส่งการเงิน)', 'success');
                if(typeof window.loadLedgerData === 'function') window.loadLedgerData();
            } catch(e) {
                AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// =========================================================
// 🌟 ส่วนที่ 4: ฟังก์ชันบัญชีกลาง (สำหรับ Admin-การเงิน)
// =========================================================
window.loadLedgerData = function() {
    if (typeof window.loadTransactions === 'function') window.loadTransactions(); 
    if (typeof window.loadReceiptHistory === 'function') window.loadReceiptHistory(); 
    if (typeof window.checkFinanceButtons === 'function') window.checkFinanceButtons(); 
    if (typeof window.loadLedgerNotes === 'function') window.loadLedgerNotes();
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
                snap.forEach(doc => {
                    batch.update(doc.ref, { status: "เข้าคลังแล้ว", currentHolder: "CENTRAL_BANK", approvedBy: AdminState.currentAdmin.name, approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
                });

                await batch.commit(); AppHelper.showLoader(false);
                Swal.fire('สำเร็จ', `รับยอด ${snap.size} บิล เข้าสู่คลังส่วนกลางเรียบร้อย`, 'success');
                window.loadLedgerData();
            } catch (err) { AppHelper.showLoader(false); Swal.fire('Error', err.message, 'error'); }
        }
    });
};

// ============================================================================
// 📊 ส่วนที่ 5: ประวัติและการแสดงผลบิล
// ============================================================================
let ledgerTxCache = [];

window.loadTransactions = async function() {
    const approvedContainer = document.getElementById('list-approved-transactions');
    try {
        const snap = await db.collection("transactions").orderBy("timestamp", "desc").limit(100).get();
        ledgerTxCache = [];
        snap.forEach(doc => { ledgerTxCache.push({ id: doc.id, ...doc.data() }); });
        window.filterTransactions();
    } catch (e) { console.error("Load Transactions Error:", e); }
};

window.filterTransactions = function() {
    const keyword = (document.getElementById('searchTxKeyword')?.value || "").toLowerCase();
    
    const approvedContainer = document.getElementById('list-approved-transactions');
    const pendingContainer = document.getElementById('list-pending-transactions');
    let approvedHtml = ""; let pendingHtml = "";

    // กรองและแยกบิลตามสถานะ
    ledgerTxCache.forEach(d => {
        const matchKeyword = !keyword || (d.txId && d.txId.toLowerCase().includes(keyword)) || (d.fullName && d.fullName.toLowerCase().includes(keyword));
        if (matchKeyword) {
            const amt = parseFloat(d.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
            let badgeColor = d.status === 'เข้าคลังแล้ว' ? 'bg-success' : 'bg-warning text-dark';
            
            const card = `
                <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
                    <div style="min-width: 0;">
                        <strong class="text-dark d-block text-truncate">${d.type} <span class="text-muted small">(${d.currentHolder || '-'})</span></strong>
                        <small class="text-muted d-block" style="font-size: 0.75rem;"><i class="fa-regular fa-calendar me-1"></i>${d.transactionDate || ''} | ${d.fullName || ''}</small>
                    </div>
                    <div class="text-end flex-shrink-0 ms-2">
                        <strong class="text-dark fs-6 d-block">฿${amt}</strong>
                        <span class="badge ${badgeColor} rounded-pill shadow-sm">${d.status}</span>
                    </div>
                </div>
            `;
            if (d.status === 'เข้าคลังแล้ว') approvedHtml += card; else pendingHtml += card;
        }
    });

    if(approvedContainer) approvedContainer.innerHTML = approvedHtml || '<div class="text-center text-muted small py-3 bg-white border">ไม่พบประวัติ</div>';
    if(pendingContainer) pendingContainer.innerHTML = pendingHtml || '<div class="text-center text-muted small py-3 bg-white border">ไม่มีบิลค้างส่ง</div>';
};

window.clearTxFilter = function() {
    if(document.getElementById('searchTxKeyword')) document.getElementById('searchTxKeyword').value = "";
    window.filterTransactions();
};

window.exportTransactionsToCSV = function() {
    AppHelper.showLoader(true, "กำลังสร้างไฟล์ Excel...");
    
    const keyword = (document.getElementById('searchTxKeyword')?.value || "").toLowerCase();
    const filterDate = document.getElementById('searchTxDate')?.value || "";
    
    const dataToExport = ledgerTxCache.filter(d => {
        if (d.status !== 'อนุมัติแล้ว') return false;
        const matchKeyword = !keyword || (d.txId && d.txId.toLowerCase().includes(keyword)) || (d.fullName && d.fullName.toLowerCase().includes(keyword)) || (d.note && d.note.toLowerCase().includes(keyword));
        const matchDate = !filterDate || (d.transactionDate === filterDate);
        return matchKeyword && matchDate;
    });

    if (dataToExport.length === 0) {
        AppHelper.showLoader(false);
        return Swal.fire('ไม่พบข้อมูล', 'ไม่มีรายการธุรกรรมให้ส่งออกตามเงื่อนไขที่ค้นหา', 'warning');
    }

    let csvContent = "\uFEFF"; 
    csvContent += "รหัสอ้างอิง (TX),วันที่ทำรายการ,ประเภทธุรกรรม,หมวดหมู่/รายละเอียด,จำนวนเงิน (บาท),ช่องทาง,ชื่อผู้ทำรายการ\n";

    dataToExport.forEach(d => {
        const txId = d.txId || '-';
        const date = d.transactionDate || '-';
        const type = d.type || '-';
        const note = (d.note || '-').replace(/,/g, " "); 
        const amt = d.amount || 0;
        const method = d.paymentMethod || '-';
        const name = (d.fullName || '-').replace(/,/g, " ");

        csvContent += `"${txId}","${date}","${type}","${note}","${amt}","${method}","${name}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `CWF_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    AppHelper.showLoader(false);
};

// ============================================================================
// 🧾 ระบบออกใบเสร็จอิเล็กทรอนิกส์ (E-Receipt Generator)
// ============================================================================

window.generateEReceipt = function(txId, type, amount, date, note, name) {
    AppHelper.showLoader(true, "กำลังสร้างสลิปใบเสร็จ...");
    
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 850;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const isIncome = type.includes('รับ') || type.includes('สมทบ');
    const themeColor = isIncome ? '#10B981' : '#EF4444'; 
    
    ctx.fillStyle = themeColor;
    ctx.fillRect(0, 0, canvas.width, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Prompt, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isIncome ? 'ใบเสร็จรับเงิน' : 'ใบสำคัญจ่าย', canvas.width / 2, 85);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '22px Prompt, sans-serif';
    
    const fundName = AdminState.fundSettings?.fundName || "กองทุนสวัสดิการชุมชน";
    
    ctx.fillStyle = '#F8FAFC';
    ctx.roundRect(40, 180, 520, 360, 20); 
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 24px Prompt';
    ctx.fillText('ข้อมูลการทำรายการ', 70, 230);
    
    ctx.font = '22px Prompt';
    ctx.fillStyle = '#64748B';
    
    ctx.beginPath(); ctx.moveTo(70, 250); ctx.lineTo(530, 250); ctx.stroke();
    
    ctx.fillText('รหัสอ้างอิง (Ref):', 70, 300); 
    ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(txId, 530, 300);

    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('วันที่ทำรายการ:', 70, 350);
    ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(date, 530, 350);

    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('ประเภท:', 70, 400);
    ctx.fillStyle = themeColor; ctx.textAlign = 'right'; ctx.fillText(type, 530, 400);

    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('ชื่อสมาชิก:', 70, 450);
    ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right'; ctx.fillText(name.replace('แอดมิน: ', ''), 530, 450);
    
    ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('รายละเอียด:', 70, 500);
    ctx.fillStyle = '#0F172A'; ctx.textAlign = 'right';
    
    let shortNote = note;
    if(shortNote.length > 25) shortNote = shortNote.substring(0, 25) + '...';
    ctx.fillText(shortNote, 530, 500);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px Prompt';
    ctx.fillText('จำนวนเงิน (Amount)', canvas.width / 2, 600);
    
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 64px Prompt';
    ctx.fillText('฿ ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2}), canvas.width / 2, 670);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '18px Prompt';
    ctx.fillText('ออกโดย: ' + fundName, canvas.width / 2, 770);
    ctx.fillText('เอกสารนี้ออกโดยระบบอัตโนมัติ SmartWelf 5.0', canvas.width / 2, 800);

    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    }

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    AppHelper.showLoader(false);

    Swal.fire({
        title: 'ใบเสร็จรับเงิน (E-Slip)',
        imageUrl: imgData,
        imageWidth: '100%',
        imageAlt: 'Receipt Image',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-download"></i> บันทึกรูปลงเครื่อง',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#2563EB',
        customClass: { image: 'rounded-4 shadow-sm border' }
    }).then((res) => {
        if(res.isConfirmed) {
            const link = document.createElement('a');
            link.download = `SmartWelf_Slip_${txId}.jpg`;
            link.href = imgData;
            link.click();
            Swal.fire({icon: 'success', title: 'บันทึกรูปภาพสำเร็จ!', showConfirmButton: false, timer: 1500});
        }
    });
};