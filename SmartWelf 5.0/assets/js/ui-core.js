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