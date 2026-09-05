// =========================================================
// 📊 dashboard.js: ภาพรวมการเงินและแดชบอร์ด
// =========================================================
async function loadDashboardOverview() {
    if(currentAdminData.role === 'Admin-ผู้ดูแล' || currentAdminData.role === 'Admin-สวัสดิการ') { loadMembersData(); return; }
    showLoader(true, "อัปเดตภาพรวม...");
    try {
        let mCount = 0, pCount = 0, sumIn = 0, sumOut = 0, bankBal = 0, cashBal = 0, totalDebt = 0;
        let chartData = { member: 0, codi: 0, local: 0, privateStore: 0, donate: 0, interest: 0, profit: 0, other: 0 };
        let pendingTxCount = 0, pendingClaimCount = 0, holderBalances = {};
        
        const mSnap = await db.collection("members").get(); 
        mCount = mSnap.size;
        mSnap.forEach(doc => { 
            const data = doc.data();
            if(data.status === 'รอตรวจสอบ') pCount++; 
            if(data.outstandingBalance && parseFloat(data.outstandingBalance) > 0) {
                totalDebt += parseFloat(data.outstandingBalance);
            }
        });
        
        const tSnap = await db.collection("transactions").get();
        tSnap.forEach(doc => {
            const d = doc.data(); 
            if(d.status === 'รอตรวจสอบ') { pCount++; pendingTxCount++; }
            if(d.status === 'รอส่งมอบ' || d.status === 'รอตรวจสอบ') {
                let holder = d.currentHolder || d.fullName.replace('แอดมิน: ', '');
                if(!holderBalances[holder]) holderBalances[holder] = { count: 0, amount: 0 };
                holderBalances[holder].count++; holderBalances[holder].amount += parseFloat(d.amount);
            }
            if(d.status === 'อนุมัติแล้ว') {
                let amt = parseFloat(d.amount) || 0;
                if(d.type.includes('รับ') || d.type === 'สมทบเงินกองทุน') {
                    sumIn += amt;
                    if(d.paymentMethod && d.paymentMethod.includes('ธนาคาร')) bankBal += amt; else cashBal += amt;
                    let noteStr = (d.note||"").toLowerCase();
                    if(d.type === 'สมทบเงินกองทุน' || noteStr.includes('สมาชิก')) chartData.member += amt;
                    else if(noteStr.includes('พอช.')) chartData.codi += amt;
                    else if(noteStr.includes('ท้องถิ่น')) chartData.local += amt;
                    else chartData.other += amt;
                } else if(d.type.includes('จ่าย') || d.type === 'จ่ายสวัสดิการ') {
                    sumOut += amt;
                    if(d.paymentMethod && d.paymentMethod.includes('ธนาคาร')) bankBal -= amt; else cashBal -= amt;
                } else if(d.type === 'โอนย้ายสภาพคล่อง') {
                    if(d.note && d.note.includes('โอนจาก bank ไป cash')) { bankBal -= amt; cashBal += amt; }
                    if(d.note && d.note.includes('โอนจาก cash ไป bank')) { cashBal -= amt; bankBal += amt; }
                }
            }
        });
        
        const cSnap = await db.collection("claims").get();
        cSnap.forEach(doc => { 
            if(doc.data().status === 'รอตรวจสอบ') { pCount++; pendingClaimCount++; } 
        });

        const radarContainer = document.getElementById('holderRadarContainer');
        let radarHtml = "";
        if (Object.keys(holderBalances).length === 0) {
            radarHtml = `<div class="col-12"><div class="admin-card text-center m-0 border-0 border-success border-opacity-25 bg-success bg-opacity-10"><small class="text-success fw-bold"><i class="fa-solid fa-check-circle"></i> ไม่มีเงินค้างอยู่กับกรรมการ</small></div></div>`;
        } else {
            for (const [holder, data] of Object.entries(holderBalances)) {
                let hAmt = data.amount.toLocaleString('en-US', {minimumFractionDigits: 2});
                radarHtml += `
                <div class="col-6">
                  <div class="admin-card m-0 border-0 border-top border-4 border-warning bg-warning bg-opacity-10">
                    <small class="text-dark fw-bold d-block mb-1 text-truncate" style="font-size:0.7rem;"><i class="fa-solid fa-user-tie me-1"></i> ${holder}</small>
                    <h5 class="text-warning mb-0 fw-bold">฿${hAmt}</h5>
                    <div class="badge bg-white text-muted mt-2 border shadow-sm" style="font-size:0.6rem;">${data.count} บิล</div>
                  </div>
                </div>`;
            }
        }
        if(radarContainer) radarContainer.innerHTML = radarHtml;

        if(document.getElementById('eq-population')) document.getElementById('eq-population').innerText = (townPopulation/1000).toFixed(1) + "k";
        if(document.getElementById('eq-active')) document.getElementById('eq-active').innerText = mCount.toLocaleString(); 
        let percentActive = ((mCount / townPopulation) * 100).toFixed(1);
        if(document.getElementById('eq-percent-active')) document.getElementById('eq-percent-active').innerText = percentActive;
        if(document.getElementById('eq-progress-bar')) document.getElementById('eq-progress-bar').style.width = percentActive + "%";
        
        if(document.getElementById('stat-total-in')) document.getElementById('stat-total-in').innerText = "฿" + formatMoney(sumIn);
        if(document.getElementById('stat-total-debt')) document.getElementById('stat-total-debt').innerText = "฿" + formatMoney(totalDebt);
        if(document.getElementById('stat-total-out')) document.getElementById('stat-total-out').innerText = "฿" + formatMoney(sumOut);
        if(document.getElementById('cap-total')) document.getElementById('cap-total').innerText = formatMoney(sumIn - sumOut);
        if(document.getElementById('liq-bank')) document.getElementById('liq-bank').innerText = "฿" + formatMoney(bankBal); 
        if(document.getElementById('liq-cash')) document.getElementById('liq-cash').innerText = "฿" + formatMoney(cashBal);
        if(document.getElementById('statPendingBadge')) document.getElementById('statPendingBadge').innerText = pCount;
        if(document.getElementById('chart-sum-total')) document.getElementById('chart-sum-total').innerText = '฿' + formatMoney(sumIn - sumOut);

        if(document.getElementById('nav-badge-ledger')) document.getElementById('nav-badge-ledger').style.display = pendingTxCount > 0 ? 'block' : 'none';
        if(document.getElementById('nav-badge-claims')) document.getElementById('nav-badge-claims').style.display = pendingClaimCount > 0 ? 'block' : 'none';

        if(window.charts && charts.doughnut) charts.doughnut.destroy();
        if(!window.charts) window.charts = {};
        const doughnutCtx = document.getElementById('doughnutChart');
        if(doughnutCtx) {
            charts.doughnut = new Chart(doughnutCtx.getContext('2d'), { 
                type: 'doughnut', 
                data: { 
                    labels: ['สมาชิก', 'พอช.', 'ท้องถิ่น', 'เอกชน', 'บริจาค', 'ดอกเบี้ย', 'กำไร', 'อื่นๆ'], 
                    datasets: [{ data: [ chartData.member, chartData.codi, chartData.local, chartData.privateStore, chartData.donate, chartData.interest, chartData.profit, chartData.other ], backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6', '#94A3B8'], borderWidth: 2, borderColor: '#ffffff' }] 
                }, 
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, family: "'Prompt'" } } } } } 
            });
        }
        renderTrendChart();
    } catch (e) { console.error(e); } showLoader(false);
}

