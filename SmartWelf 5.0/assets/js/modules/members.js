// =========================================================
// 👥 members.js: ทะเบียนสมาชิก และคัดกรอง
// =========================================================
function getArrearsStatus(monthsOwed) {
    if (monthsOwed <= 0) return `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="fa-solid fa-circle-check"></i> ปกติ</span>`;
    if (monthsOwed === 1) return `<span class="badge bg-warning bg-opacity-10 text-dark border border-warning"><i class="fa-solid fa-triangle-exclamation"></i> ค้าง 1 เดือน</span>`;
    if (monthsOwed === 2) return `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger"><i class="fa-solid fa-skull-crossbones"></i> ค้าง 2 เดือน</span>`;
    return `<span class="badge bg-dark text-white shadow-sm"><i class="fa-solid fa-ban"></i> วิกฤต/พ้นสภาพ</span>`;
}

async function loadMembersData() {
    document.getElementById('list-members').innerHTML = '<div class="text-center mt-4"><div class="spinner-border text-primary"></div></div>';
    try {
        const snap = await db.collection("members").orderBy("timestamp", "desc").get();
        allMembersCache = []; let pendingLinks = 0;
        
        const centersSet = new Set();
        const adminsSet = new Set();
        const typesSet = new Set();
        const vulnSet = new Set();

        snap.forEach(doc => { 
            let d = doc.data(); 
            let allowPush = false;
            if (currentAdminData.role === 'Admin-Master' || currentAdminData.role === 'Admin-การเงิน' || currentAdminData.role === 'Admin-สวัสดิการ') allowPush = true;
            else if (currentAdminData.role === 'Admin-ศูนย์ประสานงาน' && d.center === currentAdminData.center) allowPush = true;
            else if (currentAdminData.role === 'Admin-ผู้ดูแล' && d.responsibleAdmin === currentAdminData.name) allowPush = true;

            if(allowPush) {
                if(d.linkStatus === 'pending') pendingLinks++;
                allMembersCache.push({ id: doc.id, ...d }); 
                
                if (d.center) centersSet.add(d.center);
                if (d.responsibleAdmin) adminsSet.add(d.responsibleAdmin);
                if (d.memberType) typesSet.add(d.memberType);
                if (d.vulnerability && d.vulnerability !== "" && d.vulnerability !== "ปกติ") { vulnSet.add(d.vulnerability); }
            }
        });
        
        const alertBox = document.getElementById('pendingLinkAlert');
        if(alertBox) {
            if(pendingLinks > 0 && currentAdminData.role !== 'Admin-ผู้ดูแล') { 
                alertBox.classList.remove('d-none'); document.getElementById('linkRequestCount').innerText = pendingLinks; 
            } else { alertBox.classList.add('d-none'); }
        }
        if(currentAdminData.role === 'Admin-ผู้ดูแล' && document.getElementById('btn-add-member')) { document.getElementById('btn-add-member').style.display = 'none'; }

        populateDropdown("filterCenter", Array.from(centersSet));
        populateDropdown("filterAdmin", Array.from(adminsSet));
        populateDropdown("filterType", Array.from(typesSet));
        
        const vulnSelect = document.getElementById("filterVulnerable");
        if (vulnSelect) {
            vulnSelect.innerHTML = '<option value="">ทั้งหมด</option><option value="ปกติ">ไม่มีความเปราะบาง (ปกติ)</option>';
            Array.from(vulnSet).sort().forEach(item => { vulnSelect.innerHTML += `<option value="${item}">${item}</option>`; });
        }
        renderMembersList(allMembersCache);
    } catch(e) { console.error(e); }
}

function populateDropdown(selectId, dataArray) {
    const select = document.getElementById(selectId);
    if (!select) return;
    dataArray.sort();
    select.innerHTML = '<option value="">ทั้งหมด</option>';
    dataArray.forEach(item => {
        const option = document.createElement("option"); option.value = item; option.textContent = item;
        select.appendChild(option);
    });
}

