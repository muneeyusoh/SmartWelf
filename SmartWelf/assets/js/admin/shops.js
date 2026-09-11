// =========================================================
// 🏪 shops.js: โมดูลจัดการร้านค้าสวัสดิการและสินค้าชุมชน (Admin Edition)
// =========================================================

window.loadAdminShops = async function() {
  AppHelper.showLoader(true, "กำลังโหลดข้อมูลร้านค้า...");
  try {
    const snap = await db.collection("shops").orderBy("timestamp", "desc").get();
    let pendingHtml = "";
    let approvedHtml = "";
    
    snap.forEach(doc => {
      const s = doc.data();
      const shopId = doc.id;
      
      const subCategoryBadge = s.subCategory 
        ? `<span class="badge bg-secondary bg-opacity-10 text-secondary border shadow-sm ms-1">${s.subCategory}</span>` 
        : '';

      const card = `
        <div class="admin-card p-3 mb-3 bg-white rounded-4 border shadow-sm">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h6 class="fw-bold text-dark mb-1">
                  <i class="fa-solid fa-store text-success me-1"></i> ${s.shopName} 
                  <span class="badge bg-light text-dark border shadow-sm ms-1">${s.category || 'ทั่วไป'}</span>
                  ${subCategoryBadge}
              </h6>
              <small class="text-muted d-block"><i class="fa-solid fa-user text-secondary me-1"></i>เจ้าของ: ${s.ownerName} | โทร: <a href="tel:${s.phone}" class="text-decoration-none">${s.phone}</a></small>
              <small class="text-muted d-block"><i class="fa-solid fa-location-dot text-danger me-1"></i>${s.description || 'ไม่ระบุทำเล'}</small>
            </div>
            <div class="d-flex flex-column gap-1 text-end">
              ${s.status === 'รออนุมัติ' ? `
                <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="window.updateShopStatus('${shopId}', 'อนุมัติแล้ว')"><i class="fa-solid fa-check"></i> อนุมัติ</button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-2" onclick="window.updateShopStatus('${shopId}', 'ระงับ')">ปฏิเสธ</button>
              ` : `
                <span class="badge ${s.status === 'อนุมัติแล้ว' ? 'bg-success' : 'bg-danger'} rounded-pill shadow-sm py-1 px-3">${s.status}</span>
                <button class="btn btn-sm btn-light text-muted border rounded-pill px-2" onclick="window.updateShopStatus('${shopId}', '${s.status === 'อนุมัติแล้ว' ? 'ระงับ' : 'อนุมัติแล้ว'}')"><i class="fa-solid fa-rotate"></i> เปลี่ยนสถานะ</button>
              `}
            </div>
          </div>
          
          <!-- 🌟 ส่วนจัดการสินค้าภายในร้าน (Product Management) -->
          <div class="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
             <span class="small text-muted fw-bold"><i class="fa-solid fa-box-open me-1 text-primary"></i> สินค้าในร้านสวัสดิการ</span>
             <button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="window.openManageProductsModal('${shopId}', '${s.shopName}')">
                <i class="fa-solid fa-plus me-1"></i> จัดการ/เพิ่มสินค้า
             </button>
          </div>
        </div>`;
      
      if (s.status === 'รออนุมัติ') pendingHtml += card;
      else approvedHtml += card;
    });

    document.getElementById('list-pending-shops').innerHTML = pendingHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-check-circle fs-3 text-success mb-2 d-block opacity-50"></i>ไม่มีคำขอเปิดร้านรอตรวจสอบ</div>';
    document.getElementById('list-approved-shops').innerHTML = approvedHtml || '<div class="admin-card text-center text-muted small py-4 border-0 bg-light rounded-4 border-dashed"><i class="fa-solid fa-store-slash fs-3 mb-2 d-block opacity-50"></i>ยังไม่มีร้านค้าในระบบ</div>';
    
    AppHelper.showLoader(false);
  } catch(e) { 
    AppHelper.showLoader(false); console.error(e); 
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้', 'error');
  }
};

