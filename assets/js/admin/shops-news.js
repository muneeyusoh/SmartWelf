// =========================================================
// 📰 shops-news.js: โมดูลข่าวสารและประกาศชุมชน (Read-to-Earn)
// =========================================================

window.loadAdminNews = async function() {
  AppHelper.showLoader(true, "กำลังโหลดข่าวสาร...");
  try {
    const snap = await db.collection("news").orderBy("timestamp", "desc").get();
    const container = document.getElementById('list-admin-news');
    if (!container) { AppHelper.showLoader(false); return; }
    
    if (snap.empty) {
      container.innerHTML = '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-newspaper fs-3 mb-2 d-block opacity-50"></i>ยังไม่มีประกาศข่าวสาร</div>';
      AppHelper.showLoader(false); return;
    }
    
    let html = "";
    snap.forEach(doc => {
      const n = doc.data();
      const img = n.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=200&q=80';
      const pointsTag = n.rewardPoints > 0 ? `<span class="badge bg-warning text-dark ms-2"><i class="fa-solid fa-star"></i> แจก ${n.rewardPoints} แต้ม</span>` : '';
      const readCount = n.readBy ? n.readBy.length : 0;

      html += `
        <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3 w-100 pe-3">
            <img src="${img}" class="rounded-3 shadow-sm flex-shrink-0" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #E2E8F0;">
            <div style="min-width: 0;">
              <strong class="text-dark d-block text-truncate" style="font-size: 0.95rem;">${n.title}</strong>
              <small class="text-muted d-block text-truncate"><i class="fa-regular fa-calendar me-1"></i> ${n.dateStr || ''} | หมวด: ${n.category || 'ทั่วไป'} ${pointsTag}</small>
              <small class="text-success" style="font-size: 0.7rem;"><i class="fa-solid fa-eye me-1"></i> อ่านแล้ว ${readCount} คน</small>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-danger rounded-circle p-2 flex-shrink-0" style="width:35px; height:35px;" onclick="window.deleteAdminNews('${doc.id}')" title="ลบข่าวสาร">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>`;
    });
    container.innerHTML = html;
    AppHelper.showLoader(false);
  } catch(e) { AppHelper.showLoader(false); console.error(e); }
};

window.openCreateNewsModal = function() {
  Swal.fire({
    title: 'สร้างประกาศข่าวสาร',
    html: `
      <div class="text-start" style="font-family:'Prompt';">
          <label class="small fw-bold text-muted mb-1">หัวข้อประกาศ *</label>
          <input type="text" id="postNewsTitle" class="form-control mb-3" placeholder="เช่น แจ้งกำหนดการประชุม">
          
          <div class="row g-2 mb-3">
             <div class="col-7">
                <label class="small fw-bold text-muted mb-1">หมวดหมู่</label>
                <select id="postNewsCat" class="form-select">
                  <option value="ประชาสัมพันธ์">ประชาสัมพันธ์ทั่วไป</option>
                  <option value="ข่าวกองทุน">ข่าวกองทุน/การเงิน</option>
                  <option value="กิจกรรมชุมชน">กิจกรรมชุมชน</option>
                </select>
             </div>
             <div class="col-5">
                <label class="small fw-bold text-muted mb-1">แจกแต้มผู้อ่าน <i class="fa-solid fa-star text-warning"></i></label>
                <input type="number" id="postNewsPoints" class="form-control text-success fw-bold" placeholder="0" value="0">
             </div>
          </div>
          
          <label class="small fw-bold text-muted mb-2"><i class="fa-solid fa-camera text-primary"></i> อัปโหลดรูปภาพ / แนบลิงก์</label>
          <div class="mb-2 p-3 bg-light rounded-4 border border-primary border-opacity-25 text-center cursor-pointer" onclick="document.getElementById('postNewsFileInput').click()">
              <i class="fa-solid fa-cloud-arrow-up fs-3 text-primary mb-2 d-block"></i>
              <span class="small fw-bold text-primary" id="newsFileName">แตะเพื่อเลือกรูปจากมือถือ</span>
          </div>
          <input type="file" id="postNewsFileInput" class="d-none" accept="image/*" onchange="window.convertNewsImg(this)">
          <input type="hidden" id="postNewsBase64">
          
          <div class="text-center mb-2"><small class="text-muted">หรือแนบลิงก์ (URL) แทน</small></div>
          <input type="text" id="postNewsImg" class="form-control mb-3" placeholder="https://...">
          
          <label class="small fw-bold text-muted mb-1">เนื้อหาข่าวสาร *</label>
          <textarea id="postNewsContent" class="form-control" rows="4" placeholder="พิมพ์รายละเอียดข่าวสารที่นี่..."></textarea>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-paper-plane me-1"></i> เผยแพร่',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#2563EB',
    preConfirm: () => {
      const title = document.getElementById('postNewsTitle').value.trim();
      const content = document.getElementById('postNewsContent').value.trim();
      const rewardPoints = parseInt(document.getElementById('postNewsPoints').value) || 0;
      const base64Img = document.getElementById('postNewsBase64').value;
      const urlImg = document.getElementById('postNewsImg').value.trim();

      if (!title || !content) {
          Swal.showValidationMessage('กรุณากรอกหัวข้อและเนื้อหาข่าวให้ครบถ้วน');
          return false;
      }
      return {
        title: title, 
        category: document.getElementById('postNewsCat').value,
        imageUrl: base64Img || urlImg || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80',
        content: content,
        rewardPoints: rewardPoints,
        readBy: [] // 🌟 สร้าง Array เก็บ UID ของคนที่อ่านแล้ว (กันการรับแต้มซ้ำ)
      };
    }
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังเผยแพร่ข่าวสาร...");
      const d = new Date();
      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
      
      try {
          await db.collection("news").add({ ...res.value, dateStr: dateStr, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
          if(typeof window.createAuditLog === 'function') window.createAuditLog('POST_NEWS', `สร้างประกาศข่าวเรื่อง: ${res.value.title}`);
          AppHelper.showLoader(false);
          Swal.fire('สำเร็จ', 'เผยแพร่ข่าวสารให้สมาชิกเห็นแล้ว', 'success');
          window.loadAdminNews();
      } catch (e) { AppHelper.showLoader(false); Swal.fire('Error', 'ไม่สามารถเผยแพร่ได้', 'error'); }
    }
  });
};

// 🌟 ฟังก์ชันแปลงรูปภาพเป็น Base64
window.convertNewsImg = function(input) {
    const f = input.files[0]; if (!f) return;
    document.getElementById('newsFileName').innerHTML = `<span class="text-success fw-bold"><i class="fa-solid fa-check-circle"></i> เลือกไฟล์แล้ว: ${f.name}</span>`;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            document.getElementById('postNewsBase64').value = canvas.toDataURL('image/jpeg', 0.7); // ย่อขนาดไฟล์กันล้น
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(f);
};

window.deleteAdminNews = async function(newsId) {
  Swal.fire({ 
      title: 'ยืนยันการลบประกาศ?', text: "ข่าวสารนี้จะหายไปจากแอปพลิเคชันของสมาชิก", icon: 'warning', 
      showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ลบข่าวสาร'
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังลบ...");
      try {
          await db.collection("news").doc(newsId).delete();
          AppHelper.showLoader(false); window.loadAdminNews();
      } catch(e) { AppHelper.showLoader(false); Swal.fire('Error', 'เกิดข้อผิดพลาดในการลบ', 'error'); }
    }
  });
};