function filterMembersLocally() {
    const searchText = document.getElementById("searchMemberInput").value.toLowerCase();
    const filterCenter = document.getElementById("filterCenter") ? document.getElementById("filterCenter").value : "";
    const filterAdmin = document.getElementById("filterAdmin") ? document.getElementById("filterAdmin").value : "";
    const filterType = document.getElementById("filterType") ? document.getElementById("filterType").value : "";
    const filterAge = document.getElementById("filterAge") ? document.getElementById("filterAge").value : "";
    const filterVulnerable = document.getElementById("filterVulnerable") ? document.getElementById("filterVulnerable").value : "";

    const now = new Date();

    const filteredData = allMembersCache.filter(m => {
        const matchSearch = !searchText || 
            (m.fullName && m.fullName.toLowerCase().includes(searchText)) ||
            (m.memberId && m.memberId.toLowerCase().includes(searchText)) ||
            (m.nationalId && m.nationalId.includes(searchText));
            
        const matchCenter = !filterCenter || m.center === filterCenter;
        const matchAdmin  = !filterAdmin || m.responsibleAdmin === filterAdmin;
        const matchType   = !filterType || m.memberType === filterType;

        let memberVuln = m.vulnerability || "ปกติ";
        const matchVulnerable = !filterVulnerable || memberVuln === filterVulnerable;

        let matchAge = true;
        if (filterAge && m.registerDateObj) {
            const regDate = new Date(m.registerDateObj);
            let years = now.getFullYear() - regDate.getFullYear();
            let months = now.getMonth() - regDate.getMonth();
            let days = now.getDate() - regDate.getDate();
            
            if (days < 0) months--;
            if (months < 0) years--;

            if (filterAge === 'over1year') { matchAge = years >= 1; } 
            else if (filterAge === 'under1year') { matchAge = years < 1; }
        } else if (filterAge && !m.registerDateObj) { matchAge = false; }

        return matchSearch && matchCenter && matchAdmin && matchType && matchVulnerable && matchAge;
    });
    renderMembersList(filteredData);
}