// =========================================================
// ➕ ฟังก์ชันสำหรับให้แอดมิน "เพิ่มร้านค้าใหม่"
// =========================================================
window.openAddShopModal = function() {
  Swal.fire({
    title: 'เพิ่มร้านค้าสวัสดิการใหม่',
    html: `
      <div class="text-start" style="font-family:'Prompt';">
          <label class="small fw-bold text-muted mb-1">ชื่อร้านค้า *</label>
          <input type="text" id="adminShopName" class="form-control mb-3" placeholder="เช่น ร้านค้าชุมชนสุขสำราญ">
          
          <label class="small fw-bold text-muted mb-1">ชื่อเจ้าของร้าน *</label>
          <input type="text" id="adminShopOwner" class="form-control mb-3" placeholder="ชื่อ-นามสกุลเจ้าของ">
          
          <label class="small fw-bold text-muted mb-1">เบอร์โทรศัพท์ติดต่อ *</label>
          <input type="tel" id="adminShopPhone" class="form-control mb-3" placeholder="08X-XXX-XXXX">
          
          <div class="row g-2 mb-3">
             <div class="col-6">
                <label class="small fw-bold text-muted mb-1">หมวดหมู่</label>
                <select id="adminShopCategory" class="form-select">
                   <option value="สินค้าเกษตร">สินค้าเกษตร</option>
                   <option value="อาหารและเครื่องดื่ม">อาหารและเครื่องดื่ม</option>
                   <option value="สินค้าชุมชน/หัตถกรรม">สินค้าชุมชน/หัตถกรรม</option>
                   <option value="บริการทั่วไป">บริการทั่วไป</option>
                </select>
             </div>
             <div class="col-6">
                <label class="small fw-bold text-muted mb-1">ศูนย์ประสานงาน / พื้นที่</label>
                <input type="text" id="adminShopSubCat" class="form-control" placeholder="เช่น โซน A / สุคิริน">
             </div>
          </div>
          
          <label class="small fw-bold text-muted mb-1">รายละเอียด / ทำเลที่ตั้ง</label>
          <textarea id="adminShopDesc" class="form-control" rows="2" placeholder="รายละเอียดร้านค้า..."></textarea>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-save me-1"></i> บันทึกร้านค้า',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#2563EB',
    preConfirm: () => {
      const shopName = document.getElementById('adminShopName').value.trim();
      const ownerName = document.getElementById('adminShopOwner').value.trim();
      const phone = document.getElementById('adminShopPhone').value.trim();
      if (!shopName || !ownerName || !phone) {
        Swal.showValidationMessage('กรุณากรอกชื่อร้าน เจ้าของ และเบอร์โทรศัพท์ให้ครบถ้วน');
        return false;
      }
      return {
        shopName, ownerName, phone,
        category: document.getElementById('adminShopCategory').value,
        subCategory: document.getElementById('adminShopSubCat').value.trim(),
        description: document.getElementById('adminShopDesc').value.trim(),
        status: 'อนุมัติแล้ว', // แอดมินเพิ่มเอง ให้สถานะอนุมัติทันที
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
    }
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังบันทึกร้านค้า...");
      try {
        await db.collection("shops").add(res.value);
        AppHelper.showLoader(false);
        Swal.fire('สำเร็จ', 'เพิ่มร้านค้าเข้าระบบเรียบร้อยแล้ว', 'success');
        window.loadAdminShops();
      } catch(e) {
        AppHelper.showLoader(false);
        Swal.fire('Error', e.message, 'error');
      }
    }
  });
};

// =========================================================
// 📦 ระบบจัดการสินค้าของร้าน (Manage Shop Products)
// =========================================================
window.openManageProductsModal = async function(shopId, shopName) {
  AppHelper.showLoader(true, "กำลังโหลดรายการสินค้า...");
  try {
    const snap = await db.collection("shops").doc(shopId).collection("products").orderBy("timestamp", "desc").get();
    let productsHtml = "";
    
    snap.forEach(doc => {
      const p = doc.data();
      const pId = doc.id;
      productsHtml += `
        <div class="d-flex align-items-center justify-content-between p-2 mb-2 bg-light rounded-3 border">
           <div class="d-flex align-items-center gap-2">
              <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=200&q=80'}" class="rounded-2" style="width: 40px; height: 40px; object-fit: cover;">
              <div>
                 <strong class="text-dark d-block" style="font-size: 0.85rem;">${p.name}</strong>
                 <small class="text-success fw-bold">฿${parseFloat(p.price || 0).toLocaleString()} <span class="text-muted fw-normal">| คงเหลือ: ${p.stock || 0} ชิ้น</span></small>
              </div>
           </div>
           <button class="btn btn-sm btn-outline-danger rounded-circle p-1" style="width: 30px; height: 30px;" onclick="window.deleteShopProduct('${shopId}', '${pId}', '${shopName}')">
              <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
           </button>
        </div>`;
    });

    AppHelper.showLoader(false);

    Swal.fire({
      title: `สินค้า: ${shopName}`,
      html: `
        <div class="text-start" style="font-family:'Prompt';">
           <button class="btn btn-sm btn-primary rounded-pill w-100 mb-3 fw-bold shadow-sm" onclick="window.openAddProductModal('${shopId}', '${shopName}')">
              <i class="fa-solid fa-plus me-1"></i> เพิ่มสินค้าใหม่เข้าร้านนี้
           </button>
           <div style="max-height: 250px; overflow-y: auto;">
              ${productsHtml || '<div class="text-center text-muted small py-3">ยังไม่มีสินค้าในร้านนี้</div>'}
           </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748B',
      width: '90%'
    });
  } catch(e) {
    AppHelper.showLoader(false);
    Swal.fire('Error', 'ไม่สามารถโหลดสินค้าได้', 'error');
  }
};

