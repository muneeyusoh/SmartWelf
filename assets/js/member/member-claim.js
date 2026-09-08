// =========================================================
// 🏥 member-claim.js: ควบคุมหน้าขอรับสวัสดิการ (Smart Eligibility Check V2)
// =========================================================

// ❌ ลบ const LIFF_ID_CLAIM ทิ้งไป (เพื่อให้สคริปต์ไปดึงตัวแปร LIFF_ID จาก member-config.js อัตโนมัติ)

document.addEventListener("DOMContentLoaded", async () => {
  try {
      // 🌟 เรียกใช้ตัวแปร LIFF_ID แบบ Global จากไฟล์ตั้งค่า
      await liff.init({ liffId: LIFF_ID }); 
      
      if(liff.isLoggedIn()) {
        const profile = await liff.getProfile(); 
        document.getElementById('uid').value = profile.userId;
        
        // 1. ดึงระเบียบจากส่วนกลาง
        const sysSnap = await db.collection("settings").doc("master").get();
        let fundSettings = {};
        if(sysSnap.exists) { fundSettings = sysSnap.data(); }

        // 2. ดึงข้อมูลส่วนตัวและประวัติสมาชิก
        const docSnap = await db.collection("members").doc(profile.userId).get();
        
        if(docSnap.exists) {
          const userData = docSnap.data();
          document.getElementById('fullName').value = userData.fullName; 
          
          let listHtml = "";
          const rules = fundSettings.welfareRules || []; 
          
          // วนลูปเช็คสวัสดิการแต่ละข้อ
          rules.forEach(r => {
             let conditions = r.conditions || [];
             
             // 🌟 เรียกใช้ฟังก์ชัน Eligibility Engine ประมวลผลสิทธิ์ 🌟
             let eligibility = checkEligibility(conditions, userData, r.name);

             if (eligibility.isEligible) {
                 // ผ่านเกณฑ์: อนุญาตให้กดเข้าไปเบิกได้
                 let maxText = eligibility.maxAllowed > 0 ? `เบิกได้สูงสุด ${eligibility.maxAllowed.toLocaleString()} ฿` : `เข้าเงื่อนไขการเบิก`;

                 listHtml += `<div class="welfare-card eligible" onclick="openForm('${r.name}', ${eligibility.maxAllowed})">
                    <div>
                        <h6 class="mb-1 fw-bold text-dark">${r.name}</h6>
                        <small class="text-primary fw-bold bg-primary bg-opacity-10 px-2 py-1 rounded-pill"><i class="fa-solid fa-check me-1"></i> ${maxText}</small>
                    </div>
                    <div class="icon-box bg-primary bg-opacity-10 rounded-circle text-primary" style="width:30px; height:30px;"><i class="fa-solid fa-chevron-right"></i></div>
                 </div>`;
             } else {
                 // ไม่ผ่านเกณฑ์: ล็อกแม่กุญแจ
                 listHtml += `<div class="welfare-card opacity-75" style="border-left-color: #94A3B8; background: #F1F5F9;" onclick="Swal.fire('ยังไม่เข้าเงื่อนไข', '${eligibility.rejectReason}', 'info')">
                    <div>
                        <h6 class="mb-1 fw-bold text-muted"><i class="fa-solid fa-lock me-1"></i> ${r.name}</h6>
                        <small class="text-danger fw-bold" style="font-size: 0.75rem;">${eligibility.rejectReason}</small>
                    </div>
                    <div class="icon-box bg-light rounded-circle text-muted" style="width:30px; height:30px;"><i class="fa-solid fa-lock"></i></div>
                 </div>`;
             }
          });
          
          if(!listHtml) {
              listHtml = `<div class="text-center text-muted small p-4 bg-white rounded-4 border">แอดมินยังไม่ได้ตั้งระเบียบสวัสดิการ</div>`;
          }

          document.getElementById('welfareList').innerHTML = listHtml;
          document.getElementById('systemLoading').style.display = 'none';
        } else {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบประวัติสมาชิก กรุณาลงทะเบียนผ่านหน้าแรกก่อน', 'error').then(()=>liff.closeWindow());
        }
      } else { 
        liff.login(); 
      }
  } catch(e) {
      document.getElementById('systemLoading').innerHTML = `<h6 class="text-danger">Error: ${e.message}</h6>`;
  }
});

