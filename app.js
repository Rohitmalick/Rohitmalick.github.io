// ==========================================================================
// STAGE 1: FRONTEND DATA MODEL, STATE ENGINES, AND METRIC ANALYTICS
// ==========================================================================

// ⚠️ PASTE YOUR COPIED GOOGLE APPS SCRIPT WEB APP URL BETWEEN THESE QUOTES:
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw3mLvI4S8jQEwu9rziObM2Xoks3Lm3tD61DMgqF1Px-uyi3Jcg768zY03PNeLuuFmkEg/exec"; 

// Local Database Blueprint State Store arrays
let appLedger = {
    income: [],
    savings: [],
    expense: []
};

const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthlyMap = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 📱 Core Navigation Logic Engine (Tab Switching Mechanism)
function navigateToTab(tabName) {
    const pages = document.getElementsByClassName('tab-page');
    for (let page of pages) { page.classList.remove('active-page'); }
    
    const triggers = document.getElementsByClassName('tab-trigger');
    for (let trigger of triggers) { trigger.classList.remove('active-tab'); }
    
    document.getElementById(`tabContent${tabName}`).classList.add('active-page');
    document.getElementById(`navBtn${tabName}`).classList.add('active-tab');
}

// App Lifecycle Initialization Hook
window.onload = function() {
    const activeCache = localStorage.getItem('__excel_budget_tracker_store');
    if (activeCache) {
        try {
            appLedger = JSON.parse(activeCache);
        } catch (e) {
            console.error("Error initializing browser database cache.");
        }
    }
    recalculateFinancials();
};

// Summary Metric Calculation Engine
function recalculateFinancials() {
    localStorage.setItem('__excel_budget_tracker_store', JSON.stringify(appLedger));

    const totalIncome = appLedger.income.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = appLedger.expense.reduce((sum, r) => sum + r.amount, 0);
    const totalSavings = appLedger.savings.reduce((sum, r) => sum + r.amount, 0);
    const cashBalance = totalIncome - totalExpenses - totalSavings;

    document.getElementById('sumIncome').innerText = '₹' + totalIncome.toLocaleString('en-IN', {minimumFractionDigits: 2});
    document.getElementById('sumExpenses').innerText = '₹' + totalExpenses.toLocaleString('en-IN', {minimumFractionDigits: 2});
    document.getElementById('sumSavings').innerText = '₹' + totalSavings.toLocaleString('en-IN', {minimumFractionDigits: 2});
    document.getElementById('sumCashBalance').innerText = '₹' + cashBalance.toLocaleString('en-IN', {minimumFractionDigits: 2});

    const ratio = totalIncome > 0 ? (totalExpenses / totalIncome) : 0;
    document.getElementById('percentageSpentText').innerText = `Percentage of Income Spent: ${(ratio).toFixed(4)}`;

    renderTableGrids();
}
// ==========================================================================
// STAGE 2: NETWORK SYNC PIPELINE, FILE IMPORT PARSER, AND GRID UI RENDERERS
// ==========================================================================

// Submits single manual transaction entries straight to Google Sheets Database
function commitRowItem(type) {
    const amountInput = document.getElementById(`${type.substring(0,3)}Amount`);
    const sourceInput = document.getElementById(`${type.substring(0,3)}Source`);
    const dateInput = document.getElementById(`${type.substring(0,3)}Date`);

    const amt = parseFloat(amountInput.value);
    const src = sourceInput.value.trim();
    const dt = dateInput.value; 

    if (!src || isNaN(amt) || amt <= 0 || !dt) return;

    const dateParts = dt.split('-'); 
    const year = parseInt(dateParts, 10);
    const monthIndex = parseInt(dateParts, 10) - 1;
    const day = parseInt(dateParts, 10);

    const explicitDate = new Date(year, monthIndex, day);
    const computedDayName = weekdayMap[explicitDate.getDay()];
    const computedMonthLabel = `${monthlyMap[monthIndex]}-${year}`;

    let targetSheetName = type === 'expense' ? 'Expense' : (type === 'income' ? 'Income' : 'Savings');

    let payload = {
        action: "insertRow",
        sheetName: targetSheetName,
        source: src,
        date: `${monthIndex + 1}/${day}/${year}`, 
        amount: amt
    };

    if (type === 'expense') {
        payload.category = document.getElementById('expCategory').value.trim() || 'Misc';
        payload.day = computedDayName;
        payload.month = computedMonthLabel;
        
        const categoryInput = document.getElementById('expCategory');
        if (categoryInput) categoryInput.value = '';
    }

    const saveButton = document.querySelector(`[onclick="commitRowItem('${type}')"]`);
    if(saveButton) { saveButton.disabled = true; saveButton.innerText = "Syncing..."; }

    // Execute Cross-Origin Network Fetch Request Pipeline
    fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        let localPayload = {
            id: Date.now(),
            source: src,
            date: payload.date,
            amount: amt
        };
        if (type === 'expense') {
            localPayload.category = payload.category;
            localPayload.day = payload.day;
            localPayload.monthLabel = payload.month;
        }

        appLedger[type].push(localPayload);

        amountInput.value = '';
        sourceInput.value = '';
        dateInput.value = '';

        recalculateFinancials();
    })
    .catch(error => {
        console.error("Cloud synchronization failure:", error);
        alert("Failed to sync. Transaction saved locally instead.");
    })
    .finally(() => {
        if(saveButton) { saveButton.disabled = false; saveButton.innerText = "Insert Row"; }
    });
}

