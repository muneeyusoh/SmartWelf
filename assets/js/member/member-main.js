// ============================================================================
// 👤 member-main.js: ควบคุมหน้า Dashboard และการสมัครสมาชิก (index.html)
// ============================================================================

// 📌 SECTION 1: ตัวแปรและการเริ่มต้นระบบ (Initialization)
let fundSettings = {};
let cachedUserData = null;
let unmaskedData = { NatId: '', Phone: '' };
let isDataMasked = { natId: true, phone: true };
let currentShareMode = 'news';

function updateLoadingText(text) {
    const loadingTxt = document.getElementById('systemLoadingText');
    if (loadingTxt) loadingTxt.innerText = text;
}

// 🌟 สร้างฟังก์ชันหลักสำหรับเริ่มระบบ
async function initMemberApp() {
  try {
    updateLoadingText("กำลังเชื่อมต่อฐานข้อมูล (1/3)...");
    if (typeof db === 'undefined') throw new Error("ไม่พบการเชื่อมต่อฐานข้อมูล (db is undefined)");

    const sysSnap = await db.collection("settings").doc("master").get();
    if(sysSnap.exists) {
       fundSettings = sysSnap.data();
       const headerFundName = document.getElementById('headerFundName');
       if(headerFundName) headerFundName.innerText = fundSettings.fundName || "กองทุนสวัสดิการชุมชน";
       
       const regCenter = document.getElementById('regCenterSelect');
       const regVillage = document.getElementById('regVillageSelect');
       if(regCenter) (fundSettings.centers || []).forEach(c => regCenter.add(new Option(c, c)));
       if(regVillage) (fundSettings.inZoneVillages || []).forEach(v => regVillage.add(new Option(v, v)));
    }

    const regAdmin = document.getElementById('regResponsibleAdmin');
    if (regAdmin) {
        if (fundSettings.committee && fundSettings.committee.length > 0) {
            fundSettings.committee.forEach(com => { regAdmin.add(new Option(com.name, com.name)); });
        }
    }

    updateLoadingText("กำลังเชื่อมต่อระบบ LINE (2/3)...");
    if (typeof LIFF_ID === 'undefined') throw new Error("ไม่พบรหัส LIFF_ID");
    await liff.init({ liffId: LIFF_ID });
    
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('ref') && document.getElementById('refCode')) {
        document.getElementById('refCode').value = urlParams.get('ref');
    }

    updateLoadingText("กำลังตรวจสอบสถานะผู้ใช้ (3/3)...");
    
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      if(document.getElementById('uid')) document.getElementById('uid').value = profile.userId;
      await checkMemberOnCloud(profile.userId, profile.pictureUrl || "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/person-circle.svg");
    } else { 
        if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" || window.location.hostname === "") {
            document.getElementById('systemLoading').innerHTML = `
            <div class="text-center px-4" style="margin-top: 30vh;">
                <i class="fa-solid fa-laptop-code text-primary fs-1 mb-3"></i>
                <h6 class="fw-bold">โหมดทดสอบ Localhost</h6>
                <p class="small text-muted">ระบบฝั่งสมาชิกต้องใช้บัญชี LINE ในการเข้าสู่ระบบ<br><br>กรุณา Push ขึ้น GitHub และกดลิงก์เปิดผ่านแอป LINE</p>
            </div>`;
        } else {
            liff.login(); 
        }
    }
  } catch (err) { 
      document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4" style="margin-top: 40vh;"><h6>System Error</h6><p class="small fw-bold">${err.message}</p><button class="btn btn-sm btn-outline-danger mt-3" onclick="location.reload()">ลองใหม่</button></div>`; 
  }
}

// 🌟 ตัวดักจับ: ถ้าโหลดเว็บเสร็จแล้วให้รันทันที
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMemberApp);
} else {
    initMemberApp();
}

