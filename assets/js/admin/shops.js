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
          
          <!-- 🌟 ส่วนจัดการสินค้าและออเดอร์ภายในร้าน (Shop Management) -->
          <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
             <span class="small text-muted fw-bold"><i class="fa-solid fa-shop me-1 text-primary"></i> ระบบจัดการหลังบ้าน</span>
             <div class="d-flex gap-2">
                <!-- 📦 ปุ่มใหม่: จัดการออเดอร์ -->
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1 fw-bold shadow-sm text-dark" onclick="window.openShopOrdersModal('${shopId}', '${s.shopName}')">
                   <i class="fa-solid fa-clipboard-list me-1"></i> ออเดอร์ลูกค้า
                </button>
                <!-- 🛒 ปุ่มเดิม: จัดการสินค้า -->
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="window.openManageProductsModal('${shopId}', '${s.shopName}')">
                   <i class="fa-solid fa-plus me-1"></i> สินค้า
                </button>
             </div>
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

// =========================================================
// 🛒 ระบบจัดการคำสั่งซื้อ (Order Management)
// =========================================================

window.openShopOrdersModal = async function(shopId, shopName) {
  AppHelper.showLoader(true, "กำลังโหลดรายการคำสั่งซื้อ...");
  try {
    // 🌟 ดึงข้อมูลออเดอร์จาก Subcollection 'orders' ของร้านนั้นๆ
    const snap = await db.collection("shops").doc(shopId).collection("orders").orderBy("timestamp", "desc").get();
    let ordersHtml = "";
    
    snap.forEach(doc => {
      const order = doc.data();
      const orderId = doc.id;
      const orderDate = order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString('th-TH') : '-';
      
      // 🌟 สร้างป้ายสถานะและปุ่มกดตาม Status ของออเดอร์
      let statusBadge = '';
      let actionBtns = '';
      
      if(order.status === 'รอตรวจสอบ') {
          statusBadge = '<span class="badge bg-warning text-dark border border-warning shadow-sm">รอตรวจสอบยอดเงิน</span>';
          actionBtns = `<button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="window.updateOrderStatus('${shopId}', '${orderId}', 'กำลังเตรียมจัดส่ง', '${shopName}')"><i class="fa-solid fa-box-open me-1"></i> ยืนยันรับเงิน/เตรียมของ</button>`;
      } else if(order.status === 'กำลังเตรียมจัดส่ง') {
          statusBadge = '<span class="badge bg-info text-dark shadow-sm">กำลังเตรียมจัดส่ง</span>';
          actionBtns = `<button class="btn btn-sm btn-primary rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="window.updateOrderStatus('${shopId}', '${orderId}', 'จัดส่งแล้ว', '${shopName}')"><i class="fa-solid fa-truck-fast me-1"></i> ส่งสินค้าแล้ว</button>`;
      } else if(order.status === 'จัดส่งแล้ว') {
          statusBadge = '<span class="badge bg-success shadow-sm"><i class="fa-solid fa-check-circle me-1"></i> จัดส่งสำเร็จ</span>';
      } else {
          statusBadge = `<span class="badge bg-secondary">${order.status}</span>`;
      }

      // 🌟 สร้างรายการสินค้าที่ลูกค้าสั่งในบิลนี้
      let itemsHtml = '';
      if(order.items && order.items.length > 0) {
          order.items.forEach(item => {
              itemsHtml += `<div class="text-dark small d-flex justify-content-between border-bottom border-light pb-1 mb-1">
                              <span>- ${item.name} <span class="text-danger fw-bold">(x${item.qty})</span></span>
                              <span class="text-success fw-bold">฿${(item.price * item.qty).toLocaleString()}</span>
                            </div>`;
          });
      }

      // 🌟 ประกอบร่างการ์ดออเดอร์
      ordersHtml += `
        <div class="admin-card p-3 mb-3 bg-white rounded-4 border shadow-sm text-start position-relative overflow-hidden">
           <!-- แถบสีด้านซ้ายบอกสถานะ -->
           <div style="position:absolute; left:0; top:0; bottom:0; width:6px; background-color: ${order.status === 'รอตรวจสอบ' ? '#F59E0B' : order.status === 'กำลังเตรียมจัดส่ง' ? '#0EA5E9' : '#10B981'};"></div>
           
           <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2 ms-2">
              <div>
                 <strong class="text-primary"><i class="fa-solid fa-receipt me-1"></i> Order: ${orderId.substring(0,8).toUpperCase()}</strong><br>
                 <small class="text-muted"><i class="fa-solid fa-clock me-1"></i> ${orderDate}</small>
              </div>
              <div class="text-end">
                 <h5 class="text-success fw-bold mb-1">฿${parseFloat(order.totalAmount || 0).toLocaleString()}</h5>
                 ${statusBadge}
              </div>
           </div>
           
           <div class="mb-3 ms-2 bg-light p-2 rounded-3 border border-secondary border-opacity-10">
              <span class="small fw-bold text-dark"><i class="fa-solid fa-user me-1 text-secondary"></i> ลูกค้า:</span> <span class="small text-muted">${order.customerName || 'ไม่ระบุ'} (${order.customerPhone || '-'})</span><br>
              <span class="small fw-bold text-dark"><i class="fa-solid fa-map-location-dot me-1 text-danger"></i> จัดส่ง:</span> <span class="small text-muted">${order.shippingAddress || '-'}</span>
           </div>
           
           <div class="p-2 rounded-3 mb-3 ms-2" style="background-color: #F8FAFC; border: 1px dashed #CBD5E1;">
              <span class="small fw-bold text-dark d-block mb-2">รายการที่สั่งซื้อ:</span>
              ${itemsHtml}
           </div>

           <div class="d-flex justify-content-between align-items-center ms-2 pt-2 border-top">
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold shadow-sm" onclick="window.viewOrderSlip('${order.slipUrl || ''}')">
                 <i class="fa-solid fa-image me-1"></i> ดูสลิป
              </button>
              <div>${actionBtns}</div>
           </div>
        </div>`;
    });

    AppHelper.showLoader(false);

    Swal.fire({
      title: `ออเดอร์ร้าน: ${shopName}`,
      html: `
        <div class="text-start" style="font-family:'Prompt'; max-height: 65vh; overflow-y: auto; background-color: #F1F5F9; padding: 15px; border-radius: 12px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
           ${ordersHtml || '<div class="text-center text-muted py-5"><i class="fa-solid fa-box-open fs-1 text-secondary opacity-25 mb-3 d-block"></i><h6 class="fw-bold">ยังไม่มีออเดอร์เข้ามาครับ</h6><small>เมื่อสมาชิกสั่งซื้อ รายการจะมาปรากฏที่นี่</small></div>'}
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748B',
      width: '95%' // ขยายความกว้าง Modal ให้ดูสบายตาขึ้นในมือถือ
    });
  } catch(e) {
    AppHelper.showLoader(false);
    Swal.fire('Error', 'ไม่สามารถโหลดออเดอร์ได้: ' + e.message, 'error');
  }
};

window.updateOrderStatus = async function(shopId, orderId, newStatus, shopName) {
  Swal.fire({
    title: 'ยืนยันการดำเนินการ?',
    text: `ต้องการเปลี่ยนสถานะออเดอร์นี้เป็น "${newStatus}" ใช่หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10B981'
  }).then(async res => {
    if (res.isConfirmed) {
      AppHelper.showLoader(true, "กำลังบันทึกสถานะ...");
      try {
        await db.collection("shops").doc(shopId).collection("orders").doc(orderId).update({
          status: newStatus,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        AppHelper.showLoader(false);
        Swal.fire({ icon: 'success', title: 'อัปเดตสำเร็จ', timer: 1200, showConfirmButton: false });
        
        // 🌟 ปิดหน้าต่างเดิม แล้วโหลดหน้าออเดอร์ใหม่เพื่อรีเฟรชข้อมูล
        setTimeout(() => {
            window.openShopOrdersModal(shopId, shopName);
        }, 1200);
        
      } catch(e) {
        AppHelper.showLoader(false);
        Swal.fire('Error', 'ไม่สามารถอัปเดตสถานะได้', 'error');
      }
    }
  });
};

window.viewOrderSlip = function(slipUrl) {
  if(!slipUrl) return Swal.fire('ไม่มีสลิป', 'ออเดอร์นี้ไม่มีการแนบสลิปโอนเงิน (อาจชำระด้วยแต้ม หรือเก็บเงินปลายทาง)', 'info');
  Swal.fire({
    title: 'หลักฐานการโอนเงิน',
    imageUrl: slipUrl,
    imageAlt: 'Payment Slip',
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#64748B'
  });
};