function renderMemberItem(d) {
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    let canEditProfile = false; 
    if (currentAdminData.role === 'Admin-Master') canEditProfile = true;
    else if (currentAdminData.role === 'Admin-ศูนย์ประสานงาน' && d.center === currentAdminData.center) canEditProfile = true;
    else if (currentAdminData.role === 'Admin-ผู้ดูแล' && d.responsibleAdmin === currentAdminData.name) canEditProfile = true;

    let canEditStatus = false; 
    if (currentAdminData.role === 'Admin-Master') canEditStatus = true;
    else if (currentAdminData.role === 'Admin-ศูนย์ประสานงาน' && d.center === currentAdminData.center) canEditStatus = true;

    let canAssignCenter = (currentAdminData.role === 'Admin-Master'); 

    let statusColor = d.status === 'เป็นสมาชิก' ? 'bg-success' : (d.status.includes('รอ') ? 'bg-warning text-dark' : 'bg-danger');
    let lineBadge = d.lineUid ? `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1" style="font-size:0.65rem;"><i class="fa-brands fa-line me-1"></i> ผูกแล้ว</span>` : `<span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-2 py-1" style="font-size:0.65rem;"><i class="fa-solid fa-link-slash me-1"></i> ยังไม่ผูก LINE</span>`;
    
    let passbookBtn = `<button class="btn btn-sm btn-primary rounded-pill px-3 shadow-sm fw-bold" onclick="openMemberPassbook('${d.id}')" style="font-size:0.75rem;"><i class="fa-solid fa-book-open me-1"></i> สมุดบัญชี</button>`;
    
    let qrButton = (!d.lineUid && canEditStatus) ? `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm fw-bold" style="font-size:0.75rem;" onclick="generateLinkQR('${d.id}', '${d.fullName}')"><i class="fa-solid fa-qrcode me-1"></i> ผูกบัญชี</button>` : ``;
    let statusBtn = canEditStatus ? `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm fw-bold" onclick="changeMemberStatus('${d.id}', '${d.status}')" style="font-size:0.75rem;">เปลี่ยนสถานะ</button>` : ``;
    let editProfileBtn = canEditProfile ? `<button class="btn btn-sm btn-outline-info rounded-pill px-3 shadow-sm fw-bold" onclick="editMemberProfile('${d.id}')" style="font-size:0.75rem;"><i class="fa-solid fa-pen-to-square me-1"></i> แก้ไข</button>` : ``;
    
    let assignCenterAction = canAssignCenter ? `onclick="assignCenterToMember('${d.id}', '${d.center || ''}')" class="badge bg-light text-dark border border-secondary shadow-sm py-2 cursor-pointer"` : `class="badge bg-light text-muted border border-secondary shadow-sm py-2"`;
    let assignAction = canEditStatus ? `onclick="assignAdminToMember('${d.id}', '${d.responsibleAdmin || ''}')" class="badge bg-info bg-opacity-10 text-info shadow-sm py-2 cursor-pointer border border-info"` : `class="badge bg-light text-muted border border-secondary shadow-sm py-2"`;
    
    let profileImage = d.pictureUrl ? `<img src="${d.pictureUrl}" class="rounded-circle shadow-sm flex-shrink-0" style="width: 48px; height: 48px; object-fit: cover; border: 2px solid #E2E8F0;" alt="Profile">` : `<div class="icon-box bg-primary bg-opacity-10 text-primary flex-shrink-0 rounded-circle" style="width: 48px; height: 48px;"><i class="fa-solid fa-user"></i></div>`;

    let natId = d.nationalId || "-"; let phone = d.phone || "-"; let centerInfo = d.center || "ไม่ระบุศูนย์"; let responsibleAdmin = d.responsibleAdmin || "ไม่มีผู้ดูแล"; let memberType = d.memberType || "สมาชิกสามัญ"; let totalContrib = parseFloat(d.totalContribution || 0);
    let regDateObj = d.registerDateObj ? new Date(d.registerDateObj) : new Date();
    let formattedRegDate = `${regDateObj.getDate()} ${monthNames[regDateObj.getMonth()]} ${regDateObj.getFullYear() + 543}`;
    let ageStr = "เพิ่งสมัคร / รอตรวจสอบ"; let monthsAsMember = 1;

    if (d.registerDateObj && d.status === 'เป็นสมาชิก') {
        const now = new Date(); let years = now.getFullYear() - regDateObj.getFullYear(); let months = now.getMonth() - regDateObj.getMonth(); let days = now.getDate() - regDateObj.getDate();
        if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (months < 0) { years--; months += 12; }
        monthsAsMember = (years * 12) + months + 1; if (monthsAsMember < 1) monthsAsMember = 1;
        if (years >= 0) {
            ageStr = ''; if(years > 0) ageStr += `${years} ปี `; if(months > 0) ageStr += `${months} เดือน `; ageStr += `${days} วัน`;
            if(ageStr === '0 วัน') ageStr = 'เพิ่งอนุมัติวันนี้';
        }
    }

    let phoneHtml = canEditProfile 
        ? `<strong class="text-dark cursor-pointer border-bottom border-secondary border-opacity-50 pb-1" style="font-size:0.85rem;" onclick="editMemberPhone('${d.id}', '${phone}')" title="แก้ไขเบอร์โทร">${phone} <i class="fa-solid fa-pen text-muted" style="font-size:0.6rem;"></i></strong>` 
        : `<strong class="text-dark" style="font-size:0.85rem;">${phone}</strong>`;
        
    let regDateHtml = canEditStatus 
        ? `<strong class="text-primary cursor-pointer border-bottom border-primary border-opacity-50 pb-1" style="font-size:0.85rem;" onclick="editMemberRegDate('${d.id}', '${d.registerDateObj || ''}')" title="แก้วันสมัคร">${ageStr} <i class="fa-solid fa-pen text-primary" style="font-size:0.6rem;"></i></strong>`
        : `<strong class="text-primary" style="font-size:0.85rem;">${ageStr}</strong>`;

    let annualFee = parseFloat(fundSettings?.annualFee || 360); let monthlyRate = annualFee / 12;
    let expectedTotal = monthsAsMember * monthlyRate;
    let outstanding = expectedTotal - totalContrib; if (outstanding < 0) outstanding = 0; 

    let monthsOwed = Math.floor(outstanding / monthlyRate);
    let arrearsBadge = getArrearsStatus(monthsOwed);
    
    let formatOutstanding = outstanding.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let formatTotalContrib = totalContrib.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    let paidMonths = Math.floor(totalContrib / monthlyRate); let activeDots = paidMonths % 12;
    if (paidMonths > 0 && activeDots === 0) activeDots = 12; if (totalContrib === 0) activeDots = 0;
    const dotColors = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#F59E0B', '#F59E0B', '#FBBF24', '#FBBF24', '#34D399', '#34D399', '#10B981', '#10B981'];
    let dotsHtml = '<div class="d-flex gap-1 mt-2" title="สถานะการสมทบ">';
    for(let i=0; i<12; i++) { let dotColor = (i < activeDots) ? dotColors[i] : '#E2E8F0'; dotsHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor};"></div>`; }
    dotsHtml += '</div>';

    let welfareHtml = ""; let currentYearThai = new Date().getFullYear() + 543;
    if (d.welfareHistory && d.welfareHistory.length > 0) {
        welfareHtml = `<div class="col-12 mt-3"><div class="p-2 bg-light rounded-4 border border-light text-center"><small class="text-success"><i class="fa-solid fa-check"></i> มีประวัติสวัสดิการ</small></div></div>`;
    } else { 
        welfareHtml = `<div class="col-12 mt-3"><div class="p-2 bg-light rounded-4 border border-light text-center"><small class="text-muted" style="font-size:0.7rem;"><i class="fa-solid fa-hand-holding-medical text-secondary me-1"></i> ยังไม่มีประวัติรับสวัสดิการ</small></div></div>`; 
    }
    
    return `
    <div class="bg-white p-3 mb-3 member-row" id="row-${d.id}" style="border-left: 4px solid var(--primary-main); border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
      <div class="d-flex justify-content-between align-items-center position-relative">
        <div class="d-flex align-items-center gap-2 w-100" style="overflow: hidden;">
           <div class="member-checkbox-wrapper">
             <input type="checkbox" class="form-check-input member-check member-checkbox me-2" value="${d.id}" data-name="${d.fullName}" onchange="toggleContributionInput(this, '${d.id}')">
           </div>
           <div class="member-avatar-wrapper">${profileImage}</div>
           <div style="min-width: 0; cursor: pointer;" onclick="toggleCollapse('collapse-member-${d.id}', 'arrow-member-${d.id}')">
              <h6 class="fw-bold mb-0 text-dark text-truncate" style="font-size: 0.95rem;">${d.fullName}</h6>
              <div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
                  <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2" style="font-size:0.7rem;"><i class="fa-solid fa-id-badge"></i> ${d.memberId}</span>
                  ${arrearsBadge}
              </div>
              ${dotsHtml}
           </div>
           <div class="amount-badge-wrapper ms-2" style="display: none; z-index: 10;" onclick="reopenInput('${d.id}')">
              <span class="badge bg-success rounded-pill px-3 py-2 fs-6 shadow-sm">+<span class="display-amount">0</span> ฿</span>
           </div>
           <div class="input-overlay d-flex align-items-center justify-content-end pe-3">
              <div class="input-group input-group-sm w-auto shadow-sm rounded-pill overflow-hidden">
                  <span class="input-group-text bg-white border-0 text-muted">฿</span>
                  <input type="number" class="form-control border-0 amount-input text-success fw-bold text-center" id="input-${d.id}" placeholder="ระบุยอด" style="width: 100px; outline: none !important; box-shadow: none;" onkeypress="handleEnter(event, '${d.id}')">
                  <button class="btn btn-primary px-3 fw-bold" onclick="confirmAmount('${d.id}', '${d.status}')">ตกลง</button>
              </div>
           </div>
        </div>
        
        <div class="text-end flex-shrink-0 ms-2 d-flex flex-column align-items-end cursor-pointer" onclick="toggleCollapse('collapse-member-${d.id}', 'arrow-member-${d.id}')">
           <span class="badge ${statusColor} rounded-pill px-2 py-1 shadow-sm mb-1" style="font-size: 0.7rem;">${d.status}</span>
           <div class="bg-light rounded-circle d-flex align-items-center justify-content-center text-muted mt-1" style="width: 22px; height: 22px; transition: transform 0.3s;" id="arrow-member-${d.id}">
                <i class="fa-solid fa-chevron-down" style="font-size: 0.6rem;"></i>
           </div>
        </div>
      </div>
      
      <div class="collapse mt-3 pt-3" id="collapse-member-${d.id}" style="border-top: 1px dashed #E2E8F0;">
        <div class="row g-2 mb-3 px-2">
            <div class="col-12 mb-1"><small class="text-muted d-block mb-1" style="font-size:0.7rem;"><i class="fa-solid fa-clock-rotate-left text-primary w-20px"></i> อายุสมาชิก / วันเริ่มสมัคร</small>${regDateHtml}</div>
            <div class="col-6"><small class="text-muted d-block mb-1" style="font-size:0.7rem;"><i class="fa-solid fa-address-card text-secondary w-20px"></i> เลข ปชช.</small><strong class="text-dark" style="font-size:0.85rem;">${natId}</strong></div>
            <div class="col-6"><small class="text-muted d-block mb-1" style="font-size:0.7rem;"><i class="fa-solid fa-phone text-secondary w-20px"></i> โทรศัพท์</small>${phoneHtml}</div>
            <div class="col-6 mt-2"><small class="text-muted d-block mb-1" style="font-size:0.7rem;"><i class="fa-solid fa-coins text-success w-20px"></i> สมทบสะสม</small><strong class="text-success" style="font-size:0.85rem;">฿${formatTotalContrib}</strong></div>
            <div class="col-6 mt-2"><small class="text-muted d-block mb-1" style="font-size:0.7rem;"><i class="fa-solid fa-circle-exclamation text-danger w-20px"></i> ค้างสมทบ</small><strong class="text-danger" style="font-size:0.85rem;">฿${formatOutstanding}</strong></div>
            
            <div class="col-12 mt-2">
                <small class="text-muted d-block mb-2" style="font-size:0.7rem;"><i class="fa-solid fa-house-flag text-secondary w-20px"></i> ศูนย์ประสานงาน & กรรมการ</small>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span ${assignCenterAction} title="${canAssignCenter ? 'คลิกเพื่อย้ายศูนย์' : ''}">
                        <i class="fa-solid fa-building me-1 text-muted"></i> ${centerInfo} ${canAssignCenter ? '<i class="fa-solid fa-pen ms-1"></i>' : ''}
                    </span>
                    <span ${assignAction} title="${canEditStatus ? 'คลิกเพื่อเปลี่ยนผู้ดูแลสาย' : ''}">
                        <i class="fa-solid fa-user-tie me-1"></i> ${responsibleAdmin} ${canEditStatus ? '<i class="fa-solid fa-pen ms-1"></i>' : ''}
                    </span>
                </div>
            </div>
            ${welfareHtml}
        </div>
        <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded-4 mt-2 flex-wrap gap-2">
            <div>${lineBadge}</div>
            <div class="d-flex gap-2 flex-wrap">
                ${passbookBtn} ${statusBtn} ${editProfileBtn} ${qrButton} 
            </div>
        </div>
      </div>
    </div>`;
}

