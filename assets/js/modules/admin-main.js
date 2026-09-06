// ============================================================================
// ⚙️ ส่วนที่ 1: ระบบตั้งค่าส่วนกลางและเศรษฐศาสตร์แต้ม (Global Settings & Tokenomics)
// ============================================================================

/**
 * โหลดข้อมูลการตั้งค่าทั้งหมดมาแสดง (รวมถึงคำนวณแต้มที่ถูกรับไปแล้ว และแต้มคงเหลือ)
 */
window.loadGlobalSettings = async function() {
    try {
        const doc = await db.collection("settings").doc("master").get();
        if (doc.exists) {
            const data = doc.data();

            // 1. โหลดข้อมูลเศรษฐศาสตร์แต้ม (Tokenomics - 6 ช่องทาง)
            if(data.pointSettings) {
                // คำนวณแต้มคงเหลือ: (งบเริ่มต้น - แต้มคงเหลือปัจจุบัน = แต้มที่แจกไปแล้ว)
                let initialPool = data.pointSettings.initialPool || 0;
                let remainPool = data.globalPointPool || 0; // ตัวแปรนี้จะลดลงอัตโนมัติเมื่อสมาชิกทำภารกิจสำเร็จ
                let usedPool = initialPool - remainPool;
                if (usedPool < 0) usedPool = 0;

                // อัปเดตตัวเลขขึ้นหน้าจอ Admin
                document.getElementById('setInitialPointPool').value = initialPool;
                document.getElementById('displayPointsUsed').innerText = usedPool.toLocaleString();
                document.getElementById('displayPointsRemain').innerText = remainPool.toLocaleString();

                // อัปเดตช่องทางรับแต้มทั้ง 5 ช่องทาง (ช่องทางที่ 6 คือภารกิจ ทำแยกไว้)
                document.getElementById('setPtCheckIn').value = data.pointSettings.checkIn || 2;
                document.getElementById('setFomoTier1').value = data.pointSettings.fomo1 || 5;
                document.getElementById('setFomoTier2').value = data.pointSettings.fomo2 || 3;
                document.getElementById('setFomoTier3').value = data.pointSettings.fomo3 || 1;
                document.getElementById('setPtShopBuy').value = data.pointSettings.shopBuy || 1;
                document.getElementById('setPtShopSell').value = data.pointSettings.shopSell || 2;
                document.getElementById('setPtInvite').value = data.pointSettings.invite || 50;
                document.getElementById('setPtShare').value = data.pointSettings.shareNews || 5;
            }

            // 2. โหลดข้อมูลองค์กร (Organization Info)
            if(data.fundInfo) {
                document.getElementById('setFundName').value = data.fundInfo.name || '';
                document.getElementById('setFundCode').value = data.fundInfo.code || '';
                document.getElementById('setFundLat').value = data.fundInfo.lat || '';
                document.getElementById('setFundLng').value = data.fundInfo.lng || '';
            }
        }
    } catch (e) { console.error("Error loading settings:", e); }
};

/**
 * บันทึกข้อมูลการตั้งค่าลง Firebase
 */
window.saveGlobalSettings = async function() {
    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
    try {
        const initialPoolVal = parseInt(document.getElementById('setInitialPointPool').value) || 0;
        
        // ดึงค่าเก่ามาเช็ค เพื่อปรับยอด globalPointPool ให้สอดคล้องกัน
        const docSnap = await db.collection("settings").doc("master").get();
        let currentInitial = 0; let currentGlobal = 0;
        if (docSnap.exists) {
            currentInitial = docSnap.data().pointSettings?.initialPool || 0;
            currentGlobal = docSnap.data().globalPointPool || 0;
        }
        
        // ถ้าแอดมินเปลี่ยนงบเริ่มต้น ต้องบวก/ลบยอดคงเหลือให้สมดุล
        let newGlobalPool = currentGlobal + (initialPoolVal - currentInitial);

        const pointSettings = {
            initialPool: initialPoolVal,
            checkIn: parseInt(document.getElementById('setPtCheckIn').value) || 0,
            fomo1: parseInt(document.getElementById('setFomoTier1').value) || 0,
            fomo2: parseInt(document.getElementById('setFomoTier2').value) || 0,
            fomo3: parseInt(document.getElementById('setFomoTier3').value) || 0,
            shopBuy: parseInt(document.getElementById('setPtShopBuy').value) || 0,
            shopSell: parseInt(document.getElementById('setPtShopSell').value) || 0,
            invite: parseInt(document.getElementById('setPtInvite').value) || 0,
            shareNews: parseInt(document.getElementById('setPtShare').value) || 0
        };

        const fundInfo = {
            name: document.getElementById('setFundName').value,
            code: document.getElementById('setFundCode').value,
            lat: document.getElementById('setFundLat').value,
            lng: document.getElementById('setFundLng').value
        };

        // ใช้ merge: true เพื่ออัปเดตเฉพาะส่วน ไม่ทับการตั้งค่าอื่นๆ
        await db.collection("settings").doc("master").set({
            pointSettings: pointSettings,
            fundInfo: fundInfo,
            globalPointPool: newGlobalPool
        }, { merge: true });

        Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าองค์กรและเศรษฐศาสตร์แต้มเรียบร้อยแล้ว', 'success');
        loadGlobalSettings(); 
    } catch (e) {
        Swal.fire('Error', 'ไม่สามารถบันทึกได้', 'error');
    }
};