// 📌 SECTION 2: ระบบสมัครสมาชิกและผูกบัญชี (Registration & Account Link)
async function checkMemberOnCloud(uid, pictureUrl) {
  try {
    const docRef = db.collection("members").doc(uid);
    const docSnap = await docRef.get();
    
    const loader = document.getElementById('systemLoading');
    if (loader) loader.style.display = 'none';

    if (docSnap.exists) {
      cachedUserData = docSnap.data();
      let finalPicUrl = pictureUrl || cachedUserData.pictureUrl || "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/person-circle.svg";
      if (pictureUrl && cachedUserData.pictureUrl !== pictureUrl) {
          await docRef.update({ pictureUrl: pictureUrl }); 
          cachedUserData.pictureUrl = pictureUrl;
      }
      renderDashboardData(cachedUserData, finalPicUrl);
    } else { 
      document.getElementById('accountLinkView').style.display = 'block'; 
    }
  } catch (error) { 
     document.getElementById('systemLoading').innerHTML = `<div class="text-danger text-center px-4" style="margin-top: 40vh;"><h6>Database Error</h6><p class="small">ไม่สามารถเชื่อมต่อฐานข้อมูลได้<br>${error.message}</p></div>`;
  }
}

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

async function requestAccountLink() {
    const natId = document.getElementById('linkNatId').value;
    if(natId.length !== 13) return Swal.fire('แจ้งเตือน', 'กรุณากรอกเลข ปชช. 13 หลัก', 'warning');
    
    const loader = document.getElementById('systemLoading');
    if (loader) loader.style.display = 'flex';
    
    let userPic = "";
    if (liff.isLoggedIn()) { try { const profile = await liff.getProfile(); userPic = profile.pictureUrl || ""; } catch(err) {} }

    db.collection("members").where("nationalId", "==", natId).get().then(snap => {
        if(!snap.empty) {
            const docId = snap.docs[0].id;
            db.collection("members").doc(docId).update({ 
                linkStatus: "pending", pendingLineUid: document.getElementById('uid').value, pictureUrl: userPic 
            }).then(() => { 
                if (loader) loader.style.display = 'none';
                Swal.fire('ส่งคำขอสำเร็จ', 'กรุณารอคณะกรรมการตรวจสอบ', 'success'); 
            })
        } else { 
          if (loader) loader.style.display = 'none';
          Swal.fire('ไม่พบข้อมูล', 'ไม่พบเลข ปชช. นี้ในระบบ', 'error'); 
        }
    });
}

// 📌 SECTION 3: การแสดงผลหน้าแดชบอร์ด (Dashboard UI Rendering)
function renderDashboardData(data, pictureUrl) {
  document.getElementById('userAvatar').src = pictureUrl;
  document.getElementById('dashName').innerText = (data.prefix || "") + " " + data.fullName;
  document.getElementById('dashCenterText').innerText = " " + (data.center || "ยังไม่ระบุศูนย์");
  document.getElementById('dashCwfPoints').innerText = data.cwfPoints || 0;
  
  if (data.cwfPoints !== undefined) updateTierOnScreen(data.cwfPoints);

  const statusBadge = document.getElementById('dashStatusBadge');
  statusBadge.innerText = data.status || "รอตรวจสอบ";
  statusBadge.className = `badge-status ${data.status === 'เป็นสมาชิก' ? 'status-active' : 'status-pending'}`;

  document.getElementById('dashTotalContrib').innerText = (data.totalContribution || 0).toLocaleString('en-US', {minimumFractionDigits: 2});
  let outstanding = (data.outstandingBalance !== undefined) ? data.outstandingBalance : ((fundSettings.annualFee || 365) - (data.totalContribution || 0));
  if (outstanding < 0) outstanding = 0;
  document.getElementById('dashOutstanding').innerText = outstanding.toLocaleString('en-US', {minimumFractionDigits: 2});
  
  document.getElementById('dashTotalWelfare').innerText = (data.totalWelfareReceived || 0).toLocaleString('en-US', {minimumFractionDigits: 2});
  
  unmaskedData.NatId = data.nationalId || "";
  unmaskedData.Phone = data.phone || "";
  
  let ageStr = "เพิ่งสมัคร/รอตรวจสอบ";
  let regDateDisplay = "-";
  
  if (data.registerDateObj && data.status === 'เป็นสมาชิก') {
      const regD = new Date(data.registerDateObj); const now = new Date();
      regDateDisplay = `${String(regD.getDate()).padStart(2,'0')}/${String(regD.getMonth()+1).padStart(2,'0')}/${regD.getFullYear()+543}`;
      
      let years = now.getFullYear() - regD.getFullYear(); let months = now.getMonth() - regD.getMonth(); let days = now.getDate() - regD.getDate();
      if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (months < 0) { years--; months += 12; }
      if(years >= 0) ageStr = `${years} ปี ${months} ด. ${days} ว.`;
  }
  
  cachedUserData.displayAge = ageStr;
  cachedUserData.displayRegDate = regDateDisplay;

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
  
  if(document.getElementById('accountLinkView')) document.getElementById('accountLinkView').style.display = 'none';
  renderStreakUI(data.checkInStreak || 0, data.lastCheckInDate || "");
  loadTransparencyBoard();
  loadMemberTransactionTimeline(document.getElementById('uid').value);
  loadCommunityNews();
  loadMemberRewards();
  document.getElementById('dashboardView').style.display = 'block';
  // เพิ่มบรรทัดนี้เข้าไปครับ
  if(document.getElementById('bottomNavMenu')) document.getElementById('bottomNavMenu').style.display = 'flex';
}