/**
 * 🌟 Eligibility Engine: สมองกลตรวจสอบสิทธิ์คำนวณโควต้ารายปี 🌟
 */
function checkEligibility(conditions, userData, ruleName) {
    let isEligible = true;
    let rejectReason = "";
    let maxPerClaim = 0;     // จ่ายสูงสุดต่อครั้ง
    let maxPerYear = 0;      // จ่ายสูงสุดต่อปี
    let maxTimesPerYear = 0; // จำกัดจำนวนครั้งต่อปี

    // 1. คำนวณอายุการเป็นสมาชิก
    const regDate = userData.registerDateObj ? new Date(userData.registerDateObj) : new Date();
    const now = new Date();
    const diffMonths = (now.getFullYear() - regDate.getFullYear()) * 12 + (now.getMonth() - regDate.getMonth());
    const diffDays = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));
    const diffYears = diffDays / 365;

    // 2. ดึงประวัติการเบิก "สวัสดิการหมวดหมู่นี้" ใน "ปีปัจจุบัน"
    const currentThaiYear = now.getFullYear() + 543;
    let historyThisYear = (userData.welfareHistory || []).filter(h => {
        if(!h.date) return false;
        let parts = h.date.split('/'); // แยก วัน/เดือน/ปี
        return parseInt(parts[2]) === currentThaiYear && h.type === ruleName && h.status !== 'ไม่อนุมัติ';
    });

    // รวมยอดเงินและจำนวนครั้งที่ใช้ไปแล้วในปีนี้
    let totalAmountClaimedThisYear = historyThisYear.reduce((sum, h) => sum + parseFloat(h.amount || 0), 0);
    let totalTimesClaimedThisYear = historyThisYear.length;

    // 3. กวาดอ่านเงื่อนไขที่แอดมินตั้งไว้เพื่อนำมาตรวจสอบ
    for (let c of conditions) {
        let val = parseFloat(c.value) || 0;

        if (c.type === 'จ่ายสูงสุดต่อครั้ง') maxPerClaim = val;
        if (c.type === 'จ่ายสูงสุดต่อปี') maxPerYear = val;
        if (c.type === 'จำกัดจำนวนครั้งต่อปี') maxTimesPerYear = val;

        // ตรวจสอบอายุการเป็นสมาชิกขั้นต่ำ
        if (c.type === 'อายุการเป็นสมาชิกขั้นต่ำ' && isEligible) {
            if (c.unit === 'เดือน' && diffMonths < val) { isEligible = false; rejectReason = `ต้องเป็นสมาชิกอย่างน้อย ${val} ${c.unit}`; }
            else if (c.unit === 'ปี' && diffYears < val) { isEligible = false; rejectReason = `ต้องเป็นสมาชิกอย่างน้อย ${val} ${c.unit}`; }
            else if (c.unit === 'วัน' && diffDays < val) { isEligible = false; rejectReason = `ต้องเป็นสมาชิกอย่างน้อย ${val} ${c.unit}`; }
        }

        // ตรวจสอบกลุ่มเปราะบาง
        if (c.type === 'เฉพาะกลุ่มเปราะบาง' && isEligible) {
            if (!userData.vulnerability || userData.vulnerability === 'ปกติ' || userData.vulnerability === '') {
                isEligible = false; rejectReason = `สงวนสิทธิ์เฉพาะสมาชิกกลุ่มเปราะบางเท่านั้น`;
            }
        }
    }

    // 4. ตรวจสอบโควต้าการใช้สิทธิ์รายปี (ประมวลผลต่อเมื่อผ่านเงื่อนไขด้านบนมาแล้ว)
    if (isEligible) {
        if (maxTimesPerYear > 0 && totalTimesClaimedThisYear >= maxTimesPerYear) {
            isEligible = false;
            rejectReason = `ใช้สิทธิ์ครบโควต้า ${maxTimesPerYear} ครั้ง/ปี แล้ว`;
        } else if (maxPerYear > 0 && totalAmountClaimedThisYear >= maxPerYear) {
            isEligible = false;
            rejectReason = `เบิกครบวงเงินสูงสุด ${maxPerYear.toLocaleString()} บาท/ปี แล้ว`;
        }
    }

    // 5. คำนวณเพดานยอดเงินที่กดเบิกได้ในครั้งนี้แบบยืดหยุ่น (Dynamic Max Allowed)
    let maxAllowed = maxPerClaim; // เริ่มต้นที่เพดานต่อครั้ง
    if (maxPerYear > 0) {
        let remainingYearlyBudget = maxPerYear - totalAmountClaimedThisYear;
        // ถ้ายอดคงเหลือทั้งปี น้อยกว่ายอดเบิกสูงสุดต่อครั้ง ให้ปรับเพดานลงมาเท่ายอดคงเหลือ
        if (remainingYearlyBudget < maxAllowed || maxAllowed === 0) {
            maxAllowed = remainingYearlyBudget;
        }
    }

    return { isEligible, rejectReason, maxAllowed };
}