// ============================================================================
// 💖 ส่วนที่ 2: ระบบทำความดี (ช่องทางที่ 6 - Custom Missions)
// ============================================================================

/**
 * เปิด Popup สร้างภารกิจทำความดี
 */
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
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-save"></i> บันทึก',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const title = document.getElementById('missionTitle').value.trim();
            const points = parseInt(document.getElementById('missionPoints').value) || 0;
            if (!title || points <= 0) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบและแต้มต้องมากกว่า 0');
                return false;
            }
            return { title: title, points: points, isActive: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            Swal.fire({title:'กำลังบันทึก...', didOpen: ()=>Swal.showLoading()});
            try {
                await db.collection("missions").add(res.value);
                Swal.fire('สำเร็จ', 'เพิ่มรายการทำความดีแล้ว', 'success');
                loadMissions();
            } catch (e) { Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error'); }
        }
    });
};

/**
 * โหลดรายการทำความดีมาแสดง
 */
window.loadMissions = async function() {
    const container = document.getElementById('missionsContainer');
    if(!container) return;
    try {
        const snap = await db.collection("missions").orderBy("createdAt", "desc").get();
        let html = "";
        snap.forEach(doc => {
            let m = doc.data();
            html += `
            <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-white rounded-3 border shadow-sm">
                <div>
                    <h6 class="fw-bold mb-1 text-dark" style="font-size: 0.9rem;"><i class="fa-solid fa-hand-holding-heart text-pink me-2" style="color:#EC4899;"></i>${m.title}</h6>
                    <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">+${m.points} แต้ม</span>
                </div>
                <button class="btn btn-sm btn-light text-danger rounded-circle" onclick="deleteDocument('missions', '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML = html || '<div class="text-center text-muted small py-2">ยังไม่มีรายการทำความดี</div>';
    } catch(e) { console.log(e); }
};

// ============================================================================
// 🎁 ส่วนที่ 3: ระบบจัดการของรางวัล (ใช้ แต้ม + เงินสด ได้)
// ============================================================================

/**
 * เปิด Popup สร้างของรางวัล (แต้ม + เงินสด)
 */
window.openRewardModal = function() {
    Swal.fire({
        title: 'สร้างของรางวัลใหม่',
        html: `
        <div class="text-start" style="font-family:'Prompt';">
            <label class="small fw-bold text-muted mb-1">ชื่อของรางวัล</label>
            <input type="text" id="rewardName" class="form-control mb-3" placeholder="เช่น เสื้อยืดกองทุน, ข้าวสาร 5 กก.">
            
            <div class="row g-2 mb-3">
               <div class="col-6">
                  <label class="small fw-bold text-muted mb-1"><i class="fa-solid fa-star text-warning"></i> ใช้แต้ม (Points)</label>
                  <input type="number" id="rewardPoints" class="form-control fw-bold text-primary" placeholder="เช่น 500">
               </div>
               <div class="col-6">
                  <label class="small fw-bold text-muted mb-1"><i class="fa-solid fa-baht-sign text-success"></i> + เงินเพิ่ม (บาท)</label>
                  <input type="number" id="rewardCash" class="form-control fw-bold text-success" placeholder="0 = แลกฟรี" value="0">
               </div>
            </div>
            
            <label class="small fw-bold text-muted mb-1">จำนวนสิทธิ์ทั้งหมด (ชิ้น)</label>
            <input type="number" id="rewardStock" class="form-control mb-3" placeholder="เช่น 10">
            
            <label class="small fw-bold text-muted mb-1">ลิงก์รูปภาพรางวัล</label>
            <input type="text" id="rewardImg" class="form-control" placeholder="https://...">
        </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-save"></i> บันทึกรางวัล',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#DC2626',
        preConfirm: () => {
            const name = document.getElementById('rewardName').value.trim();
            const points = parseInt(document.getElementById('rewardPoints').value) || 0;
            const cash = parseInt(document.getElementById('rewardCash').value) || 0;
            const stock = parseInt(document.getElementById('rewardStock').value) || 0;
            
            if (!name || points <= 0 || stock <= 0) {
                Swal.showValidationMessage('กรุณากรอกชื่อ, แต้ม และจำนวนสิทธิ์ให้ครบถ้วน');
                return false;
            }
            return {
                title: name,
                pointsNeeded: points,
                cashNeeded: cash,
                stock: stock,
                remaining: stock,
                imageUrl: document.getElementById('rewardImg').value.trim() || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            Swal.fire({title:'กำลังบันทึก...', didOpen: ()=>Swal.showLoading()});
            try {
                await db.collection("rewards").add(res.value);
                Swal.fire('สำเร็จ', 'เพิ่มของรางวัลเข้าระบบแล้ว', 'success');
                loadRewards(); 
            } catch (e) { Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error'); }
        }
    });
};

/**
 * ดึงรายการของรางวัลมาแสดง พร้อมคำนวณหักลบผู้ที่รับไปแล้ว
 */
window.loadRewards = async function() {
    const container = document.getElementById('rewardsContainer');
    if(!container) return;
    
    container.innerHTML = '<div class="text-center text-muted small py-3"><div class="spinner-border spinner-border-sm mb-2 text-danger"></div><br>กำลังโหลดของรางวัล...</div>';
    
    try {
        const snap = await db.collection("rewards").orderBy("createdAt", "desc").get();
        if (snap.empty) {
            container.innerHTML = '<div class="text-center text-muted small py-3 bg-light rounded-3 border">ยังไม่มีของรางวัลในระบบ</div>';
            return;
        }

        let html = "";
        snap.forEach(doc => {
            let r = doc.data();
            
            // คำนวณจำนวนที่ถูกรับไปแล้ว
            let claimedCount = (r.stock || 0) - (r.remaining || 0);
            if (claimedCount < 0) claimedCount = 0;

            // ตรวจสอบเงื่อนไขการใช้เงินสด ถ้ามีการบวกเงินให้แสดงป้ายกำกับ[cite: 1]
            let cashTag = (r.cashNeeded > 0) 
                ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 ms-1"><i class="fa-solid fa-plus"></i> ${r.cashNeeded} ฿</span>` 
                : '';

            html += `
            <div class="d-flex align-items-center p-3 mb-2 bg-white rounded-4 border shadow-sm" style="position: relative; overflow: hidden;">
                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${r.remaining > 0 ? '#10B981' : '#EF4444'};"></div>
                <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80'}" style="width: 60px; height: 60px; object-fit: cover;" class="rounded-3 me-3 border">
                
                <div class="flex-grow-1">
                    <h6 class="fw-bold mb-1 text-dark" style="font-size: 0.95rem;">${r.title}</h6>
                    <div class="small">
                        <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"><i class="fa-solid fa-star"></i> ${r.pointsNeeded} แต้ม</span>
                        ${cashTag}
                    </div>
                </div>
                
                <div class="text-end" style="min-width: 90px;">
                    <small class="d-block text-muted" style="font-size:0.7rem;">ผู้ที่รับไปแล้ว</small>
                    <span class="text-danger fw-bold fs-6">${claimedCount}</span> <span class="text-muted small">/ ${r.stock}</span>
                    <small class="d-block fw-bold mt-1 ${r.remaining > 0 ? 'text-success' : 'text-danger'}" style="font-size:0.75rem;">
                        ${r.remaining > 0 ? `คงเหลือ: ${r.remaining}` : 'ของหมดแล้ว'}
                    </small>
                </div>
                <button class="btn btn-sm btn-light text-danger rounded-circle ms-2" onclick="deleteDocument('rewards', '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="text-center text-danger small py-3">โหลดข้อมูลขัดข้อง กรุณาลองใหม่</div>';
    }
};

// ============================================================================
// 🔒 ส่วนที่ 4: ระบบบันทึก ธนาคาร / API / ความปลอดภัย
// ============================================================================

/**
 * 1. บันทึกข้อมูลบัญชีธนาคาร[cite: 1]
 */
window.saveBankSettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({
            bankDetails: {
                name: document.getElementById('bankName').value.trim(),
                accountName: document.getElementById('bankAccountName').value.trim(),
                accountNumber: document.getElementById('bankAccountNumber').value.trim()
            }
        }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกข้อมูลบัญชีธนาคารเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

/**
 * 2. บันทึกการเชื่อมต่อบัญชี (API & LIFF)[cite: 1]
 */
window.saveConnectionSettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({
            connectionDetails: {
                liffId: document.getElementById('settingLiffId').value.trim(),
                lineAccessToken: document.getElementById('settingLineToken').value.trim()
            }
        }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกการเชื่อมต่อบัญชีเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

/**
 * 3. บันทึกการตั้งค่าความปลอดภัยและ PDPA[cite: 1]
 */
window.savePrivacySettings = async function() {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await db.collection("settings").doc("master").set({
            privacySettings: {
                requirePdpa: document.getElementById('requirePdpa').checked,
                maskSensitiveData: document.getElementById('maskSensitiveData').checked
            }
        }, { merge: true });
        Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าความปลอดภัยเรียบร้อยแล้ว', 'success');
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

/**
 * ฟังก์ชันผู้ช่วยสำหรับลบเอกสารทั่วไป (ใช้ลบภารกิจหรือของรางวัล)
 */
window.deleteDocument = function(collection, docId) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "ข้อมูลนี้จะถูกลบออกจากระบบถาวร",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: 'ใช่, ลบทิ้ง',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await db.collection(collection).doc(docId).delete();
            if(collection === 'missions') loadMissions();
            if(collection === 'rewards') loadRewards();
        }
    });
};

// ============================================================================
// 🚀 เริ่มต้นการทำงานเมื่อแอดมินเปิดหน้าเว็บ
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // หน่วงเวลาเล็กน้อยให้ Firebase Initialize เสร็จก่อน
    setTimeout(() => {
        if(typeof loadGlobalSettings === 'function') loadGlobalSettings();
        if(typeof loadRewards === 'function') loadRewards();
        if(typeof loadMissions === 'function') loadMissions();
        if(typeof loadSystemSettings === 'function') loadSystemSettings(); // โหลดข้อมูลแบงก์/API[cite: 1]
    }, 1000);
});
// ============================================================================
// 🏥 ส่วนที่ 5: ระบบจัดการและอนุมัติคำขอเบิกสวัสดิการ (Claims Management)
// ============================================================================

window.loadClaims = async function() {
    const pendingContainer = document.getElementById('list-pending-claims');
    const approvedContainer = document.getElementById('list-approved-claims');
    if (!pendingContainer) return;

    showLoader(true, "กำลังโหลดคำขอเบิกสวัสดิการ...");
    try {
        const snap = await db.collection("claims").orderBy("timestamp", "desc").get();
        let pendingHtml = "";
        let approvedHtml = "";
        let pendingCount = 0;

        snap.forEach(doc => {
            const c = doc.data();
            const claimId = doc.id;
            const amt = parseFloat(c.claimAmount || 0);
            const amtStr = amt.toLocaleString('en-US', { minimumFractionDigits: 2 });
            const hasEvidence = !!c.evidenceUrl;
            
            const sicknessInfo = (c.disease || c.hospital) 
                ? `<small class="text-danger d-block mt-1"><i class="fa-solid fa-hospital me-1"></i>${c.hospital || ''} [${c.disease || ''}]</small>` 
                : '';

            const evidenceBtn = hasEvidence
                ? `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 me-1" onclick="viewClaimEvidence('${c.evidenceUrl}')"><i class="fa-solid fa-paperclip me-1"></i> เอกสาร</button>`
                : `<span class="badge bg-light text-muted border px-2 py-1 me-1">ไม่มีเอกสาร</span>`;

            if (c.status === "รอตรวจสอบ") {
                pendingCount++;
                pendingHtml += `
                <div class="admin-card p-3 mb-3 border border-warning border-opacity-25 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.95rem;">
                                <i class="fa-solid fa-user me-1 text-primary"></i> ${c.fullName}
                            </h6>
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
                        <button class="btn btn-sm btn-danger rounded-pill px-3" onclick="rejectClaim('${claimId}')">
                            <i class="fa-solid fa-xmark me-1"></i> ปฏิเสธ
                        </button>
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="approveClaim('${claimId}', ${amt}, '${c.claimType}', '${c.uid}', '${c.fullName}')">
                            <i class="fa-solid fa-check me-1"></i> อนุมัติเบิกจ่าย
                        </button>
                    </div>
                </div>`;
            } else {
                const statusBadge = c.status === 'อนุมัติแล้ว' 
                    ? '<span class="badge bg-success rounded-pill">อนุมัติแล้ว</span>' 
                    : '<span class="badge bg-danger rounded-pill">ไม่อนุมัติ</span>';

                approvedHtml += `
                <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
                    <div>
                        <strong class="text-dark d-block" style="font-size: 0.9rem;">${c.fullName} - ${c.claimType}</strong>
                        <small class="text-muted d-block" style="font-size: 0.75rem;">
                            <i class="fa-regular fa-calendar me-1"></i> ${c.dateStr || ''} ${c.approvedBy ? '| ผู้อนุมัติ: ' + c.approvedBy : ''}
                        </small>
                    </div>
                    <div class="text-end">
                        <strong class="text-danger d-block fs-6">฿${amtStr}</strong>
                        ${statusBadge}
                    </div>
                </div>`;
            }
        });

        pendingContainer.innerHTML = pendingHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-check-circle fs-3 text-success mb-2 d-block opacity-50"></i>ไม่มีคำขอเบิกสวัสดิการที่รอตรวจสอบ</div>';
        if (approvedContainer) {
            approvedContainer.innerHTML = approvedHtml || '<div class="text-center text-muted small py-3 bg-white rounded-4 border">ยังไม่มีประวัติการจ่ายเงิน</div>';
        }

        const navBadge = document.getElementById('nav-badge-claims');
        if (navBadge) navBadge.style.display = pendingCount > 0 ? 'block' : 'none';

        showLoader(false);
    } catch (e) {
        showLoader(false);
        console.error("Load Claims Error:", e);
        if (pendingContainer) pendingContainer.innerHTML = '<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
};

window.viewClaimEvidence = function(imgUrl) {
    Swal.fire({
        title: 'หลักฐานเอกสารแนบ',
        imageUrl: imgUrl,
        imageAlt: 'หลักฐานสวัสดิการ',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#2563EB',
        width: '90%',
        padding: '1em'
    });
};

window.approveClaim = function(claimId, requestedAmt, claimType, memberUid, fullName) {
    Swal.fire({
        title: 'อนุมัติการเบิกจ่ายสวัสดิการ',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <p class="mb-1 text-muted small">สมาชิก: <strong>${fullName}</strong></p>
                <p class="mb-2 text-muted small">ประเภท: <strong>${claimType}</strong></p>
                <label class="small fw-bold text-muted mb-1">ยอดเงินที่อนุมัติจ่าย (บาท) *</label>
                <input type="number" id="approveAmt" class="form-control mb-3 text-danger fw-bold fs-4 text-center" value="${requestedAmt}" step="0.01">
                <label class="small fw-bold text-muted mb-1">ช่องทางการจ่ายเงิน *</label>
                <select id="approveWallet" class="form-select mb-3">
                    <option value="ธนาคาร">โอนผ่านธนาคาร</option>
                    <option value="เงินสด">จ่ายเงินสด</option>
                </select>
                <label class="small fw-bold text-muted mb-1">หมายเหตุการจ่าย</label>
                <input type="text" id="approveNote" class="form-control" placeholder="เช่น อนุมัติกรณีรักษาพยาบาล รพ.สุคิริน">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check me-1"></i> ยืนยันอนุมัติจ่าย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10B981',
        preConfirm: () => {
            const amt = parseFloat(document.getElementById('approveAmt').value);
            const wallet = document.getElementById('approveWallet').value;
            const note = document.getElementById('approveNote').value.trim();
            if (isNaN(amt) || amt <= 0) {
                Swal.showValidationMessage('กรุณาระบุจำนวนเงินที่ถูกต้อง');
                return false;
            }
            return { amount: amt, wallet: wallet, note: note };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            showLoader(true, "กำลังประมวลผลการจ่ายเงิน...");
            const d = new Date();
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
            const txId = "CLM-" + Date.now().toString().slice(-8);

            try {
                const batch = db.batch();

                // 1. อัปเดตสถานะ Claim
                const claimRef = db.collection("claims").doc(claimId);
                batch.update(claimRef, {
                    status: "อนุมัติแล้ว",
                    approvedAmount: res.value.amount,
                    approvedBy: currentAdminData?.name || 'Admin',
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    paymentMethod: res.value.wallet,
                    note: res.value.note || ''
                });

                // 2. สร้าง Transaction รายจ่ายในระบบการเงินส่วนกลาง
                const txRef = db.collection("transactions").doc(txId);
                batch.set(txRef, {
                    txId: txId,
                    type: "จ่ายสวัสดิการ",
                    amount: res.value.amount,
                    paymentMethod: res.value.wallet,
                    transactionDate: d.toISOString().split('T')[0],
                    fullName: 'แอดมิน: ' + (currentAdminData?.name || 'Admin'),
                    status: "อนุมัติแล้ว",
                    currentHolder: "CENTRAL_BANK",
                    note: `จ่ายสวัสดิการ: ${claimType} ให้ ${fullName}` + (res.value.note ? ` (${res.value.note})` : ''),
                    uid: memberUid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 3. บันทึกยอดรับสวัสดิการสะสมลงข้อมูลสมาชิก
                if (memberUid) {
                    const memRef = db.collection("members").doc(memberUid);
                    batch.update(memRef, {
                        totalWelfareReceived: firebase.firestore.FieldValue.increment(res.value.amount),
                        welfareHistory: firebase.firestore.FieldValue.arrayUnion({
                            type: claimType,
                            amount: res.value.amount,
                            date: dateStr,
                            status: "อนุมัติแล้ว"
                        })
                    });
                }

                await batch.commit();
                showLoader(false);
                Swal.fire('สำเร็จ', `อนุมัติจ่ายสวัสดิการ ฿${res.value.amount.toLocaleString()} เรียบร้อยแล้ว`, 'success');

                loadClaims();
                if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
            } catch (err) {
                showLoader(false);
                console.error("Approve Claim Error:", err);
                Swal.fire('Error', err.message, 'error');
            }
        }
    });
};

window.rejectClaim = function(claimId) {
    Swal.fire({
        title: 'ปฏิเสธคำขอสวัสดิการ',
        input: 'textarea',
        inputLabel: 'ระบุเหตุผลในการปฏิเสธ *',
        inputPlaceholder: 'เช่น เอกสารไม่ครบถ้วน, อายุสมาชิกไม่ถึงเกณฑ์ตามระเบียบ',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันปฏิเสธ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#EF4444',
        preConfirm: val => {
            if (!val || !val.trim()) {
                Swal.showValidationMessage('กรุณาระบุเหตุผล');
                return false;
            }
            return val.trim();
        }
    }).then(async res => {
        if (res.isConfirmed) {
            showLoader(true, "กำลังบันทึก...");
            try {
                await db.collection("claims").doc(claimId).update({
                    status: "ไม่อนุมัติ",
                    rejectReason: res.value,
                    rejectedBy: currentAdminData?.name || 'Admin',
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showLoader(false);
                Swal.fire('บันทึกแล้ว', 'ปฏิเสธคำขอเรียบร้อยแล้ว', 'info');
                loadClaims();
            } catch (e) {
                showLoader(false);
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// ============================================================================
// 🗺️ ส่วนที่ 6: ระบบแผนที่พิกัดสมาชิก GIS (Google Maps & Heatmap)
// ============================================================================

let gisMapInstance = null;
let gisMarkers = [];
let gisHeatmapLayer = null;

window.loadGISMap = function() {
    const mapDiv = document.getElementById('adminGISMap');
    if (!mapDiv) return;

    if (typeof google === 'undefined' || !google.maps) {
        mapDiv.innerHTML = '<div class="text-center text-muted p-4">กำลังโหลด Google Maps API...</div>';
        return;
    }

    const defaultLat = parseFloat(fundSettings?.fundLat) || 5.92159;
    const defaultLng = parseFloat(fundSettings?.fundLng) || 101.76996;

    gisMapInstance = new google.maps.Map(mapDiv, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 12,
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: true
    });

    // ล้าง Marker เก่าออก
    gisMarkers.forEach(m => m.setMap(null));
    gisMarkers = [];

    const heatmapData = [];
    const membersWithLoc = (allMembersCache || []).filter(m => m.latitude && m.longitude);

    membersWithLoc.forEach(m => {
        const lat = parseFloat(m.latitude);
        const lng = parseFloat(m.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const pos = new google.maps.LatLng(lat, lng);
        heatmapData.push(pos);

        const marker = new google.maps.Marker({
            position: pos,
            map: gisMapInstance,
            title: m.fullName,
            icon: {
                url: m.status === 'เป็นสมาชิก' ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
            }
        });

        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="font-family:'Prompt'; padding: 5px;">
                    <strong style="font-size:0.9rem;">${m.fullName}</strong>
                    <div style="font-size:0.75rem; color:#64748B; margin-top:2px;">
                        รหัส: <strong>${m.memberId || '-'}</strong><br>
                        หมู่บ้าน: ${m.village || '-'}<br>
                        โทร: <a href="tel:${m.phone}">${m.phone || '-'}</a>
                    </div>
                    <span class="badge ${m.status === 'เป็นสมาชิก' ? 'bg-success' : 'bg-warning'} mt-2" style="font-size:0.65rem;">${m.status}</span>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindow.open(gisMapInstance, marker);
        });

        gisMarkers.push(marker);
    });

    if (google.maps.visualization && google.maps.visualization.HeatmapLayer) {
        gisHeatmapLayer = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: null,
            radius: 30
        });
    }

    // ค่าเริ่มต้นเป็น micro (แสดงหมุดรายคน)
    switchMapMode('micro');
};

window.switchMapMode = function(mode) {
    if (!gisMapInstance) return;

    if (mode === 'macro') {
        // ซ่อนหมุด แสดง Heatmap
        gisMarkers.forEach(m => m.setMap(null));
        if (gisHeatmapLayer) gisHeatmapLayer.setMap(gisMapInstance);
    } else {
        // ซ่อน Heatmap แสดงหมุด
        if (gisHeatmapLayer) gisHeatmapLayer.setMap(null);
        gisMarkers.forEach(m => m.setMap(gisMapInstance));
    }
};

// ============================================================================
// 👥 ส่วนที่ 7: ระบบจัดการผู้ดูแลระบบ (Admin Users Management)
// ============================================================================

window.loadAdminsData = async function() {
    const container = document.getElementById('list-admins');
    if (!container) return;

    showLoader(true, "กำลังโหลดรายชื่อผู้ดูแลระบบ...");
    try {
        const snap = await db.collection("admins").get();
        let html = "";

        snap.forEach(doc => {
            const adm = doc.data();
            const email = doc.id;
            const isMaster = email === MASTER_EMAIL || adm.role === 'Admin-Master';
            const isActive = adm.status === 'ใช้งาน';

            html += `
            <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-3">
                    <div class="icon-box bg-primary bg-opacity-10 text-primary rounded-circle">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <strong class="text-dark d-block" style="font-size: 0.95rem;">${adm.name || email}</strong>
                        <small class="text-muted d-block" style="font-size: 0.75rem;">
                            <i class="fa-solid fa-envelope me-1"></i>${email} | <span class="badge bg-light text-primary border">${adm.role || 'Admin'}</span>
                        </small>
                        ${adm.center ? `<small class="text-muted" style="font-size: 0.7rem;"><i class="fa-solid fa-building me-1"></i>ศูนย์: ${adm.center}</small>` : ''}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} rounded-pill shadow-sm py-2 px-3">${adm.status || 'ใช้งาน'}</span>
                    ${!isMaster && currentAdminData?.role === 'Admin-Master' ? `
                        <button class="btn btn-sm btn-light text-muted border rounded-circle" onclick="toggleAdminStatus('${email}', '${adm.status}')" title="เปลี่ยนสถานะ">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                        <button class="btn btn-sm btn-light text-danger border rounded-circle" onclick="deleteAdmin('${email}')" title="ลบแอดมิน">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>`;
        });

        container.innerHTML = html || '<div class="text-center text-muted small p-3">ไม่พบรายชื่อผู้ดูแลระบบ</div>';
        showLoader(false);
    } catch (e) {
        showLoader(false);
        console.error("Load Admins Error:", e);
        container.innerHTML = '<div class="text-danger small p-3 text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
};

window.openAddAdminModal = function() {
    let centerOptsHtml = '<option value="">ไม่มีศูนย์ / ส่วนกลาง</option>';
    (uiSettingsCenters || []).forEach(c => {
        centerOptsHtml += `<option value="${c}">${c}</option>`;
    });

    Swal.fire({
        title: 'เพิ่มผู้ดูแลระบบใหม่',
        html: `
            <div class="text-start" style="font-family:'Prompt';">
                <label class="small fw-bold text-muted mb-1">อีเมลแอดมิน (ใช้ล็อกอิน) *</label>
                <input type="email" id="newAdminEmail" class="form-control mb-3" placeholder="admin@sukhirin.org">
                <label class="small fw-bold text-muted mb-1">ชื่อ-นามสกุล *</label>
                <input type="text" id="newAdminName" class="form-control mb-3" placeholder="นายสมชาย ใจดี">
                <label class="small fw-bold text-muted mb-1">สิทธิ์การใช้งาน (Role) *</label>
                <select id="newAdminRole" class="form-select mb-3">
                    <option value="Admin-ผู้ดูแล">Admin-ผู้ดูแล (เก็บเงิน/ดูแลสมาชิกประจำสาย)</option>
                    <option value="Admin-ศูนย์ประสานงาน">Admin-ศูนย์ประสานงาน (ดูแลสมาชิกในศูนย์)</option>
                    <option value="Admin-การเงิน">Admin-การเงิน (ดูแลบัญชี/รับยอดคลัง)</option>
                    <option value="Admin-สวัสดิการ">Admin-สวัสดิการ (พิจารณาคำขอเบิก)</option>
                    <option value="Admin-Master">Admin-Master (สิทธิ์สูงสุดทุกระบบ)</option>
                </select>
                <label class="small fw-bold text-muted mb-1">ศูนย์ประสานงานประจำตัว</label>
                <select id="newAdminCenter" class="form-select mb-3">
                    ${centerOptsHtml}
                </select>
                <label class="small fw-bold text-muted mb-1">รหัส PIN 6 หลักเริ่มต้น *</label>
                <input type="text" id="newAdminPin" class="form-control text-center fw-bold fs-5" maxlength="6" value="123456">
                <small class="text-muted d-block mt-2">* ต้องเพิ่มอีเมลนี้ในเมนู Authentication ของ Firebase Console ด้วย</small>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกข้อมูล',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563EB',
        preConfirm: () => {
            const email = document.getElementById('newAdminEmail').value.trim();
            const name = document.getElementById('newAdminName').value.trim();
            const role = document.getElementById('newAdminRole').value;
            const center = document.getElementById('newAdminCenter').value;
            const pin = document.getElementById('newAdminPin').value.trim();

            if (!email || !name || pin.length !== 6) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน และ PIN ต้องมี 6 หลัก');
                return false;
            }
            return { email, name, role, center, pin, status: 'ใช้งาน' };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            showLoader(true, "กำลังบันทึกข้อมูลผู้ดูแล...");
            try {
                const payload = res.value;
                const emailKey = payload.email;
                delete payload.email;
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

                await db.collection("admins").doc(emailKey).set(payload);
                showLoader(false);
                Swal.fire('สำเร็จ', 'เพิ่มผู้ดูแลระบบเรียบร้อยแล้ว', 'success');
                loadAdminsData();
            } catch (e) {
                showLoader(false);
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

window.toggleAdminStatus = async function(adminEmail, currentStatus) {
    const nextStatus = currentStatus === 'ใช้งาน' ? 'ระงับ' : 'ใช้งาน';
    showLoader(true, "กำลังเปลี่ยนสถานะ...");
    try {
        await db.collection("admins").doc(adminEmail).update({ status: nextStatus });
        showLoader(false);
        Swal.fire({ icon: 'success', title: 'อัปเดตสถานะสำเร็จ', timer: 1000, showConfirmButton: false });
        loadAdminsData();
    } catch (e) {
        showLoader(false);
        Swal.fire('Error', e.message, 'error');
    }
};

window.deleteAdmin = function(adminEmail) {
    Swal.fire({
        title: 'ยืนยันการลบผู้ดูแล?',
        text: `คุณต้องการลบผู้ดูแล ${adminEmail} ออกจากระบบถาวรหรือไม่`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: 'ใช่, ลบออก',
        cancelButtonText: 'ยกเลิก'
    }).then(async res => {
        if (res.isConfirmed) {
            showLoader(true, "กำลังลบ...");
            try {
                await db.collection("admins").doc(adminEmail).delete();
                showLoader(false);
                Swal.fire('สำเร็จ', 'ลบผู้ดูแลเรียบร้อย', 'success');
                loadAdminsData();
            } catch (e) {
                showLoader(false);
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// ============================================================================
// 🔗 ส่วนที่ 8: ระบบตรวจสอบและยืนยันคำขอผูกบัญชี LINE (Pending Links)
// ============================================================================

window.showPendingLinksModal = async function() {
    showLoader(true, "กำลังดึงคำขอผูกบัญชี...");
    try {
        const snap = await db.collection("members").where("linkStatus", "==", "pending").get();
        showLoader(false);

        if (snap.empty) {
            return Swal.fire('ข้อมูลเป็นปัจจุบัน', 'ขณะนี้ไม่มีคำขอผูกบัญชี LINE ที่รอตรวจสอบ', 'info');
        }

        let itemsHtml = "";
        snap.forEach(doc => {
            const m = doc.data();
            itemsHtml += `
                <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded-3 border">
                    <div>
                        <strong class="text-dark d-block" style="font-size:0.9rem;">${m.fullName}</strong>
                        <small class="text-muted d-block">ปชช: ${m.nationalId || '-'} | ศูนย์: ${m.center || '-'}</small>
                        <small class="text-primary d-block">LINE UID: ${m.pendingLineUid ? m.pendingLineUid.slice(0, 10) + '...' : '-'}</small>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold" onclick="approvePendingLink('${doc.id}', '${m.pendingLineUid}', '${m.fullName}')">
                            <i class="fa-solid fa-check"></i> ยืนยัน
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1" onclick="rejectPendingLink('${doc.id}')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        Swal.fire({
            title: `คำขอผูกบัญชี LINE (${snap.size} รายการ)`,
            html: `<div class="text-start" style="font-family:'Prompt'; max-height: 350px; overflow-y: auto;">${itemsHtml}</div>`,
            showConfirmButton: false,
            showCloseButton: true,
            width: '90%'
        });
    } catch (e) {
        showLoader(false);
        Swal.fire('Error', e.message, 'error');
    }
};

window.approvePendingLink = async function(docId, lineUid, memberName) {
    if (!lineUid) return Swal.fire('Error', 'ไม่พบรหัส LINE UID ของคำขอ', 'error');

    showLoader(true, "กำลังยืนยันการผูกบัญชี...");
    try {
        await db.collection("members").doc(docId).update({
            lineUid: lineUid,
            linkStatus: "linked",
            pendingLineUid: firebase.firestore.FieldValue.delete()
        });

        showLoader(false);
        Swal.fire('สำเร็จ', `ผูกบัญชี LINE ของคุณ ${memberName} สำเร็จแล้ว`, 'success');
        if (typeof loadMembersData === 'function') loadMembersData();
    } catch (e) {
        showLoader(false);
        Swal.fire('Error', e.message, 'error');
    }
};

window.rejectPendingLink = async function(docId) {
    showLoader(true, "กำลังยกเลิกคำขอ...");
    try {
        await db.collection("members").doc(docId).update({
            linkStatus: "unlinked",
            pendingLineUid: firebase.firestore.FieldValue.delete()
        });

        showLoader(false);
        Swal.fire('สำเร็จ', 'ยกเลิกคำขอผูกบัญชีเรียบร้อย', 'info');
        if (typeof loadMembersData === 'function') loadMembersData();
    } catch (e) {
        showLoader(false);
        Swal.fire('Error', e.message, 'error');
    }
};

// ============================================================================
// ⚙️ ส่วนที่ 9: โหลดข้อมูลตั้งค่าระบบ (ธนาคาร, API, PDPA)
// ============================================================================

window.loadSystemSettings = async function() {
    try {
        const snap = await db.collection("settings").doc("master").get();
        if (snap.exists) {
            const d = snap.data();
            // ธนาคาร
            if (d.bankDetails) {
                if (document.getElementById('bankName')) document.getElementById('bankName').value = d.bankDetails.name || '';
                if (document.getElementById('bankAccountName')) document.getElementById('bankAccountName').value = d.bankDetails.accountName || '';
                if (document.getElementById('bankAccountNumber')) document.getElementById('bankAccountNumber').value = d.bankDetails.accountNumber || '';
            }
            // เชื่อมต่อ API
            if (d.connectionDetails) {
                if (document.getElementById('settingLiffId')) document.getElementById('settingLiffId').value = d.connectionDetails.liffId || '';
                if (document.getElementById('settingLineToken')) document.getElementById('settingLineToken').value = d.connectionDetails.lineAccessToken || '';
            }
            // PDPA
            if (d.privacySettings) {
                if (document.getElementById('requirePdpa')) document.getElementById('requirePdpa').checked = d.privacySettings.requirePdpa !== false;
                if (document.getElementById('maskSensitiveData')) document.getElementById('maskSensitiveData').checked = d.privacySettings.maskSensitiveData !== false;
            }
        }
    } catch (e) {
        console.error("Load System Settings Error:", e);
    }
};

window.forgotAdminPassword = async function() {
    const { value: email } = await Swal.fire({
        title: 'รีเซ็ตรหัสผ่านผู้ดูแลระบบ',
        text: 'กรุณากรอกอีเมลเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่',
        input: 'email',
        inputValue: document.getElementById('adminEmail')?.value || '',
        inputPlaceholder: 'admin@example.com',
        showCancelButton: true,
        confirmButtonText: 'ส่งลิงก์รีเซ็ต',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563EB'
    });

    if (email) {
        showLoader(true, "กำลังส่งอีเมลรีเซ็ตรหัสผ่าน...");
        try {
            await auth.sendPasswordResetEmail(email);
            showLoader(false);
            Swal.fire('สำเร็จ', 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลเรียบร้อยแล้ว', 'success');
        } catch (e) {
            showLoader(false);
            Swal.fire('ผิดพลาด', 'ส่งอีเมลไม่สำเร็จ: ' + e.message, 'error');
        }
    }
};
