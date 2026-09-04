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
    document.getElementById(`navBtn${tabName}`).classList.add('active-nav');
}

// App Lifecyle Initialization Hook
window.onload = function() {
    const activeCache = localStorage.getItem('__excel_budget_tracker_store');
    if (activeCache) {
        try {
            appLedger = JSON.parse(activeCache);
        } catch (e) {
            console.error("Stack overflow initializing browser database model caches.");
        }
    }
    recalculateFinancials();
};

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

function commitRowItem(type) {
    const amountInput = document.getElementById(`${type.substring(0,3)}Amount`);
    const sourceInput = document.getElementById(`${type.substring(0,3)}Source`);
    const dateInput = document.getElementById(`${type.substring(0,3)}Date`);

    const amt = parseFloat(amountInput.value);
    const src = sourceInput.value.trim();
    const dt = dateInput.value; 

    if (!src || isNaN(amt) || amt <= 0 || !dt) return;

    const dateParts = dt.split('-'); 
    const year = parseInt(dateParts[0], 10);
    const monthIndex = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);

    const explicitDate = new Date(year, monthIndex, day);
    const computedDayName = weekdayMap[explicitDate.getDay()];
    const computedMonthLabel = `${monthlyMap[monthIndex]}-${year}`;

    let payload = {
        id: Date.now(),
        source: src,
        date: `${monthIndex + 1}/${day}/${year}`, 
        amount: amt
    };

    if (type === 'expense') {
        payload.category = document.getElementById('expCategory').value.trim() || 'Misc';
        payload.day = computedDayName;
        payload.monthLabel = computedMonthLabel;
        
        const categoryInput = document.getElementById('expCategory');
        if (categoryInput) categoryInput.value = '';
    }

    appLedger[type].push(payload);

    amountInput.value = '';
    sourceInput.value = '';
    dateInput.value = '';

    recalculateFinancials();
}

// 📂 TIMEZONE-SAFE BANK STATEMENT PARSER ENGINE
function importBankStatementFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (columns.length >= 3) {
                // FIXED: Added precise bracket array indices to prevent compilation crashing
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
                        appLedger.expense.push({
                            id: Date.now() + i,
                            source: rawDescription,
                            category: "Imported",
                            date: `${month}/${day}/${year}`,
                            day: weekdayMap[generatedDate.getDay()],
                            monthLabel: `${monthlyMap[month - 1]}-${year}`,
                            amount: rawAmount
                        });
                        count++;
                    }
                }
            }
        }
        alert(`Successfully imported ${count} statement expense rows offline!`);
        document.getElementById('bankStatementFile').value = '';
        recalculateFinancials();
    };
    reader.readAsText(file);
}