// ---------------------------------------------------------
// UI Actions (การควบคุมหน้าจอขอเบิก)
// ---------------------------------------------------------
function openForm(name, max) {
  document.getElementById('welfareListSection').style.display='none'; 
  document.getElementById('claimFormSection').style.display='block';
  
  document.getElementById('titleWelfare').innerText = name; 
  document.getElementById('welfareName').value = name;
  document.getElementById('claimMaxBadge').innerHTML = max > 0 ? `<i class="fa-solid fa-circle-info"></i> เบิกได้สูงสุด ${parseFloat(max).toLocaleString()} บาท` : '';
  
  // ล็อกเพดานตัวเลขในกล่อง input ไม่ให้กรอกเกินสิทธิ์
  if(max > 0) document.getElementById('claimAmount').max = max;
  else document.getElementById('claimAmount').removeAttribute('max');

  if(name.includes('เจ็บป่วย') || name.includes('รพ') || name.includes('รักษา')) {
      document.getElementById('sicknessSection').style.display = 'block';
      document.getElementById('diseaseCategory').required = true;
      document.getElementById('hospitalName').required = true;
  } else {
      document.getElementById('sicknessSection').style.display = 'none';
      document.getElementById('diseaseCategory').required = false;
      document.getElementById('hospitalName').required = false;
  }
  window.scrollTo(0,0);
}

function goBack() { 
    document.getElementById('welfareListSection').style.display='block'; 
    document.getElementById('claimFormSection').style.display='none'; 
}

function convertImg(input) { 
  const f = input.files[0]; if (!f) return;
  document.getElementById('fileNameDisplay').innerHTML = `<span class="text-success fw-bold"><i class="fa-solid fa-check-circle"></i> เลือกไฟล์แล้ว: ${f.name}</span>`;
  const reader = new FileReader(); reader.onload = function(e) {
    const img = new Image(); img.onload = function() {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      const MAX_WIDTH = 1000; const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      document.getElementById('docBase64').value = canvas.toDataURL('image/jpeg', 0.6);
    }; img.src = e.target.result;
  }; reader.readAsDataURL(f); 
}

async function submitClaim(e) {
  e.preventDefault(); 
  const btn = document.getElementById('submitBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังส่งเอกสาร...';
  
  const formDataObj = Object.fromEntries(new FormData(e.target));
  const d = new Date(); const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
  
  const claimData = {
      uid: formDataObj.uid, 
      fullName: formDataObj.fullName, 
      claimType: formDataObj.welfareName, 
      claimAmount: parseFloat(formDataObj.claimAmount), 
      evidenceUrl: formDataObj.docBase64 || null, 
      disease: formDataObj.diseaseCategory || null, 
      hospital: formDataObj.hospitalName || null,
      status: "รอตรวจสอบ", 
      dateStr: dateStr, 
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("claims").add(claimData);
    Swal.fire({ title: 'ส่งเอกสารสำเร็จ', text: 'คณะกรรมการจะตรวจสอบเอกสารและแจ้งผลให้ทราบ', icon: 'success', confirmButtonColor: '#2563EB' }).then(()=>liff.closeWindow());
  } catch(err) { 
      btn.disabled = false; btn.innerHTML = 'ยืนยันส่งคำขอตรวจสอบ'; 
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งข้อมูล: ' + err.message, 'error');
  }
}