// 📌 SECTION 4: ภารกิจและคะแนนสะสม (Gamification & Check-in)
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

function renderStreakUI(streakCount, lastCheckInStr) {
    const now = new Date(); const todayStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
    for (let i = 1; i <= 7; i++) {
        const circle = document.getElementById(`streak-${i}`); if (!circle) continue;
        circle.classList.remove('active');
        if (i === 7) circle.innerHTML = '<i class="fa-solid fa-gift"></i>'; else circle.innerHTML = i;
        if (i <= streakCount) { circle.classList.add('active'); if (i !== 7) circle.innerHTML = '<i class="fa-solid fa-check"></i>'; }
    }
    const btn = document.getElementById('btnCheckIn');
    if(btn) {
        if (lastCheckInStr === todayStr) { btn.classList.replace('btn-success', 'btn-secondary'); btn.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> เช็คอินแล้ว'; btn.disabled = true; } 
        else { btn.classList.replace('btn-secondary', 'btn-success'); btn.innerHTML = '<i class="fa-solid fa-calendar-check me-1"></i> กดเช็คอินรับแต้มวันนี้'; btn.disabled = false; }
    }
}

// 📌 SECTION 5: กระดานโปร่งใสและไทม์ไลน์ (Transparency & Timeline)
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

// 📌 SECTION 6: เครื่องมือเสริม (QR Scan & Share)
function openShareModal(mode) { currentShareMode = mode; document.getElementById('shareModal').style.display = 'flex'; }
function closeShareModal() { document.getElementById('shareModal').style.display = 'none'; }

async function executeShare(platform) {
    closeShareModal();
    const url = `https://liff.line.me/${LIFF_ID}` + (currentShareMode==='invite' ? `?ref=${cachedUserData.memberId}` : '');
    const text = currentShareMode==='invite' ? 'มาสมัครกองทุนสวัสดิการชุมชนกันเถอะ!' : 'ข่าวสารใหม่จากกองทุนสวัสดิการชุมชน';
    if(platform === 'line') window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + " " + url)}`);
    else if(platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    else { navigator.clipboard.writeText(url); Swal.fire('สำเร็จ', 'คัดลอกลิงก์แล้ว', 'success'); }
}

async function scanToPayAdmin() {
    if (!liff.isLoggedIn()) return Swal.fire('แจ้งเตือน', 'กรุณาเปิดแอปผ่าน LINE เพื่อใช้งานกล้องครับ', 'warning');
    try {
        const result = await liff.scanCodeV2();
        if (result.value) {
            Swal.fire({ title: 'กำลังดึงข้อมูลบิล...', didOpen: () => Swal.showLoading() });
            let qrData; try { qrData = JSON.parse(result.value); } catch (e) { Swal.close(); return Swal.fire('ผิดพลาด', 'QR Code ไม่ถูกต้อง', 'error'); }

            // 🌟 ตรวจสอบว่า Action ตรงกันและมีรหัส Ref
            if ((qrData.action === "member_pay" || qrData.action === "member_pay_bulk") && qrData.ref) {
                const payRef = db.collection("pending_payments").doc(qrData.ref);
                const paySnap = await payRef.get();
                Swal.close();

                if (!paySnap.exists || paySnap.data().status !== "waiting_member_scan") return Swal.fire('หมดอายุ', 'รายการนี้ถูกยืนยันไปแล้ว หรือไม่มีอยู่ในระบบ', 'error');
                const payData = paySnap.data();

                Swal.fire({
                    title: 'ยืนยันการมอบเงินสด',
                    html: `<div class="text-start" style="font-family:'Prompt';"><p class="mb-1 text-muted small">ผู้รับเงิน (กรรมการ):</p><h6 class="fw-bold text-dark"><i class="fa-solid fa-user-tie text-warning me-1"></i> ${payData.adminName}</h6><hr><p class="mb-1 text-muted small">ยอดเงินที่ต้องชำระ:</p><h1 class="fw-bold text-success text-center mb-1">฿${payData.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</h1><p class="small text-danger text-center mt-3"><i class="fa-solid fa-triangle-exclamation"></i> กดยืนยันเมื่อคุณมอบเงินสดให้กรรมการแล้วเท่านั้น</p></div>`,
                    showCancelButton: true, confirmButtonText: 'ยืนยันมอบเงินแล้ว', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
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
            } else { Swal.close(); Swal.fire('Error', 'QR Code นี้ไม่ใช่บิลเรียกเก็บเงินของกองทุน', 'error'); }
        }
    } catch (err) {}
}

// 📌 SECTION 7: ข่าวสารและประกาศชุมชน (Community News)
async function loadCommunityNews() {
    const container = document.getElementById('memberNewsFeed');
    try {
        const snap = await db.collection("news").orderBy("timestamp", "desc").limit(10).get();
        if (snap.empty) {
            container.innerHTML = `<div class="text-center text-muted small py-3 w-100 bg-white rounded-4 border">ยังไม่มีประกาศข่าวสารใหม่</div>`;
            return;
        }
        
        let html = "";
        snap.forEach(doc => {
            const n = doc.data();
            const img = n.imageUrl || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80";
            // 🌟 โชว์ป้ายแจกแต้มที่มุมขวาบนของรูป
            const rewardBadge = (n.rewardPoints > 0) ? `<span class="badge bg-warning text-dark position-absolute top-0 end-0 m-2 shadow-sm" style="font-size: 0.65rem; z-index: 10;"><i class="fa-solid fa-gift"></i> +${n.rewardPoints} แต้ม</span>` : '';
            
            html += `
                <div class="vertical-news-card" onclick="viewNewsDetail('${doc.id}')">
                    <div class="position-relative">
                        ${rewardBadge}
                        <img src="${img}" class="news-img" alt="News">
                    </div>
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

window.viewNewsDetail = async function(newsId) {
    Swal.fire({ title: 'กำลังโหลด...', didOpen: () => Swal.showLoading() });
    try {
        const doc = await db.collection("news").doc(newsId).get();
        if (!doc.exists) return Swal.fire('Error', 'ไม่พบข้อมูลข่าวสาร', 'error');
        
        const n = doc.data();
        const uid = document.getElementById('uid').value || (cachedUserData ? cachedUserData.lineUid : "");
        
        // 🌟 ตรวจสอบสิทธิ์การรับแต้ม
        let unreadReward = false;
        let earnedPoints = 0;
        
        if (n.rewardPoints > 0 && uid) {
            const readByArray = n.readBy || [];
            // ถ้ายังไม่เคยอ่านข่าวนี้ ให้แจกแต้ม
            if (!readByArray.includes(uid)) {
                unreadReward = true;
                earnedPoints = n.rewardPoints;
                
                // อัปเดตฐานข้อมูล 3 ส่วนพร้อมกัน
                const batch = db.batch();
                batch.update(db.collection("news").doc(newsId), { readBy: firebase.firestore.FieldValue.arrayUnion(uid) });
                batch.update(db.collection("members").doc(uid), { cwfPoints: firebase.firestore.FieldValue.increment(earnedPoints) });
                batch.update(db.collection("settings").doc("master"), { globalPointPool: firebase.firestore.FieldValue.increment(-earnedPoints) });
                await batch.commit();
                
                // อัปเดตหน้าจอทันที
                if (cachedUserData) cachedUserData.cwfPoints += earnedPoints;
                const dashCwfPoints = document.getElementById('dashCwfPoints');
                if (dashCwfPoints) dashCwfPoints.innerText = cachedUserData.cwfPoints;
            }
        }

        // ข้อความแสดงความยินดี หากได้แต้ม
        let rewardAlert = unreadReward ? `<div class="alert alert-success py-2 small mb-3 border-0 bg-success bg-opacity-10 text-success fw-bold text-center"><i class="fa-solid fa-gift me-1 fs-5"></i> ยินดีด้วย! คุณได้รับ ${earnedPoints} แต้มจากการอ่านข่าวนี้</div>` : '';

        Swal.fire({
            title: n.title,
            html: `
                <div class="text-start" style="font-family:'Prompt';">
                    ${rewardAlert}
                    <img src="${n.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'}" class="w-100 rounded-3 mb-3" style="max-height: 220px; object-fit: cover; border: 1px solid #E5E7EB;">
                    <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill">${n.category || 'ทั่วไป'}</span>
                        <small class="text-muted"><i class="fa-regular fa-calendar me-1"></i> ${n.dateStr || ''}</small>
                    </div>
                    <p style="font-size: 0.9rem; line-height: 1.6; color: #334155; white-space: pre-wrap;">${n.content}</p>
                </div>
            `,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#2563EB',
            width: '90%',
            padding: '1.5em'
        });
    } catch (e) {
        Swal.fire('Error', 'ไม่สามารถเปิดข่าวสารได้', 'error');
    }
};

// 📌 SECTION 8: ป๊อปอัปข้อมูลส่วนตัว (Profile Popup)
window.maskString = (str) => {
    if (!str) return "-";
    if (str.length <= 4) return str;
    return "*".repeat(str.length - 4) + str.slice(-4);
};

window.showProfilePopup = function() {
    if(!cachedUserData) return;

    const memId = cachedUserData.memberId || "-";
    const memType = cachedUserData.memberType || "สมาชิกสามัญ";
    const age = cachedUserData.displayAge || "-";
    const regDate = cachedUserData.displayRegDate || "-";

    isDataMasked.natId = true;
    isDataMasked.phone = true;

    Swal.fire({
        title: '<i class="fa-solid fa-address-card text-primary me-2"></i> ข้อมูลส่วนตัว',
        html: `
        <div class="text-start mt-3" style="font-family: 'Prompt', sans-serif;">

          <button class="btn btn-primary w-100 rounded-pill fw-bold mb-3 shadow-sm" onclick="openProfileEditor(); Swal.close();">
             <i class="fa-solid fa-user-pen me-2"></i> แก้ไขข้อมูลส่วนตัว
          </button>
          
          <button id="swal-toggle-details-btn" class="btn btn-light w-100 rounded-pill border text-primary fw-bold mb-2 shadow-sm" onclick="toggleProfileDetails()">
             <i class="fa-solid fa-chevron-down me-2" id="swal-toggle-details-icon"></i> แสดงรายละเอียด
          </button>

          <div id="swal-profile-details" style="display: none;">
            <div class="info-list shadow-none mb-0 mt-3">
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
          </div>

        </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-4 px-3 pb-4' }
    });
};

window.toggleProfileDetails = function() {
    const detailsDiv = document.getElementById('swal-profile-details');
    const btn = document.getElementById('swal-toggle-details-btn');
    
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-chevron-up me-2"></i> ซ่อนรายละเอียด';
        btn.classList.replace('btn-light', 'btn-primary');
        btn.classList.replace('text-primary', 'text-white');
    } else {
        detailsDiv.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-chevron-down me-2"></i> แสดงรายละเอียด';
        btn.classList.replace('btn-primary', 'btn-light');
        btn.classList.replace('text-white', 'text-primary');
    }
};

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
// 🎁 SECTION 9: โหลดรายการของรางวัล (Rewards Showcase)
// ============================================================================

async function loadMemberRewards() {
    const container = document.getElementById('memberRewardsFeed');
    if(!container) return;

    try {
        const snap = await db.collection("rewards").orderBy("createdAt", "desc").limit(10).get();
        if (snap.empty) {
            container.innerHTML = `<div class="text-center text-muted small py-3 w-100 bg-white rounded-4 border">ยังไม่มีของรางวัลในขณะนี้</div>`;
            return;
        }

        let html = "";
        snap.forEach(doc => {
            const r = doc.data();
            let stockBadge = r.remaining > 0 
                ? `<span class="badge bg-success position-absolute top-0 end-0 m-2 shadow-sm">เหลือ ${r.remaining}</span>` 
                : `<span class="badge bg-danger position-absolute top-0 end-0 m-2 shadow-sm">หมด</span>`;
            
            let cashTag = (r.cashNeeded > 0) 
                ? `<small class="text-success fw-bold d-block mt-1">+ ${r.cashNeeded} ฿</small>` 
                : '';
            
            let imgUrl = r.imageUrl || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80';

            html += `
                <div class="reward-card" onclick="promptRedeemReward('${doc.id}', '${r.title}', ${r.pointsNeeded}, ${r.cashNeeded || 0}, ${r.remaining})">
                    ${stockBadge}
                    <img src="${imgUrl}" class="reward-img" alt="Reward">
                    <div class="p-2 d-flex flex-column flex-grow-1">
                        <strong class="text-dark d-block text-truncate mb-1" style="font-size: 0.8rem;">${r.title}</strong>
                        <div class="mt-auto">
                            <span class="text-warning fw-bold" style="font-size: 0.85rem;"><i class="fa-solid fa-star"></i> ${r.pointsNeeded} แต้ม</span>
                            ${cashTag}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<div class="text-danger small p-3">โหลดข้อมูลขัดข้อง</div>`;
    }
}

window.promptRedeemReward = function(docId, title, pointsNeeded, cashNeeded, remaining) {
    if (remaining <= 0) {
        return Swal.fire('ขออภัย', 'ของรางวัลชิ้นนี้หมดแล้วครับ', 'warning');
    }

    let msg = `ใช้แต้ม <b>${pointsNeeded} แต้ม</b>`;
    if (cashNeeded > 0) msg += ` และชำระเงินเพิ่ม <b>${cashNeeded} บาท</b>`;

    Swal.fire({
        title: 'ยืนยันการแลกรางวัล',
        html: `คุณต้องการแลก <b>${title}</b><br><span class="text-danger small">${msg}</span><br>ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันการแลก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10B981'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('รับเรื่องแล้ว!', 'คำขอแลกรางวัลถูกส่งให้ส่วนกลางแล้ว โปรดรอการติดต่อกลับ', 'success');
        }
    });
};

