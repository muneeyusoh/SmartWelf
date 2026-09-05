// ============================================================================
// 👤 member-main.js: ควบคุมหน้า Dashboard และการสมัครสมาชิก (index.html)
// ============================================================================
// สารบัญโค้ด (ค้นหาคำเหล่านี้ด้วย Ctrl+F เพื่อกระโดดไปยังส่วนที่ต้องการแก้ไข)
// 📌 SECTION 1: ตัวแปรและการเริ่มต้นระบบ (Initialization)
// 📌 SECTION 2: ระบบสมัครสมาชิกและผูกบัญชี (Registration & Account Link)
// 📌 SECTION 3: การแสดงผลหน้าแดชบอร์ด (Dashboard UI Rendering)
// 📌 SECTION 4: ภารกิจและคะแนนสะสม (Gamification & Check-in)
// 📌 SECTION 5: กระดานโปร่งใสและไทม์ไลน์ (Transparency & Timeline)
// 📌 SECTION 6: เครื่องมือเสริม (QR Scan & Share)
// ============================================================================

// ============================================================================
// 📌 SECTION 1: ตัวแปรและการเริ่มต้นระบบ (Initialization)
// ============================================================================
const LIFF_ID = "2011183541-9UDIqf8P";
let unmaskedData = { NatId: '', Phone: '' };
let isDataMasked = { natId: true, phone: true }; // 🌟 เพิ่มบรรทัดนี้
let currentShareMode = 'news';

/**
 * โหลดข้อมูลเริ่มต้นเมื่อเปิดหน้าเว็บ (ดึงตั้งค่าส่วนกลาง, โหลดรายชื่อหมู่บ้าน/กรรมการ, และเช็คล็อกอิน LINE)
 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const sysSnap = await db.collection("settings").doc("master").get();
    if(sysSnap.exists) {
       fundSettings = sysSnap.data();
       document.getElementById('headerFundName').innerText = fundSettings.fundName || "กองทุนสวัสดิการชุมชน";
       
       const regCenter = document.getElementById('regCenterSelect');
       const regVillage = document.getElementById('regVillageSelect');
       (fundSettings.centers || []).forEach(c => regCenter.add(new Option(c, c)));
       (fundSettings.inZoneVillages || []).forEach(v => regVillage.add(new Option(v, v)));
    }

    const regAdmin = document.getElementById('regResponsibleAdmin');
    if (regAdmin) {
        const adminSnap = await db.collection("admins").where("status", "==", "ใช้งาน").get();
        adminSnap.forEach(doc => { regAdmin.add(new Option(doc.data().name, doc.data().name)); });
    }

    await liff.init({ liffId: LIFF_ID });
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('ref')) document.getElementById('refCode').value = urlParams.get('ref');

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      document.getElementById('uid').value = profile.userId;
      await checkMemberOnCloud(profile.userId, profile.pictureUrl || "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/person-circle.svg");
    } else { liff.login(); }
  } catch (err) { 
      document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4"><h6>System Error</h6><p class="small">${err.message}</p></div>`; 
  }
});


// ============================================================================
// 📌 SECTION 2: ระบบสมัครสมาชิกและผูกบัญชี (Registration & Account Link)
// ============================================================================

/**
 * ตรวจสอบว่าผู้ใช้นี้เคยสมัครสมาชิกไว้แล้วหรือยัง
 */
async function checkMemberOnCloud(uid, pictureUrl) {
  try {
    const docRef = db.collection("members").doc(uid);
    const docSnap = await docRef.get();
    document.getElementById('systemLoading').style.display = 'none';

    if (docSnap.exists) {
      cachedUserData = docSnap.data();
      let finalPicUrl = pictureUrl || cachedUserData.pictureUrl || "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/person-circle.svg";
      if (pictureUrl && cachedUserData.pictureUrl !== pictureUrl) {
          await docRef.update({ pictureUrl: pictureUrl }); cachedUserData.pictureUrl = pictureUrl;
      }
      renderDashboardData(cachedUserData, finalPicUrl);
    } else { 
      // ถ้าไม่เจอข้อมูล ให้แสดงหน้าต่างให้เลือกว่าจะสมัครใหม่หรือผูกบัญชี
      document.getElementById('accountLinkView').style.display = 'block'; 
    }
  } catch (error) { 
     document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4"><h6>Database Error</h6><p class="small">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p></div>`;
  }
}

/**
 * ส่งข้อมูลสมัครสมาชิกใหม่ขึ้นฐานข้อมูล Firebase
 */
