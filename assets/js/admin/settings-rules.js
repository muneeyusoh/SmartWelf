// =========================================================
// ⚖️ settings-rules.js: จัดการระเบียบสวัสดิการและโครงสร้างกลุ่ม
// =========================================================

// 🌟 เพิ่มฟังก์ชันนี้ เพื่อให้ HTML มีตัวเชื่อมตอนกดคลิกเมนู
window.loadRulesData = function() {
    // ให้ดึงข้อมูลจากส่วนกลางมาแสดงผลได้เลย (เพราะเป็นฐานข้อมูลก้อนเดียวกัน)
    if (typeof window.loadGlobalSettings === 'function') {
        window.loadGlobalSettings();
    } else {
        // หากดึงไม่ได้ ให้พยายามเรนเดอร์จาก Cache ในระบบแทน
        window.renderMemberTypeBadges();
        window.renderVillageBadges();
        window.renderCenterBadges();
        window.renderWelfareTypeBadges();
        window.renderConditionTypeBadges();
        window.renderRulesList();
    }
};

// =========================================================
// ⚖️ settings-rules.js: จัดการระเบียบสวัสดิการและโครงสร้างกลุ่ม
// =========================================================

window.renderWelfareTypeBadges = function() {
    const container = document.getElementById('welfareTypesContainer'); if(!container) return; container.innerHTML = "";
    (AdminState.uiOptions.welfareTypes || []).forEach((type, index) => { 
        container.innerHTML += `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger d-flex align-items-center py-2 px-3 shadow-sm mb-2" style="font-size: 0.8rem; border-radius: 12px;">${type} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="window.removeWelfareTypeBadge(${index})"></i></span>`; 
    });
    
    const ruleSelect = document.getElementById('ruleName');
    if (ruleSelect && ruleSelect.tagName === 'SELECT') {
        ruleSelect.innerHTML = '<option value="" disabled selected>-- เลือกประเภทสวัสดิการ --</option>';
        (AdminState.uiOptions.welfareTypes || []).forEach(type => { ruleSelect.innerHTML += `<option value="${type}">${type}</option>`; });
        ruleSelect.innerHTML += '<option value="อื่นๆ (ระบุเอง)">อื่นๆ (ระบุเอง)</option>';
    }
};

window.addWelfareTypeBadge = async function() { 
    const input = document.getElementById('newWelfareTypeInput'); const val = input.value.trim(); 
    if(!val || (AdminState.uiOptions.welfareTypes || []).includes(val)) return; 
    if(!AdminState.uiOptions.welfareTypes) AdminState.uiOptions.welfareTypes = [];
    AdminState.uiOptions.welfareTypes.push(val); input.value = ""; window.renderWelfareTypeBadges(); 
    await db.collection("settings").doc("master").set({ welfareTypes: AdminState.uiOptions.welfareTypes }, { merge: true });
};

window.removeWelfareTypeBadge = async function(index) { 
    AdminState.uiOptions.welfareTypes.splice(index, 1); window.renderWelfareTypeBadges(); 
    await db.collection("settings").doc("master").set({ welfareTypes: AdminState.uiOptions.welfareTypes }, { merge: true });
};

window.renderConditionTypeBadges = function() {
    const container = document.getElementById('conditionTypesContainer'); if(!container) return; container.innerHTML = "";
    (AdminState.uiOptions.conditionTypes || []).forEach((type, index) => { 
        container.innerHTML += `<span class="badge bg-warning bg-opacity-10 text-dark border border-warning d-flex align-items-center py-2 px-3 shadow-sm mb-2" style="font-size: 0.8rem; border-radius: 12px;">${type} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="window.removeConditionTypeBadge(${index})"></i></span>`; 
    });
};

window.addConditionTypeBadge = async function() { 
    const input = document.getElementById('newConditionTypeInput'); const val = input.value.trim(); 
    if(!val || (AdminState.uiOptions.conditionTypes || []).includes(val)) return; 
    if(!AdminState.uiOptions.conditionTypes) AdminState.uiOptions.conditionTypes = [];
    AdminState.uiOptions.conditionTypes.push(val); input.value = ""; window.renderConditionTypeBadges(); 
    await db.collection("settings").doc("master").set({ conditionTypes: AdminState.uiOptions.conditionTypes }, { merge: true });
};

window.removeConditionTypeBadge = async function(index) { 
    AdminState.uiOptions.conditionTypes.splice(index, 1); window.renderConditionTypeBadges(); 
    await db.collection("settings").doc("master").set({ conditionTypes: AdminState.uiOptions.conditionTypes }, { merge: true });
};

