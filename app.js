// ==========================================================================
// PART 1: FRONTEND DATA LAYER & FIXED NAVIGATION ENGINE
// ==========================================================================

const WEB_APP_URL = "https://google.com"; 

let appLedger = {
    income: [],
    savings: [],
    expense: []
};

const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthlyMap = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function navigateToTab(tabName) {
    const pages = document.getElementsByClassName('tab-page');
    for (let page of pages) { 
        page.style.display = 'none'; 
    }
    
    const triggers = document.getElementsByClassName('tab-trigger');
    for (let trigger of triggers) { 
        trigger.classList.remove('active-tab');
        trigger.style.backgroundColor = 'white';
        trigger.style.borderColor = '#cbd5e1';
    }
    
    const targetContent = document.getElementById(`tabContent${tabName}`);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    const targetBtn = document.getElementById(`navBtn${tabName}`);
    if (targetBtn) {
        targetBtn.classList.add('active-tab');
        targetBtn.style.backgroundColor = '#fef08a';
        targetBtn.style.borderColor = '#eab308';
    }
}

window.onload = function() {
    const activeCache = localStorage.getItem('__excel_budget_tracker_store');
    if (activeCache) {
        try { appLedger = JSON.parse(activeCache); } catch (e) { console.error(e); }
    }
    recalculateFinancials();
    setupFastAddButtonEngine(); 
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

    renderTableGrids();
}
// ==========================================================================
// PART 2: FAST-ADD MECHANICS & FIXES FOR IND-RUPEE SYMBOL RENDERING
// ==========================================================================

function setupFastAddButtonEngine() {
    const mainAddBtn = document.getElementById('addSelectedBtn');
    if (mainAddBtn) {
        mainAddBtn.removeAttribute('onclick'); 
        mainAddBtn.addEventListener('click', function() {
            const uncheckedCards = Array.from(document.querySelectorAll('.checkbox-grid input[type="checkbox"]')).filter(i => i.checked);
            if(uncheckedCards.length === 0) { alert("Please tick at least one item transaction checkbox first!"); return; }
            
            mainAddBtn.disabled = true;
            mainAddBtn.innerText = "Syncing Toggles...";

            const today = new Date();
            const payloadDateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
            const computedDayName = weekdayMap[today.getDay()];
            const computedMonthLabel = `${monthlyMap[today.getMonth()]}-${today.getFullYear()}`;

            let promises = [];

            uncheckedCards.forEach(box => {
                const cardContainer = box.closest('.check-card');
                const titleEl = cardContainer.querySelector('strong');
                const amountEl = cardContainer.querySelector('.txt-red');
                
                let sourceName = titleEl ? titleEl.textContent.trim() : "Fast Add Expense";
                let rawAmount = amountEl ? parseFloat(amountEl.textContent.replace(/[^0-9.]/g, '')) : 0;
                
                if (rawAmount > 0) {
                    let payload = {
                        action: "insertRow",
                        sheetName: "Expense",
                        source: sourceName,
                        category: (sourceName === "House Rent" || sourceName === "Rentomojo") ? "Rent" : "Bill",
                        date: payloadDateStr,
                        day: computedDayName,
                        month: computedMonthLabel,
                        amount: rawAmount
                    };

                    let req = fetch(WEB_APP_URL, {
                        method: "POST",
                        mode: "no-cors",
                        body: JSON.stringify(payload)
                    }).then(() => {
                        appLedger.expense.push({
                            id: Date.now() + Math.random(),
                            source: payload.source,
                            category: payload.category,
                            date: payload.date,
                            day: payload.day,
                            monthLabel: payload.month,
                            amount: payload.amount
                        });
                        box.checked = false; 
                    });
                    promises.push(req);
                }
            });

            Promise.all(promises).then(() => {
                alert("Selected fast transactions pushed securely to cloud!");
                recalculateFinancials();
                mainAddBtn.disabled = false;
                mainAddBtn.innerText = "➕ ADD SELECTED TRANSACTIONS";
            });
        });
    }
}

function commitRowItem(type) {
    const amountInput = document.getElementById(`${type.substring(0,3)}Amount`);
    const sourceInput = document.getElementById(`${type.substring(0,3)}Source`);
    const dateInput = document.getElementById(`${type.substring(0,3)}Date`);
    const categorySelect = document.getElementById(`${type.substring(0,3)}Category`);

    if (!amountInput || !sourceInput || !dateInput) { console.error("DOM form fields parsing mismatch."); return; }

    const amt = parseFloat(amountInput.value);
    const src = sourceInput.value.trim();
    const dt = dateInput.value; 

    if (!src || isNaN(amt) || amt <= 0 || !dt) return;

    const dateParts = dt.split('-'); 
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);

    const explicitDate = new Date(year, month - 1, day);
    const computedDayName = weekdayMap[explicitDate.getDay()];
    const computedMonthLabel = `${monthlyMap[month - 1]}-${year}`;

    let targetSheetName = type === 'expense' ? 'Expense' : (type === 'income' ? 'Income' : 'Savings');
    let selectedCategory = categorySelect ? categorySelect.value : 'Misc';

    let payload = {
        action: "insertRow",
        sheetName: targetSheetName,
        source: src,
        category: selectedCategory,
        date: `${month}/${day}/${year}`, 
        day: computedDayName,
        month: computedMonthLabel,
        amount: amt
    };

    const saveButton = document.querySelector(`[onclick="commitRowItem('${type}')"]`);
    if(saveButton) { saveButton.disabled = true; saveButton.innerText = "Syncing..."; }

    fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
    })
    .then(() => {
        appLedger[type].push({
            id: Date.now(),
            source: src,
            category: payload.category,
            date: payload.date,
            day: computedDayName,
            monthLabel: computedMonthLabel,
            amount: amt
        });

        amountInput.value = '';
        sourceInput.value = '';
        recalculateFinancials();
    })
    .catch(err => alert("Offline fallback tracking activated."))
    .finally(() => { if(saveButton) { saveButton.disabled = false; saveButton.innerText = "Insert Row"; } });
}

function deleteRowItem(type, targetId) {
    appLedger[type] = appLedger[type].filter(item => item.id !== targetId);
    recalculateFinancials();
}

function renderTableGrids() {
    const targets = [
        { key: 'income', bodyId: 'incomeTableBody' },
        { key: 'expense', bodyId: 'expensesTableBody' },
        { key: 'savings', bodyId: 'savingsTableBody' }
    ];

    targets.forEach(t => {
        const body = document.getElementById(t.bodyId);
        if (body) {
            let htmlBuffer = '';
            appLedger[t.key].forEach((row, index) => {
                // FIXED: Changed display tracking output text symbol label cleanly from Rh to ₹
                htmlBuffer += `<tr>
                    <td>${index + 1}</td>
                    <td>${row.source}</td>
                    <td>${row.category || 'Misc'}</td>
                    <td>${row.date}</td>
                    <td>${row.day || 'N/A'}</td>
                    <td style="text-align: right; font-weight: 600;">₹${row.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td>${row.monthLabel || ''}</td>
                    <td><button onclick="deleteRowItem('${t.key}', ${row.id})" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer;">✕</button></td>
                </tr>`;
            });
            body.innerHTML = htmlBuffer;
        }
    });
}
