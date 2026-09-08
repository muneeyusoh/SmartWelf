// =========================================================
// ⚙️ settings.js: ตั้งค่าระบบ ระเบียบกองทุน และคณะกรรมการ (Modular)
// =========================================================

window.loadGlobalSettings = async function() {
    AppHelper.showLoader(true, "กำลังโหลดข้อมูลส่วนกลาง...");
    try {
        const snap = await db.collection("settings").doc("master").get();
        if (snap.exists) {
            const d = snap.data();

            // --- ส่วนที่ 1: ข้อมูลองค์กรพื้นฐาน ---
            const textFields = ['fundName','fundCode','fundLat','fundLng','addressNo','addressMoo','addressSub','addressDist','addressProv','addressZip','fundPhone','fundEmail','fundFb','presidentName','presidentAddress','presidentPhone','presidentEmail','coordinatorName','coordinatorAddress','coordinatorPhone','coordinatorEmail','supportOrg'];
            textFields.forEach(f => {
                const el = document.getElementById('set' + f.charAt(0).toUpperCase() + f.slice(1));
                if(el) {
                    if (d.fundInfo && d.fundInfo[f]) el.value = d.fundInfo[f]; 
                    else el.value = d[f] || ""; 
                }
            });

            if(document.getElementById('setEstablishDate')) document.getElementById('setEstablishDate').value = d.establishDate || "";
            if(document.getElementById('setAnnualFee')) document.getElementById('setAnnualFee').value = d.annualFee || 365;

            // เอาค่าจาก Database มายัดใส่ AdminState 
            AdminState.uiOptions.memberTypes = d.memberTypes || ['สมาชิกสามัญ', 'สมาชิกสมทบ'];
            AdminState.uiOptions.villages = d.inZoneVillages || [];
            AdminState.uiOptions.centers = d.centers || [];
            AdminState.uiOptions.objectives = d.objectives || ['ส่งเสริมให้สมาชิกรู้จักการออมเงิน เพื่อช่วยเหลือซึ่งกันและกัน', 'เพื่อจัดสวัสดิการแก่สมาชิกตลอดชีวิต'];
            AdminState.uiOptions.committee = d.committee || [];
            AdminState.uiOptions.rules = d.welfareRules || [];
            AdminState.uiOptions.welfareTypes = d.welfareTypes || ['สวัสดิการเจ็บป่วย/รักษาพยาบาล', 'สวัสดิการเกี่ยวกับเด็กแรกเกิด/คลอดบุตร', 'สวัสดิการกรณีเสียชีวิต', 'สวัสดิการผู้สูงอายุ', 'สวัสดิการช่วยเหลือผู้ประสบภัยพิบัติ', 'สวัสดิการเพื่อพัฒนาอาชีพ', 'สวัสดิการสนับสนุนกิจกรรมสาธารณประโยชน์'];
            AdminState.uiOptions.conditionTypes = d.conditionTypes || ['อายุการเป็นสมาชิกขั้นต่ำ', 'เฉพาะกลุ่มเปราะบาง', 'จ่ายสูงสุดต่อครั้ง', 'จ่ายสูงสุดต่อปี', 'จำกัดจำนวนครั้งต่อปี', 'เงื่อนไขทั่วไป'];

            // 🌟 จุดที่แก้ไข: เติม window. เข้าไปเพื่อให้เรียกใช้งานข้ามไฟล์ได้
            if(typeof window.renderMemberTypeBadges === 'function') window.renderMemberTypeBadges();
            if(typeof window.renderVillageBadges === 'function') window.renderVillageBadges();
            if(typeof window.renderCenterBadges === 'function') window.renderCenterBadges();

            if(typeof window.renderObjectivesList === 'function') window.renderObjectivesList(); 
            if(typeof window.renderCommitteeList === 'function') window.renderCommitteeList(); 
            if(typeof window.renderRulesList === 'function') window.renderRulesList();
            if(typeof window.renderWelfareTypeBadges === 'function') window.renderWelfareTypeBadges(); 
            if(typeof window.renderConditionTypeBadges === 'function') window.renderConditionTypeBadges();

            // --- ส่วนที่ 2: ข้อมูลเศรษฐศาสตร์แต้ม (Tokenomics) ---
            if(d.pointSettings) {
                let initialPool = d.pointSettings.initialPool || 0;
                let remainPool = d.globalPointPool || 0;
                let usedPool = initialPool - remainPool;
                if (usedPool < 0) usedPool = 0;

                if(document.getElementById('setInitialPointPool')) document.getElementById('setInitialPointPool').value = initialPool;
                if(document.getElementById('displayPointsUsed')) document.getElementById('displayPointsUsed').innerText = usedPool.toLocaleString();
                if(document.getElementById('displayPointsRemain')) document.getElementById('displayPointsRemain').innerText = remainPool.toLocaleString();

                if(document.getElementById('setPtCheckIn')) document.getElementById('setPtCheckIn').value = d.pointSettings.checkIn || 2;
                if(document.getElementById('setFomoTier1')) document.getElementById('setFomoTier1').value = d.pointSettings.fomo1 || 5;
                if(document.getElementById('setFomoTier2')) document.getElementById('setFomoTier2').value = d.pointSettings.fomo2 || 3;
                if(document.getElementById('setFomoTier3')) document.getElementById('setFomoTier3').value = d.pointSettings.fomo3 || 1;
                if(document.getElementById('setPtShopBuy')) document.getElementById('setPtShopBuy').value = d.pointSettings.shopBuy || 1;
                if(document.getElementById('setPtShopSell')) document.getElementById('setPtShopSell').value = d.pointSettings.shopSell || 2;
                if(document.getElementById('setPtInvite')) document.getElementById('setPtInvite').value = d.pointSettings.invite || 50;
                if(document.getElementById('setPtShare')) document.getElementById('setPtShare').value = d.pointSettings.shareNews || 5;
            }
        }
        AppHelper.showLoader(false);
    } catch(e) {
        AppHelper.showLoader(false); console.error(e); Swal.fire('Error', 'ไม่สามารถดึงข้อมูลการตั้งค่าได้', 'error');
    }
};