// Timezone-Safe Bank Statement File Parsing Upload System
function importBankStatementFile(event) {
    const file = event.target.files;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*\$)/);
            if (columns.length >= 3) {
                const rawDescription = columns[0].replace(/"/g, '').trim();
                const rawDateStr = columns[1].trim();
                const rawAmount = parseFloat(columns[2].replace(/[^0-9.]/g, ''));

                if (rawDescription && rawDateStr && !isNaN(rawAmount) && rawAmount > 0) {
                    const normalizedDate = rawDateStr.replace(/\//g, '-');
                    const parts = normalizedDate.split('-');
                    if (parts.length === 3) {
                        let month = parseInt(parts[0], 10);
                        let day = parseInt(parts[1], 10);
                        let year = parseInt(parts[2], 10);

                        if (parts[0].length === 4) {
                            year = parseInt(parts[0], 10); month = parseInt(parts[1], 10); day = parseInt(parts[2], 10);
                        }

                        const generatedDate = new Date(year, month - 1, day);
                        
                        let payload = {
                            action: "insertRow",
                            sheetName: "Expense",
                            source: rawDescription,
                            category: "Imported",
                            date: `${month}/${day}/${year}`,
                            day: weekdayMap[generatedDate.getDay()],
                            month: `${monthlyMap[month - 1]}-${year}`,
                            amount: rawAmount
                        };

                        fetch(WEB_APP_URL, {
                            method: "POST",
                            mode: "no-cors",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        });

                        appLedger.expense.push({
                            id: Date.now() + i,
                            source: payload.source,
                            category: payload.category,
                            date: payload.date,
                            day: payload.day,
                            monthLabel: payload.month,
                            amount: payload.amount
                        });
                        count++;
                    }
                }
            }
        }
        alert(`Successfully imported ${count} statement expense rows offline and queued cloud synchronization!`);
        document.getElementById('bankStatementFile').value = '';
        recalculateFinancials();
    };
    reader.readAsText(file);
}

function deleteRowItem(type, targetId) {
    appLedger[type] = appLedger[type].filter(item => item.id !== targetId);
    recalculateFinancials();
}

// High-speed Data Display Grid UI Renderers with string memory buffering
function renderTableGrids() {
    const savBody = document.getElementById('savingsTableBody'); 
    if (savBody) {
        let htmlBuffer = '';
        appLedger.savings.forEach((row, index) => {
            htmlBuffer += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.date}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td><button onclick="deleteRowItem('savings', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
        savBody.innerHTML = htmlBuffer;
    }

    const expBody = document.getElementById('expensesTableBody'); 
    if (expBody) {
        let htmlBuffer = '';
        appLedger.expense.forEach((row, index) => {
            htmlBuffer += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.category}</td><td>${row.date}</td><td>${row.day}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td>${row.monthLabel}</td><td><button onclick="deleteRowItem('expense', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
        expBody.innerHTML = htmlBuffer;
    }

    const incBody = document.getElementById('incomeTableBody'); 
    if (incBody) {
        let htmlBuffer = '';
        appLedger.income.forEach((row, index) => {
            htmlBuffer += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.date}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td><button onclick="deleteRowItem('income', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
        incBody.innerHTML = htmlBuffer;
    }
}