function displayMemberList(membersArray) {
    const container = document.getElementById('list-members');
    if(membersArray.length === 0) {
        container.innerHTML = "<div class='text-center text-muted small p-3 bg-white rounded-4 border'>ไม่มีรายชื่อสมาชิกที่ค้นหา</div>";
        return;
    }
    let htmlContent = '';
    membersArray.forEach(member => { htmlContent += renderMemberItem(member); });
    container.innerHTML = htmlContent;
}
function renderMembersList(dataArr) { displayMemberList(dataArr); }

async function editMemberPhone(memberId, currentPhone) {
    const { value: newPhone } = await Swal.fire({
        title: 'แก้ไขเบอร์โทรศัพท์', input: 'tel', inputValue: currentPhone !== '-' ? currentPhone : '',
        showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (!value) return 'กรุณากรอกเบอร์โทรศัพท์';
            if (value.length < 9) return 'เบอร์โทรศัพท์ไม่ถูกต้อง';
        }
    });

    if (newPhone && newPhone !== currentPhone) {
        try {
            await db.collection('members').doc(memberId).update({ phone: newPhone, updatedAt: new Date() });
            Swal.fire('สำเร็จ', 'อัปเดตเบอร์โทรศัพท์แล้ว', 'success');
            loadMembersData(); 
        } catch (error) { Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
    }
}