async function handleRegister(e) {
  e.preventDefault(); 
  const btn = document.getElementById('submitRegBtn'); btn.disabled = true; btn.innerHTML = 'กำลังตรวจสอบข้อมูล...';
  
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries()); 
  payload.nationalId = payload.nationalId.replace(/\D/g, ''); 
  payload.phone = payload.phone.replace(/\D/g, '');
  
  if (payload.nationalId.length !== 13) { Swal.fire('เตือน', 'เลข ปชช. ต้องมี 13 หลัก', 'warning'); btn.disabled = false; btn.innerHTML = 'สมัครสมาชิก'; return; }
  const uid = document.getElementById('uid').value;

  try {
      const existCheck = await db.collection("members").where("nationalId", "==", payload.nationalId).get();
      if (!existCheck.empty) {
          Swal.fire('ปฏิเสธการสมัคร', 'เลขบัตรประจำตัวประชาชนนี้ ถูกลงทะเบียนในระบบเรียบร้อยแล้ว ไม่สามารถสมัครซ้ำได้ครับ', 'error');
          btn.disabled = false; btn.innerHTML = 'สมัครสมาชิก'; return;
      }

      let userPic = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/person-circle.svg";
      if (liff.isLoggedIn()) { try { const profile = await liff.getProfile(); userPic = profile.pictureUrl || userPic; } catch(err) {} }
      
      let mType = 'สมาชิกสมทบ';
      if((fundSettings.inZoneVillages || []).includes(payload.village)) { mType = 'สมาชิกสามัญ'; }
      
      const d = new Date(); const thaiYear = d.getFullYear() + 543;
      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${thaiYear}`;

      const newMemberData = {
          ...payload, 
          memberId: "CWF" + Date.now().toString().slice(-5), 
          status: "รอตรวจสอบ",
          memberType: mType, 
          addressZoneType: mType === 'สมาชิกสามัญ' ? 'ในเขต' : 'นอกเขต', 
          cwfPoints: 0, totalContribution: 0, totalWelfareReceived: 0,
          outstandingBalance: fundSettings.annualFee || 365, 
          welfareHistory: [], vulnerableData: [],
          registerDateObj: d.toISOString(), 
          timestamp: dateStr, linkStatus: "linked", lineUid: uid, pictureUrl: userPic
      };

      btn.innerHTML = 'กำลังบันทึก...';
      await db.collection("members").doc(uid).set(newMemberData);
      
      if(payload.refCode) {
          const refSnap = await db.collection("members").where("memberId", "==", payload.refCode).get();
          if(!refSnap.empty) { await db.collection("members").doc(refSnap.docs[0].id).update({ cwfPoints: firebase.firestore.FieldValue.increment(50) }); }
      }
      
      document.getElementById('registerView').style.display = 'none';
      document.getElementById('registrationSuccessView').style.display = 'block';
      window.scrollTo(0, 0);

  } catch (error) { 
    Swal.fire('Error', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); 
    btn.disabled = false; btn.innerHTML = 'สมัครสมาชิก'; 
  }
}

/**
 * ส่งคำขอผูกบัญชี LINE กับข้อมูลเดิมที่กรรมการเคยลงให้แล้ว
 */
async function requestAccountLink() {
    const natId = document.getElementById('linkNatId').value;
    if(natId.length !== 13) return Swal.fire('แจ้งเตือน', 'กรุณากรอกเลข ปชช. 13 หลัก', 'warning');
    document.getElementById('systemLoading').style.display = 'flex';
    
    let userPic = "";
    if (liff.isLoggedIn()) { try { const profile = await liff.getProfile(); userPic = profile.pictureUrl || ""; } catch(err) {} }

    db.collection("members").where("nationalId", "==", natId).get().then(snap => {
        if(!snap.empty) {
            const docId = snap.docs[0].id;
            db.collection("members").doc(docId).update({ 
                linkStatus: "pending", pendingLineUid: document.getElementById('uid').value, pictureUrl: userPic 
            }).then(() => { 
                document.getElementById('systemLoading').style.display = 'none'; 
                Swal.fire('ส่งคำขอสำเร็จ', 'กรุณารอคณะกรรมการตรวจสอบ', 'success'); 
            })
        } else { 
          document.getElementById('systemLoading').style.display = 'none'; 
          Swal.fire('ไม่พบข้อมูล', 'ไม่พบเลข ปชช. นี้ในระบบ', 'error'); 
        }
    });
}


// ============================================================================
// 📌 SECTION 3: การแสดงผลหน้าแดชบอร์ด (Dashboard UI Rendering)
// ============================================================================

/**
 * นำข้อมูลสมาชิกมาแสดงผลบนหน้าจอหลัก (คำนวณยอดเงิน, อายุสมาชิก ฯลฯ)
 */
function renderDashboardData(data, pictureUrl) {
  // ตั้งค่ารูปโปรไฟล์
  document.getElementById('userAvatar').src = pictureUrl;

  document.getElementById('dashName').innerText = (data.prefix || "") + " " + data.fullName;
  document.getElementById('dashCenterText').innerText = " " + (data.center || "ยังไม่ระบุศูนย์");
  document.getElementById('dashCwfPoints').innerText = data.cwfPoints || 0;
  
  // อัปเดตป้ายยศ (Tier)
  if (data.cwfPoints !== undefined) updateTierOnScreen(data.cwfPoints);

  // ตั้งค่าป้ายสถานะ
  const statusBadge = document.getElementById('dashStatusBadge');
  statusBadge.innerText = data.status || "รอตรวจสอบ";
  statusBadge.className = `badge-status ${data.status === 'เป็นสมาชิก' ? 'status-active' : 'status-pending'}`;

  // แสดงยอดเงินกระเป๋า (Wallet)
  document.getElementById('dashTotalContrib').innerText = (data.totalContribution || 0).toLocaleString('en-US', {minimumFractionDigits: 2});
  let outstanding = (data.outstandingBalance !== undefined) ? data.outstandingBalance : ((fundSettings.annualFee || 365) - (data.totalContribution || 0));
  if (outstanding < 0) outstanding = 0;
  document.getElementById('dashOutstanding').innerText = outstanding.toLocaleString('en-US', {minimumFractionDigits: 2});
  
  document.getElementById('dashTotalWelfare').innerText = (data.totalWelfareReceived || 0).toLocaleString('en-US', {minimumFractionDigits: 2});
  
  // 🌟 เก็บข้อมูลจริงไว้ในหน่วยความจำสำหรับการเปิด Popup
  unmaskedData.NatId = data.nationalId || "";
  unmaskedData.Phone = data.phone || "";
  
  let ageStr = "เพิ่งสมัคร/รอตรวจสอบ";
  let regDateDisplay = "-";
  
  // คำนวณอายุและวันที่
  if (data.registerDateObj && data.status === 'เป็นสมาชิก') {
      const regD = new Date(data.registerDateObj); const now = new Date();
      regDateDisplay = `${String(regD.getDate()).padStart(2,'0')}/${String(regD.getMonth()+1).padStart(2,'0')}/${regD.getFullYear()+543}`;
      
      let years = now.getFullYear() - regD.getFullYear(); let months = now.getMonth() - regD.getMonth(); let days = now.getDate() - regD.getDate();
      if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (months < 0) { years--; months += 12; }
      if(years >= 0) ageStr = `${years} ปี ${months} ด. ${days} ว.`;
  }
  
  // 🌟 เซฟอายุและวันที่ลงในตัวแปร เพื่อให้ป๊อปอัปดึงไปใช้ได้
  cachedUserData.displayAge = ageStr;
  cachedUserData.displayRegDate = regDateDisplay;

  // ประวัติรับสวัสดิการ
  const historyList = document.getElementById('dashWelfareList');
  historyList.innerHTML = "";
  if((data.welfareHistory || []).length === 0) {
    historyList.innerHTML = `<div class="info-row text-center text-muted small"><div class="w-100 py-2">ไม่มีประวัติ</div></div>`;
  } else {
    data.welfareHistory.forEach(item => { 
      let badgeClass = item.status.includes('อนุมัติ') ? 'bg-success text-white' : 'bg-warning text-dark';
      historyList.innerHTML += `<div class="info-row"><span class="info-label text-dark">${item.type}</span><span class="badge ${badgeClass} rounded-pill">${item.status}</span></div>`; 
    });
  }
  
  document.getElementById('accountLinkView').style.display = 'none';
  renderStreakUI(data.checkInStreak || 0, data.lastCheckInDate || "");
  loadTransparencyBoard();
  loadMemberTransactionTimeline(document.getElementById('uid').value);
  loadCommunityNews();

  document.getElementById('dashboardView').style.display = 'block';
}


// ============================================================================
// 📌 SECTION 4: ภารกิจและคะแนนสะสม (Gamification & Check-in)
// ============================================================================

/**
 * เปลี่ยนสีป้ายสถานะยศ (Tier) ตามคะแนน
 */
function updateTierOnScreen(points) {
    let tierName = "ร่วมใจ (Unity)"; let tierColor = "#64748B"; 
    if (points >= 5000) { tierName = "เกียรติภูมิชุมชน (Legacy)"; tierColor = "#D97706"; }
    else if (points >= 2500) { tierName = "ทรงคุณค่า (Precious)"; tierColor = "#1D4ED8"; }
    else if (points >= 1000) { tierName = "ต้นแบบ (Role Model)"; tierColor = "#059669"; }
    else if (points >= 600) { tierName = "อุทิศตน (Dedication)"; tierColor = "#7C3AED"; }
    else if (points >= 300) { tierName = "แบ่งปัน (Sharing)"; tierColor = "#EA580C"; }
    else if (points >= 100) { tierName = "เกื้อกูล (Solidarity)"; tierColor = "#0284C7"; }
    
    const tierBadge = document.getElementById('dashTierBadge');
    if(tierBadge) {
        tierBadge.innerHTML = `<i class="fa-solid fa-crown"></i> ${tierName}`;
        tierBadge.style.backgroundColor = tierColor;
        tierBadge.style.display = 'inline-flex';
    }
}

/**
 * กดเช็คอินรับแต้มรายวัน
 */
async function processDailyCheckIn() {
    Swal.fire({ title: 'กำลังตรวจสอบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const uid = document.getElementById('uid').value || (cachedUserData ? cachedUserData.lineUid : "");
        const masterRef = db.collection("settings").doc("master"); const docRef = db.collection("members").doc(uid);
        const masterSnap = await masterRef.get(); let currentPool = masterSnap.data().globalPointPool || 0;
        if (currentPool <= 0) return Swal.fire('โควต้าหมด', 'งบประมาณแต้มหมดแล้ว ไม่สามารถรับแต้มเช็คอินได้', 'info');

        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const d = docSnap.data(); const lastCheckIn = d.lastCheckInDate; let currentStreak = d.checkInStreak || 0;
            const now = new Date(); const todayStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
            if (lastCheckIn === todayStr) return Swal.fire({ icon: 'info', title: 'คุณเช็คอินไปแล้ว', text: 'ไว้มาเช็คอินใหม่พรุ่งนี้นะครับ!', confirmButtonColor: '#2563EB' });

            let isContinuous = false;
            if (lastCheckIn) {
                const parts = lastCheckIn.split('/'); const lastDate = new Date(parts[2], parts[1]-1, parts[0]);
                const diffDays = Math.floor(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) isContinuous = true;
            }
            if (isContinuous) currentStreak += 1; else currentStreak = 1;

            let pointsToGive = 2; let alertMsg = 'ได้รับแต้มจากการเช็คอินวันนี้'; let alertTitle = 'ยอดเยี่ยม!';
            if (currentStreak >= 7) { pointsToGive = 15; currentStreak = 0; alertMsg = 'เช็คอินครบ 7 วัน! รับโบนัส'; alertTitle = '🎉 แจ็คพอตแตก!'; }

            let actualGive = pointsToGive; if (currentPool < pointsToGive) actualGive = currentPool;

            const batch = db.batch();
            batch.update(docRef, { cwfPoints: firebase.firestore.FieldValue.increment(actualGive), lastCheckInDate: todayStr, checkInStreak: currentStreak });
            batch.update(masterRef, { globalPointPool: firebase.firestore.FieldValue.increment(-actualGive) });
            await batch.commit();

            fundSettings.globalPointPool -= actualGive; renderStreakUI(currentStreak, todayStr); checkMemberOnCloud(uid, d.pictureUrl);
            Swal.fire({ icon: 'success', title: alertTitle, text: `${alertMsg} (+${actualGive} แต้ม)`, confirmButtonColor: '#10B981' });
        }
    } catch (error) { Swal.fire('Error', 'ประมวลผลล้มเหลว', 'error'); }
}

/**
 * วาดวงกลม 7 วันเช็คอิน
 */
function renderStreakUI(streakCount, lastCheckInStr) {
    const now = new Date(); const todayStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
    for (let i = 1; i <= 7; i++) {
        const circle = document.getElementById(`streak-${i}`); if (!circle) continue;
        circle.classList.remove('active');
        if (i === 7) circle.innerHTML = '<i class="fa-solid fa-gift"></i>'; else circle.innerHTML = i;
        if (i <= streakCount) { circle.classList.add('active'); if (i !== 7) circle.innerHTML = '<i class="fa-solid fa-check"></i>'; }
    }
    const btn = document.getElementById('btnCheckIn');
    if (lastCheckInStr === todayStr) { btn.classList.replace('btn-success', 'btn-secondary'); btn.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> เช็คอินแล้ว'; btn.disabled = true; } 
    else { btn.classList.replace('btn-secondary', 'btn-success'); btn.innerHTML = '<i class="fa-solid fa-calendar-check me-1"></i> กดเช็คอินรับแต้มวันนี้'; btn.disabled = false; }
}


// ============================================================================
// 📌 SECTION 5: กระดานโปร่งใสและไทม์ไลน์ (Transparency & Timeline)
// ============================================================================

/**
 * ดึงประวัติธุรกรรมเพื่อแสดง Timeline ติดตามเงิน
 */
async function loadMemberTransactionTimeline(uid) {
    const container = document.getElementById('dashTxTimeline');
    try {
        const snap = await db.collection("transactions").orderBy("timestamp", "desc").limit(10).get();
        let latestTx = null;
        snap.forEach(doc => {
            const d = doc.data();
            if (d.uid === uid) { if(!latestTx) latestTx = d; } 
            else if (d.uid === "BULK" && d.bulkMembers) {
                let found = d.bulkMembers.find(m => m.uid === uid);
                if (found && !latestTx) latestTx = d;
            }
        });

        if (!latestTx) {
            container.innerHTML = `<div class="text-center text-muted small py-2"><i class="fa-solid fa-inbox d-block fs-3 mb-2"></i>ยังไม่มีประวัติส่งเงินสมทบ</div>`;
            return;
        }

        let amtStr = parseFloat(latestTx.amount).toLocaleString('en-US', {minimumFractionDigits: 2});
        let holder = latestTx.currentHolder || latestTx.fullName.replace('แอดมิน: ', '');
        
        let step1 = "active", step2 = "", step3 = "", step4 = "";
        let step2Msg = "รอการส่งมอบเข้าศูนย์ฯ"; let step3Msg = "รอการเงินกองทุนรับยอด";
        
        if (latestTx.status === "รอส่งมอบ") { step2 = "warning"; step2Msg = `เงินสดอยู่ที่: <strong>${holder}</strong>`; } 
        else if (latestTx.status === "รอตรวจสอบ") { step2 = "active"; step3 = "warning"; step3Msg = `เงินสดอยู่ที่: <strong>${holder}</strong> (รอพิจารณา)`; } 
        else if (latestTx.status === "อนุมัติแล้ว") { step2 = "active"; step3 = "active"; step4 = "active"; step2Msg = "ผ่านศูนย์ประสานงานแล้ว"; step3Msg = "ตรวจสอบถูกต้อง"; }

        container.innerHTML = `
            <h6 class="fw-bold text-dark mb-3"><i class="fa-solid fa-receipt text-primary me-1"></i> ยอดล่าสุด: ฿${amtStr}</h6>
            <div class="timeline">
                <div class="timeline-item ${step1}"><small class="fw-bold text-dark d-block">จ่ายเงินสำเร็จ</small><span class="text-muted" style="font-size:0.7rem;">ผ่านช่องทาง: ${latestTx.paymentMethod}</span></div>
                <div class="timeline-item ${step2}"><small class="fw-bold text-dark d-block">การส่งมอบ (Chain of Custody)</small><span class="text-muted" style="font-size:0.7rem;">${step2Msg}</span></div>
                <div class="timeline-item ${step3}"><small class="fw-bold text-dark d-block">ส่วนกลางตรวจสอบ</small><span class="text-muted" style="font-size:0.7rem;">${step3Msg}</span></div>
                <div class="timeline-item ${step4}"><small class="fw-bold text-success d-block">อนุมัติเข้าบัญชีหลัก</small><span class="text-muted" style="font-size:0.7rem;">ยอดสะสมของคุณถูกอัปเดตแล้ว</span></div>
            </div>
        `;
    } catch (e) { container.innerHTML = `<div class="text-center text-danger small py-2">โหลดข้อมูลไทม์ไลน์ล้มเหลว</div>`; }
}

/**
 * ดึงรายการเบิกจ่ายสวัสดิการมาให้สมาชิกช่วยตรวจสอบความโปร่งใส
 */
async function loadTransparencyBoard() {
    const feed = document.getElementById('transparencyFeed');
    try {
        const snap = await db.collection("transactions").orderBy("timestamp", "desc").limit(30).get();
        let html = ""; let validCount = 0; 
        let t1 = fundSettings.fomoTier1 || 5; let t2 = fundSettings.fomoTier2 || 3; let t3 = fundSettings.fomoTier3 || 1;
        
        snap.forEach(doc => {
            const d = doc.data();
            if (d.status === "อนุมัติแล้ว" || validCount >= 5) return;
            validCount++;

            const currentUserUid = document.getElementById('uid').value || (cachedUserData ? cachedUserData.lineUid : "");
            let verifiedByArray = d.verifiedBy || []; let verifiedCount = verifiedByArray.length;
            
            let pointsToGive = t3; let badgeHtml = ""; let btnColor = "btn-outline-secondary"; let btnText = "ตรวจสอบและเป็นพยาน"; 
            
            if(verifiedCount < 10) { pointsToGive = t1; badgeHtml = `<span class="badge bg-danger rounded-pill shadow-sm" style="font-size:0.65rem;">🔥 โควต้า ${t1} แต้ม (เหลือ ${10 - verifiedCount})</span>`; btnColor = "btn-success"; } 
            else if(verifiedCount < 30) { pointsToGive = t2; badgeHtml = `<span class="badge bg-warning text-dark rounded-pill shadow-sm" style="font-size:0.65rem;">⚡ โควต้า ${t2} แต้ม (เหลือ ${30 - verifiedCount})</span>`; btnColor = "btn-warning text-dark"; } 
            else { badgeHtml = `<span class="badge bg-light text-muted border rounded-pill" style="font-size:0.65rem;">✅ โควต้าพิเศษหมด (ได้ ${t3} แต้ม)</span>`; btnColor = "btn-outline-primary"; }

            let alreadyVerified = verifiedByArray.includes(currentUserUid);
            let btnHtml = alreadyVerified 
                ? `<button class="btn btn-sm btn-light text-success w-100 rounded-pill fw-bold" disabled><i class="fa-solid fa-circle-check"></i> คุณเป็นพยานรายการนี้แล้ว</button>`
                : `<button class="btn btn-sm ${btnColor} w-100 rounded-pill fw-bold" onclick="verifyTransaction('${doc.id}', ${pointsToGive})"><i class="fa-solid fa-eye"></i> ${btnText} (+${pointsToGive})</button>`;

            let amtStr = parseFloat(d.amount).toLocaleString('en-US', {minimumFractionDigits: 2});
            let dateStr = d.transactionDate || "ไม่ระบุวันที่";
            let statusBadge = `<span class="badge bg-warning text-dark rounded-pill shadow-sm mt-1" style="font-size:0.65rem;">${d.status}</span>`;

            html += `
            <div class="transparency-card">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="fw-bold text-dark mb-0" style="font-size:0.85rem;"><i class="fa-solid fa-file-invoice text-primary me-1"></i> ${d.type}</h6>
                        <small class="text-muted" style="font-size:0.75rem;">${d.note || d.fullName}</small>
                    </div>
                    <div class="text-end">
                        <h6 class="fw-bold text-success mb-0 bg-success bg-opacity-10 px-2 py-1 rounded-3">฿${amtStr}</h6>
                        ${statusBadge}
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-3 mt-3 border-top pt-2">
                    <small class="text-muted" style="font-size:0.7rem;"><i class="fa-regular fa-calendar"></i> ${dateStr}</small>
                    ${badgeHtml}
                </div>
                ${btnHtml}
            </div>`;
        });
        
        feed.innerHTML = html || '<div class="text-center text-success fw-bold small p-4 bg-white rounded-4 border border-success border-opacity-25"><i class="fa-solid fa-shield-check fs-2 mb-2 d-block"></i> โปร่งใส 100%<br><span class="text-muted fw-normal">ขณะนี้ไม่มีรายการสวัสดิการที่รอตรวจสอบครับ</span></div>';
    } catch(e) { feed.innerHTML = '<div class="text-center text-danger small p-3">โหลดข้อมูลกระดานล้มเหลว</div>'; }
}

/**
 * กดตรวจสอบรายการในกระดานเพื่อรับแต้ม
 */
async function verifyTransaction(txId, pointsToGive) {
    Swal.fire({ title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading() });
    try {
        const uid = document.getElementById('uid').value || (cachedUserData ? cachedUserData.lineUid : "");
        const masterRef = db.collection("settings").doc("master");
        const masterSnap = await masterRef.get();
        let currentPool = masterSnap.data().globalPointPool || 0;
        
        if (currentPool <= 0) return Swal.fire('โควต้าหมด', 'งบประมาณแต้มรวมประจำปีหมดแล้ว ขอขอบคุณที่ร่วมตรวจสอบครับ', 'info');
        
        let actualGive = pointsToGive; if (currentPool < pointsToGive) { actualGive = currentPool; }

        const batch = db.batch();
        batch.update(db.collection("transactions").doc(txId), { verifiedBy: firebase.firestore.FieldValue.arrayUnion(uid) });
        batch.update(db.collection("members").doc(uid), { cwfPoints: firebase.firestore.FieldValue.increment(actualGive) });
        batch.update(masterRef, { globalPointPool: firebase.firestore.FieldValue.increment(-actualGive) });
        await batch.commit();
        
        Swal.fire({ icon: 'success', title: `รับ ${actualGive} แต้ม`, text: 'ขอบคุณที่ร่วมตรวจสอบความโปร่งใสให้ชุมชนครับ', confirmButtonColor: '#10B981' });
        fundSettings.globalPointPool -= actualGive;
        loadTransparencyBoard();
        checkMemberOnCloud(uid, cachedUserData ? cachedUserData.pictureUrl : ""); 
    } catch(e) { Swal.fire('Error', 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error'); }
}


// ============================================================================
// 📌 SECTION 6: เครื่องมือเสริม (QR Scan & Share)
// ============================================================================

function openShareModal(mode) { currentShareMode = mode; document.getElementById('shareModal').style.display = 'flex'; }
function closeShareModal() { document.getElementById('shareModal').style.display = 'none'; }

/**
 * สร้างลิงก์เชิญเพื่อนผ่าน LINE หรือ Facebook
 */
async function executeShare(platform) {
    closeShareModal();
    const url = `https://liff.line.me/${LIFF_ID}` + (currentShareMode==='invite' ? `?ref=${cachedUserData.memberId}` : '');
    const text = currentShareMode==='invite' ? 'มาสมัครกองทุนสวัสดิการชุมชนกันเถอะ!' : 'ข่าวสารใหม่จากกองทุนสวัสดิการชุมชน';
    if(platform === 'line') window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + " " + url)}`);
    else if(platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    else { navigator.clipboard.writeText(url); Swal.fire('สำเร็จ', 'คัดลอกลิงก์แล้ว', 'success'); }
}

/**
 * สแกน QR Code ที่แอดมินสร้าง เพื่อยืนยันการจ่ายเงินสด
 */
async function scanToPayAdmin() {
    if (!liff.isLoggedIn()) return Swal.fire('แจ้งเตือน', 'กรุณาเปิดแอปผ่าน LINE เพื่อใช้งานกล้องครับ', 'warning');
    try {
        const result = await liff.scanCodeV2();
        if (result.value) {
            Swal.fire({ title: 'กำลังดึงข้อมูลบิล...', didOpen: () => Swal.showLoading() });
            let qrData; try { qrData = JSON.parse(result.value); } catch (e) { Swal.close(); return Swal.fire('ผิดพลาด', 'QR Code ไม่ถูกต้อง', 'error'); }

            if ((qrData.action === "member_pay" || qrData.action === "member_pay_bulk") && qrData.ref) {
                const payRef = db.collection("pending_payments").doc(qrData.ref);
                const paySnap = await payRef.get();
                Swal.close();

                if (!paySnap.exists || paySnap.data().status !== "waiting_member_scan") return Swal.fire('หมดอายุ', 'รายการนี้ถูกยืนยันไปแล้ว', 'error');
                const payData = paySnap.data();

                Swal.fire({
                    title: 'ยืนยันการมอบเงินสด',
                    html: `<div class="text-start" style="font-family:'Prompt';"><p class="mb-1 text-muted small">ผู้รับเงิน (กรรมการ):</p><h6 class="fw-bold text-dark"><i class="fa-solid fa-user-tie text-warning me-1"></i> ${payData.adminName}</h6><hr><p class="mb-1 text-muted small">ยอดเงินที่ต้องชำระ:</p><h1 class="fw-bold text-success text-center mb-1">฿${payData.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</h1><p class="small text-danger text-center mt-3"><i class="fa-solid fa-triangle-exclamation"></i> กดยืนยันเมื่อคุณมอบเงินสดให้กรรมการแล้วเท่านั้น</p></div>`,
                    showCancelButton: true, confirmButtonText: 'ยืนยันมอบเงินแล้ว', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
                }).then(async (res) => {
                    if (res.isConfirmed) {
                        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
                        try {
                            const batch = db.batch();
                            const newTxRef = db.collection("transactions").doc();
                            let txPayload = {
                                txId: payData.txId, type: 'สมทบเงินกองทุน', amount: payData.amount, paymentMethod: 'เงินสด', transactionDate: payData.date, fullName: 'แอดมิน: ' + payData.adminName, status: 'รอส่งมอบ', currentHolder: payData.adminEmail, note: payData.note, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            };
                            if (qrData.action === "member_pay_bulk") { txPayload.uid = "BULK"; txPayload.bulkMembers = payData.bulkMembers; } 
                            else { txPayload.uid = payData.uid; }
                            
                            batch.set(newTxRef, txPayload);
                            batch.update(payRef, { status: "completed", scannedByUid: document.getElementById('uid').value, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
                            await batch.commit();
                            
                            Swal.fire({ icon: 'success', title: 'ชำระเงินสำเร็จ!', text: 'ระบบบันทึกการมอบเงินให้กรรมการเรียบร้อยแล้ว', confirmButtonColor: '#10B981' }).then(() => { checkMemberOnCloud(document.getElementById('uid').value); });
                        } catch(err) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก', 'error'); }
                    }
                });
            } else { Swal.close(); Swal.fire('Error', 'QR Code ไม่ใช่บิลเรียกเก็บเงิน', 'error'); }
        }
    } catch (err) {}
}
/**
 * ฟังก์ชันสร้างตัวเลขซ่อน (*)
 */
window.maskString = (str) => {
    if (!str) return "-";
    if (str.length <= 4) return str;
    return "*".repeat(str.length - 4) + str.slice(-4);
};

/**
 * ฟังก์ชันแสดงป๊อปอัปข้อมูลส่วนตัว
 */
window.showProfilePopup = function() {
    if(!cachedUserData) return;

    const memId = cachedUserData.memberId || "-";
    const memType = cachedUserData.memberType || "สมาชิกสามัญ";
    const age = cachedUserData.displayAge || "-";
    const regDate = cachedUserData.displayRegDate || "-";

    // รีเซ็ตสถานะเป็นซ่อนเสมอเมื่อเปิดป๊อปอัป
    isDataMasked.natId = true;
    isDataMasked.phone = true;

    Swal.fire({
        title: '<i class="fa-solid fa-address-card text-primary me-2"></i> ข้อมูลส่วนตัว',
        html: `
        <div class="info-list shadow-none mb-0 text-start mt-3" style="font-family: 'Prompt', sans-serif;">
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">รหัสสมาชิก</span>
            <span class="info-data text-primary fw-bold">${memId}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">ประเภทสมาชิก</span>
            <span class="info-data text-dark fw-bold">${memType}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between align-items-center">
            <span class="info-label fw-bold">เลข ปชช. 
              <i class="fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6" id="swal-toggle-natId" onclick="toggleSwalSecureData('natId')"></i>
            </span>
            <span class="info-data text-dark fw-bold" id="swal-natId-display">${window.maskString(unmaskedData.NatId)}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between align-items-center">
            <span class="info-label fw-bold">เบอร์โทรศัพท์ 
              <i class="fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6" id="swal-toggle-phone" onclick="toggleSwalSecureData('phone')"></i>
            </span>
            <span class="info-data text-dark fw-bold" id="swal-phone-display">${window.maskString(unmaskedData.Phone)}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">อายุสมาชิก</span>
            <span class="info-data text-success fw-bold">${age}</span>
          </div>
          <div class="info-row px-0 py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">วันที่สมัคร</span>
            <span class="info-data text-dark fw-bold">${regDate}</span>
          </div>
        </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-4 px-3 pb-4' }
    });
};

