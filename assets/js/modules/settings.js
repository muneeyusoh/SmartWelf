// =========================================================
// ⚙️ settings.js: ตั้งค่าระบบ ระเบียบกองทุน และคณะกรรมการ
// =========================================================
async function loadGlobalSettings() {
    showLoader(true, "กำลังโหลดข้อมูลระบบส่วนกลาง...");
    try {
        const snap = await db.collection("settings").doc("master").get();
        if (snap.exists) {
            const d = snap.data();
            
            const textFields = ['fundName','fundCode','fundLat','fundLng','addressNo','addressMoo','addressSub','addressDist','addressProv','addressZip','fundPhone','fundEmail','fundFb','presidentName','presidentAddress','presidentPhone','presidentEmail','coordinatorName','coordinatorAddress','coordinatorPhone','coordinatorEmail','supportOrg'];
            textFields.forEach(f => { const el = document.getElementById('set' + f.charAt(0).toUpperCase() + f.slice(1)); if(el) el.value = d[f] || ""; });

            if(document.getElementById('setEstablishDate')) document.getElementById('setEstablishDate').value = d.establishDate || "";
            if(document.getElementById('setAnnualFee')) document.getElementById('setAnnualFee').value = d.annualFee || 365;
            
            uiSettingsMemberTypes = d.memberTypes || ['สมาชิกสามัญ', 'สมาชิกสมทบ'];
            uiSettingsVillages = d.inZoneVillages || [];
            uiSettingsCenters = d.centers || [];
            uiSettingsObjectives = d.objectives || ['ส่งเสริมให้สมาชิกรู้จักการออมเงิน เพื่อช่วยเหลือซึ่งกันและกัน', 'เพื่อจัดสวัสดิการแก่สมาชิกตลอดชีวิต'];
            uiSettingsCommittee = d.committee || [];
            uiSettingsRules = d.welfareRules || [];
            uiSettingsWelfareTypes = d.welfareTypes || ['สวัสดิการเจ็บป่วย/รักษาพยาบาล', 'สวัสดิการเกี่ยวกับเด็กแรกเกิด/คลอดบุตร', 'สวัสดิการกรณีเสียชีวิต', 'สวัสดิการผู้สูงอายุ', 'สวัสดิการช่วยเหลือผู้ประสบภัยพิบัติ', 'สวัสดิการเพื่อพัฒนาอาชีพ', 'สวัสดิการสนับสนุนกิจกรรมสาธารณประโยชน์'];
            uiSettingsConditionTypes = d.conditionTypes || ['อายุการเป็นสมาชิกขั้นต่ำ', 'เฉพาะกลุ่มเปราะบาง', 'จ่ายสูงสุดต่อครั้ง', 'จ่ายสูงสุดต่อปี', 'จำกัดจำนวนครั้งต่อปี', 'เงื่อนไขทั่วไป'];

            if(typeof renderMemberTypeBadges === 'function') renderMemberTypeBadges(); 
            if(typeof renderVillageBadges === 'function') renderVillageBadges(); 
            if(typeof renderCenterBadges === 'function') renderCenterBadges();
            
            renderObjectivesList(); renderCommitteeList(); renderRulesList();
            renderWelfareTypeBadges(); renderConditionTypeBadges();
        }
        showLoader(false);
    } catch(e) { showLoader(false); console.error(e); Swal.fire('Error', 'ไม่สามารถดึงข้อมูลการตั้งค่าได้', 'error'); }
}