function deleteRowItem(type, targetId) {
    appLedger[type] = appLedger[type].filter(item => item.id !== targetId);
    recalculateFinancials();
}
function renderTableGrids() {
    const savBody = document.getElementById('savingsTableBody'); 
    if (savBody) {
        savBody.innerHTML = '';
        appLedger.savings.forEach((row, index) => {
            savBody.innerHTML += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.date}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td><button onclick="deleteRowItem('savings', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
    }

    const expBody = document.getElementById('expensesTableBody'); 
    if (expBody) {
        expBody.innerHTML = '';
        appLedger.expense.forEach((row, index) => {
            expBody.innerHTML += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.category}</td><td>${row.date}</td><td>${row.day}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td>${row.monthLabel}</td><td><button onclick="deleteRowItem('expense', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
    }

    const incBody = document.getElementById('incomeTableBody'); 
    if (incBody) {
        incBody.innerHTML = '';
        appLedger.income.forEach((row, index) => {
            incBody.innerHTML += `<tr><td>${index + 1}</td><td>${row.source}</td><td>${row.date}</td><td class="txt-right">₹${row.amount.toLocaleString('en-IN')}</td><td><button onclick="deleteRowItem('income', ${row.id})" class="del-cross">✕</button></td></tr>`;
        });
    }
}

// ==========================================================================
// CORRECTED EXCEL SPREADSHEET MATRIX GENERATOR (Fixed Variable Reference)
// ==========================================================================
function downloadExcelSpreadsheet() {
    let csv = "";
    
    const incomeTotal = appLedger.income.reduce((sum, r) => sum + r.amount, 0);
    const expenseTotal = appLedger.expense.reduce((sum, r) => sum + r.amount, 0);
    const totalSavings = appLedger.savings.reduce((sum, r) => sum + r.amount, 0);
    const cashBalance = incomeTotal - expenseTotal - totalSavings;
    const spentRatio = incomeTotal > 0 ? (expenseTotal / incomeTotal) : 0;
    const inverseRatio = incomeTotal > 0 ? (1 - spentRatio) : 0;

    csv += ",,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += ",Personal Budger Tracker,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += ",,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += `,Percentage of Income Spent :,,,SUMMARY :,,,,,,,,,,,,,,,,,,,\n`;
    csv += `,${spentRatio},,,,,,,,,,,,,,,,,,,,,,,\n`;
    csv += `,,,,Monthly Income :,,,,,,,,,,,,,,,,,,,${incomeTotal}\n`;
    csv += `,,,,${inverseRatio},,,,,,,,,,,,,,,,,,,${spentRatio}\n`;
    csv += ",,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += `,,,,Monthly Expenses :,,,,,,,,,,,,,,,,,,,\n`;
    csv += `,,,,${expenseTotal}\n`;
    csv += ",,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += `,,,,Monthly Savings :,,,,,,,,,,,,,,,,,,,\n`;
    csv += `,,,,${totalSavings}\n`;
    csv += ",,,,,,,,,,,,,,,,,,,,,,,\n";
    csv += `,,,,Cash Balance :,,,,,,,,,,,,,,,,,,,\n`;
    csv += `,,,,${cashBalance}\n`;
    csv += ",,,,\n";

    // AREA 2: WEALTH ACCUMULATION REGISTER STACK
    csv += ",Personal Budger Tracker,,,\n,,,,\n,Monthly Expenses :,,,\n,,,,\n";
    csv += ",Srno.,Savings Source,Date,Amount\n";
    appLedger.savings.forEach((row, idx) => {
        csv += `,${idx + 1},${row.source},${row.date},${row.amount}\n`;
    });
    csv += ",,,,,,,\n";

    // AREA 3: CATEGORIZED SPENDING MATRIX ROW REGISTER
    csv += ",Personal Budger Tracker,,,, bridge,\n,,,,,,,\n,Monthly Expenses :,,,,,,\n,,,,,,,\n";
    csv += ",Srno.,Expense Source,Category,Date,Day,Amount,Month2\n";
    
    let pivotTable = {};
    appLedger.expense.forEach((row, idx) => {
        csv += `,${idx + 1},${row.source},${row.category},${row.date},${row.day},${row.amount},${row.monthLabel}\n`;
        if (!pivotTable[row.monthLabel]) pivotTable[row.monthLabel] = 0;
        pivotTable[row.monthLabel] += row.amount;
    });
    csv += ",,,,,,,\n,,,,,,,\n";

    // PIVOT SUMMARY REPLICATION LAYER
    csv += "Row Labels,Sum of Amount,,,,,\n";
    for (let m in pivotTable) {
        csv += `"${m}",${pivotTable[m]},,,,,\n`;
    }
    csv += `Grand Total,${expenseTotal},,,,,\n`;
    csv += ",,,,\n";

    // AREA 4: REVENUE INCOME STACK REGISTERS
    csv += ",Personal Budger Tracker,,,\n,,,,\n,Monthly Income :,,,\n,,,,\n";
    csv += ",Srno.,Income Source,Date,Amount\n";
    appLedger.income.forEach((row, idx) => {
        csv += `,${idx + 1},${row.source},${row.date},${row.amount}\n`;
    });

    const universalUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const trigger = document.createElement("a");
    trigger.setAttribute("href", universalUri);
    trigger.setAttribute("download", "Expense_Tracker_Export.csv");
    document.body.appendChild(trigger);
    trigger.click();
    document.body.removeChild(trigger);
}

function clearApplicationState() {
    if (confirm("Wipe sheet databases? All data cache logs will be cleared.")) {
        localStorage.removeItem('__excel_budget_tracker_store');
        appLedger = { income: [], savings: [], expense: [] };
        recalculateFinancials();
    }
}
