// =========================================================
// 💸 ledger.js: ระบบการเงินและบัญชี (Complete Version)
// =========================================================

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

/**
 * 🌟 รับเงินสมทบรายบุคคล (Atomic Transaction)
 */
window.confirmAmount = async function(memberId, currentStatus) {
    const inputElement = document.getElementById(`input-${memberId}`);
    const amount = parseFloat(inputElement.value);
    if (isNaN(amount) || amount <= 0) return Swal.fire('แจ้งเตือน', 'กรุณาระบุจำนวนเงินที่ถูกต้อง', 'warning');

    AppHelper.showLoader(true, "กำลังบันทึกยอดเงินลงสมุดบัญชี...");
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
                totalContribution: newTotal, 
                outstandingBalance: newOutstanding, 
                lastContributionDate: new Date().toISOString() 
            };

            if (currentStatus.includes('รอ') || doc.data().status.includes('รอ')) {
                updatePayload.status = 'เป็นสมาชิก';
                if(!doc.data().registerDateObj) updatePayload.registerDateObj = new Date().toISOString();
            }
            
            transaction.update(memberRef, updatePayload);

            const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
            let setStatus = "รอส่งมอบ"; 
            let holder = AdminState.currentAdmin.email;
            
            if(AdminState.currentAdmin.role === 'Admin-Master' || AdminState.currentAdmin.role === 'Admin-การเงิน') { 
                setStatus = "อนุมัติแล้ว"; 
                holder = "CENTRAL_BANK"; 
            }

            transaction.set(txRef, { 
                txId: txId, type: 'สมทบเงินกองทุน', amount: amount, paymentMethod: 'เงินสด', 
                transactionDate: new Date().toISOString().split('T')[0], fullName: 'แอดมิน: ' + AdminState.currentAdmin.name, 
                status: setStatus, currentHolder: holder, note: `รับเงินสมทบจาก: ${memberName}`, uid: memberId, 
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
        Swal.fire({ title: 'บันทึกสำเร็จ!', text: `รับสมทบ ${amount} บาท และลงบัญชีเรียบร้อยแล้ว`, icon: 'success', timer: 1500, showConfirmButton: false });

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
            return { 
                membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: false 
            }; 
        }
    }).then(result => {
        if (result.isDenied) { 
            return { isConfirmed: true, value: { membersData: collectionData, totalAmount: totalAmount, date: document.getElementById('bulkDate').value, note: document.getElementById('bulkNote').value, isQR: true } }; 
        }
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
                AppHelper.showLoader(true, "กำลังสร้าง QR Code...");
                const paymentId = "PAY-BLK-" + Date.now();
                await db.collection("pending_payments").doc(paymentId).set({ 
                    paymentId: paymentId, txId: bulkTxId, type: 'bulk_payment', amount: totalAmt, 
                    date: formValues.date, note: finalNote, adminEmail: adminEmail, adminName: adminName, 
                    bulkMembers: bulkDataArr, status: "waiting_member_scan", timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                });
                AppHelper.showLoader(false);
                
                setTimeout(() => {
                    Swal.fire({ 
                        title: 'ให้ตัวแทนสมาชิกสแกน QR นี้', 
                        html: `<p class="small text-muted mb-2">ยอดรวม (${formValues.membersData.length} คน): <strong class="text-primary fs-4">฿${totalAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></p><div id="memberQrContainer" class="d-flex justify-content-center bg-white p-3 rounded-4 shadow-sm mx-auto mb-3" style="width: 220px; height: 220px;"></div>`, 
                        didOpen: () => { new QRCode(document.getElementById("memberQrContainer"), { text: JSON.stringify({ action: "member_pay_bulk", ref: paymentId }), width: 180, height: 180 }); }, 
                        showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง' 
                    });
                }, 500);

            } else {
                AppHelper.showLoader(true, "กำลังบันทึกรายการกลุ่ม...");
                let setStatus = "รอส่งมอบ"; 
                let holder = adminEmail;
                if(AdminState.currentAdmin.role === 'Admin-Master' || AdminState.currentAdmin.role === 'Admin-การเงิน') { 
                    setStatus = "อนุมัติแล้ว"; holder = "CENTRAL_BANK"; 
                }

                const batch = db.batch();
                const txRef = db.collection("transactions").doc();
                batch.set(txRef, { 
                    txId: bulkTxId, type: 'สมทบเงินกองทุน', amount: totalAmt, paymentMethod: 'เงินสด', 
                    transactionDate: formValues.date, fullName: 'แอดมิน: ' + adminName, status: setStatus, 
                    currentHolder: holder, note: finalNote, uid: "BULK", bulkMembers: bulkDataArr, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                });

                if(setStatus === 'อนุมัติแล้ว') {
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
                Swal.fire('สำเร็จ', setStatus === 'อนุมัติแล้ว' ? 'ส่งยอดเข้าส่วนกลางเรียบร้อย' : 'บันทึกเข้ากระเป๋าของคุณ (รอส่งมอบ)', 'success');
                if(typeof window.loadMembersData === 'function') window.loadMembersData();
            }
        } catch(e) { 
            AppHelper.showLoader(false); console.error("Bulk Ledger Error:", e); 
            Swal.fire('Error', 'ผิดพลาด ไม่สามารถจัดเก็บเงินกลุ่มได้', 'error'); 
        }
    }
};