async function saveGlobalSettings() {
    if(currentAdminData && currentAdminData.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    
    const payload = {
        fundName: document.getElementById('setFundName')?.value.trim() || '',
        fundCode: document.getElementById('setFundCode')?.value.trim() || '',
        fundLat: document.getElementById('setFundLat')?.value.trim() || '',
        fundLng: document.getElementById('setFundLng')?.value.trim() || '',
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
        coordinatorEmail: document.getElementById('setCoordinatorEmail')?.value.trim() || '',
        
        establishDate: document.getElementById('setEstablishDate')?.value || '',
        supportOrg: document.getElementById('setSupportOrg')?.value.trim() || '',
        annualFee: parseFloat(document.getElementById('setAnnualFee')?.value) || 365,
        
        memberTypes: uiSettingsMemberTypes,
        inZoneVillages: uiSettingsVillages,
        centers: uiSettingsCenters,
        objectives: uiSettingsObjectives,
        welfareTypes: uiSettingsWelfareTypes,
        conditionTypes: uiSettingsConditionTypes
    };
    
    showLoader(true, "กำลังอัปเดตระบบส่วนกลาง...");
    try {
        await db.collection("settings").doc("master").set(payload, { merge: true });
        fundSettings = { ...fundSettings, ...payload };
        
        if(document.getElementById('headerFundName')) document.getElementById('headerFundName').innerText = payload.fundName;
        if(typeof populateDropdown === "function") { populateDropdown("filterCenter", uiSettingsCenters); populateDropdown("filterType", uiSettingsMemberTypes); }

        showLoader(false); 
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: 'ข้อมูลพื้นฐานองค์กรถูกบันทึกเรียบร้อย', showConfirmButton: false, timer: 1500 });
    } catch(e) { showLoader(false); console.error(e); Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error'); }
}