// ============================================================================
// ✏️ SECTION 10: ระบบแก้ไขข้อมูลส่วนตัว (Edit Profile)
// ============================================================================

window.openProfileEditor = async function() {
    if (!cachedUserData) return;

    const editVillage = document.getElementById('editVillage');
    const editCenter = document.getElementById('editCenter');
    editVillage.innerHTML = '<option value="" disabled>-- เลือกหมู่บ้าน --</option>';
    editCenter.innerHTML = '';
    (fundSettings.inZoneVillages || []).forEach(v => editVillage.add(new Option(v, v)));
    (fundSettings.centers || []).forEach(c => editCenter.add(new Option(c, c)));

    const d = cachedUserData;
    document.getElementById('editUid').value = document.getElementById('uid').value;
    document.getElementById('editMemId').value = d.memberId || '';
    document.getElementById('editNatId').value = window.maskString(d.nationalId);
    document.getElementById('editPrefix').value = d.prefix || 'นาย';
    document.getElementById('editName').value = d.fullName || '';
    document.getElementById('editBirth').value = d.birthDate || '';
    document.getElementById('editPhone').value = d.phone || '';
    document.getElementById('editEmail').value = d.email || '';
    
    if(d.village) editVillage.value = d.village;
    if(d.center) editCenter.value = d.center;

    document.getElementById('editAddress').value = d.address || '';
    document.getElementById('editLatitude').value = d.latitude || '';
    document.getElementById('editLongitude').value = d.longitude || '';
    document.getElementById('editEdu').value = d.education || '';
    document.getElementById('editOcc').value = d.occupation || '';
    document.getElementById('editInc').value = d.income || '';
    document.getElementById('editFam').value = d.familyMembers || '';
    document.getElementById('editDis').value = d.disabledPersons || '';
    document.getElementById('editHouseT').value = d.houseType || '';
    document.getElementById('editHouseC').value = d.houseCondition || '';
    
    document.getElementById('editBen1N').value = d.beneficiary1_name || '';
    document.getElementById('editBen1R').value = d.beneficiary1_relation || '';
    document.getElementById('editBen2N').value = d.beneficiary2_name || '';
    document.getElementById('editBen2R').value = d.beneficiary2_relation || '';
    document.getElementById('editBen3N').value = d.beneficiary3_name || '';
    document.getElementById('editBen3R').value = d.beneficiary3_relation || '';

    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('editProfileView').style.display = 'block';
    window.scrollTo(0, 0);
};

