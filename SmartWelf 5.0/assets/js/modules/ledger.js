// =========================================================
// 💸 ledger.js: ระบบการเงินและบัญชี
// =========================================================
function toggleContributionInput(checkbox, memberId) {
    const row = document.getElementById(`row-${memberId}`); const input = document.getElementById(`input-${memberId}`); const badgeWrapper = row.querySelector('.amount-badge-wrapper');
    if (checkbox.checked) { row.classList.add('show-input'); badgeWrapper.style.display = 'none'; setTimeout(() => input.focus(), 300); } 
    else { row.classList.remove('show-input'); input.value = ''; badgeWrapper.style.display = 'none'; }
}

function confirmAmountLocal(memberId) {
    const row = document.getElementById(`row-${memberId}`); const input = document.getElementById(`input-${memberId}`); const badgeWrapper = row.querySelector('.amount-badge-wrapper'); const displayAmount = row.querySelector('.display-amount'); const checkbox = row.querySelector('.member-check');
    const amount = parseFloat(input.value);
    if (amount > 0) { row.classList.remove('show-input'); displayAmount.textContent = amount.toLocaleString(); badgeWrapper.style.display = 'block'; checkbox.checked = true; } 
    else { row.classList.remove('show-input'); checkbox.checked = false; badgeWrapper.style.display = 'none'; }
}

function handleEnter(event, memberId) { 
    if (event.key === 'Enter') { event.preventDefault(); confirmAmount(memberId, 'รอตรวจสอบ'); } 
}

function reopenInput(memberId) {
    const row = document.getElementById(`row-${memberId}`); const badgeWrapper = row.querySelector('.amount-badge-wrapper'); const input = document.getElementById(`input-${memberId}`);
    row.classList.add('show-input'); badgeWrapper.style.display = 'none'; input.focus();
}

async function confirmAmount(memberId, currentStatus) {
    const inputElement = document.getElementById(`input-${memberId}`);
    const amount = parseFloat(inputElement.value);
    if (isNaN(amount) || amount <= 0) return Swal.fire('แจ้งเตือน', 'กรุณาระบุจำนวนเงินที่ถูกต้อง', 'warning');

    showLoader(true, "กำลังบันทึกยอดเงินลงสมุดบัญชี...");
    try {
        const memberRef = db.collection('members').doc(memberId);
        let memberName = "";
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(memberRef);
            if (!doc.exists) throw "ไม่พบข้อมูลสมาชิก";

            memberName = doc.data().fullName; 
            let currentTotal = parseFloat(doc.data().totalContribution || 0);
            let currentOutstanding = parseFloat(doc.data().outstandingBalance || 0);
            
            let newTotal = currentTotal + amount;
            let newOutstanding = currentOutstanding - amount;
            if (newOutstanding < 0) newOutstanding = 0; 
            
            let updatePayload = { totalContribution: newTotal, outstandingBalance: newOutstanding, lastContributionDate: new Date().toISOString() };

            if (currentStatus.includes('รอ') || doc.data().status.includes('รอ')) {
                updatePayload.status = 'เป็นสมาชิก';
                if(!doc.data().registerDateObj) updatePayload.registerDateObj = new Date().toISOString();
            }
            transaction.update(memberRef, updatePayload);
        });

        const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
        let setStatus = "รอส่งมอบ"; let holder = currentAdminData.email;
        if(currentAdminData.role === 'Admin-Master' || currentAdminData.role === 'Admin-การเงิน') { setStatus = "อนุมัติแล้ว"; holder = "CENTRAL_BANK"; }

        await db.collection("transactions").add({ 
            txId: txId, type: 'สมทบเงินกองทุน', amount: amount, paymentMethod: 'เงินสด', transactionDate: new Date().toISOString().split('T')[0], 
            fullName: 'แอดมิน: ' + currentAdminData.name, status: setStatus, currentHolder: holder, note: `รับเงินสมทบจาก: ${memberName}`, uid: memberId, timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });

        inputElement.closest('.input-overlay').style.display = 'none';
        let badgeWrapper = document.querySelector(`#row-${memberId} .amount-badge-wrapper`);
        if(badgeWrapper) { badgeWrapper.querySelector('.display-amount').innerText = amount.toLocaleString('en-US'); badgeWrapper.style.display = 'block'; }

        showLoader(false);
        Swal.fire({ title: 'บันทึกสำเร็จ!', text: `รับสมทบ ${amount} บาท และลงบัญชีเรียบร้อยแล้ว`, icon: 'success', timer: 1500, showConfirmButton: false });

        setTimeout(() => { loadMembersData(); if(document.getElementById('admin-view-overview').classList.contains('d-block')) loadDashboardOverview(); }, 1500); 
    } catch (error) { showLoader(false); console.error(error); Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกเงินสมทบ', 'error'); }
}

