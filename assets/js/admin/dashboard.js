// =========================================================
// 📊 dashboard.js: ภาพรวมการเงินและแดชบอร์ด (Custom Text Matching)
// =========================================================
let dashboardListeners = [];

// 🌟 Helper: ตัวคัดกรองหมวดหมู่รายจ่าย (คงไว้เพื่อแยกสวัสดิการออกจากค่าบริหาร)
function getExpenseCategory(type, note) {
    if (type === 'จ่ายสวัสดิการ' || note === 'จ่ายสวัสดิการ (เก็บตก)') return 'สวัสดิการชุมชน';
    return 'ค่าบริหารจัดการ';
}

async function loadDashboardOverview() {
    if(!AdminState.currentAdmin) return;
    
    if(AdminState.currentAdmin.role === 'Admin-ผู้ดูแล' || AdminState.currentAdmin.role === 'Admin-สวัสดิการ') { 
        if(typeof loadMembersData === 'function') loadMembersData(); 
        return; 
    }

    AppHelper.showLoader(true, "กำลังประมวลผลข้อมูลการเงิน...");

    try {
        dashboardListeners.forEach(unsubscribe => unsubscribe());
        dashboardListeners = [];

        let mCount = 0, pCount = 0, sumIn = 0, sumOut = 0, bankBal = 0, cashBal = 0, totalDebt = 0;
        let pendingTxCount = 0, pendingClaimCount = 0, holderBalances = {};
        
        // โครงสร้างข้อมูล 8 หมวดหมู่ตามที่คุณต้องการ
        let chartData = { member: 0, codi: 0, local: 0, privateStore: 0, donate: 0, interest: 0, profit: 0, other: 0 };
        
        const mSnap = await db.collection("members").get(); 
        mCount = mSnap.size;
        mSnap.forEach(doc => { 
            const data = doc.data();
            if(data.status === 'รอตรวจสอบ') pCount++; 
            if(data.outstandingBalance && parseFloat(data.outstandingBalance) > 0) {
                totalDebt += parseFloat(data.outstandingBalance);
            }
        });

        const cSnap = await db.collection("claims").where("status", "==", "รอตรวจสอบ").get();
        pendingClaimCount = cSnap.size;
        pCount += pendingClaimCount;

        db.collection("settings").doc("master").get().then(sysSnap => {
            if(sysSnap.exists) {
                const sys = sysSnap.data();
                const initPool = sys.pointSettings?.initialPool || 0;
                const currentPool = sys.globalPointPool || 0;
                injectPointPoolUI(initPool, currentPool);
            }
        });
        
        const txListener = db.collection("transactions").onSnapshot((tSnap) => {
            sumIn = 0; sumOut = 0; bankBal = 0; cashBal = 0; pendingTxCount = 0;
            holderBalances = {};
            chartData = { member: 0, codi: 0, local: 0, privateStore: 0, donate: 0, interest: 0, profit: 0, other: 0 };

            tSnap.forEach(doc => {
                const d = doc.data(); 
                if(d.status === 'รอตรวจสอบ') { pendingTxCount++; }
                
                if(d.status === 'รอส่งมอบ' || d.status === 'รอตรวจสอบ') {
                    let holder = d.currentHolder || (d.fullName ? d.fullName.replace('แอดมิน: ', '') : 'ไม่ระบุ');
                    if(!holderBalances[holder]) holderBalances[holder] = { count: 0, amount: 0 };
                    holderBalances[holder].count++; 
                    holderBalances[holder].amount += parseFloat(d.amount) || 0;
                }

                if(d.status === 'อนุมัติแล้ว') {
                    let amt = parseFloat(d.amount) || 0;
                    
                    if(d.type.includes('รับ') || d.type === 'สมทบเงินกองทุน') {
                        sumIn += amt;
                        if(d.paymentMethod && d.paymentMethod.includes('ธนาคาร')) bankBal += amt; else cashBal += amt;
                        
                        // 🌟 ตรรกะตรวจจับคำ (Text Matching) ของคุณ
                        let noteStr = d.note || "";
                        if(d.type === 'สมทบเงินกองทุน' || noteStr.includes('สมาชิก')) chartData.member += amt;
                        else if(noteStr.includes('พอช.')) chartData.codi += amt;
                        else if(noteStr.includes('ท้องถิ่น')) chartData.local += amt;
                        else if(noteStr.includes('เอกชน') || noteStr.includes('ร้านค้า')) chartData.privateStore += amt;
                        else if(noteStr.includes('บริจาค')) chartData.donate += amt;
                        else if(noteStr.includes('ดอกเบี้ย')) chartData.interest += amt;
                        else if(noteStr.includes('กำไร')) chartData.profit += amt;
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

            updateDashboardUI(mCount, pCount, pendingTxCount, pendingClaimCount, sumIn, sumOut, totalDebt, bankBal, cashBal, holderBalances);
            updateDashboardChart(chartData);

        }, (error) => { console.error("Real-time Listener Error:", error); });

        dashboardListeners.push(txListener);
        AppHelper.showLoader(false);
        renderTrendChart();

    } catch (e) { 
        console.error("Dashboard Load Error:", e); 
        AppHelper.showLoader(false); 
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้', 'error');
    }
}

// 🌟 ฟังก์ชันแทรก UI สำหรับสรุปงบประมาณแต้มแบบอัตโนมัติ
function injectPointPoolUI(initial, current) {
    let container = document.getElementById('injectedPointPoolSummary');
    if(!container) {
        container = document.createElement('div');
        container.id = 'injectedPointPoolSummary';
        const target = document.getElementById('holderRadarContainer').closest('.admin-tab-pane');
        const insertAfterEl = document.getElementById('overviewChartArea');
        if(insertAfterEl && target) {
            target.insertBefore(container, insertAfterEl.nextSibling);
        }
    }
    
    let used = initial - current;
    if(used < 0) used = 0;
    
    let percentUsed = 0;
    if(initial > 0) percentUsed = ((used / initial) * 100).toFixed(1);

    container.innerHTML = `
      <div class="admin-card border-0 p-4 mb-4 shadow-sm rounded-4 bg-white">
          <div class="d-flex align-items-center mb-3">
              <div class="d-flex justify-content-center align-items-center bg-warning bg-opacity-10 text-warning rounded-circle me-2" style="width: 28px; height: 28px;"><i class="fa-solid fa-star"></i></div>
              <h6 class="fw-bold text-dark mb-0">งบประมาณแต้มสะสม (Point Pool)</h6>
          </div>
          <div class="row g-2 text-center">
             <div class="col-4">
                 <small class="text-muted d-block" style="font-size: 0.7rem;">ตั้งงบเริ่มต้น</small>
                 <strong class="text-dark">${initial.toLocaleString()}</strong>
             </div>
             <div class="col-4 border-start border-end">
                 <small class="text-danger d-block" style="font-size: 0.7rem;">สมาชิกรับไปแล้ว</small>
                 <strong class="text-danger">${used.toLocaleString()}</strong>
             </div>
             <div class="col-4">
                 <small class="text-success d-block" style="font-size: 0.7rem;">คงเหลือแจกได้</small>
                 <strong class="text-success">${current.toLocaleString()}</strong>
             </div>
          </div>
          <div class="progress mt-3 bg-light" style="height: 6px;">
              <div class="progress-bar bg-warning" role="progressbar" style="width: ${percentUsed}%;"></div>
          </div>
      </div>
    `;
}

function updateDashboardUI(mCount, pCount, pendingTxCount, pendingClaimCount, sumIn, sumOut, totalDebt, bankBal, cashBal, holderBalances) {
    const radarContainer = document.getElementById('holderRadarContainer');
    let radarHtml = "";
    if (Object.keys(holderBalances).length === 0) {
        radarHtml = `<div class="col-12"><div class="admin-card text-center m-0 border-0 border-success border-opacity-25 bg-success bg-opacity-10"><small class="text-success fw-bold"><i class="fa-solid fa-check-circle"></i> ไม่มีเงินค้างอยู่กับกรรมการ</small></div></div>`;
    } else {
        for (const [holder, data] of Object.entries(holderBalances)) {
            let hAmt = data.amount.toLocaleString('en-US', {minimumFractionDigits: 2});
            radarHtml += `<div class="col-6"><div class="admin-card m-0 border-0 border-top border-4 border-warning bg-warning bg-opacity-10"><small class="text-dark fw-bold d-block mb-1 text-truncate" style="font-size:0.7rem;"><i class="fa-solid fa-user-tie me-1"></i> ${holder}</small><h5 class="text-warning mb-0 fw-bold">฿${hAmt}</h5><div class="badge bg-white text-muted mt-2 border shadow-sm" style="font-size:0.6rem;">${data.count} บิล</div></div></div>`;
        }
    }
    if(radarContainer) radarContainer.innerHTML = radarHtml;

    if(document.getElementById('eq-population')) document.getElementById('eq-population').innerText = (AdminState.townPopulation/1000).toFixed(1) + "k";
    if(document.getElementById('eq-active')) document.getElementById('eq-active').innerText = mCount.toLocaleString(); 
    let percentActive = ((mCount / AdminState.townPopulation) * 100).toFixed(1);
    if(document.getElementById('eq-percent-active')) document.getElementById('eq-percent-active').innerText = percentActive;
    if(document.getElementById('eq-progress-bar')) document.getElementById('eq-progress-bar').style.width = percentActive + "%";
    
    const netTotal = sumIn - sumOut;
    if(document.getElementById('stat-total-in')) document.getElementById('stat-total-in').innerText = "฿" + AppHelper.formatMoney(sumIn);
    if(document.getElementById('stat-total-debt')) document.getElementById('stat-total-debt').innerText = "฿" + AppHelper.formatMoney(totalDebt);
    if(document.getElementById('stat-total-out')) document.getElementById('stat-total-out').innerText = "฿" + AppHelper.formatMoney(sumOut);
    if(document.getElementById('cap-total')) document.getElementById('cap-total').innerText = AppHelper.formatMoney(netTotal);
    if(document.getElementById('chart-sum-total')) document.getElementById('chart-sum-total').innerText = '฿' + AppHelper.formatMoney(netTotal);
    if(document.getElementById('liq-bank')) document.getElementById('liq-bank').innerText = "฿" + AppHelper.formatMoney(bankBal); 
    if(document.getElementById('liq-cash')) document.getElementById('liq-cash').innerText = "฿" + AppHelper.formatMoney(cashBal);
    
    let totalOverallPending = pCount + pendingTxCount;
    if(document.getElementById('statPendingBadge')) document.getElementById('statPendingBadge').innerText = totalOverallPending;
    if(document.getElementById('nav-badge-ledger')) document.getElementById('nav-badge-ledger').style.display = pendingTxCount > 0 ? 'block' : 'none';
    if(document.getElementById('nav-badge-claims')) document.getElementById('nav-badge-claims').style.display = pendingClaimCount > 0 ? 'block' : 'none';
}

function updateDashboardChart(chartData) {
    if(window.charts && charts.doughnut) charts.doughnut.destroy();
    if(!window.charts) window.charts = {};
    const doughnutCtx = document.getElementById('doughnutChart');
    if(doughnutCtx) {
        charts.doughnut = new Chart(doughnutCtx.getContext('2d'), { 
            type: 'doughnut', 
            data: { 
                labels: ['สมาชิก', 'พอช.', 'ท้องถิ่น', 'เอกชน', 'บริจาค', 'ดอกเบี้ย', 'กำไร', 'อื่นๆ'], 
                datasets: [{ 
                    data: [ chartData.member, chartData.codi, chartData.local, chartData.privateStore, chartData.donate, chartData.interest, chartData.profit, chartData.other ], 
                    backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6', '#94A3B8'], 
                    borderWidth: 2, borderColor: '#ffffff' 
                }] 
            }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, family: "'Prompt'" } } } } } 
        });
    }
}