async function renderTrendChart() {
    const filterSelect = document.getElementById('trendFilter');
    if(!filterSelect) return;
    const filter = filterSelect.value;
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    try {
        const snap = await db.collection("transactions").where("status", "==", "อนุมัติแล้ว").get();
        let rawData = [];
        const now = new Date();
        let startFiscalYear = now.getFullYear();
        if (now.getMonth() < 9) startFiscalYear -= 1; 
        const fiscalStartDate = new Date(startFiscalYear, 9, 1);

        snap.forEach(doc => {
            const d = doc.data();
            let txDate = new Date();
            if (d.transactionDate) txDate = new Date(d.transactionDate);
            else if (d.timestamp) txDate = d.timestamp.toDate();
            let amt = parseFloat(d.amount) || 0;
            let isTransfer = d.type === 'โอนย้ายสภาพคล่อง';
            if (!isTransfer) rawData.push({ type: d.type, amount: amt, dateObj: txDate, note: d.note || "" });
        });

        let startDate = new Date('2000-01-01');
        if (filter === '1month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); } 
        else if (filter === '3months') { startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); } 
        else if (filter === '6months') { startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); } 
        else if (filter === 'thisYear' || filter === 'quarter') { startDate = new Date(now.getFullYear(), 0, 1); } 
        else if (filter === 'fiscal') { startDate = fiscalStartDate; }

        let filteredData = rawData.filter(d => d.dateObj >= startDate);
        let grouped = {};
        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        filteredData.forEach(d => {
            let dObj = d.dateObj; let thYear = dObj.getFullYear() + 543; let thMonth = dObj.getMonth();
            let sortKey = `${dObj.getFullYear()}-${String(thMonth+1).padStart(2,'0')}`;
            let displayKey = `${monthNames[thMonth]} ${thYear.toString().slice(-2)}`;
            if (!grouped[sortKey]) grouped[sortKey] = { label: displayKey, member: 0, codi: 0, local: 0, privateStore: 0, donate: 0, interest: 0, profit: 0, other: 0, expense: 0 };
            
            let isIncome = d.type.includes('รับ') || d.type.includes('สมทบ');
            if (isIncome) {
                let noteStr = d.note.toLowerCase();
                if(d.type === 'สมทบเงินกองทุน' || noteStr.includes('สมาชิก')) grouped[sortKey].member += d.amount;
                else if(noteStr.includes('พอช.')) grouped[sortKey].codi += d.amount;
                else grouped[sortKey].other += d.amount;
            } else { grouped[sortKey].expense += d.amount; }
        });

        const sortedKeys = Object.keys(grouped).sort();
        const labels = sortedKeys.map(k => grouped[k].label);
        const dMember = sortedKeys.map(k => grouped[k].member);
        const dExpense = sortedKeys.map(k => grouped[k].expense);

        if (!window.charts) window.charts = {}; 
        if (charts.trendChartObj) charts.trendChartObj.destroy();
        
        charts.trendChartObj = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'รับจากสมาชิก', data: dMember, borderColor: '#2563EB', backgroundColor: '#2563EB', tension: 0.3, fill: false, pointRadius: 4 },
                    { label: 'รายจ่ายรวม', data: dExpense, borderColor: '#EF4444', backgroundColor: '#EF4444', borderDash: [5, 5], tension: 0.3, fill: false, pointRadius: 4 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { family: "'Prompt'" } } } },
                scales: { y: { beginAtZero: true, ticks: { font: { family: "'Prompt'" } } }, x: { ticks: { font: { family: "'Prompt'" } } } }
            }
        });
    } catch (e) { console.error("Trend Chart Error:", e); }
}