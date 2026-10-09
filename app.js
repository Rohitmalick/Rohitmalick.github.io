// ==========================================================================
// EMBEDDED HIGH-PERFORMANCE VISUALIZATION GRAPHS CONFIGURATION LAYER
// ==========================================================================
let trendsChartInstance = null;
let donutChartInstance = null;

// Dynamically inject Chart.js library onto the DOM pipeline if missing
if (!document.getElementById('chart-js-sdk-core')) {
    const scriptTag = document.createElement('script');
    scriptTag.id = 'chart-js-sdk-core';
    scriptTag.src = 'https://jsdelivr.net';
    scriptTag.onload = () => { if(typeof recalculateFinancials === 'function') recalculateFinancials(); };
    document.head.appendChild(scriptTag);
}

// Intercept and wrap the existing matrix rendering calculation engine
const originalRecalculateFinancials = recalculateFinancials;
recalculateFinancials = function() {
    // Run all existing functional summary values math processing calculations first
    originalRecalculateFinancials.apply(this, arguments);
    
    // Trigger embedded charts refresh sequence instantly if script library is fully initialized
    if (typeof Chart !== 'undefined') {
        refreshDashboardCharts();
    }
};

function refreshDashboardCharts() {
    const contextTrend = document.getElementById('timeSeriesTrendChart');
    const contextDonut = document.getElementById('categoryDonutChart');
    
    if (!contextTrend || !contextDonut) return;

    // --- CHART 1 STRUCTURE: MONTHLY TREND TIMELINE DATA AGGREGATION ---
    let monthsTracked = {};
    appLedger.income.forEach(r => { monthsTracked[r.monthLabel] = (monthsTracked[r.monthLabel] || 0) + r.amount; });
    
    let labelsTimeline = Object.keys(monthsTracked);
    if(labelsTimeline.length === 0) labelsTimeline = ["No Data Logged"];
    
    let dataIncomeValues = labelsTimeline.map(lbl => monthsTracked[lbl] || 0);
    let dataExpenseValues = labelsTimeline.map(lbl => {
        return appLedger.expense.filter(r => r.monthLabel === lbl).reduce((s, r) => s + r.amount, 0);
    });

    if (trendsChartInstance) trendsChartInstance.destroy();
    trendsChartInstance = new Chart(contextTrend.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsTimeline,
            datasets: [
                { label: 'Income', data: dataIncomeValues, backgroundColor: '#00E676', borderRadius: 4 },
                { label: 'Expenses', data: dataExpenseValues, backgroundColor: '#FF5252', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'INFLOW VS OUTFLOW TRENDS', color: '#FFFFFF', font: { weight: 'bold' } },
                legend: { labels: { color: '#A0A5AB' } }
            },
            scales: {
                x: { grid: { color: '#2D3136' }, ticks: { color: '#A0A5AB' } },
                y: { grid: { color: '#2D3136' }, ticks: { color: '#A0A5AB' } }
            }
        }
    });

    // --- CHART 2 STRUCTURE: CATEGORY BREAKDOWN LOGIC ---
    let spendingCategoryMap = {};
    appLedger.expense.forEach(r => {
        spendingCategoryMap[r.category] = (spendingCategoryMap[r.category] || 0) + r.amount;
    });

    let labelsCategories = Object.keys(spendingCategoryMap);
    let dataCategoryValues = Object.values(spendingCategoryMap);

    if(labelsCategories.length === 0) {
        labelsCategories = ["No Expenses"];
        dataCategoryValues =;
    }

    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(contextDonut.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labelsCategories,
            datasets: [{
                data: dataCategoryValues,
                backgroundColor: ['#FF5252', '#FF9100', '#FFEA00', '#2563eb', '#00E5FF'],
                borderWidth: 2,
                borderColor: '#24272B'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'OUTFLOW SPLIT', color: '#FFFFFF', font: { weight: 'bold' } },
                legend: { position: 'right', labels: { color: '#A0A5AB', boxWidth: 12 } }
            },
            cutout: '60%' // Turns simple pie charts layout visual into clean open Power BI ring donut looks
        }
    });
}
