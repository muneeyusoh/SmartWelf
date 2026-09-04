const firebaseConfig = { 
    apiKey: "AIzaSyBs1G5k31100g6PeVvU5nUyz0QDB21jHpI", 
    authDomain: "smartwelf-f7d81.firebaseapp.com", 
    projectId: "smartwelf-f7d81", 
    storageBucket: "smartwelf-f7d81.firebasestorage.app", 
    messagingSenderId: "114126831149", 
    appId: "1:114126831149:web:66ea766f6c558b159442a4" 
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); 

const LIFF_ID = "2011183541-zDAQXVLM";
const MASTER_EMAIL = "mr.munee@gmail.com";

let currentAdminData = null; 
let currentPin = "";
let allMembersCache = [];
let allTransactionsCache = [];
let fundSettings = { inZoneVillages: [], annualFee: 365, fundName: "กองทุนสวัสดิการชุมชน" };
let townPopulation = localStorage.getItem('cwf_town_pop') ? parseInt(localStorage.getItem('cwf_town_pop')) : 20000;

// ตัวแปรส่วนกลาง (Global Settings Variables)
let uiSettingsMemberTypes = [];
let uiSettingsVillages = [];
let uiSettingsCenters = [];
let uiSettingsCommittee = [];
let uiSettingsRules = [];
let uiSettingsObjectives = [];
let uiSettingsWelfareTypes = [];
let uiSettingsConditionTypes = [];

let incomeNotes = [];
let expenseNotes = [];

const formatMoney = (val) => parseFloat(val || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function showLoader(show, text="กำลังประมวลผล...") { 
    const loader = document.getElementById('systemLoading');
    if(show) { document.getElementById('systemLoadingText').innerText = text; loader.style.display = 'flex'; } 
    else { loader.style.display = 'none'; }
}

async function createAuditLog(actionTitle, detailDesc) {
    if (!currentAdminData) return;
    try {
        await db.collection("audit_logs").add({
            adminEmail: currentAdminData.email,
            adminName: currentAdminData.name,
            role: currentAdminData.role,
            action: actionTitle,
            details: detailDesc,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Audit Log Error:", e); }
}

// UI Core Functions
function switchAdminTab(tabId, btn) {
    document.querySelectorAll('.admin-tab-pane').forEach(el => { el.classList.remove('d-block'); el.classList.add('d-none'); });
    document.getElementById(tabId).classList.replace('d-none', 'd-block');
    const trendChartEl = document.getElementById('sharedTrendChart');
    if(trendChartEl) {
        if(tabId === 'admin-view-overview') { document.getElementById('overviewChartArea').appendChild(trendChartEl); trendChartEl.style.display = 'block'; renderTrendChart(); } 
        else if (tabId === 'admin-view-ledger') { document.getElementById('ledgerChartArea').appendChild(trendChartEl); trendChartEl.style.display = 'block'; renderTrendChart(); } 
        else { trendChartEl.style.display = 'none'; }
    }
    if(btn) { document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); btn.classList.add('active'); window.scrollTo(0,0); }
}

function closeMenuAndSwitchTab(tabId) {
    const menuEl = document.getElementById('menuOffcanvas');
    if (menuEl && typeof bootstrap !== 'undefined') {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(menuEl) || bootstrap.Offcanvas.getOrCreateInstance(menuEl);
        offcanvasInstance.hide();
    }
    setTimeout(() => { switchAdminTab(tabId, null); }, 150);
}

function toggleCollapse(detailId, arrowId) {
    const dObj = document.getElementById(detailId); const aObj = document.getElementById(arrowId);
    if(dObj && aObj) {
        if(dObj.classList.contains('show')) { dObj.classList.remove('show'); aObj.classList.remove('fa-rotate-180'); } 
        else { dObj.classList.add('show'); aObj.classList.add('fa-rotate-180'); }
    }
}