window.closeProfileEditor = function() {
    document.getElementById('editProfileView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
};

window.updateEditLocation = function(e) {
    e.preventDefault();
    Swal.fire({title: 'กำลังค้นหาพิกัด...', didOpen: () => Swal.showLoading()});
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            document.getElementById('editLatitude').value = position.coords.latitude;
            document.getElementById('editLongitude').value = position.coords.longitude;
            Swal.fire({icon: 'success', title: 'ดึงพิกัดสำเร็จ', timer: 1200, showConfirmButton: false});
        }, () => {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเข้าถึงตำแหน่งได้ โปรดเปิด GPS', 'error');
        });
    } else {
        Swal.fire('ข้อผิดพลาด', 'เบราว์เซอร์ไม่รองรับ GPS', 'error');
    }
};

window.handleProfileUpdate = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitEditBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> กำลังบันทึก...';
    
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    const uid = payload.uid;
    delete payload.uid; 

    try {
        await db.collection("members").doc(uid).update(payload);
        cachedUserData = { ...cachedUserData, ...payload };
        
        closeProfileEditor();
        renderDashboardData(cachedUserData, document.getElementById('userAvatar').src);
        
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ!', text: 'ข้อมูลส่วนตัวของคุณถูกอัปเดตเรียบร้อยแล้ว', confirmButtonColor: '#10B981'});
    } catch(err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-save me-1"></i> บันทึกข้อมูล';
    }
};
// ============================================================================
// 🧾 สร้าง E-Receipt บนมือถือสมาชิก
// ============================================================================
window.generateMemberEReceipt = function(txId, type, amount, date, note, name) {
    AppHelper.showLoader(true, "กำลังสร้างสลิปใบเสร็จ...");
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 850; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const themeColor = '#10B981'; 
    ctx.fillStyle = themeColor; ctx.fillRect(0, 0, canvas.width, 140);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px Prompt, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ใบเสร็จรับเงิน', canvas.width / 2, 85);
    ctx.textAlign = 'left'; ctx.fillStyle = '#475569'; ctx.font = '22px Prompt, sans-serif';
    const fundName = fundSettings?.fundName || "กองทุนสวัสดิการชุมชน";
    
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

    // ... โค้ดด้านบนของฟังก์ชัน generateMemberEReceipt เหมือนเดิม ...

    const imgData = canvas.toDataURL('image/jpeg', 1.0); AppHelper.showLoader(false);
    
    // 🌟 อัปเดตส่วนนี้: เพิ่ม fetch blob เพื่อให้บันทึกบนมือถือผ่าน LINE ได้ 100% 🌟
    Swal.fire({ 
        title: 'ใบเสร็จรับเงิน (E-Slip)', 
        html: '<div class="alert alert-success bg-opacity-10 py-2 small mb-2"><i class="fa-solid fa-hand-pointer me-1 text-success"></i> ผู้ใช้ LINE แตะค้างที่รูปภาพแล้วเลือก <b>"บันทึก"</b> หรือกดปุ่มด้านล่าง</div>',
        imageUrl: imgData, 
        imageWidth: '100%', 
        imageAlt: 'Receipt Image', 
        showCancelButton: true, 
        confirmButtonText: '<i class="fa-solid fa-download"></i> ดาวน์โหลด', 
        cancelButtonText: 'ปิดหน้าต่าง', 
        confirmButtonColor: '#10B981', 
        customClass: { image: 'rounded-4 shadow-sm border' } 
    }).then((res) => { 
        if(res.isConfirmed) { 
            // แปลง Base64 เป็น Blob เพื่อให้ Browser มือถือยอมให้ดาวน์โหลด
            fetch(imgData).then(r => r.blob()).then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a'); 
                link.download = `SmartWelf_Slip_${txId}.jpg`; 
                link.href = url; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                Swal.fire({icon: 'success', title: 'ดาวน์โหลดสลิปสำเร็จ!', showConfirmButton: false, timer: 1500}); 
            });
        } 
    });
};