window.saveGlobalSettings = async function() {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
    try {
        const docSnap = await db.collection("settings").doc("master").get();
        let currentInitial = 0; let currentGlobal = 0;
        if (docSnap.exists) {
            currentInitial = docSnap.data().pointSettings?.initialPool || 0;
            currentGlobal = docSnap.data().globalPointPool || 0;
        }

        const initialPoolVal = parseInt(document.getElementById('setInitialPointPool')?.value) || 0;
        let newGlobalPool = currentGlobal + (initialPoolVal - currentInitial);

        const pointSettings = {
            initialPool: initialPoolVal,
            checkIn: parseInt(document.getElementById('setPtCheckIn')?.value) || 0,
            fomo1: parseInt(document.getElementById('setFomoTier1')?.value) || 0,
            fomo2: parseInt(document.getElementById('setFomoTier2')?.value) || 0,
            fomo3: parseInt(document.getElementById('setFomoTier3')?.value) || 0,
            shopBuy: parseInt(document.getElementById('setPtShopBuy')?.value) || 0,
            shopSell: parseInt(document.getElementById('setPtShopSell')?.value) || 0,
            invite: parseInt(document.getElementById('setPtInvite')?.value) || 0,
            shareNews: parseInt(document.getElementById('setPtShare')?.value) || 0
        };

        const fundInfo = {
            name: document.getElementById('setFundName')?.value.trim() || '',
            code: document.getElementById('setFundCode')?.value.trim() || '',
            lat: document.getElementById('setFundLat')?.value.trim() || '',
            lng: document.getElementById('setFundLng')?.value.trim() || '',
            addressNo: document.getElementById('setAddressNo')?.value.trim() || '',
            addressMoo: document.getElementById('setAddressMoo')?.value.trim() || '',
            addressSub: document.getElementById('setAddressSub')?.value.trim() || '',
            addressDist: document.getElementById('setAddressDist')?.value.trim() || '',
            addressProv: document.getElementById('setAddressProv')?.value.trim() || '',
            addressZip: document.getElementById('setAddressZip')?.value.trim() || '',
            fundPhone: document.getElementById('setFundPhone')?.value.trim() || '',
            fundEmail: document.getElementById('setFundEmail')?.value.trim() || '',
            fundFb: document.getElementById('setFundFb')?.value.trim() || '',
            presidentName: document.getElementById('setPresidentName')?.value.trim() || '',
            presidentAddress: document.getElementById('setPresidentAddress')?.value.trim() || '',
            presidentPhone: document.getElementById('setPresidentPhone')?.value.trim() || '',
            presidentEmail: document.getElementById('setPresidentEmail')?.value.trim() || '',
            coordinatorName: document.getElementById('setCoordinatorName')?.value.trim() || '',
            coordinatorAddress: document.getElementById('setCoordinatorAddress')?.value.trim() || '',
            coordinatorPhone: document.getElementById('setCoordinatorPhone')?.value.trim() || '',
            coordinatorEmail: document.getElementById('setCoordinatorEmail')?.value.trim() || ''
        };

        const payload = {
            establishDate: document.getElementById('setEstablishDate')?.value || '',
            supportOrg: document.getElementById('setSupportOrg')?.value.trim() || '',
            annualFee: parseFloat(document.getElementById('setAnnualFee')?.value) || 365,
            
            // เซฟค่ากลับจาก AdminState
            memberTypes: AdminState.uiOptions.memberTypes,
            inZoneVillages: AdminState.uiOptions.villages,
            centers: AdminState.uiOptions.centers,
            objectives: AdminState.uiOptions.objectives,
            welfareTypes: AdminState.uiOptions.welfareTypes,
            conditionTypes: AdminState.uiOptions.conditionTypes,
            welfareRules: AdminState.uiOptions.rules,
            committee: AdminState.uiOptions.committee,

            fundInfo: fundInfo,
            pointSettings: pointSettings,
            globalPointPool: newGlobalPool
        };

        await db.collection("settings").doc("master").set(payload, { merge: true });
        
        if(document.getElementById('headerFundName')) document.getElementById('headerFundName').innerText = fundInfo.name;
        if(typeof populateDropdown === "function") { populateDropdown("filterCenter", AdminState.uiOptions.centers); populateDropdown("filterType", AdminState.uiOptions.memberTypes); }

        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: 'ข้อมูลส่วนกลางและระบบแต้มถูกบันทึกเรียบร้อย', showConfirmButton: false, timer: 1500 });
        loadGlobalSettings();
    } catch(e) {
        console.error(e); Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
};