window.saveWelfareRule = async function() {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');

    let ruleName = document.getElementById('ruleName').value;
    if (ruleName === 'อื่นๆ (ระบุเอง)' || !ruleName) {
        let customVal = document.getElementById('ruleNameCustom')?.value.trim();
        if(customVal) ruleName = customVal; else ruleName = document.getElementById('ruleName')?.value.trim(); 
    }
    if (!ruleName) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อสวัสดิการ', 'warning');

    const conditionRows = document.querySelectorAll('.condition-row'); let conditions = [];
    conditionRows.forEach(row => {
        const type = row.querySelector('.cond-type').value; const value = row.querySelector('.cond-value').value.trim(); const unit = row.querySelector('.cond-unit').value;
        if (value) conditions.push({ type, value, unit });
    });
    if (conditions.length === 0) return Swal.fire('แจ้งเตือน', 'กรุณาเพิ่มเงื่อนไขอย่างน้อย 1 ข้อ', 'warning');

    AppHelper.showLoader(true, "กำลังบันทึกระเบียบ...");
    const ruleObject = { id: "RULE-" + Date.now(), name: ruleName, conditions: conditions, createdAt: new Date().toISOString() };
    
    if(!AdminState.uiOptions.rules) AdminState.uiOptions.rules = []; AdminState.uiOptions.rules.push(ruleObject);
    
    try {
        await db.collection("settings").doc("master").set({ welfareRules: AdminState.uiOptions.rules }, { merge: true });
        
        if(document.getElementById('ruleName').tagName === 'SELECT') document.getElementById('ruleName').selectedIndex = 0;
        else document.getElementById('ruleName').value = '';
        if(document.getElementById('ruleNameCustom')) { document.getElementById('ruleNameCustom').value = ''; document.getElementById('ruleNameCustom').classList.add('d-none'); }
        
        document.getElementById('ruleConditionsContainer').innerHTML = ''; window.addRuleConditionRow(); 
        const formCollapse = document.getElementById('collapseRuleForm'); if(formCollapse && typeof bootstrap !== 'undefined') bootstrap.Collapse.getInstance(formCollapse)?.hide();
        window.renderRulesList(); AppHelper.showLoader(false); Swal.fire('สำเร็จ', 'บันทึกระเบียบสวัสดิการแล้ว', 'success');
    } catch(e) { AdminState.uiOptions.rules.pop(); AppHelper.showLoader(false); Swal.fire('Error', 'บันทึกระเบียบไม่สำเร็จ', 'error'); }
};

window.removeWelfareRule = async function(index) {
    if(AdminState.currentAdmin && AdminState.currentAdmin.role !== 'Admin-Master') return Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin-Master เท่านั้น', 'error');
    Swal.fire({ title: 'ยืนยันการลบระเบียบ?', text: "เมื่อลบแล้วจะไม่นำมาคำนวณสิทธิ์ให้สมาชิกอีก", icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'ลบข้อมูล' }).then(async (result) => {
        if (result.isConfirmed) {
            const backup = [...AdminState.uiOptions.rules]; AdminState.uiOptions.rules.splice(index, 1);
            AppHelper.showLoader(true, "กำลังลบ...");
            try { await db.collection("settings").doc("master").set({ welfareRules: AdminState.uiOptions.rules }, { merge: true }); window.renderRulesList(); AppHelper.showLoader(false); } 
            catch(e) { AdminState.uiOptions.rules = backup; AppHelper.showLoader(false); Swal.fire('Error', 'ลบข้อมูลไม่สำเร็จ', 'error'); }
        }
    });
};

