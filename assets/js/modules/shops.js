// =========================================================
// 🏪 shops.js: โมดูลจัดการร้านค้าสวัสดิการชุมชน
// =========================================================

/**
 * ฟังก์ชัน: โหลดรายชื่อร้านค้าทั้งหมดจาก Firestore
 * หน้าที่: ดึงข้อมูลร้านค้ามาแยกเป็น 2 กลุ่ม (รออนุมัติ และ อนุมัติแล้ว) และแสดงผลเป็นการ์ด
 */
async function loadAdminShops() {
  showLoader(true, "กำลังโหลดข้อมูลร้านค้า...");
  try {
    const snap = await db.collection("shops").orderBy("timestamp", "desc").get();
    let pendingHtml = "";
    let approvedHtml = "";
    
    snap.forEach(doc => {
      const s = doc.data();
      
      // 🌟 สร้าง Badge สำหรับหมวดหมู่ย่อย (ถ้าผู้ใช้กรอกมา ให้แสดง ถ้าไม่กรอกก็ซ่อนไว้)
      const subCategoryBadge = s.subCategory 
        ? `<span class="badge bg-secondary bg-opacity-10 text-secondary border shadow-sm ms-1">${s.subCategory}</span>` 
        : '';

      const card = `
        <div class="admin-card p-3 mb-2 d-flex justify-content-between align-items-center">
          <div>
            <h6 class="fw-bold text-dark mb-1">
                ${s.shopName} 
                <span class="badge bg-light text-dark border shadow-sm">${s.category}</span>
                ${subCategoryBadge} <!-- แสดงหมวดหมู่ย่อยตรงนี้ -->
            </h6>
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
  } catch(e) { 
    showLoader(false); console.error(e); 
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้', 'error');
  }
}

/**
 * ฟังก์ชัน: อัปเดตสถานะร้านค้า
 * หน้าที่: เปลี่ยนสถานะของร้านค้าในฐานข้อมูล (เช่น จาก รออนุมัติ เป็น อนุมัติแล้ว)
 */
async function updateShopStatus(shopUid, newStatus) {
  showLoader(true, "กำลังอัปเดตสถานะร้านค้า...");
  try {
    // สั่งอัปเดตฟิลด์ status ใน Firestore
    await db.collection("shops").doc(shopUid).update({ status: newStatus });
    
    // บันทึกประวัติการทำงาน (Audit Log) ถ้ามีฟังก์ชันนี้อยู่ในระบบ
    if(typeof createAuditLog === 'function') {
        createAuditLog('SHOP_STATUS', `เปลี่ยนสถานะร้านค้า UID ${shopUid} เป็น ${newStatus}`);
    }
    
    showLoader(false);
    Swal.fire({ icon: 'success', title: 'อัปเดตสถานะสำเร็จ', timer: 1200, showConfirmButton: false });
    
    // โหลดข้อมูลใหม่เพื่อรีเฟรชหน้าจอ
    loadAdminShops();
  } catch(e) { 
    showLoader(false); 
    Swal.fire('Error', e.message, 'error'); 
  }
}