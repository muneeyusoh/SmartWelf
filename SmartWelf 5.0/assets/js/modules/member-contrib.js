// =========================================================
// 💸 member-contrib.js: ควบคุมหน้าสมทบเงิน (contribution.html)
// =========================================================
const LIFF_ID_CONTRIB = "2011183541-lPBacDBx";
let annualFee = 365;

document.addEventListener("DOMContentLoaded", async () => {
  try {
      await liff.init({ liffId: LIFF_ID_CONTRIB }); 
      if(liff.isLoggedIn()) {
        const profile = await liff.getProfile(); 
        document.getElementById('uid').value = profile.userId;
        
        const sysSnap = await db.collection("settings").doc("master").get();
        if(sysSnap.exists) {
            annualFee = sysSnap.data().annualFee || 365;
            document.getElementById('annualFeeText').innerText = annualFee.toLocaleString();
        }

        const docRef = db.collection("members").doc(profile.userId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const d = docSnap.data();
            document.getElementById('fullName').value = d.fullName;
            document.getElementById('memberCenter').value = d.center || "ไม่ระบุศูนย์";
            
            const total = d.totalContribution || 0;
            document.getElementById('dashTotalContrib').innerText = total.toLocaleString('en-US', {minimumFractionDigits: 2});
            
            let debt = (d.outstandingBalance !== undefined) ? d.outstandingBalance : (annualFee - total);
            if (debt < 0) debt = 0;
            
            document.getElementById('debtText').innerText = debt.toLocaleString('en-US', {minimumFractionDigits: 2});
            
            let percent = (total / annualFee) * 100;
            if (percent > 100) percent = 100;
            document.getElementById('progressBar').style.width = percent + "%";
            
            if (debt > 0) {
                document.getElementById('statusBadge').innerText = "ค้างชำระ";
                document.getElementById('statusBadge').classList.replace('text-success', 'text-warning');
            }

            const adminSnap = await db.collection("admins").where("status", "==", "ใช้งาน").get();
            const select = document.getElementById('committeeSelect');
            select.innerHTML = '<option value="" disabled selected>-- เลือกกรรมการผู้รับเงิน --</option>';
            
            if(d.responsibleAdmin && d.responsibleAdmin !== "ไม่มีผู้ดูแล") {
                select.innerHTML += `<option value="${d.responsibleAdmin}">⭐ ${d.responsibleAdmin} (กรรมการประจำสาย)</option>`;
            }
            adminSnap.forEach(a => { 
                if(a.data().name !== d.responsibleAdmin) {
                    select.innerHTML += `<option value="${a.data().name}">${a.data().name}</option>`; 
                }
            });

            document.getElementById('systemLoading').style.display = 'none';
        } else {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อน', 'error').then(()=> liff.closeWindow());
        }
      } else { liff.login(); }
  } catch(e) {
      document.getElementById('systemLoading').innerHTML = `<h6 class="text-danger">Error: ${e.message}</h6>`;
  }
});

function togglePaymentSection() {
  const pType = document.querySelector('input[name="paymentType"]:checked').value;
  const lblT = document.getElementById('lblTransfer'); const lblC = document.getElementById('lblCash');
  
  lblT.classList.remove('active'); lblC.classList.remove('active');
  lblT.querySelector('.check-icon').classList.replace('text-primary', 'text-muted');
  lblT.querySelector('.check-icon').classList.add('opacity-25');
  lblC.querySelector('.check-icon').classList.replace('text-primary', 'text-muted');
  lblC.querySelector('.check-icon').classList.add('opacity-25');

  if (pType === 'transfer') { 
      lblT.classList.add('active'); 
      lblT.querySelector('.check-icon').classList.replace('text-muted', 'text-primary');
      lblT.querySelector('.check-icon').classList.remove('opacity-25');
      document.getElementById('transferSection').style.display='block'; 
      document.getElementById('cashSection').style.display='none'; 
      document.getElementById('committeeSelect').required = false;
  } else { 
      lblC.classList.add('active'); 
      lblC.querySelector('.check-icon').classList.replace('text-muted', 'text-primary');
      lblC.querySelector('.check-icon').classList.remove('opacity-25');
      document.getElementById('transferSection').style.display='none'; 
      document.getElementById('cashSection').style.display='block'; 
      document.getElementById('committeeSelect').required = true;
  }
}

function convertImg(input) { 
  const f = input.files[0]; if (!f) return;
  const reader = new FileReader(); reader.onload = function(e) {
    const img = new Image(); img.onload = function() {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      document.getElementById('slipBase64').value = canvas.toDataURL('image/jpeg', 0.6); 
    }; img.src = e.target.result;
  }; reader.readAsDataURL(f); 
}

async function submitContrib(e) {
  e.preventDefault(); 
  
  const formDataObj = Object.fromEntries(new FormData(e.target));
  
  if (formDataObj.paymentType === 'transfer' && !formDataObj.slipBase64) {
      Swal.fire('แจ้งเตือน', 'กรุณาแนบรูปภาพสลิปโอนเงินครับ', 'warning');
      return;
  }

  const btn = document.getElementById('submitBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังส่งข้อมูล...';
  
  const d = new Date(); 
  const txIdString = "TX" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2,'0');
  
  let noteText = "ทำรายการด้วยตนเองผ่านมือถือ";
  if(formDataObj.paymentType === 'cash') noteText = `ฝากเงินสดผ่านกรรมการ: ${formDataObj.committeeName}`;

  const txData = {
      txId: txIdString,
      uid: formDataObj.uid, 
      fullName: formDataObj.fullName, 
      type: "สมทบเงินกองทุน", 
      amount: parseFloat(formDataObj.amount),
      paymentMethod: formDataObj.paymentType === 'transfer' ? "ธนาคาร" : "เงินสด", 
      status: "รอตรวจสอบ", 
      transactionDate: d.toISOString().split('T')[0], 
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      note: noteText,
      evidenceUrl: formDataObj.slipBase64 || null 
  };

  try {
    await db.collection("transactions").doc(txIdString).set(txData);
    Swal.fire({ title: 'ส่งข้อมูลสำเร็จ!', text: 'กรุณารอแอดมินตรวจสอบยอดเงิน', icon: 'success', confirmButtonColor: '#2563EB' }).then(()=>liff.closeWindow());
  } catch (err) { 
    btn.disabled = false; btn.innerHTML = 'ยืนยันทำรายการ'; 
    Swal.fire('Error', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
  }
}