window.openMemberSearchModal = async function(targetRole) {
    if(AdminState.membersCache.length === 0) return Swal.fire('แจ้งเตือน', 'กรุณาไปเปิดแท็บ "สมาชิก" เพื่อดึงฐานข้อมูลก่อน', 'warning');

    let optionsHtml = '<option value="" disabled selected>-- พิมพ์ค้นหาและเลือกสมาชิก --</option>';
    AdminState.membersCache.forEach(m => { optionsHtml += `<option value="${m.id}">${m.nationalId || '-'} : ${m.fullName}</option>`; });

    const { value: memberId } = await Swal.fire({
        title: targetRole === 'president' ? 'ดึงข้อมูลประธาน' : 'ดึงข้อมูลผู้ประสานงาน',
        html: `<select id="swalMemberSelect" class="form-select border-primary p-2">${optionsHtml}</select>`,
        showCancelButton: true, confirmButtonText: 'ดึงข้อมูล', cancelButtonText: 'ยกเลิก',
        preConfirm: () => document.getElementById('swalMemberSelect').value
    });

    if (memberId) {
        const member = AdminState.membersCache.find(m => m.id === memberId);
        if(!member) return;

        let fullAddr = [member.addressNo?"เลขที่ "+member.addressNo:"", member.addressMoo?"ม."+member.addressMoo:"", member.addressSub?"ต."+member.addressSub:"", member.addressDist?"อ."+member.addressDist:"", member.addressProv?"จ."+member.addressProv:"", member.addressZip||""].filter(Boolean).join(" ");
        
        if (targetRole === 'president') {
            document.getElementById('setPresidentName').value = member.fullName || '';
            document.getElementById('setPresidentAddress').value = fullAddr || '-';
            document.getElementById('setPresidentPhone').value = member.phone || '';
            document.getElementById('setPresidentEmail').value = member.email || '';
        } else {
            document.getElementById('setCoordinatorName').value = member.fullName || '';
            document.getElementById('setCoordinatorAddress').value = fullAddr || '-';
            document.getElementById('setCoordinatorPhone').value = member.phone || '';
            document.getElementById('setCoordinatorEmail').value = member.email || '';
        }
        Swal.fire({icon: 'success', title: 'ดึงข้อมูลสำเร็จ', showConfirmButton: false, timer: 1000});
    }
};

// ===================== จัดการวัตถุประสงค์ =====================
window.renderObjectivesList = function() {
    const container = document.getElementById('objectivesContainer'); if(!container) return; container.innerHTML = "";
    AdminState.uiOptions.objectives.forEach((obj, idx) => {
        container.innerHTML += `<div class="d-flex align-items-center justify-content-between p-2 bg-light border rounded-3 mb-1"><span style="font-size: 0.85rem;"><i class="fa-solid fa-check text-success me-2"></i>${obj}</span><button class="btn btn-sm text-danger py-0" onclick="removeObjectiveItem(${idx})"><i class="fa-solid fa-trash"></i></button></div>`;
    });
};
window.addObjectiveItem = function() {
    const val = document.getElementById('newObjectiveInput').value.trim();
    if(!val || AdminState.uiOptions.objectives.includes(val)) return;
    AdminState.uiOptions.objectives.push(val); document.getElementById('newObjectiveInput').value = ""; renderObjectivesList();
};
window.removeObjectiveItem = function(idx) { AdminState.uiOptions.objectives.splice(idx, 1); renderObjectivesList(); };