window.renderRulesList = function() {
    const container = document.getElementById('list-rules'); if(!container) return; container.innerHTML = "";
    if(!AdminState.uiOptions.rules || AdminState.uiOptions.rules.length === 0) return container.innerHTML = "<div class='text-center text-muted small p-4 bg-light rounded-4 border border-dashed'>ยังไม่มีการกำหนดระเบียบกองทุน</div>";

    AdminState.uiOptions.rules.forEach((rule, index) => {
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
                <div class="p-3"><strong class="small text-dark d-block pb-2 mb-2 border-bottom"><i class="fa-solid fa-gears text-muted me-1"></i> กฎเกณฑ์ที่ระบบจะใช้ประมวลผล:</strong><div class="mb-3">${condHtml}</div><div class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-1 px-3 rounded-pill fw-bold" onclick="window.removeWelfareRule(${index})"><i class="fa-solid fa-trash me-1"></i> ลบระเบียบนี้</button></div></div>
            </div>
        </div>`;
    });
};

window.addRuleConditionRow = function() {
    const container = document.getElementById('ruleConditionsContainer'); if(!container) return;
    const rowId = 'cond-' + Date.now(); let conditionOptionsHtml = '';
    (AdminState.uiOptions.conditionTypes || []).forEach(cond => { conditionOptionsHtml += `<option value="${cond}">${cond}</option>`; });
    if(!conditionOptionsHtml) { conditionOptionsHtml = `<option value="เงื่อนไขทั่วไป">เงื่อนไขทั่วไป</option>`; }

    const html = `
    <div class="row g-2 align-items-center condition-row bg-light p-2 rounded-3 border mb-1" id="${rowId}">
        <div class="col-12 col-md-5"><select class="form-select-modern w-100 form-select-sm cond-type bg-white border-0 shadow-sm" style="font-size: 0.8rem;">${conditionOptionsHtml}</select></div>
        <div class="col-8 col-md-4"><input type="text" class="form-control-modern w-100 form-control-sm cond-value bg-white border-0 shadow-sm" placeholder="ระบุจำนวน/รายละเอียด" style="font-size: 0.8rem;"></div>
        <div class="col-4 col-md-2"><select class="form-select-modern w-100 form-select-sm cond-unit bg-white border-0 shadow-sm" style="font-size: 0.8rem;"><option value="วัน">วัน</option><option value="เดือน">เดือน</option><option value="ปี">ปี</option><option value="บาท">บาท</option><option value="ครั้ง">ครั้ง</option><option value="">(ไม่มีหน่วย)</option></select></div>
        <div class="col-12 col-md-1 text-end text-md-center mt-2 mt-md-0"><button type="button" class="btn btn-sm text-danger p-1 bg-white rounded-circle shadow-sm" onclick="document.getElementById('${rowId}').remove()" title="ลบเงื่อนไขนี้"><i class="fa-solid fa-xmark"></i></button></div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
};

window.toggleCustomRuleName = function(selectObj) {
    const customInput = document.getElementById('ruleNameCustom'); if(!customInput) return;
    if (selectObj.value === 'อื่นๆ (ระบุเอง)') { customInput.classList.remove('d-none'); customInput.focus(); } 
    else { customInput.classList.add('d-none'); customInput.value = ""; }
};

window.renderMemberTypeBadges = function() {
    const container = document.getElementById('memberTypesContainer'); if (!container) return; container.innerHTML = "";
    (AdminState.uiOptions.memberTypes || []).forEach((type, index) => {
        container.innerHTML += `<span class="badge bg-dark d-flex align-items-center py-2 px-3 shadow-sm" style="font-size: 0.8rem; border-radius: 12px;">${type} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="window.removeMemberTypeBadge(${index})" title="ลบออก"></i></span>`;
    });
};
window.addMemberTypeBadge = function() {
    const input = document.getElementById('newMemberTypeInput'); const val = input.value.trim();
    if (!val || AdminState.uiOptions.memberTypes.includes(val)) return;
    AdminState.uiOptions.memberTypes.push(val); input.value = ""; window.renderMemberTypeBadges();
};
window.removeMemberTypeBadge = function(index) { AdminState.uiOptions.memberTypes.splice(index, 1); window.renderMemberTypeBadges(); };

window.renderVillageBadges = function() {
    const container = document.getElementById('villagesContainer'); if (!container) return; container.innerHTML = "";
    (AdminState.uiOptions.villages || []).forEach((v, index) => {
        container.innerHTML += `<span class="badge bg-success bg-opacity-10 text-success border border-success d-flex align-items-center py-2 px-3 shadow-sm" style="font-size: 0.8rem; border-radius: 12px;"><i class="fa-solid fa-house-chimney me-1"></i> ${v} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="window.removeVillageBadge(${index})" title="ลบออก"></i></span>`;
    });
};
window.addVillageBadge = function() {
    const input = document.getElementById('newVillageInput'); const val = input.value.trim();
    if (!val || AdminState.uiOptions.villages.includes(val)) return;
    AdminState.uiOptions.villages.push(val); input.value = ""; window.renderVillageBadges();
};
window.removeVillageBadge = function(index) { AdminState.uiOptions.villages.splice(index, 1); window.renderVillageBadges(); };

window.renderCenterBadges = function() {
    const container = document.getElementById('centersContainer'); if (!container) return; container.innerHTML = "";
    (AdminState.uiOptions.centers || []).forEach((c, index) => {
        container.innerHTML += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary d-flex align-items-center py-2 px-3 shadow-sm" style="font-size: 0.8rem; border-radius: 12px;"><i class="fa-solid fa-building me-1"></i> ${c} <i class="fa-solid fa-xmark ms-2 text-danger cursor-pointer" onclick="window.removeCenterBadge(${index})" title="ลบออก"></i></span>`;
    });
};
window.addCenterBadge = function() {
    const input = document.getElementById('newCenterInput'); const val = input.value.trim();
    if (!val || AdminState.uiOptions.centers.includes(val)) return;
    AdminState.uiOptions.centers.push(val); input.value = ""; window.renderCenterBadges();
};
window.removeCenterBadge = function(index) { AdminState.uiOptions.centers.splice(index, 1); window.renderCenterBadges(); };



// ... โค้ด window.renderWelfareTypeBadges = function() { ... ของเดิมอยู่ต่อจากตรงนี้