async function openMemberSearchModal(targetRole) {
    if(allMembersCache.length === 0) return Swal.fire('แจ้งเตือน', 'กรุณาไปเปิดแท็บ "สมาชิก" เพื่อดึงฐานข้อมูลก่อน', 'warning');

    let optionsHtml = '<option value="" disabled selected>-- พิมพ์ค้นหาและเลือกสมาชิก --</option>';
    allMembersCache.forEach(m => { optionsHtml += `<option value="${m.id}">${m.nationalId || '-'} : ${m.fullName}</option>`; });

    const { value: memberId } = await Swal.fire({
        title: targetRole === 'president' ? 'ดึงข้อมูลประธาน' : 'ดึงข้อมูลผู้ประสานงาน',
        html: `<select id="swalMemberSelect" class="form-select border-primary p-2">${optionsHtml}</select>`,
        showCancelButton: true, confirmButtonText: 'ดึงข้อมูล', cancelButtonText: 'ยกเลิก',
        preConfirm: () => document.getElementById('swalMemberSelect').value
    });

    if (memberId) {
        const member = allMembersCache.find(m => m.id === memberId);
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
}

function renderObjectivesList() {
    const container = document.getElementById('objectivesContainer'); if(!container) return; container.innerHTML = "";
    uiSettingsObjectives.forEach((obj, idx) => {
        container.innerHTML += `<div class="d-flex align-items-center justify-content-between p-2 bg-light border rounded-3 mb-1"><span style="font-size: 0.85rem;"><i class="fa-solid fa-check text-success me-2"></i>${obj}</span><button class="btn btn-sm text-danger py-0" onclick="removeObjectiveItem(${idx})"><i class="fa-solid fa-trash"></i></button></div>`;
    });
}
function addObjectiveItem() {
    const val = document.getElementById('newObjectiveInput').value.trim();
    if(!val || uiSettingsObjectives.includes(val)) return;
    uiSettingsObjectives.push(val); document.getElementById('newObjectiveInput').value = ""; renderObjectivesList();
}
function removeObjectiveItem(idx) { uiSettingsObjectives.splice(idx, 1); renderObjectivesList(); }

async function addCommitteeMember() {
    if(currentAdminData && currentAdminData.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    const name = document.getElementById('comName').value.trim(); const pos = document.getElementById('comPos').value.trim();
    const role = document.getElementById('comRole').value.trim(); const phone = document.getElementById('comPhone').value.trim(); const email = document.getElementById('comEmail').value.trim();
    if (!name || !pos) return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อและตำแหน่งให้ครบถ้วน', 'warning');

    showLoader(true, "กำลังบันทึกข้อมูล..."); uiSettingsCommittee.push({ name, pos, role, phone, email });
    try {
        await db.collection("settings").doc("master").set({ committee: uiSettingsCommittee }, { merge: true });
        document.getElementById('comName').value = ""; document.getElementById('comPos').value = ""; document.getElementById('comRole').value = ""; document.getElementById('comPhone').value = ""; document.getElementById('comEmail').value = "";
        const formCollapse = document.getElementById('collapseCommitteeForm');
        if(formCollapse && typeof bootstrap !== 'undefined') bootstrap.Collapse.getInstance(formCollapse)?.hide();
        renderCommitteeList(); showLoader(false); Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1000});
    } catch(e) { uiSettingsCommittee.pop(); showLoader(false); Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error'); }
}

async function removeCommitteeMember(index) {
    if(currentAdminData && currentAdminData.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    Swal.fire({ title: 'ยืนยันการลบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ลบข้อมูล' })
    .then(async (result) => {
        if (result.isConfirmed) {
            const backup = [...uiSettingsCommittee]; uiSettingsCommittee.splice(index, 1);
            showLoader(true, "กำลังลบข้อมูล...");
            try { await db.collection("settings").doc("master").set({ committee: uiSettingsCommittee }, { merge: true }); renderCommitteeList(); showLoader(false); } 
            catch(e) { uiSettingsCommittee = backup; showLoader(false); Swal.fire('Error', 'ลบไม่สำเร็จ', 'error'); }
        }
    });
}

function renderCommitteeList() {
    const container = document.getElementById('committeeContainer'); if(!container) return; container.innerHTML = "";
    if (uiSettingsCommittee.length === 0) return container.innerHTML = "<div class='text-center text-muted small p-2 bg-light rounded-4 border'>ยังไม่มีข้อมูลคณะกรรมการ</div>";
    uiSettingsCommittee.forEach((com, index) => {
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
}

async function saveWelfareRule() {
    if(currentAdminData && currentAdminData.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');

    let ruleName = document.getElementById('ruleName').value;
    if (ruleName === 'อื่นๆ (ระบุเอง)' || !ruleName) {
        let customVal = document.getElementById('ruleNameCustom')?.value.trim();
        if(customVal) ruleName = customVal;
        else ruleName = document.getElementById('ruleName').value.trim(); 
    }
    if (!ruleName) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อสวัสดิการ', 'warning');

    const conditionRows = document.querySelectorAll('.condition-row'); let conditions = [];
    conditionRows.forEach(row => {
        const type = row.querySelector('.cond-type').value; const value = row.querySelector('.cond-value').value.trim(); const unit = row.querySelector('.cond-unit').value;
        if (value) conditions.push({ type, value, unit });
    });
    if (conditions.length === 0) return Swal.fire('แจ้งเตือน', 'กรุณาเพิ่มเงื่อนไขอย่างน้อย 1 ข้อ', 'warning');

    showLoader(true, "กำลังบันทึกระเบียบ...");
    const ruleObject = { id: "RULE-" + Date.now(), name: ruleName, conditions: conditions, createdAt: new Date().toISOString() };
    uiSettingsRules.push(ruleObject);
    
    try {
        await db.collection("settings").doc("master").set({ welfareRules: uiSettingsRules }, { merge: true });
        if(document.getElementById('ruleName').tagName === 'SELECT') document.getElementById('ruleName').selectedIndex = 0;
        else document.getElementById('ruleName').value = '';
        if(document.getElementById('ruleNameCustom')) { document.getElementById('ruleNameCustom').value = ''; document.getElementById('ruleNameCustom').classList.add('d-none'); }
        document.getElementById('ruleConditionsContainer').innerHTML = ''; addRuleConditionRow(); 
        const formCollapse = document.getElementById('collapseRuleForm');
        if(formCollapse && typeof bootstrap !== 'undefined') bootstrap.Collapse.getInstance(formCollapse)?.hide();
        renderRulesList(); showLoader(false); Swal.fire('สำเร็จ', 'บันทึกระเบียบสวัสดิการแล้ว', 'success');
    } catch(e) { uiSettingsRules.pop(); showLoader(false); Swal.fire('Error', 'บันทึกระเบียบไม่สำเร็จ', 'error'); }
}

async function removeWelfareRule(index) {
    if(currentAdminData && currentAdminData.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    Swal.fire({ title: 'ยืนยันการลบระเบียบ?', text: "เมื่อลบแล้วจะไม่นำมาคำนวณสิทธิ์ให้สมาชิกอีก", icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ลบข้อมูล' })
    .then(async (result) => {
        if (result.isConfirmed) {
            const backup = [...uiSettingsRules]; uiSettingsRules.splice(index, 1);
            showLoader(true, "กำลังลบ...");
            try { await db.collection("settings").doc("master").set({ welfareRules: uiSettingsRules }, { merge: true }); renderRulesList(); showLoader(false); } 
            catch(e) { uiSettingsRules = backup; showLoader(false); Swal.fire('Error', 'ลบข้อมูลไม่สำเร็จ', 'error'); }
        }
    });
}

function renderRulesList() {
    const container = document.getElementById('list-rules'); if(!container) return; container.innerHTML = "";
    if(uiSettingsRules.length === 0) return container.innerHTML = "<div class='text-center text-muted small p-4 bg-light rounded-4 border border-dashed'>ยังไม่มีการกำหนดระเบียบกองทุน</div>";

    uiSettingsRules.forEach((rule, index) => {
        let condHtml = "";
        rule.conditions.forEach((c) => {
            let badgeClass = "bg-secondary";
            if(c.type.includes('อายุสมาชิก') || c.type.includes('เปราะบาง')) badgeClass = "bg-info text-dark";
            else if(c.type.includes('จ่ายสูงสุด')) badgeClass = "bg-success";
            else if(c.type.includes('จำกัด')) badgeClass = "bg-warning text-dark";
            condHtml += `<div class="d-flex justify-content-between align-items-center border-bottom py-2 border-opacity-50" style="font-size: 0.8rem;"><div><span class="badge ${badgeClass} me-2 shadow-sm" style="font-size: 0.65rem; min-width: 100px;">${c.type}</span><span class="text-dark">ต้องระบุที่: <strong class="text-primary">${c.value}</strong> <span class="text-muted">${c.unit}</span></span></div></div>`;
        });
        container.innerHTML += `
        <div class="admin-card border border-primary border-opacity-25 p-0 mb-0 shadow-sm transition overflow-hidden">
            <div class="d-flex justify-content-between align-items-center cursor-pointer bg-light p-3" onclick="toggleCollapse('rule-detail-${index}', 'rule-arrow-${index}')">
                <div class="w-100"><strong class="text-primary d-block mb-1" style="font-size: 0.9rem;"><i class="fa-solid fa-shield-heart me-2 text-primary"></i> ${rule.name}</strong><div class="d-flex align-items-center gap-3"><span class="badge bg-white border text-muted shadow-sm" style="font-size:0.65rem;">รหัส: ${rule.id || 'N/A'}</span><span class="text-success" style="font-size: 0.75rem;"><i class="fa-solid fa-list-check me-1"></i> ${rule.conditions.length} เงื่อนไข</span></div></div>
                <div class="text-muted ms-3 bg-white p-2 rounded-circle shadow-sm"><i class="fa-solid fa-chevron-down transition" id="rule-arrow-${index}"></i></div>
            </div>
            <div class="collapse border-top border-primary border-opacity-25 bg-white" id="rule-detail-${index}">
                <div class="p-3"><strong class="small text-dark d-block pb-2 mb-2 border-bottom"><i class="fa-solid fa-gears text-muted me-1"></i> กฎเกณฑ์ที่ระบบจะใช้ประมวลผล:</strong><div class="mb-3">${condHtml}</div><div class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-1 px-3 rounded-pill fw-bold" onclick="removeWelfareRule(${index})"><i class="fa-solid fa-trash me-1"></i> ลบระเบียบนี้</button></div></div>
            </div>
        </div>`;
    });
}

function addRuleConditionRow() {
    const container = document.getElementById('ruleConditionsContainer'); if(!container) return;
    const rowId = 'cond-' + Date.now();
    let conditionOptionsHtml = '';
    uiSettingsConditionTypes.forEach(cond => { conditionOptionsHtml += `<option value="${cond}">${cond}</option>`; });
    if(!conditionOptionsHtml) { conditionOptionsHtml = `<option value="เงื่อนไขทั่วไป">เงื่อนไขทั่วไป</option>`; }

    const html = `
    <div class="row g-2 align-items-center condition-row bg-light p-2 rounded-3 border mb-1" id="${rowId}">
        <div class="col-12 col-md-5"><select class="form-select-modern w-100 form-select-sm cond-type bg-white border-0 shadow-sm" style="font-size: 0.8rem;">${conditionOptionsHtml}</select></div>
        <div class="col-8 col-md-4"><input type="text" class="form-control-modern w-100 form-control-sm cond-value bg-white border-0 shadow-sm" placeholder="ระบุจำนวน/รายละเอียด" style="font-size: 0.8rem;"></div>
        <div class="col-4 col-md-2"><select class="form-select-modern w-100 form-select-sm cond-unit bg-white border-0 shadow-sm" style="font-size: 0.8rem;"><option value="วัน">วัน</option><option value="เดือน">เดือน</option><option value="ปี">ปี</option><option value="บาท">บาท</option><option value="ครั้ง">ครั้ง</option><option value="">(ไม่มีหน่วย)</option></select></div>
        <div class="col-12 col-md-1 text-end text-md-center mt-2 mt-md-0"><button type="button" class="btn btn-sm text-danger p-1 bg-white rounded-circle shadow-sm" onclick="document.getElementById('${rowId}').remove()" title="ลบเงื่อนไขนี้"><i class="fa-solid fa-xmark"></i></button></div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function toggleCustomRuleName(selectObj) {
    const customInput = document.getElementById('ruleNameCustom'); if(!customInput) return;
    if (selectObj.value === 'อื่นๆ (ระบุเอง)') { customInput.classList.remove('d-none'); customInput.focus(); } 
    else { customInput.classList.add('d-none'); customInput.value = ""; }
}

function renderWelfareTypeBadges() {
    const container = document.getElementById('welfareTypesContainer'); if(!container) return; container.innerHTML = "";
    uiSettingsWelfareTypes.forEach((type, index) => { container.innerHTML += `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger d-flex align-items-center py-2 px-3 shadow-sm" style="font-size: 0.8rem; border-radius: 12px;">${type} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="removeWelfareTypeBadge(${index})"></i></span>`; });
    const ruleSelect = document.getElementById('ruleName');
    if (ruleSelect && ruleSelect.tagName === 'SELECT') {
        ruleSelect.innerHTML = '<option value="" disabled selected>-- เลือกประเภทสวัสดิการ --</option>';
        uiSettingsWelfareTypes.forEach(type => { ruleSelect.innerHTML += `<option value="${type}">${type}</option>`; });
        ruleSelect.innerHTML += '<option value="อื่นๆ (ระบุเอง)">อื่นๆ (ระบุเอง)</option>';
    }
}
function addWelfareTypeBadge() { const val = document.getElementById('newWelfareTypeInput').value.trim(); if(!val || uiSettingsWelfareTypes.includes(val)) return; uiSettingsWelfareTypes.push(val); document.getElementById('newWelfareTypeInput').value = ""; renderWelfareTypeBadges(); }
function removeWelfareTypeBadge(index) { uiSettingsWelfareTypes.splice(index, 1); renderWelfareTypeBadges(); }

function renderConditionTypeBadges() {
    const container = document.getElementById('conditionTypesContainer'); if(!container) return; container.innerHTML = "";
    uiSettingsConditionTypes.forEach((type, index) => { container.innerHTML += `<span class="badge bg-warning bg-opacity-10 text-dark border border-warning d-flex align-items-center py-2 px-3 shadow-sm" style="font-size: 0.8rem; border-radius: 12px;">${type} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="removeConditionTypeBadge(${index})"></i></span>`; });
}
function addConditionTypeBadge() { const val = document.getElementById('newConditionTypeInput').value.trim(); if(!val || uiSettingsConditionTypes.includes(val)) return; uiSettingsConditionTypes.push(val); document.getElementById('newConditionTypeInput').value = ""; renderConditionTypeBadges(); }
function removeConditionTypeBadge(index) { uiSettingsConditionTypes.splice(index, 1); renderConditionTypeBadges(); }