/**
 * ฟังก์ชันเปิด/ปิด ตา ในหน้าป๊อปอัป SweetAlert
 */
window.toggleSwalSecureData = function(type) {
    const displayEl = document.getElementById(type === 'natId' ? 'swal-natId-display' : 'swal-phone-display');
    const iconEl = document.getElementById(type === 'natId' ? 'swal-toggle-natId' : 'swal-toggle-phone');
    const realData = type === 'natId' ? unmaskedData.NatId : unmaskedData.Phone;
    
    if (!displayEl || !iconEl || !realData) return;

    isDataMasked[type] = !isDataMasked[type];
    
    if (isDataMasked[type]) {
        displayEl.innerText = window.maskString(realData);
        iconEl.className = "fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6";
    } else {
        displayEl.innerText = realData;
        iconEl.className = "fa-solid fa-eye text-primary ms-2 cursor-pointer fs-6";
    }
};   

// ============================================================================
// 📌 SECTION 7: ข่าวสารและประกาศชุมชน (Community News)
// ============================================================================

/**
 * ดึงข่าวสารล่าสุดจาก Firestore มาแสดงเป็นแบบการ์ด
 */
async function loadCommunityNews() {
    const container = document.getElementById('memberNewsFeed');
    try {
        // ดึงข่าวสารล่าสุด 10 รายการ เรียงตามวันที่ล่าสุด
        const snap = await db.collection("news").orderBy("timestamp", "desc").limit(10).get();
        if (snap.empty) {
            container.innerHTML = `<div class="text-center text-muted small py-3 w-100 bg-white rounded-4 border">ยังไม่มีประกาศข่าวสารใหม่</div>`;
            return;
        }
        
        let html = "";
        snap.forEach(doc => {
            const n = doc.data();
            // ใช้รูปภาพเริ่มต้น หากแอดมินไม่ได้แนบ URL มา
            const img = n.imageUrl || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80";
            
            html += `
                <div class="vertical-news-card" onclick="viewNewsDetail('${doc.id}')">
                    <img src="${img}" class="news-img" alt="News">
                    <div class="news-content">
                        <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill mb-2" style="font-size: 0.65rem; width: fit-content;">${n.category || 'ทั่วไป'}</span>
                        <strong class="text-dark d-block mb-1 text-truncate" style="font-size: 0.85rem; line-height: 1.3;">${n.title}</strong>
                        <p class="text-muted small mb-2 line-clamp-2" style="font-size: 0.75rem; line-height: 1.4;">${n.content}</p>
                        <small class="text-muted mt-auto" style="font-size: 0.65rem;"><i class="fa-regular fa-calendar me-1"></i> ${n.dateStr || ''}</small>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<div class="text-danger small p-3">โหลดข่าวสารขัดข้อง</div>`;
    }
}

/**
 * เปิดดูรายละเอียดข่าวสารเมื่อสมาชิกกดคลิกที่การ์ดข่าว
 */
window.viewNewsDetail = async function(newsId) {
    Swal.fire({ title: 'กำลังโหลด...', didOpen: () => Swal.showLoading() });
    try {
        const doc = await db.collection("news").doc(newsId).get();
        if (!doc.exists) return Swal.fire('Error', 'ไม่พบข้อมูลข่าวสาร', 'error');
        const n = doc.data();
        
        Swal.fire({
            title: n.title,
            html: `
                <div class="text-start" style="font-family:'Prompt';">
                    <img src="${n.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'}" class="w-100 rounded-3 mb-3" style="max-height: 220px; object-fit: cover; border: 1px solid #E5E7EB;">
                    <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill">${n.category || 'ทั่วไป'}</span>
                        <small class="text-muted"><i class="fa-regular fa-calendar me-1"></i> ${n.dateStr || ''}</small>
                    </div>
                    <!-- white-space: pre-wrap; ทำให้รองรับการเว้นบรรทัด (Enter) จากแอดมิน -->
                    <p style="font-size: 0.9rem; line-height: 1.6; color: #334155; white-space: pre-wrap;">${n.content}</p>
                </div>
            `,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#2563EB',
            width: '90%', // ปรับขนาด popup ให้กว้างขึ้นในมือถือ
            padding: '1.5em'
        });
    } catch (e) {
        Swal.fire('Error', 'ไม่สามารถเปิดข่าวสารได้', 'error');
    }
};

// ============================================================================
// 📌 SECTION 8: ป๊อปอัปข้อมูลส่วนตัว (Profile Popup)
// ============================================================================

/**
 * ฟังก์ชันสร้างตัวเลขซ่อน (*)
 */
window.maskString = (str) => {
    if (!str) return "-";
    if (str.length <= 4) return str;
    return "*".repeat(str.length - 4) + str.slice(-4);
};

/**
 * ฟังก์ชันแสดงป๊อปอัปข้อมูลส่วนตัว
 */
window.showProfilePopup = function() {
    if(!cachedUserData) return;

    const memId = cachedUserData.memberId || "-";
    const memType = cachedUserData.memberType || "สมาชิกสามัญ";
    const age = cachedUserData.displayAge || "-";
    const regDate = cachedUserData.displayRegDate || "-";

    // รีเซ็ตสถานะเป็นซ่อนเสมอเมื่อเปิดป๊อปอัป
    isDataMasked.natId = true;
    isDataMasked.phone = true;

    Swal.fire({
        title: '<i class="fa-solid fa-address-card text-primary me-2"></i> ข้อมูลส่วนตัว',
        html: `
        <div class="info-list shadow-none mb-0 text-start mt-3" style="font-family: 'Prompt', sans-serif;">
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">รหัสสมาชิก</span>
            <span class="info-data text-primary fw-bold">${memId}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">ประเภทสมาชิก</span>
            <span class="info-data text-dark fw-bold">${memType}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between align-items-center">
            <span class="info-label fw-bold">เลข ปชช. 
              <i class="fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6" id="swal-toggle-natId" onclick="toggleSwalSecureData('natId')"></i>
            </span>
            <span class="info-data text-dark fw-bold" id="swal-natId-display">${window.maskString(unmaskedData.NatId)}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between align-items-center">
            <span class="info-label fw-bold">เบอร์โทรศัพท์ 
              <i class="fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6" id="swal-toggle-phone" onclick="toggleSwalSecureData('phone')"></i>
            </span>
            <span class="info-data text-dark fw-bold" id="swal-phone-display">${window.maskString(unmaskedData.Phone)}</span>
          </div>
          <div class="info-row px-0 border-bottom py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">อายุสมาชิก</span>
            <span class="info-data text-success fw-bold">${age}</span>
          </div>
          <div class="info-row px-0 py-3 d-flex justify-content-between">
            <span class="info-label fw-bold">วันที่สมัคร</span>
            <span class="info-data text-dark fw-bold">${regDate}</span>
          </div>
        </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-4 px-3 pb-4' }
    });
};

/**
 * ฟังก์ชันเปิด/ปิด ตา ในหน้าป๊อปอัป SweetAlert
 */
window.toggleSwalSecureData = function(type) {
    const displayEl = document.getElementById(type === 'natId' ? 'swal-natId-display' : 'swal-phone-display');
    const iconEl = document.getElementById(type === 'natId' ? 'swal-toggle-natId' : 'swal-toggle-phone');
    const realData = type === 'natId' ? unmaskedData.NatId : unmaskedData.Phone;
    
    if (!displayEl || !iconEl || !realData) return;

    isDataMasked[type] = !isDataMasked[type];
    
    if (isDataMasked[type]) {
        displayEl.innerText = window.maskString(realData);
        iconEl.className = "fa-solid fa-eye-slash text-primary ms-2 cursor-pointer fs-6";
    } else {
        displayEl.innerText = realData;
        iconEl.className = "fa-solid fa-eye text-primary ms-2 cursor-pointer fs-6";
    }
};