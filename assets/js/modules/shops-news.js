// =========================================================
// 🏪 shops-news.js: จัดการร้านค้าสวัสดิการชุมชน และข่าวสาร
// =========================================================
async function loadAdminShops() {
  showLoader(true, "กำลังโหลดข้อมูลร้านค้า...");
  try {
    const snap = await db.collection("shops").orderBy("timestamp", "desc").get();
    let pendingHtml = "", approvedHtml = "";
    
    snap.forEach(doc => {
      const s = doc.data();
      const card = `
        <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
          <div>
            <h6 class="fw-bold text-dark mb-1">${s.shopName} <span class="badge bg-light text-dark border shadow-sm">${s.category}</span></h6>
            <small class="text-muted d-block"><i class="fa-solid fa-user text-secondary me-1"></i>เจ้าของ: ${s.ownerName} | โทร: <a href="tel:${s.phone}" class="text-decoration-none">${s.phone}</a></small>
            <small class="text-muted"><i class="fa-solid fa-location-dot text-danger me-1"></i>${s.description || 'ไม่ระบุทำเล'}</small>
          </div>
          <div class="d-flex flex-column gap-2 text-end">
            ${s.status === 'รออนุมัติ' ? `
              <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="updateShopStatus('${doc.id}', 'อนุมัติแล้ว')"><i class="fa-solid fa-check"></i> อนุมัติ</button>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-2" onclick="updateShopStatus('${doc.id}', 'ระงับ')">ปฏิเสธ</button>
            ` : `
              <span class="badge ${s.status === 'อนุมัติแล้ว' ? 'bg-success' : 'bg-danger'} rounded-pill shadow-sm py-2 px-3">${s.status}</span>
              <button class="btn btn-sm btn-light text-muted border rounded-pill px-2" onclick="updateShopStatus('${doc.id}', '${s.status === 'อนุมัติแล้ว' ? 'ระงับ' : 'อนุมัติแล้ว'}')"><i class="fa-solid fa-rotate"></i> เปลี่ยนสถานะ</button>
            `}
          </div>
        </div>`;
      
      if (s.status === 'รออนุมัติ') pendingHtml += card;
      else approvedHtml += card;
    });

    document.getElementById('list-pending-shops').innerHTML = pendingHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-check-circle fs-3 text-success mb-2 d-block opacity-50"></i>ไม่มีคำขอเปิดร้านรอตรวจสอบ</div>';
    document.getElementById('list-approved-shops').innerHTML = approvedHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-store-slash fs-3 mb-2 d-block opacity-50"></i>ยังไม่มีร้านค้าในระบบ</div>';
    showLoader(false);
  } catch(e) { showLoader(false); console.error(e); }
}

async function updateShopStatus(shopUid, newStatus) {
  showLoader(true, "กำลังอัปเดตสถานะร้านค้า...");
  try {
    await db.collection("shops").doc(shopUid).update({ status: newStatus });
    if(typeof createAuditLog === 'function') createAuditLog('SHOP_STATUS', `เปลี่ยนสถานะร้านค้า UID ${shopUid} เป็น ${newStatus}`);
    showLoader(false);
    Swal.fire({ icon: 'success', title: 'อัปเดตสถานะสำเร็จ', timer: 1200, showConfirmButton: false });
    loadAdminShops();
  } catch(e) { showLoader(false); Swal.fire('Error', e.message, 'error'); }
}

async function loadAdminNews() {
  showLoader(true, "กำลังโหลดข่าวสาร...");
  try {
    const snap = await db.collection("news").orderBy("timestamp", "desc").get();
    const container = document.getElementById('list-admin-news');
    if (snap.empty) {
      container.innerHTML = '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-newspaper fs-3 mb-2 d-block opacity-50"></i>ยังไม่มีประกาศข่าวสาร</div>';
      showLoader(false);
      return;
    }
    let html = "";
    snap.forEach(doc => {
      const n = doc.data();
      const img = n.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=200&q=80';
      html += `
        <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3 w-100 pe-3">
            <img src="${img}" class="rounded-3 shadow-sm flex-shrink-0" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #E2E8F0;">
            <div style="min-width: 0;">
              <strong class="text-dark d-block text-truncate" style="font-size: 0.95rem;">${n.title}</strong>
              <small class="text-muted d-block text-truncate"><i class="fa-regular fa-calendar me-1"></i> ${n.dateStr || ''} | หมวด: ${n.category || 'ทั่วไป'}</small>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-danger rounded-circle p-2 flex-shrink-0" style="width:35px; height:35px;" onclick="deleteAdminNews('${doc.id}')" title="ลบข่าวสาร">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>`;
    });
    container.innerHTML = html;
    showLoader(false);
  } catch(e) { showLoader(false); console.error(e); }
}

function openCreateNewsModal() {
  Swal.fire({
    title: 'สร้างประกาศข่าวสาร',
    html: `
      <div class="text-start" style="font-family:'Prompt';">
          <label class="small fw-bold text-muted mb-1">หัวข้อประกาศ *</label>
          <input type="text" id="postNewsTitle" class="form-control mb-3" placeholder="เช่น แจ้งกำหนดการประชุม">
          
          <label class="small fw-bold text-muted mb-1">หมวดหมู่</label>
          <select id="postNewsCat" class="form-select mb-3">
            <option value="ประชาสัมพันธ์">ประชาสัมพันธ์ทั่วไป</option>
            <option value="ข่าวกองทุน">ข่าวกองทุน/การเงิน</option>
            <option value="กิจกรรมชุมชน">กิจกรรมชุมชน</option>
          </select>
          
          <label class="small fw-bold text-muted mb-1">URL รูปภาพ (แนบลิงก์รูปภาพ)</label>
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
      if (!title || !content) {
          Swal.showValidationMessage('กรุณากรอกหัวข้อและเนื้อหาข่าวให้ครบถ้วน');
          return false;
      }
      return {
        title: title,
        category: document.getElementById('postNewsCat').value,
        imageUrl: document.getElementById('postNewsImg').value.trim() || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80',
        content: content
      };
    }
  }).then(async res => {
    if (res.isConfirmed) {
      showLoader(true, "กำลังเผยแพร่ข่าวสาร...");
      const d = new Date();
      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
      
      try {
          await db.collection("news").add({
            ...res.value,
            dateStr: dateStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          if(typeof createAuditLog === 'function') createAuditLog('POST_NEWS', `สร้างประกาศข่าวเรื่อง: ${res.value.title}`);
          showLoader(false);
          Swal.fire('สำเร็จ', 'เผยแพร่ข่าวสารให้สมาชิกเห็นแล้ว', 'success');
          loadAdminNews();
      } catch (e) {
          showLoader(false);
          Swal.fire('Error', 'ไม่สามารถเผยแพร่ได้', 'error');
      }
    }
  });
}

async function deleteAdminNews(newsId) {
  Swal.fire({ 
      title: 'ยืนยันการลบประกาศ?', 
      text: "ข่าวสารนี้จะหายไปจากแอปพลิเคชันของสมาชิก",
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'ลบข่าวสาร'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoader(true, "กำลังลบ...");
      try {
          await db.collection("news").doc(newsId).delete();
          showLoader(false);
          loadAdminNews();
      } catch(e) {
          showLoader(false);
          Swal.fire('Error', 'เกิดข้อผิดพลาดในการลบ', 'error');
      }
    }
  });
}