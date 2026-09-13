// ============================================================================
// 🚀 admin-main.js: ศูนย์รวมระบบปฏิบัติการย่อย (Missions, Rewards, Pending Links)
// ============================================================================

window.deleteDocument = function(collection, docId) {
    Swal.fire({ title: 'ยืนยันการลบ?', text: "ข้อมูลนี้จะถูกลบออกจากระบบถาวร", icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ใช่, ลบทิ้ง', cancelButtonText: 'ยกเลิก' })
    .then(async (result) => {
        if (result.isConfirmed) {
            await db.collection(collection).doc(docId).delete();
            if(collection === 'missions' && typeof window.loadMissions === 'function') window.loadMissions();
            if(collection === 'rewards' && typeof window.loadRewards === 'function') window.loadRewards();
        }
    });
};

// ============================================================================
// 💖 ส่วนที่ 1: ระบบทำความดี (Missions)
// ============================================================================

window.openMissionModal = function() {
    Swal.fire({
        title: 'เพิ่มรายการทำความดี',
        html: `
        <div class="text-start" style="font-family:'Prompt';">
            <label class="small fw-bold text-muted mb-1">ชื่อภารกิจ/กิจกรรม</label>
            <input type="text" id="missionTitle" class="form-control mb-3" placeholder="เช่น เก็บขยะรอบหมู่บ้าน">
            <label class="small fw-bold text-muted mb-1">แต้มที่จะได้รับ (Points)</label>
            <input type="number" id="missionPoints" class="form-control mb-3 text-success fw-bold" placeholder="เช่น 10">
        </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> บันทึก', cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const title = document.getElementById('missionTitle').value.trim();
            const points = parseInt(document.getElementById('missionPoints').value) || 0;
            if (!title || points <= 0) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบและแต้มต้องมากกว่า 0'); return false;
            }
            return { title: title, points: points, isActive: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            Swal.fire({title:'กำลังบันทึก...', didOpen: ()=>Swal.showLoading()});
            try {
                await db.collection("missions").add(res.value);
                Swal.fire('สำเร็จ', 'เพิ่มรายการทำความดีแล้ว', 'success'); window.loadMissions();
            } catch (e) { Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error'); }
        }
    });
};

window.loadMissions = async function() {
    const container = document.getElementById('missionsContainer'); if(!container) return;
    try {
        const snap = await db.collection("missions").orderBy("createdAt", "desc").get();
        let html = "";
        snap.forEach(doc => {
            let m = doc.data();
            html += `
            <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-white rounded-3 border shadow-sm">
                <div><h6 class="fw-bold mb-1 text-dark" style="font-size: 0.9rem;"><i class="fa-solid fa-hand-holding-heart text-pink me-2" style="color:#EC4899;"></i>${m.title}</h6><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">+${m.points} แต้ม</span></div>
                <button class="btn btn-sm btn-light text-danger rounded-circle" onclick="window.deleteDocument('missions', '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML = html || '<div class="text-center text-muted small py-2">ยังไม่มีรายการทำความดี</div>';
    } catch(e) { console.log(e); }
};

// ============================================================================
// 🎁 ส่วนที่ 2: ระบบจัดการของรางวัล (Rewards)
// ============================================================================

window.openRewardModal = function() {
    Swal.fire({
        title: 'สร้างของรางวัลใหม่',
        html: `
        <div class="text-start" style="font-family:'Prompt';">
            <label class="small fw-bold text-muted mb-1">ชื่อของรางวัล</label>
            <input type="text" id="rewardName" class="form-control mb-3" placeholder="เช่น เสื้อยืดกองทุน, ข้าวสาร 5 กก.">
            <div class="row g-2 mb-3">
               <div class="col-6"><label class="small fw-bold text-muted mb-1"><i class="fa-solid fa-star text-warning"></i> ใช้แต้ม (Points)</label><input type="number" id="rewardPoints" class="form-control fw-bold text-primary" placeholder="เช่น 500"></div>
               <div class="col-6"><label class="small fw-bold text-muted mb-1"><i class="fa-solid fa-baht-sign text-success"></i> + เงินเพิ่ม (บาท)</label><input type="number" id="rewardCash" class="form-control fw-bold text-success" placeholder="0 = แลกฟรี" value="0"></div>
            </div>
            <label class="small fw-bold text-muted mb-1">จำนวนสิทธิ์ทั้งหมด (ชิ้น)</label>
            <input type="number" id="rewardStock" class="form-control mb-3" placeholder="เช่น 10">
            <label class="small fw-bold text-muted mb-1">ลิงก์รูปภาพรางวัล</label>
            <input type="text" id="rewardImg" class="form-control" placeholder="https://...">
        </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> บันทึกรางวัล', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626',
        preConfirm: () => {
            const name = document.getElementById('rewardName').value.trim(); const points = parseInt(document.getElementById('rewardPoints').value) || 0;
            const cash = parseInt(document.getElementById('rewardCash').value) || 0; const stock = parseInt(document.getElementById('rewardStock').value) || 0;
            if (!name || points <= 0 || stock <= 0) { Swal.showValidationMessage('กรุณากรอกชื่อ, แต้ม และจำนวนสิทธิ์ให้ครบถ้วน'); return false; }
            return { title: name, pointsNeeded: points, cashNeeded: cash, stock: stock, remaining: stock, imageUrl: document.getElementById('rewardImg').value.trim() || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80', createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        }
    }).then(async (res) => {
                    if (res.isConfirmed) {
                        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
                        try {
                            const scannerUid = document.getElementById('uid').value; 
                            const batch = db.batch();
                            const newTxRef = db.collection("transactions").doc();
                            
                            let txPayload = {
                                txId: payData.txId, type: 'สมทบเงินกองทุน', amount: payData.amount, paymentMethod: 'เงินสด', transactionDate: payData.date, fullName: 'แอดมิน: ' + payData.adminName, status: 'รอส่งมอบ', currentHolder: payData.adminEmail, note: payData.note, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            };
                            
                            if (qrData.action === "member_pay_bulk") { 
                                txPayload.uid = "BULK"; 
                                txPayload.bulkMembers = payData.bulkMembers; 
                            } else { 
                                txPayload.uid = payData.uid === "SCANNER" ? scannerUid : payData.uid; 
                            }
                            
                            batch.set(newTxRef, txPayload);
                            batch.update(payRef, { status: "completed", scannedByUid: scannerUid, completedAt: firebase.firestore.FieldValue.serverTimestamp() });

                            // 🌟 แก้ไข: เพิ่มคำสั่งอัปเดตยอดเงินในโปรไฟล์สมาชิกทันทีที่สแกนจ่ายสำเร็จ
                            if (qrData.action === "member_pay_bulk") {
                                for (let member of payData.bulkMembers) {
                                    batch.update(db.collection("members").doc(member.uid), {
                                        totalContribution: firebase.firestore.FieldValue.increment(member.amt),
                                        outstandingBalance: firebase.firestore.FieldValue.increment(-member.amt),
                                        lastContributionDate: new Date().toISOString()
                                    });
                                }
                            } else {
                                const payerUid = payData.uid === "SCANNER" ? scannerUid : payData.uid;
                                batch.update(db.collection("members").doc(payerUid), {
                                    totalContribution: firebase.firestore.FieldValue.increment(payData.amount),
                                    outstandingBalance: firebase.firestore.FieldValue.increment(-payData.amount),
                                    lastContributionDate: new Date().toISOString()
                                });
                            }

                            await batch.commit();

                            if (typeof window.generateMemberEReceipt === 'function') {
                                window.generateMemberEReceipt(payData.txId, 'สมทบเงินกองทุน', payData.amount, payData.date, `มอบเงินสดให้: ${payData.adminName}`, cachedUserData?.fullName || "สมาชิก");
                                checkMemberOnCloud(scannerUid);
                            } else {
                                Swal.fire({ icon: 'success', title: 'ชำระเงินสำเร็จ!', text: 'ระบบบันทึกการมอบเงินให้กรรมการเรียบร้อยแล้ว', confirmButtonColor: '#10B981' }).then(() => { checkMemberOnCloud(scannerUid); });
                            }
                        } catch(err) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก', 'error'); }
                    }
                });
};

window.loadRewards = async function() {
    const container = document.getElementById('rewardsContainer'); if(!container) return;
    container.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm mb-2 text-danger"></div><br>กำลังโหลดของรางวัล...</div>';
    try {
        const snap = await db.collection("rewards").orderBy("createdAt", "desc").get();
        if (snap.empty) { container.innerHTML = '<div class="text-center text-muted small py-3 bg-light rounded-3 border">ยังไม่มีของรางวัลในระบบ</div>'; return; }

        let html = "";
        snap.forEach(doc => {
            let r = doc.data();
            let claimedCount = (r.stock || 0) - (r.remaining || 0); if (claimedCount < 0) claimedCount = 0;
            let cashTag = (r.cashNeeded > 0) ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 ms-1"><i class="fa-solid fa-plus"></i> ${r.cashNeeded} ฿</span>` : '';

            html += `
            <div class="d-flex align-items-center p-3 mb-2 bg-white rounded-4 border shadow-sm" style="position: relative; overflow: hidden;">
                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${r.remaining > 0 ? '#10B981' : '#EF4444'};"></div>
                <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80'}" style="width: 60px; height: 60px; object-fit: cover;" class="rounded-3 me-3 border">
                <div class="flex-grow-1"><h6 class="fw-bold mb-1 text-dark" style="font-size: 0.95rem;">${r.title}</h6><div class="small"><span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"><i class="fa-solid fa-star"></i> ${r.pointsNeeded} แต้ม</span>${cashTag}</div></div>
                <div class="text-end" style="min-width: 90px;"><small class="d-block text-muted" style="font-size:0.7rem;">ผู้ที่รับไปแล้ว</small><span class="text-danger fw-bold fs-6">${claimedCount}</span> <span class="text-muted small">/ ${r.stock}</span><small class="d-block fw-bold mt-1 ${r.remaining > 0 ? 'text-success' : 'text-danger'}" style="font-size:0.75rem;">${r.remaining > 0 ? `คงเหลือ: ${r.remaining}` : 'ของหมดแล้ว'}</small></div>
                <button class="btn btn-sm btn-light text-danger rounded-circle ms-2" onclick="window.deleteDocument('rewards', '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = '<div class="text-center text-danger small py-3">โหลดข้อมูลขัดข้อง กรุณาลองใหม่</div>'; }
};


// ============================================================================
// 🔗 ส่วนที่ 3: ระบบตรวจสอบและยืนยันคำขอผูกบัญชี LINE (Pending Links)
// ============================================================================

window.showPendingLinksModal = async function() {
    AppHelper.showLoader(true, "กำลังดึงคำขอผูกบัญชี...");
    try {
        const snap = await db.collection("members").where("linkStatus", "==", "pending").get(); AppHelper.showLoader(false);
        if (snap.empty) { return Swal.fire('ข้อมูลเป็นปัจจุบัน', 'ขณะนี้ไม่มีคำขอผูกบัญชี LINE ที่รอตรวจสอบ', 'info'); }

        let itemsHtml = "";
        snap.forEach(doc => {
            const m = doc.data();
            itemsHtml += `
                <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded-3 border">
                    <div><strong class="text-dark d-block" style="font-size:0.9rem;">${m.fullName}</strong><small class="text-muted d-block">ปชช: ${m.nationalId || '-'} | ศูนย์: ${m.center || '-'}</small><small class="text-primary d-block">LINE UID: ${m.pendingLineUid ? m.pendingLineUid.slice(0, 10) + '...' : '-'}</small></div>
                    <div class="d-flex gap-1"><button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold" onclick="window.approvePendingLink('${doc.id}', '${m.pendingLineUid}', '${m.fullName}')"><i class="fa-solid fa-check"></i> ยืนยัน</button><button class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1" onclick="window.rejectPendingLink('${doc.id}')"><i class="fa-solid fa-xmark"></i></button></div>
                </div>`;
        });
        Swal.fire({ title: `คำขอผูกบัญชี LINE (${snap.size} รายการ)`, html: `<div class="text-start" style="font-family:'Prompt'; max-height: 350px; overflow-y: auto;">${itemsHtml}</div>`, showConfirmButton: false, showCloseButton: true, width: '90%' });
    } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
};

window.approvePendingLink = async function(docId, lineUid, memberName) {
    if (!lineUid) return Swal.fire('Error', 'ไม่พบรหัส LINE UID ของคำขอ', 'error');
    AppHelper.showLoader(true, "กำลังยืนยันการผูกบัญชี...");
    try {
        await db.collection("members").doc(docId).update({ lineUid: lineUid, linkStatus: "linked", pendingLineUid: firebase.firestore.FieldValue.delete() });
        AppHelper.showLoader(false); Swal.fire('สำเร็จ', `ผูกบัญชี LINE ของคุณ ${memberName} สำเร็จแล้ว`, 'success'); if (typeof window.loadMembersData === 'function') window.loadMembersData();
    } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
};

window.rejectPendingLink = async function(docId) {
    AppHelper.showLoader(true, "กำลังยกเลิกคำขอ...");
    try {
        await db.collection("members").doc(docId).update({ linkStatus: "unlinked", pendingLineUid: firebase.firestore.FieldValue.delete() });
        AppHelper.showLoader(false); Swal.fire('สำเร็จ', 'ยกเลิกคำขอผูกบัญชีเรียบร้อย', 'info'); if (typeof window.loadMembersData === 'function') window.loadMembersData();
    } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', e.message, 'error'); }
};

// ============================================================================
// 🚀 เริ่มต้นการทำงานเมื่อแอดมินเปิดหน้าเว็บ (Init Bootloader)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if(typeof window.loadGlobalSettings === 'function') window.loadGlobalSettings();
        if(typeof window.loadRewards === 'function') window.loadRewards();
        if(typeof window.loadMissions === 'function') window.loadMissions();
        if(typeof window.loadSystemSettings === 'function') window.loadSystemSettings(); 
    }, 1000);
});