async function editMemberRegDate(memberId, currentISODate) {
    let displayDate = "";
    if (currentISODate) {
        const dObj = new Date(currentISODate);
        if (!isNaN(dObj)) displayDate = dObj.toISOString().split('T')[0];
    }

    const { value: newDate } = await Swal.fire({
        title: 'แก้ไขวันที่เริ่มเป็นสมาชิก', html: '<p class="small text-muted mb-2">จะมีผลกับการคำนวณเงินค้างสมทบทันที</p>',
        input: 'date', inputValue: displayDate, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก'
    });

    if (newDate) {
        try {
            const newIsoString = new Date(newDate).toISOString();
            await db.collection('members').doc(memberId).update({ registerDateObj: newIsoString, updatedAt: new Date() });
            Swal.fire('สำเร็จ', 'อัปเดตวันสมัครเรียบร้อยแล้ว', 'success');
            loadMembersData(); 
        } catch (error) { Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
    }
}

async function changeMemberStatus(memberId, currentStatus) {
    const inputOptions = { 'เป็นสมาชิก': 'เป็นสมาชิก (สถานะปกติ)', 'รอตรวจสอบ': 'รอตรวจสอบ (ระงับชั่วคราว)', 'พ้นสภาพสมาชิก': 'พ้นสภาพสมาชิก', 'เสียชีวิต': 'เสียชีวิต' };
    const { value: newStatus } = await Swal.fire({
        title: 'เปลี่ยนสถานะสมาชิก', input: 'select', inputOptions: inputOptions, inputValue: currentStatus,
        showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก'
    });

    if (newStatus && newStatus !== currentStatus) {
        try {
            await db.collection('members').doc(memberId).update({ status: newStatus, updatedAt: new Date() });
            createAuditLog('CHANGE_STATUS', `เปลี่ยนสถานะสมาชิก ID: ${memberId} จาก ${currentStatus} เป็น ${newStatus}`);
            Swal.fire('สำเร็จ', 'อัปเดตสถานะสมาชิกแล้ว', 'success');
            loadMembersData(); 
        } catch (error) { Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
    }
}

async function assignCenterToMember(memberId, currentCenter) {
    try {
        Swal.fire({ title: 'กำลังดึงข้อมูลศูนย์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        const docRef = await db.collection('settings').doc('master').get();
        if (!docRef.exists) return Swal.fire('แจ้งเตือน', 'ไม่พบข้อมูลตั้งค่า', 'warning');

        const centersArray = docRef.data().centers || []; 
        if (centersArray.length === 0) return Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลศูนย์ประสานงานในระบบ', 'warning');

        let centerOptions = {};
        centersArray.forEach(c => { centerOptions[c] = c; });
        Swal.close();

        const { value: newCenter } = await Swal.fire({
            title: 'เปลี่ยนศูนย์ประสานงาน', input: 'select', inputOptions: centerOptions, 
            inputValue: currentCenter !== 'ไม่ระบุศูนย์' ? currentCenter : '',
            inputPlaceholder: '--- กรุณาเลือกศูนย์ ---', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก'
        });

        if (newCenter && newCenter !== currentCenter) {
            await db.collection('members').doc(memberId).update({ center: newCenter, updatedAt: new Date() });
            Swal.fire('สำเร็จ', 'อัปเดตศูนย์ประสานงานแล้ว', 'success');
            loadMembersData();
        }
    } catch (error) { Swal.fire({ icon: 'error', title: 'ดึงข้อมูลล้มเหลว', text: error.message }); }
}

async function assignAdminToMember(memberId, currentAdmin) {
    const { value: newAdmin } = await Swal.fire({
        title: 'กำหนดกรรมการผู้ดูแล', input: 'text', inputLabel: 'ระบุชื่อกรรมการ',
        inputValue: currentAdmin !== 'ไม่มีผู้ดูแล' ? currentAdmin : '', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก'
    });

    if (newAdmin !== undefined && newAdmin !== currentAdmin) {
        try {
            await db.collection('members').doc(memberId).update({ responsibleAdmin: newAdmin || 'ไม่มีผู้ดูแล', updatedAt: new Date() });
            Swal.fire('สำเร็จ', 'อัปเดตกรรมการผู้ดูแลแล้ว', 'success');
            loadMembersData();
        } catch (error) { Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
    }
}

function openAdminRegisterModal() {
    document.getElementById('memberDataForm').reset();
    document.getElementById('memDocId').value = "";
    document.getElementById('memberModalTitle').innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>ขึ้นทะเบียนสมาชิกใหม่';
    document.getElementById('memRegDate').value = new Date().toISOString().split('T')[0];

    populateDropdownDirect('memVillage', uiSettingsVillages, 'เลือกหมู่บ้าน');
    populateDropdownDirect('memType', uiSettingsMemberTypes, '');
    populateDropdownDirect('memCenter', uiSettingsCenters, 'เลือกศูนย์ประสานงาน');

    const centerSelect = document.getElementById('memCenter');
    const lockWarning = document.getElementById('adminLockWarning');
    if (currentAdminData.role === 'Admin-ศูนย์ประสานงาน') {
        centerSelect.value = currentAdminData.center;
        centerSelect.setAttribute('disabled', 'true');
        lockWarning.classList.remove('d-none');
    } else {
        centerSelect.removeAttribute('disabled');
        lockWarning.classList.add('d-none');
    }

    const modal = new bootstrap.Modal(document.getElementById('memberFormModal'));
    modal.show();
}

function editMemberProfile(docId) {
    const member = allMembersCache.find(m => m.id === docId);
    if (!member) return Swal.fire('Error', 'ไม่พบข้อมูลสมาชิก', 'error');

    populateDropdownDirect('memVillage', uiSettingsVillages, 'เลือกหมู่บ้าน');
    populateDropdownDirect('memType', uiSettingsMemberTypes, '');
    populateDropdownDirect('memCenter', uiSettingsCenters, 'เลือกศูนย์ประสานงาน');

    document.getElementById('memDocId').value = member.id;
    document.getElementById('memberModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square me-2"></i>แก้ไขข้อมูลสมาชิก';
    
    document.getElementById('memNationalId').value = member.nationalId || "";
    document.getElementById('memFullName').value = member.fullName || "";
    document.getElementById('memDob').value = member.dob || "";
    document.getElementById('memPhone').value = member.phone || "";
    document.getElementById('memAddressNo').value = member.addressNo || "";
    document.getElementById('memVillage').value = member.village || "";
    document.getElementById('memVulnerability').value = member.vulnerability || "ปกติ";
    document.getElementById('memFundId').value = member.memberId || "";
    
    if (member.registerDateObj) { document.getElementById('memRegDate').value = new Date(member.registerDateObj).toISOString().split('T')[0]; }
    document.getElementById('memType').value = member.memberType || "";
    document.getElementById('memCenter').value = member.center || "";
    document.getElementById('memBeneficiary').value = member.beneficiary || "";

    const centerSelect = document.getElementById('memCenter');
    if (currentAdminData.role === 'Admin-ศูนย์ประสานงาน') { centerSelect.setAttribute('disabled', 'true'); } 
    else { centerSelect.removeAttribute('disabled'); }

    const modal = new bootstrap.Modal(document.getElementById('memberFormModal'));
    modal.show();
}

function populateDropdownDirect(selectId, dataArray, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = placeholder ? `<option value="" disabled selected>-- ${placeholder} --</option>` : '';
    dataArray.sort().forEach(item => { select.innerHTML += `<option value="${item}">${item}</option>`; });
}

async function saveMemberData(e) {
    e.preventDefault();
    
    const docId = document.getElementById('memDocId').value;
    const nationalId = document.getElementById('memNationalId').value.trim();
    const fullName = document.getElementById('memFullName').value.trim();
    const center = document.getElementById('memCenter').value;
    const actualCenter = document.getElementById('memCenter').disabled ? currentAdminData.center : center;

    showLoader(true, "กำลังตรวจสอบข้อมูล...");
    try {
        const duplicateCheck = await db.collection("members").where("nationalId", "==", nationalId).get();
        if (!duplicateCheck.empty) {
            let isDuplicate = false;
            duplicateCheck.forEach(doc => { if (doc.id !== docId) isDuplicate = true; });
            if (isDuplicate) {
                showLoader(false); return Swal.fire('ข้อมูลซ้ำ!', `เลขบัตรประชาชน ${nationalId} ถูกลงทะเบียนแล้ว`, 'error');
            }
        }
    } catch (err) { showLoader(false); return Swal.fire('ข้อผิดพลาด', 'ไม่สามารถตรวจสอบฐานข้อมูลได้', 'error'); }
    
    const payload = {
        nationalId: nationalId,
        fullName: fullName,
        dob: document.getElementById('memDob').value,
        phone: document.getElementById('memPhone').value.trim(),
        addressNo: document.getElementById('memAddressNo').value.trim(),
        village: document.getElementById('memVillage').value,
        vulnerability: document.getElementById('memVulnerability').value,
        registerDateObj: new Date(document.getElementById('memRegDate').value).toISOString(),
        memberType: document.getElementById('memType').value,
        center: actualCenter,
        beneficiary: document.getElementById('memBeneficiary').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const customMemberId = document.getElementById('memFundId').value.trim();
    if (customMemberId) payload.memberId = customMemberId;

    showLoader(true, "กำลังบันทึกข้อมูลสมาชิก...");
    try {
        if (docId) {
            await db.collection("members").doc(docId).update(payload);
            Swal.fire({icon: 'success', title: 'อัปเดตข้อมูลสำเร็จ', showConfirmButton: false, timer: 1500});
        } else {
            if (!customMemberId) {
                const yearPrefix = (new Date().getFullYear() + 543).toString().slice(-2);
                const randomNum = Math.floor(1000 + Math.random() * 9000); 
                payload.memberId = `MB${yearPrefix}-${randomNum}`; 
            }
            payload.status = "รอตรวจสอบ";
            payload.totalContribution = 0;
            payload.outstandingBalance = 0;
            payload.linkStatus = "unlinked";
            payload.responsibleAdmin = currentAdminData.name; 
            payload.timestamp = firebase.firestore.FieldValue.serverTimestamp();

            await db.collection("members").add(payload);
            Swal.fire({icon: 'success', title: 'เพิ่มสมาชิกใหม่สำเร็จ', showConfirmButton: false, timer: 1500});
        }

        const modalEl = document.getElementById('memberFormModal');
        if (modalEl && typeof bootstrap !== 'undefined') bootstrap.Modal.getInstance(modalEl)?.hide();
        loadMembersData(); showLoader(false);
    } catch (error) { showLoader(false); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
}

function generateLinkQR(memberId, memberName) {
    Swal.fire({ title: 'ผูกบัญชี LINE สมาชิก', html: `<p class="small text-muted mb-2">ให้ <b>${memberName}</b> ใช้แอป LINE สแกน QR Code นี้</p><div id="memberLinkQrContainer" class="d-flex justify-content-center bg-white p-3 rounded-4 shadow-sm mx-auto mb-3" style="width: 220px; height: 220px;"></div>`, didOpen: () => { new QRCode(document.getElementById("memberLinkQrContainer"), { text: JSON.stringify({ action: "link_member_line", ref: memberId }), width: 180, height: 180 }); }, showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง' });
}
function showPendingLinksModal() { Swal.fire({ title: 'ตรวจสอบคำขอผูกบัญชี', text: 'ระบบดึงข้อมูลคำขอผูกบัญชี LINE (จะเปิดใช้งานใน Phase ถัดไป)', icon: 'info' }); }

async function openMemberPassbook(memberId) {
    const member = allMembersCache.find(m => m.id === memberId);
    if (!member) return Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลสมาชิกนี้ในระบบ', 'error');

    document.getElementById('pbMemberName').innerText = member.fullName;
    document.getElementById('pbMemberId').innerText = `ID: ${member.memberId || '-'}`;
    document.getElementById('pbMemberType').innerText = member.memberType || '-';
    
    if (member.pictureUrl) {
        document.getElementById('pbProfileImage').innerHTML = `<img src="${member.pictureUrl}" class="w-100 h-100" style="object-fit: cover; border-radius: 16px;">`;
    } else {
        document.getElementById('pbProfileImage').innerHTML = `<i class="fa-solid fa-user"></i>`;
    }

    const modal = new bootstrap.Modal(document.getElementById('passbookModal'));
    modal.show();
    
    const tbody = document.getElementById('passbookTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังดึงประวัติธุรกรรม...</td></tr>`;

    try {
        const snap = await db.collection("transactions")
                             .where("uid", "==", memberId)
                             .where("status", "==", "อนุมัติแล้ว")
                             .get();
        
        let txs = [];
        snap.forEach(doc => {
            const d = doc.data();
            let timestamp = d.timestamp ? d.timestamp.toDate().getTime() : 0;
            if (d.transactionDate) timestamp = new Date(d.transactionDate).getTime();
            txs.push({ ...d, timestampSort: timestamp });
        });

        txs.sort((a, b) => a.timestampSort - b.timestampSort);

        let runningBalance = 0;
        let totalContribute = 0;
        let totalClaim = 0;

        txs = txs.map(tx => {
            let isIncome = tx.type.includes('รับ') || tx.type === 'สมทบเงินกองทุน';
            let amt = parseFloat(tx.amount) || 0;
            
            if (isIncome) {
                runningBalance += amt;
                totalContribute += amt;
                tx.in = amt;
                tx.out = 0;
            } else {
                runningBalance -= amt;
                totalClaim += amt;
                tx.in = 0;
                tx.out = amt;
            }
            tx.runBal = runningBalance;
            return tx;
        });

        document.getElementById('pbTotalContribute').innerText = `฿${formatMoney(totalContribute)}`;
        document.getElementById('pbTotalClaim').innerText = `฿${formatMoney(totalClaim)}`;

        txs.sort((a, b) => b.timestampSort - a.timestampSort);

        if (txs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted border-0"><i class="fa-solid fa-file-invoice mb-2 d-block text-secondary fs-4"></i>ยังไม่มีประวัติการทำธุรกรรม</td></tr>`;
            return;
        }

        let html = "";
        txs.forEach(tx => {
            const dateObj = new Date(tx.timestampSort);
            const dateStr = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${(dateObj.getFullYear()+543).toString().slice(-2)}`;
            
            let inText = tx.in > 0 ? `+${formatMoney(tx.in)}` : '-';
            let outText = tx.out > 0 ? `-${formatMoney(tx.out)}` : '-';

            html += `
            <tr class="border-bottom border-light">
                <td class="py-3 px-3 text-muted">${dateStr}</td>
                <td class="py-3">
                    <strong class="text-dark d-block" style="font-size: 0.8rem;">${tx.type}</strong>
                    <span class="text-muted" style="font-size: 0.7rem;">${tx.note || '-'}</span>
                </td>
                <td class="py-3 text-end text-success fw-bold">${inText}</td>
                <td class="py-3 text-end text-danger fw-bold">${outText}</td>
                <td class="py-3 text-end px-3 fw-bold text-dark">${formatMoney(tx.runBal)}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger"><i class="fa-solid fa-circle-exclamation me-1"></i>เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`;
    }
}