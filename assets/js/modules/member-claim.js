// =========================================================
// 🏥 member-claim.js: ควบคุมหน้าขอรับสวัสดิการ (claim.html)
// =========================================================
const LIFF_ID_CLAIM = "2011183541-uvW1j86T"; 

document.addEventListener("DOMContentLoaded", async () => {
  try {
      await liff.init({ liffId: LIFF_ID_CLAIM }); 
      if(liff.isLoggedIn()) {
        const profile = await liff.getProfile(); 
        document.getElementById('uid').value = profile.userId;
        const docSnap = await db.collection("members").doc(profile.userId).get();
        
        if(docSnap.exists) {
          document.getElementById('fullName').value = docSnap.data().fullName; 
          
          const rulesSnap = await db.collection("rules").get();
          let listHtml = "";
          rulesSnap.forEach(r => {
             const d = r.data();
             listHtml += `<div class="welfare-card eligible" onclick="openForm('${d.name}', ${d.maxPerClaim})">
                <div>
                    <h6 class="mb-1 fw-bold text-dark">${d.name}</h6>
                    <small class="text-primary fw-bold bg-primary bg-opacity-10 px-2 py-1 rounded-pill">สูงสุด ${parseFloat(d.maxPerClaim).toLocaleString()} ฿</small>
                </div>
                <div class="icon-box bg-light rounded-circle text-muted" style="width:30px; height:30px;"><i class="fa-solid fa-chevron-right"></i></div>
             </div>`;
          });
          
          if(!listHtml) {
              listHtml = `
              <div class="welfare-card eligible" onclick="openForm('สวัสดิการเจ็บป่วย (นอน รพ.)', 1000)">
                  <div><h6 class="mb-1 fw-bold text-dark">สวัสดิการเจ็บป่วย</h6><small class="text-primary fw-bold bg-primary bg-opacity-10 px-2 py-1 rounded-pill">สูงสุด 1,000 ฿</small></div>
                  <div class="icon-box bg-light rounded-circle text-muted" style="width:30px; height:30px;"><i class="fa-solid fa-chevron-right"></i></div>
              </div>
              <div class="welfare-card eligible" onclick="openForm('สวัสดิการเสียชีวิต', 10000)">
                  <div><h6 class="mb-1 fw-bold text-dark">สวัสดิการเสียชีวิต</h6><small class="text-primary fw-bold bg-primary bg-opacity-10 px-2 py-1 rounded-pill">สูงสุด 10,000 ฿</small></div>
                  <div class="icon-box bg-light rounded-circle text-muted" style="width:30px; height:30px;"><i class="fa-solid fa-chevron-right"></i></div>
              </div>`;
          }
          document.getElementById('welfareList').innerHTML = listHtml;
          document.getElementById('systemLoading').style.display = 'none';
        } else {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบประวัติสมาชิก กรุณาลงทะเบียนก่อน', 'error').then(()=>liff.closeWindow());
        }
      } else { liff.login(); }
  } catch(e) {
      document.getElementById('systemLoading').innerHTML = `<h6 class="text-danger">Error: ${e.message}</h6>`;
  }
});

function openForm(name, max) {
  document.getElementById('welfareListSection').style.display='none'; 
  document.getElementById('claimFormSection').style.display='block';
  
  document.getElementById('titleWelfare').innerText = name; 
  document.getElementById('welfareName').value = name;
  document.getElementById('claimMaxBadge').innerHTML = `<i class="fa-solid fa-circle-info"></i> เบิกได้สูงสุด ${parseFloat(max).toLocaleString()} บาท`;
  document.getElementById('claimAmount').max = max;

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
      evidenceUrl: formDataObj.docBase64, 
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
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งข้อมูล', 'error');
  }
}