// ===================== จัดการโครงสร้างคณะกรรมการ =====================
window.addCommitteeMember = async function() {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    const name = document.getElementById('comName').value.trim(); const pos = document.getElementById('comPos').value.trim();
    const role = document.getElementById('comRole').value.trim(); const phone = document.getElementById('comPhone').value.trim(); const email = document.getElementById('comEmail').value.trim();
    if (!name || !pos) return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อและตำแหน่งให้ครบถ้วน', 'warning');

    AppHelper.showLoader(true, "กำลังบันทึกข้อมูล..."); 
    AdminState.uiOptions.committee.push({ name, pos, role, phone, email });
    try {
        await db.collection("settings").doc("master").set({ committee: AdminState.uiOptions.committee }, { merge: true });
        document.getElementById('comName').value = ""; document.getElementById('comPos').value = ""; document.getElementById('comRole').value = ""; document.getElementById('comPhone').value = ""; document.getElementById('comEmail').value = "";
        const formCollapse = document.getElementById('collapseCommitteeForm');
        if(formCollapse && typeof bootstrap !== 'undefined') bootstrap.Collapse.getInstance(formCollapse)?.hide();
        renderCommitteeList(); AppHelper.showLoader(false); Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1000});
    } catch(e) { AdminState.uiOptions.committee.pop(); AppHelper.showLoader(false); Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
};

window.removeCommitteeMember = async function(index) {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    Swal.fire({ title: 'ยืนยันการลบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ลบข้อมูล' })
    .then(async (result) => {
        if (result.isConfirmed) {
            const backup = [...AdminState.uiOptions.committee]; AdminState.uiOptions.committee.splice(index, 1);
            AppHelper.showLoader(true, "กำลังลบข้อมูล...");
            try { await db.collection("settings").doc("master").set({ committee: AdminState.uiOptions.committee }, { merge: true }); renderCommitteeList(); AppHelper.showLoader(false); } 
            catch(e) { AdminState.uiOptions.committee = backup; AppHelper.showLoader(false); Swal.fire('Error', 'ลบไม่สำเร็จ', 'error'); }
        }
    });
};

window.renderCommitteeList = function() {
    const container = document.getElementById('committeeContainer'); if(!container) return; container.innerHTML = "";
    if (AdminState.uiOptions.committee.length === 0) return container.innerHTML = "<div class='text-center text-muted small p-2 bg-light rounded-4 border'>ยังไม่มีข้อมูลคณะกรรมการ</div>";
    AdminState.uiOptions.committee.forEach((com, index) => {
        container.innerHTML += `
        <div class="bg-light border rounded-3 p-2 shadow-sm transition">
            <div class="d-flex justify-content-between align-items-center cursor-pointer" onclick="toggleCollapse('com-detail-${index}', 'com-arrow-${index}')">
                <div class="w-100"><strong class="text-dark d-block" style="font-size: 0.85rem;">${com.name}</strong><div class="d-flex align-items-center gap-2 mt-1"><span class="badge bg-warning text-dark border shadow-sm" style="font-size: 0.65rem;">${com.pos}</span><span class="text-muted" style="font-size: 0.7rem;"><i class="fa-solid fa-phone me-1"></i>${com.phone || '-'}</span></div></div>
                <div class="text-muted ms-2 p-1"><i class="fa-solid fa-chevron-down transition" id="com-arrow-${index}"></i></div>
            </div>
            <div class="collapse mt-2 pt-2 border-top" id="com-detail-${index}">
                <div class="row g-1 mb-2" style="font-size: 0.75rem;"><div class="col-12"><span class="text-muted">หน้าที่:</span> <strong class="text-dark">${com.role || '-'}</strong></div><div class="col-12"><span class="text-muted">อีเมล:</span> <strong class="text-dark">${com.email || '-'}</strong></div></div>
                <div class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-pill" style="font-size: 0.7rem;" onclick="removeCommitteeMember(${index})"><i class="fa-solid fa-trash"></i> ลบออก</button></div>
            </div>
        </div>`;
    });
};
// ===================== ระบบ GPS =====================
window.getCurrentLocation = function() {
    if (!navigator.geolocation) return Swal.fire('แจ้งเตือน', 'เบราว์เซอร์ไม่รองรับการระบุพิกัด GPS', 'warning');
    AppHelper.showLoader(true, "กำลังดึงพิกัด GPS...");
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude.toFixed(6); const lng = pos.coords.longitude.toFixed(6);
            if (document.getElementById('setFundLat')) document.getElementById('setFundLat').value = lat;
            if (document.getElementById('setFundLng')) document.getElementById('setFundLng').value = lng;
            AppHelper.showLoader(false);
            Swal.fire({ icon: 'success', title: 'บันทึกพิกัดแล้ว', text: `ละติจูด: ${lat}, ลองจิจูด: ${lng}`, timer: 1500, showConfirmButton: false });
        },
        err => { AppHelper.showLoader(false); Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเข้าถึงพิกัด GPS ได้: ' + err.message, 'error'); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};