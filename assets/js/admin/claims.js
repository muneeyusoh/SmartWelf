// =========================================================
// 🏥 claims.js: โมดูลจัดการและอนุมัติคำขอเบิกสวัสดิการ (Seamless Edition)
// =========================================================

window.loadClaims = async function() {
    const pendingContainer = document.getElementById('list-pending-claims');
    const approvedContainer = document.getElementById('list-approved-claims');
    if (!pendingContainer) return;

    AppHelper.showLoader(true, "กำลังโหลดคำขอเบิกสวัสดิการ...");
    try {
        const snap = await db.collection("claims").orderBy("timestamp", "desc").get();
        let pendingHtml = ""; let approvedHtml = ""; let pendingCount = 0;

        snap.forEach(doc => {
            const c = doc.data(); const claimId = doc.id;
            const amt = parseFloat(c.claimAmount || 0);
            const amtStr = amt.toLocaleString('en-US', { minimumFractionDigits: 2 });
            const hasEvidence = !!c.evidenceUrl;
            
            const sicknessInfo = (c.disease || c.hospital) ? `<small class="text-danger d-block mt-1"><i class="fa-solid fa-hospital me-1"></i>${c.hospital || ''} [${c.disease || ''}]</small>` : '';
            const evidenceBtn = hasEvidence ? `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 me-1 shadow-sm" onclick="window.viewClaimEvidence('${c.evidenceUrl}')"><i class="fa-solid fa-paperclip me-1"></i> หลักฐานแนบ</button>` : `<span class="badge bg-light text-muted border px-2 py-1 me-1">ไม่มีเอกสาร</span>`;

            if (c.status === "รอตรวจสอบ") {
                pendingCount++;
                pendingHtml += `
                <div class="admin-card p-3 mb-3 border border-warning border-opacity-25 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.95rem;"><i class="fa-solid fa-user me-1 text-primary"></i> ${c.fullName}</h6>
                            <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill">${c.claimType}</span>
                            ${sicknessInfo}
                            <small class="text-muted d-block mt-1"><i class="fa-regular fa-calendar me-1"></i> ยื่นเมื่อ: ${c.dateStr || ''}</small>
                        </div>
                        <div class="text-end">
                            <h5 class="fw-bold text-danger mb-0">฿${amtStr}</h5>
                            <span class="badge bg-warning text-dark rounded-pill mt-1">รอตรวจสอบ</span>
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2 mt-3 pt-2 border-top">
                        ${evidenceBtn}
                        <button class="btn btn-sm btn-danger rounded-pill px-3 shadow-sm" onclick="window.rejectClaim('${claimId}')"><i class="fa-solid fa-xmark me-1"></i> ปฏิเสธ</button>
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="window.approveClaim('${claimId}', ${amt}, '${c.claimType}', '${c.uid}', '${c.fullName}')"><i class="fa-solid fa-check me-1"></i> อนุมัติเบิกจ่าย</button>
                    </div>
                </div>`;
            } else {
                const statusBadge = c.status === 'อนุมัติแล้ว' ? '<span class="badge bg-success rounded-pill shadow-sm">อนุมัติแล้ว</span>' : '<span class="badge bg-danger rounded-pill shadow-sm">ไม่อนุมัติ</span>';
                approvedHtml += `
                <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
                    <div>
                        <strong class="text-dark d-block" style="font-size: 0.9rem;">${c.fullName} - ${c.claimType}</strong>
                        <small class="text-muted d-block" style="font-size: 0.75rem;"><i class="fa-regular fa-calendar me-1"></i> ${c.dateStr || ''} ${c.approvedBy ? '| อนุมัติโดย: ' + c.approvedBy : ''}</small>
                    </div>
                    <div class="text-end">
                        <strong class="text-danger d-block fs-6">฿${amtStr}</strong>
                        ${statusBadge}
                    </div>
                </div>`;
            }
        });

        pendingContainer.innerHTML = pendingHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-check-circle fs-3 text-success mb-2 d-block opacity-50"></i>ไม่มีคำขอเบิกสวัสดิการที่รอตรวจสอบ</div>';
        if (approvedContainer) approvedContainer.innerHTML = approvedHtml || '<div class="text-center text-muted small py-3 bg-white rounded-4 border">ยังไม่มีประวัติการจ่ายเงิน</div>';

        const navBadge = document.getElementById('nav-badge-claims');
        if (navBadge) navBadge.style.display = pendingCount > 0 ? 'block' : 'none';

        AppHelper.showLoader(false);
    } catch (e) {
        AppHelper.showLoader(false); console.error("Load Claims Error:", e);
        if (pendingContainer) pendingContainer.innerHTML = '<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
};

window.viewClaimEvidence = function(imgUrl) {
    Swal.fire({ title: 'หลักฐานเอกสารแนบ', imageUrl: imgUrl, imageAlt: 'หลักฐานสวัสดิการ', confirmButtonText: 'ปิด', confirmButtonColor: '#2563EB', width: '90%', padding: '1em', customClass: { image: 'rounded-4 shadow-sm' } });
};

window.approveClaim = function(claimId, requestedAmt, claimType, memberUid, fullName) {
    // 🌟 ระบบแนะนำหมายเหตุอัตโนมัติ เพื่อลดการพิมพ์ซ้ำซ้อน
    const defaultNote = `จ่ายสวัสดิการ: ${claimType} ให้ ${fullName.split(' ')[0]}`;

    Swal.fire({
        title: 'อนุมัติจ่ายสวัสดิการ',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <p class="mb-1 text-muted small">สมาชิก: <strong>${fullName}</strong></p>
                <p class="mb-2 text-muted small">สิทธิ์ที่ขอเบิก: <strong>${claimType}</strong></p>
                
                <label class="small fw-bold text-muted mb-1">ยอดเงินที่อนุมัติ (บาท) *</label>
                <input type="number" id="approveAmt" class="form-control mb-3 text-danger fw-bold fs-3 text-center rounded-4 shadow-sm" value="${requestedAmt}" step="0.01" style="background-color: #FEF2F2;">
                
                <label class="small fw-bold text-muted mb-1">ช่องทางการจ่ายเงิน *</label>
                <select id="approveWallet" class="form-select-modern w-100 mb-3 shadow-sm border-0">
                    <option value="ธนาคาร">โอนผ่านธนาคาร</option>
                    <option value="เงินสด">จ่ายด้วยเงินสด</option>
                </select>
                
                <label class="small fw-bold text-muted mb-1">หมายเหตุลงบัญชี</label>
                <input type="text" id="approveNote" class="form-control-modern w-100 shadow-sm border-0" value="${defaultNote}">
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-check-circle me-1"></i> ยืนยันจ่ายเงิน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981',
        preConfirm: () => {
            const amt = parseFloat(document.getElementById('approveAmt').value);
            if (isNaN(amt) || amt <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวนเงินที่ถูกต้อง'); return false; }
            return { amount: amt, wallet: document.getElementById('approveWallet').value, note: document.getElementById('approveNote').value.trim() };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังตัดยอดเงินและสร้างใบเสร็จ...");
            const d = new Date();
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
            const sysDateStr = d.toISOString().split('T')[0];
            const txId = "CLM-" + Date.now().toString().slice(-8);

            try {
                const batch = db.batch();

                // 1. อัปเดตสถานะการเบิกเป็น "อนุมัติแล้ว"
                const claimRef = db.collection("claims").doc(claimId);
                batch.update(claimRef, {
                    status: "อนุมัติแล้ว", approvedAmount: res.value.amount, approvedBy: AdminState.currentAdmin?.name || 'Admin',
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(), paymentMethod: res.value.wallet, note: res.value.note
                });

                // 2. สร้างประวัติรายจ่ายในสมุดบัญชีกลางโดยอัตโนมัติ
                const txRef = db.collection("transactions").doc(txId);
                batch.set(txRef, {
                    txId: txId, type: "จ่ายสวัสดิการ", amount: res.value.amount, paymentMethod: res.value.wallet,
                    transactionDate: sysDateStr, fullName: 'แอดมิน: ' + (AdminState.currentAdmin?.name || 'Admin'),
                    status: "อนุมัติแล้ว", currentHolder: "CENTRAL_BANK", note: res.value.note, uid: memberUid, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 3. บันทึกยอดรวมกลับไปที่โปรไฟล์สมาชิก เพื่อให้สมองกลล็อกสิทธิ์ในปีถัดๆ ไป
                if (memberUid) {
                    const memRef = db.collection("members").doc(memberUid);
                    batch.update(memRef, {
                        totalWelfareReceived: firebase.firestore.FieldValue.increment(res.value.amount),
                        welfareHistory: firebase.firestore.FieldValue.arrayUnion({
                            type: claimType, amount: res.value.amount, date: dateStr, status: "อนุมัติแล้ว"
                        })
                    });
                }

                await batch.commit();
                
                // 🌟 โหลดข้อมูลใหม่เงียบๆ ระหว่างแสดงใบเสร็จ
                window.loadClaims();
                if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
                if (typeof window.loadLedgerData === 'function') window.loadLedgerData();

                // 🌟 ขั้นตอนสำคัญ: เด้งใบเสร็จอิเล็กทรอนิกส์ (E-Slip) ให้อัตโนมัติทันที
                if (typeof window.generateEReceipt === 'function') {
                    window.generateEReceipt(txId, "จ่ายสวัสดิการ", res.value.amount, sysDateStr, res.value.note, fullName);
                } else {
                    Swal.fire('สำเร็จ', `อนุมัติจ่ายสวัสดิการ ฿${res.value.amount.toLocaleString()} เรียบร้อยแล้ว`, 'success');
                }

            } catch (err) {
                AppHelper.showLoader(false); console.error("Approve Claim Error:", err);
                Swal.fire('ข้อผิดพลาด', err.message, 'error');
            }
        }
    });
};

window.rejectClaim = function(claimId) {
    Swal.fire({
        title: 'ปฏิเสธคำขอสวัสดิการ',
        input: 'textarea', inputLabel: 'ระบุเหตุผลในการปฏิเสธคำขอ', inputPlaceholder: 'เช่น เอกสารใบรับรองแพทย์ไม่ชัดเจน...',
        showCancelButton: true, confirmButtonText: 'ยืนยันปฏิเสธ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#EF4444',
        preConfirm: val => { if (!val || !val.trim()) { Swal.showValidationMessage('กรุณาระบุเหตุผลให้สมาชิกทราบ'); return false; } return val.trim(); }
    }).then(async res => {
        if (res.isConfirmed) {
            AppHelper.showLoader(true, "กำลังปฏิเสธคำขอ...");
            try {
                await db.collection("claims").doc(claimId).update({
                    status: "ไม่อนุมัติ", rejectReason: res.value, rejectedBy: AdminState.currentAdmin?.name || 'Admin', rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                AppHelper.showLoader(false); Swal.fire({ icon: 'info', title: 'บันทึกแล้ว', text: 'ปฏิเสธคำขอสวัสดิการเรียบร้อยแล้ว', showConfirmButton: false, timer: 1500 });
                window.loadClaims();
            } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
        }
    });
};