window.loadLedgerData = function() {
    if (typeof window.loadTransactions === 'function') window.loadTransactions(); 
    if (typeof window.loadReceiptHistory === 'function') window.loadReceiptHistory(); 
    if (typeof window.checkFinanceButtons === 'function') window.checkFinanceButtons(); 
    if (typeof window.loadLedgerNotes === 'function') window.loadLedgerNotes();
};

let currentTxFilterDate = "";

window.toggleLedgerActionForm = function(mode) {
    const container = document.getElementById('ledgerActionContainer');
    const formIE = document.getElementById('form-ie');
    const formTF = document.getElementById('form-tf');
    const title = document.getElementById('ledgerActionTitle');
    const today = new Date().toISOString().split('T')[0];

    if (!container || !formIE || !formTF) return;

    if (mode === 'ie') {
        container.style.display = 'block'; formIE.style.display = 'block'; formTF.style.display = 'none';
        if (title) title.innerHTML = '<i class="fa-solid fa-money-bill-wave me-1 text-success"></i> บันทึกรายรับ - รายจ่าย';
        document.getElementById('ieDate').value = today;
        window.renderNoteDropdown();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (mode === 'tf') {
        container.style.display = 'block'; formTF.style.display = 'block'; formIE.style.display = 'none';
        if (title) title.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left me-1 text-warning"></i> โอนย้ายสภาพคล่อง (ธนาคาร ⇋ เงินสด)';
        document.getElementById('tfDate').value = today;
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        container.style.display = 'none'; formIE.style.display = 'none'; formTF.style.display = 'none';
    }
};

window.renderNoteDropdown = function() {
    const isIncome = document.getElementById('ieTypeIn')?.checked;
    const select = document.getElementById('ieNote');
    if (!select) return;

    const incomeDefaults = ["สมทบเงินกองทุนจากสมาชิก", "เงินอุดหนุน พอช.", "เงินสมทบท้องถิ่น/อปท.", "เงินบริจาค", "ดอกเบี้ยเงินฝากธนาคาร", "ผลกำไร/ผลตอบแทนจากกิจการ", "รายรับอื่นๆ"];
    const expenseDefaults = ["จ่ายสวัสดิการชุมชน", "ค่าใช้จ่ายดำเนินงาน/บริหารกองทุน", "ค่าจัดประชุม/สัมมนาพัฒนาศักยภาพ", "ค่าสาธารณูปโภค/สำนักงาน", "ค่าตอบแทนเจ้าหน้าที่/กรรมการ", "รายจ่ายอื่นๆ"];

    const targetList = isIncome ? [...incomeDefaults, ...(AdminState.uiOptions.incomeNotes || [])] : [...expenseDefaults, ...(AdminState.uiOptions.expenseNotes || [])];

    select.innerHTML = '<option value="" selected disabled>-- เลือกหมวดหมู่ --</option>';
    targetList.forEach(opt => { select.innerHTML += `<option value="${opt}">${opt}</option>`; });
};

window.addNewLedgerNote = function() {
    const isIncome = document.getElementById('ieTypeIn')?.checked;
    const typeLabel = isIncome ? "รายรับ" : "รายจ่าย";

    Swal.fire({
        title: `เพิ่มหมวดหมู่${typeLabel}`, input: 'text', inputPlaceholder: 'ระบุชื่อหมวดหมู่ใหม่',
        showCancelButton: true, confirmButtonText: 'เพิ่มหมวดหมู่', cancelButtonText: 'ยกเลิก'
    }).then(async result => {
        if (result.isConfirmed && result.value) {
            const val = result.value.trim();
            if (isIncome) {
                if (!AdminState.uiOptions.incomeNotes.includes(val)) {
                    AdminState.uiOptions.incomeNotes.push(val);
                    await db.collection("settings").doc("master").set({ incomeNotes: AdminState.uiOptions.incomeNotes }, { merge: true });
                }
            } else {
                if (!AdminState.uiOptions.expenseNotes.includes(val)) {
                    AdminState.uiOptions.expenseNotes.push(val);
                    await db.collection("settings").doc("master").set({ expenseNotes: AdminState.uiOptions.expenseNotes }, { merge: true });
                }
            }
            window.renderNoteDropdown();
            document.getElementById('ieNote').value = val;
            Swal.fire({ icon: 'success', title: 'เพิ่มเรียบร้อย', timer: 1000, showConfirmButton: false });
        }
    });
};

window.submitLedgerIE = async function(e) {
    e.preventDefault();
    const isIncome = document.getElementById('ieTypeIn')?.checked;
    const cat = document.getElementById('ieNote')?.value;
    const detail = document.getElementById('ieAddNote')?.value.trim();
    const amt = parseFloat(document.getElementById('ieAmt')?.value);
    const date = document.getElementById('ieDate')?.value;
    const wallet = document.getElementById('ieWallet')?.value; 

    if (!cat || isNaN(amt) || amt <= 0 || !date) return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลและจำนวนเงินให้ถูกต้อง', 'warning');

    AppHelper.showLoader(true, "กำลังบันทึกรายการบัญชี...");
    try {
        const txId = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const role = AdminState.currentAdmin?.role || 'Admin-Master';
        let setStatus = "อนุมัติแล้ว"; let holder = "CENTRAL_BANK";

        if (role !== 'Admin-Master' && role !== 'Admin-การเงิน') {
            setStatus = "รอตรวจสอบ"; holder = AdminState.currentAdmin?.email || "ADMIN";
        }

        const txType = isIncome ? 'รับเงินเข้ากองทุน' : 'จ่ายเงินจากกองทุน';
        const noteFull = detail ? `${cat} (${detail})` : cat;

        await db.collection("transactions").doc(txId).set({
            txId: txId, type: txType, category: cat, amount: amt, paymentMethod: wallet === 'bank' ? 'ธนาคาร' : 'เงินสด', transactionDate: date,
            fullName: 'แอดมิน: ' + (AdminState.currentAdmin?.name || 'Admin'), status: setStatus, currentHolder: holder, note: noteFull, uid: "GENERAL", timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof window.createAuditLog === 'function') {
            window.createAuditLog('LEDGER_ENTRY', `${txType} ${amt} บาท [${noteFull}] ผ่าน ${wallet}`);
        }

        AppHelper.showLoader(false);
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: `${txType} จำนวน ฿${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} เรียบร้อยแล้ว`, timer: 1500, showConfirmButton: false });

        document.getElementById('form-ie').reset(); window.toggleLedgerActionForm('close'); window.loadLedgerData();
        if (document.getElementById('admin-view-overview')?.classList.contains('d-block')) {
            if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
        }
    } catch (err) { AppHelper.showLoader(false); console.error("Ledger IE Error:", err); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error'); }
};

window.submitLedgerTF = async function(e) {
    e.preventDefault();
    const from = document.getElementById('tfFrom')?.value; const to = document.getElementById('tfTo')?.value;
    const amt = parseFloat(document.getElementById('tfAmt')?.value); const date = document.getElementById('tfDate')?.value;

    if (from === to) return Swal.fire('แจ้งเตือน', 'บัญชีต้นทางและปลายทางต้องไม่เป็นบัญชีเดียวกัน', 'warning');
    if (isNaN(amt) || amt <= 0 || !date) return Swal.fire('แจ้งเตือน', 'กรุณาระบุจำนวนเงินที่ถูกต้อง', 'warning');

    AppHelper.showLoader(true, "กำลังโอนย้ายสภาพคล่อง...");
    try {
        const txId = "TF" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const fromLabel = from === 'bank' ? 'ธนาคาร' : 'เงินสด'; const toLabel = to === 'bank' ? 'ธนาคาร' : 'เงินสด';

        await db.collection("transactions").doc(txId).set({
            txId: txId, type: 'โอนย้ายสภาพคล่อง', amount: amt, paymentMethod: 'โอนย้าย', transactionDate: date,
            fullName: 'แอดมิน: ' + (AdminState.currentAdmin?.name || 'Admin'), status: 'อนุมัติแล้ว', currentHolder: 'CENTRAL_BANK',
            note: `โอนจาก ${from} ไป ${to} (${fromLabel} ➜ ${toLabel})`, uid: "TRANSFER", timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        AppHelper.showLoader(false);
        Swal.fire({ icon: 'success', title: 'โอนย้ายสำเร็จ!', text: `ย้ายยอด ฿${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} จาก ${fromLabel} ไป ${toLabel} แล้ว`, timer: 1500, showConfirmButton: false });

        document.getElementById('form-tf').reset(); window.toggleLedgerActionForm('close'); window.loadLedgerData();
        if (document.getElementById('admin-view-overview')?.classList.contains('d-block')) {
            if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
        }
    } catch (err) { AppHelper.showLoader(false); console.error("Ledger TF Error:", err); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโอนย้ายได้: ' + err.message, 'error'); }
};

window.approveFundsToCentralBank = async function() {
    Swal.fire({
        title: 'ยืนยันยอดเงินเข้าคลังส่วนกลาง?', html: '<p class="small text-muted mb-0">ระบบจะทำการเปลี่ยนสถานะยอดเงินที่ค้างส่งมอบทั้งหมด ให้เข้าสู่บัญชีกองทุนส่วนกลางอย่างสมบูรณ์</p>',
        icon: 'question', showCancelButton: true, confirmButtonColor: '#10B981', confirmButtonText: '<i class="fa-solid fa-check me-1"></i> ยืนยันรับเข้าคลัง', cancelButtonText: 'ยกเลิก'
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังยืนยันยอดเข้าคลัง...");
            try {
                const snap = await db.collection("transactions").where("status", "==", "รอส่งมอบ").get();
                if (snap.empty) { AppHelper.showLoader(false); return Swal.fire('แจ้งเตือน', 'ไม่มียอดเงินค้างส่งมอบในขณะนี้', 'info'); }

                const batch = db.batch();
                snap.forEach(doc => {
                    batch.update(doc.ref, { status: "อนุมัติแล้ว", currentHolder: "CENTRAL_BANK", approvedBy: AdminState.currentAdmin?.name || 'Admin', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
                });

                await batch.commit(); AppHelper.showLoader(false);
                Swal.fire('สำเร็จ', `ยืนยันยอดเงิน ${snap.size} รายการ เข้าสู่กองทุนส่วนกลางเรียบร้อย`, 'success');

                window.loadLedgerData();
                if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
            } catch (err) { AppHelper.showLoader(false); console.error("Approve Funds Error:", err); Swal.fire('Error', 'ไม่สามารถยืนยันยอดได้: ' + err.message, 'error'); }
        }
    });
};

window.checkFinanceButtons = async function() {
    const btnBox = document.getElementById('financeApproveBtnBox');
    if (!btnBox) return;

    const role = AdminState.currentAdmin?.role || '';
    if (role !== 'Admin-Master' && role !== 'Admin-การเงิน') { btnBox.style.display = 'none'; return; }

    try {
        const snap = await db.collection("transactions").where("status", "==", "รอส่งมอบ").limit(1).get();
        btnBox.style.display = !snap.empty ? 'block' : 'none';
    } catch (e) { btnBox.style.display = 'none'; }
};

window.scanToReceiveAdminFunds = function() {
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        liff.scanCodeV2().then(res => { if (res && res.value) { window.handleScannedAdminQR(res.value); } }).catch(err => { window.promptManualCodeInput(); });
    } else { window.promptManualCodeInput(); }
};

window.promptManualCodeInput = function() {
    Swal.fire({ title: 'ระบุรหัสธุรกรรม / สแกน', input: 'text', inputPlaceholder: 'เช่น TX12345678', showCancelButton: true, confirmButtonText: 'ตรวจสอบ', cancelButtonText: 'ยกเลิก' })
    .then(res => { if (res.isConfirmed && res.value) { window.handleScannedAdminQR(res.value.trim()); } });
};

window.handleScannedAdminQR = async function(codeValue) {
    let refId = codeValue;
    try { const parsed = JSON.parse(codeValue); if (parsed.ref) refId = parsed.ref; } catch (e) {}

    AppHelper.showLoader(true, "กำลังตรวจสอบรหัส...");
    try {
        const docSnap = await db.collection("transactions").doc(refId).get();
        AppHelper.showLoader(false);

        if (!docSnap.exists) return Swal.fire('ไม่พบข้อมูล', 'ไม่พบรายการธุรกรรมรหัส ' + refId, 'error');

        const d = docSnap.data();
        Swal.fire({
            title: 'รับมอบเงินธุรกรรม',
            html: `
                <div class="text-start" style="font-family:'Prompt';">
                    <p class="mb-1 text-muted small">ประเภท: <strong>${d.type}</strong></p>
                    <p class="mb-1 text-muted small">จำนวนเงิน: <strong class="text-success fs-4">฿${parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></p>
                    <p class="mb-1 text-muted small">ผู้ถือเงินปัจจุบัน: <strong>${d.currentHolder || d.fullName}</strong></p>
                    <p class="mb-0 text-muted small">สถานะ: <span class="badge bg-warning text-dark">${d.status}</span></p>
                </div>
            `,
            showCancelButton: true, confirmButtonText: 'ยืนยันรับเงินยอดนี้', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
        }).then(async r => {
            if (r.isConfirmed) {
                AppHelper.showLoader(true, "กำลังโอนย้ายสิทธิ์การถือเงิน...");
                await db.collection("transactions").doc(refId).update({
                    currentHolder: AdminState.currentAdmin?.email || 'ADMIN',
                    status: (AdminState.currentAdmin?.role === 'Admin-Master' || AdminState.currentAdmin?.role === 'Admin-การเงิน') ? 'อนุมัติแล้ว' : 'รอส่งมอบ',
                    receivedBy: AdminState.currentAdmin?.name, receivedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                AppHelper.showLoader(false); Swal.fire('สำเร็จ', 'รับมอบเงินและอัปเดตสิทธิ์ผู้ถือยอดแล้ว', 'success'); window.loadLedgerData();
                if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
            }
        });
    } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
};

window.generateTransferAdminQR = async function() {
    AppHelper.showLoader(true, "กำลังคำนวณยอดเงินที่คุณถืออยู่...");
    try {
        const myEmail = AdminState.currentAdmin?.email || "";
        const snap = await db.collection("transactions").where("currentHolder", "==", myEmail).where("status", "==", "รอส่งมอบ").get();
        AppHelper.showLoader(false);

        let totalHold = 0; let billsCount = snap.size;
        snap.forEach(doc => { totalHold += parseFloat(doc.data().amount) || 0; });

        if (totalHold <= 0) return Swal.fire({ icon: 'info', title: 'ไม่มียอดเงินค้าง', text: 'คุณไม่มียอดเงินสดที่รอส่งมอบเข้ากองทุนในขณะนี้' });

        const transferRefId = "TRF-" + Date.now().toString().slice(-8);
        const qrPayload = JSON.stringify({ action: "admin_transfer_handover", sender: myEmail, senderName: AdminState.currentAdmin?.name || "Admin", amount: totalHold, ref: transferRefId });

        Swal.fire({
            title: 'QR ส่งมอบเงินเข้ากองทุน',
            html: `
                <div class="text-center" style="font-family:'Prompt';">
                    <p class="small text-muted mb-2">ยอดเงินสดที่ถืออยู่ (${billsCount} รายการ):</p>
                    <h2 class="fw-bold text-success mb-3">฿${totalHold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                    <div id="transferAdminQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3" style="width: 200px; height: 200px;"></div>
                    <p class="small text-muted mb-0">ให้คณะกรรมการการเงินหรือประธานสแกนเพื่อรับยอด</p>
                </div>
            `,
            didOpen: () => { new QRCode(document.getElementById("transferAdminQrBox"), { text: qrPayload, width: 170, height: 170 }); },
            showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง'
        });
    } catch (e) { AppHelper.showLoader(false); console.error(e); Swal.fire('Error', e.message, 'error'); }
};

window.generatePaymentQR = function() {
    Swal.fire({
        title: 'สร้าง QR เรียกเก็บเงินสมทบ',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">ระบุจำนวนเงิน (บาท) *</label>
                <input type="number" id="payQrAmount" class="form-control mb-3 text-success fw-bold fs-4 text-center" placeholder="0.00" step="0.01">
                <label class="small fw-bold text-muted mb-1">ระบุชื่อสมาชิกหรือหมายเหตุ</label>
                <input type="text" id="payQrNote" class="form-control mb-2" placeholder="เช่น เงินสมทบ นายสมชาย">
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'สร้าง QR', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const amt = parseFloat(document.getElementById('payQrAmount').value);
            const note = document.getElementById('payQrNote').value.trim();
            if (isNaN(amt) || amt <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวนเงินที่ถูกต้อง'); return false; }
            return { amount: amt, note: note };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังสร้างรายการเรียกเก็บ...");
            const paymentId = "PAY-" + Date.now(); const txId = "TX" + Date.now().toString().slice(-8);

            try {
                await db.collection("pending_payments").doc(paymentId).set({
                    paymentId: paymentId, txId: txId, type: 'individual_payment', amount: res.value.amount, date: new Date().toISOString().split('T')[0],
                    note: res.value.note || 'เรียกเก็บเงินสมทบ', adminEmail: AdminState.currentAdmin?.email || '', adminName: AdminState.currentAdmin?.name || 'Admin',
                    status: "waiting_member_scan", timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                AppHelper.showLoader(false);
                const qrPayload = JSON.stringify({ action: "member_pay", ref: paymentId });

                Swal.fire({
                    title: 'สแกนเพื่อชำระเงิน',
                    html: `
                        <div class="text-center" style="font-family:'Prompt';">
                            <p class="small text-muted mb-1">ยอดเงินที่ต้องชำระ:</p>
                            <h2 class="fw-bold text-primary mb-3">฿${res.value.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                            <div id="memberPayQrBox" class="d-flex justify-content-center p-3 bg-white rounded-4 shadow-sm mx-auto mb-3" style="width: 200px; height: 200px;"></div>
                            <small class="text-muted d-block">${res.value.note || ''}</small>
                        </div>
                    `,
                    didOpen: () => { new QRCode(document.getElementById("memberPayQrBox"), { text: qrPayload, width: 170, height: 170 }); },
                    showConfirmButton: true, confirmButtonText: 'เสร็จสิ้น'
                });
            } catch (err) { AppHelper.showLoader(false); Swal.fire('Error', err.message, 'error'); }
        }
    });
};

window.loadReceiptHistory = async function() {
    const container = document.getElementById('receiptHistoryContainer'); const badge = document.getElementById('receiptCountBadge');
    if (!container) return;

    try {
        const snap = await db.collection("transactions").where("status", "==", "อนุมัติแล้ว").orderBy("timestamp", "desc").limit(8).get();
        if (badge) badge.innerText = `${snap.size} รายการ`;
        if (snap.empty) { container.innerHTML = '<div class="text-center text-muted small py-3 w-100 bg-white rounded-4 border">ยังไม่มีประวัติรับเงิน</div>'; return; }

        let html = "";
        snap.forEach(doc => {
            const d = doc.data(); const amt = parseFloat(d.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
            html += `
                <div class="card border-0 p-3 bg-white rounded-4 shadow-sm flex-shrink-0" style="width: 170px; border-top: 4px solid var(--success-main) !important;">
                    <small class="text-muted d-block text-truncate" style="font-size: 0.7rem;"><i class="fa-solid fa-receipt me-1 text-success"></i>${d.txId || 'TX'}</small>
                    <h6 class="fw-bold text-success mb-1 mt-1 text-truncate">฿${amt}</h6>
                    <small class="text-dark d-block text-truncate fw-bold" style="font-size: 0.75rem;">${d.note || d.type}</small>
                    <small class="text-muted d-block mt-2" style="font-size: 0.65rem;"><i class="fa-regular fa-clock me-1"></i>${d.transactionDate || ''}</small>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) { console.error(e); container.innerHTML = '<div class="text-center text-muted small py-3 w-100 bg-white rounded-4 border">โหลดข้อมูลขัดข้อง</div>'; }
};

window.loadLedgerNotes = async function() {
    try {
        const snap = await db.collection("settings").doc("master").get();
        if (snap.exists) {
            const d = snap.data();
            AdminState.uiOptions.incomeNotes = d.incomeNotes || [];
            AdminState.uiOptions.expenseNotes = d.expenseNotes || [];
        }
    } catch (e) { console.error("Load Ledger Notes Error:", e); }
};

// ============================================================================
// 📊 ระบบค้นหาขั้นสูงและส่งออกข้อมูล (Advanced Search & Export)
// ============================================================================

let ledgerTxCache = [];

window.loadTransactions = async function() {
    const approvedContainer = document.getElementById('list-approved-transactions');
    const pendingContainer = document.getElementById('list-pending-transactions');
    if (!approvedContainer) return;

    try {
        const snap = await db.collection("transactions").orderBy("timestamp", "desc").limit(100).get();
        ledgerTxCache = [];
        
        snap.forEach(doc => {
            ledgerTxCache.push({ id: doc.id, ...doc.data() });
        });
        
        window.filterTransactions();
        
    } catch (e) { 
        console.error("Load Transactions Error:", e); 
        if (approvedContainer) approvedContainer.innerHTML = '<div class="text-center text-danger small py-3">โหลดประวัติธุรกรรมไม่สำเร็จ</div>'; 
    }
};

window.filterTransactions = function() {
    const keyword = (document.getElementById('searchTxKeyword')?.value || "").toLowerCase();
    const filterDate = document.getElementById('searchTxDate')?.value || "";
    
    const approvedContainer = document.getElementById('list-approved-transactions');
    const pendingContainer = document.getElementById('list-pending-transactions');
    
    let approvedHtml = ""; let pendingHtml = "";

    ledgerTxCache.forEach(d => {
        const matchKeyword = !keyword || 
            (d.txId && d.txId.toLowerCase().includes(keyword)) ||
            (d.fullName && d.fullName.toLowerCase().includes(keyword)) ||
            (d.type && d.type.toLowerCase().includes(keyword)) ||
            (d.note && d.note.toLowerCase().includes(keyword));
            
        const matchDate = !filterDate || (d.transactionDate === filterDate);

        if (matchKeyword && matchDate) {
            const amt = parseFloat(d.amount || 0); const amtStr = amt.toLocaleString('en-US', { minimumFractionDigits: 2 });
            const isIncome = d.type.includes('รับ') || d.type.includes('สมทบ'); const isTransfer = d.type === 'โอนย้ายสภาพคล่อง';
            
            let amtColor = isIncome ? 'text-success' : 'text-danger'; let sign = isIncome ? '+' : '-';
            if (isTransfer) { amtColor = 'text-warning'; sign = '⇄ '; }

            const badgeColor = d.status === 'อนุมัติแล้ว' ? 'bg-success' : 'bg-warning text-dark';
            const methodBadge = d.paymentMethod ? `<span class="badge bg-light text-dark border me-1">${d.paymentMethod}</span>` : '';
            
            let receiptBtn = '';
            if (d.status === 'อนุมัติแล้ว') {
                const safeNote = (d.note || '-').replace(/'/g, "\\'");
                const safeName = (d.fullName || '-').replace(/'/g, "\\'");
                receiptBtn = `<button class="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 mt-2" style="font-size:0.7rem;" onclick="generateEReceipt('${d.txId}', '${d.type}', ${amt}, '${d.transactionDate}', '${safeNote}', '${safeName}')"><i class="fa-solid fa-receipt me-1"></i> ใบเสร็จ</button>`;
            }

            const card = `
                <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
                    <div style="min-width: 0;">
                        <strong class="text-dark d-block text-truncate" style="font-size: 0.9rem;">${d.note || d.type}</strong>
                        <small class="text-muted d-block" style="font-size: 0.75rem;"><i class="fa-regular fa-calendar me-1"></i>${d.transactionDate || ''} | ${methodBadge}${d.fullName || ''}</small>
                        ${receiptBtn}
                    </div>
                    <div class="text-end flex-shrink-0 ms-2">
                        <strong class="${amtColor} fs-6 d-block">${sign}฿${amtStr}</strong>
                        <span class="badge ${badgeColor} rounded-pill shadow-sm" style="font-size: 0.65rem;">${d.status}</span>
                    </div>
                </div>
            `;
            if (d.status === 'อนุมัติแล้ว') approvedHtml += card; else pendingHtml += card;
        }
    });

    if(approvedContainer) approvedContainer.innerHTML = approvedHtml || '<div class="text-center text-muted small py-3 bg-white rounded-4 border">ไม่พบข้อมูลที่ค้นหา</div>';
    if(pendingContainer) pendingContainer.innerHTML = pendingHtml || '<div class="text-center text-muted small py-3 bg-white rounded-4 border">ไม่มีรายการค้างตรวจสอบ</div>';
};

window.clearTxFilter = function() {
    if(document.getElementById('searchTxKeyword')) document.getElementById('searchTxKeyword').value = "";
    if(document.getElementById('searchTxDate')) document.getElementById('searchTxDate').value = "";
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