window.openAddProductModal = function(shopId, shopName) {
  Swal.fire({
    title: `เพิ่มสินค้าใหม่ (${shopName})`,
    html: `
      <div class="text-start" style="font-family:'Prompt';">
         <label class="small fw-bold text-muted mb-1">ชื่อสินค้า *</label>
         <input type="text" id="prodName" class="form-control mb-3" placeholder="เช่น น้ำผึ้งป่าเดือน 5">
         
         <div class="row g-2 mb-3">
            <div class="col-6">
               <label class="small fw-bold text-muted mb-1">ราคา (บาท) *</label>
               <input type="number" id="prodPrice" class="form-control fw-bold text-success" placeholder="0.00" step="0.01">
            </div>
            <div class="col-6">
               <label class="small fw-bold text-muted mb-1">จำนวนสต็อก (ชิ้น) *</label>
               <input type="number" id="prodStock" class="form-control fw-bold" placeholder="10" value="10">
            </div>
         </div>
         
         <label class="small fw-bold text-muted mb-1">ลิงก์รูปภาพสินค้า (URL)</label>
         <input type="text" id="prodImg" class="form-control mb-3" placeholder="https://...">
         
         <label class="small fw-bold text-muted mb-1">รายละเอียดสินค้า</label>
         <textarea id="prodDesc" class="form-control" rows="2" placeholder="รายละเอียดสรรพคุณ ขนาด..."></textarea>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกสินค้า',
    cancelButtonText: 'ย้อนกลับ',
    confirmButtonColor: '#10B981',
    preConfirm: () => {
      const name = document.getElementById('prodName').value.trim();
      const price = parseFloat(document.getElementById('prodPrice').value);
      const stock = parseInt(document.getElementById('prodStock').value);
      if (!name || isNaN(price) || isNaN(stock)) {
        Swal.showValidationMessage('กรุณากรอกชื่อสินค้า ราคา และจำนวนสต็อกให้ถูกต้อง');
        return false;
      }
      return {
        name, price, stock,
        description: document.getElementById('prodDesc').value.trim(),
        imageUrl: document.getElementById('prodImg').value.trim() || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
    }
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังบันทึกสินค้า...");
      try {
        await db.collection("shops").doc(shopId).collection("products").add(res.value);
        AppHelper.showLoader(false);
        Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าสำเร็จ', timer: 1200, showConfirmButton: false });
        window.openManageProductsModal(shopId, shopName); // เปิดหน้าจัดการสินค้ากลับมา
      } catch(e) {
        AppHelper.showLoader(false);
        Swal.fire('Error', e.message, 'error');
      }
    }
  });
};

window.deleteShopProduct = async function(shopId, productId, shopName) {
  Swal.fire({
    title: 'ยืนยันการลบสินค้า?',
    text: "สินค้านี้จะถูกลบออกจากร้านค้าถาวร",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    confirmButtonText: 'ลบสินค้า',
    cancelButtonText: 'ยกเลิก'
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังลบสินค้า...");
      try {
        await db.collection("shops").doc(shopId).collection("products").doc(productId).delete();
        AppHelper.showLoader(false);
        window.openManageProductsModal(shopId, shopName);
      } catch(e) {
        AppHelper.showLoader(false);
        Swal.fire('Error', 'ไม่สามารถลบสินค้าได้', 'error');
      }
    }
  });
};

window.updateShopStatus = async function(shopUid, newStatus) {
  AppHelper.showLoader(true, "กำลังอัปเดตสถานะร้านค้า...");
  try {
    await db.collection("shops").doc(shopUid).update({ status: newStatus });
    
    if(typeof window.createAuditLog === 'function') {
        window.createAuditLog('SHOP_STATUS', `เปลี่ยนสถานะร้านค้า UID ${shopUid} เป็น ${newStatus}`);
    }
    
    AppHelper.showLoader(false);
    Swal.fire({ icon: 'success', title: 'อัปเดตสถานะสำเร็จ', timer: 1200, showConfirmButton: false });
    window.loadAdminShops();
  } catch(e) { 
    AppHelper.showLoader(false); 
    Swal.fire('Error', e.message, 'error'); 
  }
};