// =========================================================
// 📈 ฟังก์ชันสร้าง Mixed Chart (Stacked Bar + Line)
// =========================================================
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
            
            if (!isTransfer) {
                rawData.push({ type: d.type, amount: amt, dateObj: txDate, note: d.note || "" });
            }
        });

        let startDate = new Date('2000-01-01'); 
        if (filter === '1month') startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
        else if (filter === '3months') startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        else if (filter === '6months') startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        else if (filter === 'thisYear' || filter === 'quarter') startDate = new Date(now.getFullYear(), 0, 1);
        else if (filter === 'fiscal') startDate = fiscalStartDate;
        else if (filter === 'all') startDate = new Date('2000-01-01'); 

        let filteredData = rawData.filter(d => d.dateObj >= startDate);
        let grouped = {};
        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        filteredData.forEach(d => {
            let dObj = d.dateObj; let thYear = dObj.getFullYear() + 543; let thMonth = dObj.getMonth();
            let sortKey = `${dObj.getFullYear()}-${String(thMonth+1).padStart(2,'0')}`;
            let displayKey = `${monthNames[thMonth]} ${thYear.toString().slice(-2)}`;
            
            if (!grouped[sortKey]) {
                // 🌟 โครงสร้างเก็บยอดเงินแบบรายเดือน
                grouped[sortKey] = { label: displayKey, member: 0, codi: 0, local: 0, privateStore: 0, donate: 0, interest: 0, profit: 0, other: 0, expenseWelfare: 0, expenseAdmin: 0 };
            }
            
            let isIncome = d.type.includes('รับ') || d.type.includes('สมทบ');
            let noteStr = d.note || "";

            if (isIncome) {
                // 🌟 ตรรกะตรวจจับคำ (Text Matching) ของคุณ
                if(d.type === 'สมทบเงินกองทุน' || noteStr.includes('สมาชิก')) grouped[sortKey].member += d.amount;
                else if(noteStr.includes('พอช.')) grouped[sortKey].codi += d.amount;
                else if(noteStr.includes('ท้องถิ่น')) grouped[sortKey].local += d.amount;
                else if(noteStr.includes('เอกชน') || noteStr.includes('ร้านค้า')) grouped[sortKey].privateStore += d.amount;
                else if(noteStr.includes('บริจาค')) grouped[sortKey].donate += d.amount;
                else if(noteStr.includes('ดอกเบี้ย')) grouped[sortKey].interest += d.amount;
                else if(noteStr.includes('กำไร')) grouped[sortKey].profit += d.amount;
                else grouped[sortKey].other += d.amount;
            } else { 
                // 🌟 แยกรายจ่ายสวัสดิการ ออกจากค่าบริหารจัดการอย่างชัดเจน
                if (getExpenseCategory(d.type, d.note || "") === 'สวัสดิการชุมชน') grouped[sortKey].expenseWelfare += d.amount;
                else grouped[sortKey].expenseAdmin += d.amount;
            }
        });

        const sortedKeys = Object.keys(grouped).sort();
        const labels = sortedKeys.map(k => grouped[k].label);
        
        if (!window.charts) window.charts = {}; 
        if (charts.trendChartObj) charts.trendChartObj.destroy();
        
        const ctx2d = ctx.getContext('2d');

        // 🌟 ตั้งค่ากราฟผสม (Mixed Chart) คืนกราฟแท่ง 8 หมวดหมู่
        charts.trendChartObj = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    // เส้น 1: จ่ายสวัสดิการ (เน้นสีแดง)
                    { 
                        type: 'line', label: 'จ่ายสวัสดิการ', data: sortedKeys.map(k => grouped[k].expenseWelfare), 
                        borderColor: '#EF4444', borderWidth: 3, tension: 0.3, fill: false,
                        pointBackgroundColor: '#ffffff', pointBorderColor: '#EF4444', pointRadius: 4, order: 1
                    },
                    // เส้น 2: ค่าบริหารจัดการ (สีส้ม)
                    { 
                        type: 'line', label: 'ค่าบริหารจัดการ', data: sortedKeys.map(k => grouped[k].expenseAdmin), 
                        borderColor: '#F59E0B', borderWidth: 3, tension: 0.3, fill: false, borderDash: [5, 5],
                        pointBackgroundColor: '#ffffff', pointBorderColor: '#F59E0B', pointRadius: 4, order: 2
                    },
                    // กราฟแท่งซ้อน: รายรับ 8 หมวดหมู่
                    { type: 'bar', label: 'สมาชิก', data: sortedKeys.map(k => grouped[k].member), backgroundColor: '#2563EB', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'พอช.', data: sortedKeys.map(k => grouped[k].codi), backgroundColor: '#10B981', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'ท้องถิ่น', data: sortedKeys.map(k => grouped[k].local), backgroundColor: '#F59E0B', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'เอกชน/ร้านค้า', data: sortedKeys.map(k => grouped[k].privateStore), backgroundColor: '#8B5CF6', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'บริจาค', data: sortedKeys.map(k => grouped[k].donate), backgroundColor: '#EC4899', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'ดอกเบี้ย', data: sortedKeys.map(k => grouped[k].interest), backgroundColor: '#06B6D4', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'กำไร', data: sortedKeys.map(k => grouped[k].profit), backgroundColor: '#14B8A6', stack: 'Income', order: 3 },
                    { type: 'bar', label: 'อื่นๆ', data: sortedKeys.map(k => grouped[k].other), backgroundColor: '#94A3B8', stack: 'Income', order: 3 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false }, 
                animation: { duration: 1500, easing: 'easeOutQuart' },
                plugins: { 
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Prompt'", size: 10 } } },
                    tooltip: { 
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { family: "'Prompt'", size: 13 },
                        bodyFont: { family: "'Prompt'", size: 12 }, padding: 12, cornerRadius: 12,
                        callbacks: {
                            footer: (tooltipItems) => {
                                let totalExp = 0; let totalInc = 0;
                                tooltipItems.forEach(item => {
                                    if(item.dataset.stack === 'Income') totalInc += item.parsed.y;
                                    else totalExp += item.parsed.y;
                                });
                                return `รายรับรวม: ฿${totalInc.toLocaleString()}\nรายจ่ายรวม: ฿${totalExp.toLocaleString()}`;
                            }
                        }
                    }
                }, 
                scales: { 
                    y: { stacked: true, beginAtZero: true, grid: { borderDash: [4, 4], color: '#E2E8F0', drawBorder: false }, ticks: { font: { family: "'Prompt'", size: 10 }, color: '#64748B' } }, 
                    x: { stacked: true, grid: { display: false, drawBorder: false }, ticks: { font: { family: "'Prompt'", size: 11 }, color: '#64748B' } } 
                } 
            }
        });
    } catch (e) { console.error("Trend Chart Error:", e); }
}