async function bulkCollectContribution() {
    const checkedBoxes = document.querySelectorAll('.member-check:checked');
    const collectionData = [];
    checkedBoxes.forEach(box => {
        const memberId = box.value; const memberName = box.getAttribute('data-name'); const input = document.getElementById(`input-${memberId}`); const amount = parseFloat(input.value);
        if (amount > 0) { collectionData.push({ id: memberId, name: memberName, amount: amount }); }
    });

    if (collectionData.length === 0) { Swal.fire({ icon: 'warning', title: 'ยังไม่ได้ระบุยอดเงิน', text: 'กรุณาเลือกสมาชิกและระบุยอดเงินสมทบก่อนกดทำรายการ' }); return; }
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
        showDenyButton: true, showCancelButton: true, confirmButtonText: 'บันทึกรับเงินสด', denyButtonText: '<i class="fa-solid fa-qrcode"></i> ให้สมาชิกสแกน QR', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981', denyButtonColor: '#2563EB',
        preConfirm: () => { return { membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: false }; }
    }).then(result => {
        if (result.isDenied) { return { isConfirmed: true, value: { membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: true } }; }
        return result;
    });

    if (formValues) {
        try {
            const adminName = currentAdminData.name; const adminEmail = currentAdminData.email; const totalAmt = formValues.totalAmount;
            let bulkTxId = "BLK" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0'); 
            let bulkDataArr = [];
            for (let member of formValues.membersData) {
                let individualTxId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0'); 
                bulkDataArr.push({ uid: member.id, name: member.name, amt: member.amount, txId: individualTxId });
            }
            const finalNote = formValues.note ? `เก็บเงินกลุ่ม ${formValues.membersData.length} คน (${formValues.note})` : `เก็บเงินกลุ่ม ${formValues.membersData.length} คน`;

            if (formValues.isQR) {
                showLoader(true, "กำลังสร้าง QR Code...");
                const paymentId = "PAY-BLK-" + Date.now();
                await db.collection("pending_payments").doc(paymentId).set({ paymentId: paymentId, txId: bulkTxId, type: 'bulk_payment', amount: totalAmt, date: formValues.date, note: finalNote, adminEmail: adminEmail, adminName: adminName, bulkMembers: bulkDataArr, status: "waiting_member_scan", timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                showLoader(false);
                setTimeout(() => {
                    Swal.fire({ title: 'ให้ตัวแทนสมาชิกสแกน QR นี้', html: `<p class="small text-muted mb-2">ยอดรวม (${formValues.membersData.length} คน): <strong class="text-primary fs-4">฿${totalAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></p><div id="memberQrContainer" class="d-flex justify-content-center bg-white p-3 rounded-4 shadow-sm mx-auto mb-3" style="width: 220px; height: 220px;"></div>`, didOpen: () => { new QRCode(document.getElementById("memberQrContainer"), { text: JSON.stringify({ action: "member_pay_bulk", ref: paymentId }), width: 180, height: 180 }); }, showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง' });
                }, 500);
            } else {
                showLoader(true, "กำลังบันทึกรายการกลุ่ม...");
                let setStatus = "รอส่งมอบ"; let holder = adminEmail;
                if(currentAdminData.role === 'Admin-Master' || currentAdminData.role === 'Admin-การเงิน') { setStatus = "อนุมัติแล้ว"; holder = "CENTRAL_BANK"; }

                await db.collection("transactions").add({ txId: bulkTxId, type: 'สมทบเงินกองทุน', amount: totalAmt, paymentMethod: 'เงินสด', transactionDate: formValues.date, fullName: 'แอดมิน: ' + adminName, status: setStatus, currentHolder: holder, note: finalNote, uid: "BULK", bulkMembers: bulkDataArr, timestamp: firebase.firestore.FieldValue.serverTimestamp() });

                if(setStatus === 'อนุมัติแล้ว') {
                    for (let member of formValues.membersData) {
                        await db.collection("members").doc(member.id).update({ totalContribution: firebase.firestore.FieldValue.increment(member.amount), outstandingBalance: firebase.firestore.FieldValue.increment(-member.amount) });
                    }
                }
                Swal.fire('สำเร็จ', setStatus === 'อนุมัติแล้ว' ? 'ส่งยอดเข้าส่วนกลางเรียบร้อย' : 'บันทึกเข้ากระเป๋าของคุณ (รอส่งมอบ)', 'success');
                loadMembersData();
            }
        } catch(e) { showLoader(false); console.error(e); Swal.fire('Error', 'ผิดพลาด', 'error'); }
    }
}

function loadLedgerData() {
    if (typeof loadTransactions === 'function') loadTransactions(); 
    if (typeof loadReceiptHistory === 'function') loadReceiptHistory(); 
    if (typeof checkFinanceButtons === 'function') checkFinanceButtons(); 
    if (typeof loadLedgerNotes === 'function') loadLedgerNotes();
}