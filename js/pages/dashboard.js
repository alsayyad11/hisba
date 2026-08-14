/* ============================================================
   HISBA — FINANCIAL DASHBOARD
   Product-recomposition release
   ============================================================ */
import { t, formatCurrency, formatRelativeDate, formatPercent, getMonthRange, getCurrentMonth, getLanguage, todayISO, validateAmount, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=release-2.3.0';
import { getDashboardSummary, getCategorySpending, getTransactions, getBudgets, getBudgetSpending, getAccounts, getCategories, createTransaction } from '../services/data.js';
import { createModal, openModal, closeModal } from '../components/modal.js?v=release-2.3.0';
import { toast } from '../toast.js?v=release-2.3.0';
import { drawLineChart, drawDonutChart } from '../components/charts.js?v=release-2.3.0';

let userId, userCurrency = 'USD', profileData = {};
let summaryData = {}, categoryData = [], recentTx = [], monthTx = [], budgets = [], quickAccounts = [], quickCategories = [];

export async function initDashboard(uid, profile) {
  userId = uid;
  profileData = profile || {};
  userCurrency = profile?.currency || 'USD';
  renderSkeleton();
  await loadData();
  render();
  window.addEventListener('resize', () => redrawCharts());
}

function renderSkeleton() {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="page-header"><div><div class="skeleton skeleton-title" style="width:230px;height:28px;"></div><div class="skeleton skeleton-text" style="width:180px;margin-top:8px;"></div></div></div>
    <div class="finance-dashboard-skeleton"><div class="skeleton" style="height:148px"></div><div class="skeleton" style="height:244px"></div><div class="skeleton" style="height:230px"></div></div>`;
}

async function loadData() {
  const { year, month } = getCurrentMonth();
  const { start, end } = getMonthRange(year, month);
  const [summary, categories, recent, allMonthTx, budgetList, accountList, categoryList] = await Promise.all([
    getDashboardSummary(userId, start, end).catch(() => ({ totalBalance: 0, income: 0, expenses: 0, net: 0, transactions: [] })),
    getCategorySpending(userId, start, end).catch(() => []),
    getTransactions(userId, { start_date: start, end_date: end, limit: 6 }).catch(() => []),
    getTransactions(userId, { start_date: start, end_date: end, limit: 300 }).catch(() => []),
    getBudgets(userId).catch(() => []),
    getAccounts(userId).catch(() => []),
    getCategories(userId).catch(() => []),
  ]);
  summaryData = summary || {};
  categoryData = categories || [];
  recentTx = recent || [];
  monthTx = allMonthTx || [];
  quickAccounts = accountList || [];
  quickCategories = categoryList || [];
  const spending = await getBudgetSpending(userId, budgetList || [], start, end).catch(() => ({}));
  budgets = (budgetList || []).map(budget => {
    const calculated = Number(spending[String(budget.category_id || '__total__')] || 0);
    return { ...budget, spent: calculated || (!budget.category_id ? Number(summaryData.expenses || 0) : 0) };
  });
}

function render() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const { totalBalance = 0, income = 0, expenses = 0, net = 0 } = summaryData;
  const isArabic = getLanguage().startsWith('ar');
  const isFirstRun = !quickAccounts.length && !recentTx.length && !budgets.length;
  const openingBalance = Number(totalBalance) - Number(net);
  const cashflow = cashflowSeries(openingBalance);
  const mainBudget = budgets.find(budget => !budget.category_id) || budgets[0] || null;
  const budgetPercentage = mainBudget ? formatPercent(mainBudget.spent, mainBudget.amount) : 0;
  const budgetRemaining = mainBudget ? Number(mainBudget.amount || 0) - Number(mainBudget.spent || 0) : 0;
  const topCategory = categoryData[0] || null;
  const totalCategorySpend = categoryData.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const topCategoryShare = topCategory && totalCategorySpend > 0 ? Math.round((Number(topCategory.total || 0) / totalCategorySpend) * 100) : 0;
  const profileName = String(profileData.full_name || profileData.display_name || profileData.name || '').trim();
  const greeting = profileName ? t('dashboard_greeting_named', { name: profileName }) : t('dashboard_greeting_default');
  const netClass = net >= 0 ? 'is-positive' : 'is-negative';
  const budgetState = budgetPercentage >= 100 ? 'is-over' : budgetPercentage >= 80 ? 'is-near' : 'is-safe';
  const insight = getInsight(mainBudget, budgetRemaining, topCategory, topCategoryShare, isArabic);

  el.innerHTML = `
    <header class="page-header finance-page-header finance-page-header-recomposed">
      <div><p class="finance-eyebrow">${escapeHTML(greeting)}</p><h1 class="page-title">${t('dashboard_title')}</h1><p class="page-subtitle">${t('dashboard_overview_copy')}</p></div>
      <button class="btn btn-primary finance-header-action" id="btn-add-tx" type="button">${renderIcon('plus', 17)}<span>${t('add_transaction')}</span></button>
    </header>

    <section class="finance-overview-strip" aria-label="${t('dashboard_financial_health')}">
      <div class="finance-overview-primary"><span>${t('total_balance')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(totalBalance, userCurrency)}</strong><em class="${netClass}">${renderIcon(net >= 0 ? 'arrow-up-right' : 'arrow-down-right', 14)} <b class="sensitive-value" dir="ltr">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net), userCurrency)}</b> ${t('this_month')}</em></div>
      <div class="finance-overview-metric is-income"><span>${t('monthly_income')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(income, userCurrency)}</strong></div>
      <div class="finance-overview-metric is-expense"><span>${t('monthly_expenses')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(expenses, userCurrency)}</strong></div>
      <div class="finance-overview-metric is-net"><span>${t('net_savings')}</span><strong class="sensitive-value" dir="ltr">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net), userCurrency)}</strong></div>
    </section>

    <section class="finance-trend-panel" aria-label="${t('dashboard_cash_flow')}">
      <div class="finance-trend-heading"><div><p class="finance-section-kicker">${t('dashboard_financial_health')}</p><h2>${t('dashboard_cash_flow')}</h2><p>${t('dashboard_cash_flow_sub')}</p></div><div class="finance-trend-value"><span>${t('total_balance')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(totalBalance, userCurrency)}</strong></div></div>
      <div class="finance-trend-chart ${cashflow.length > 1 ? '' : 'is-empty'}">${cashflow.length > 1 ? '<canvas id="cashflow-line-chart" aria-label="Cash flow" role="img"></canvas>' : `<div class="finance-empty-chart finance-empty-chart-compact"><span aria-hidden="true">${renderIcon('chart-line', 22)}</span><div><strong>${t('dashboard_no_trend')}</strong><p>${t('dashboard_cashflow_empty')}</p></div><button class="btn btn-outline btn-sm" id="btn-empty-add-tx" type="button">${t('add_transaction')}</button></div>`}</div>
      <div class="finance-trend-footer"><span>${t('dashboard_balance_start')} <strong class="sensitive-value" dir="ltr">${formatCurrency(openingBalance, userCurrency)}</strong></span><span>${t('dashboard_income_events')} <strong class="sensitive-value is-income" dir="ltr">${formatCurrency(income, userCurrency)}</strong></span><span>${t('dashboard_expense_events')} <strong class="sensitive-value is-expense" dir="ltr">${formatCurrency(expenses, userCurrency)}</strong></span></div>
    </section>

    <section class="finance-analysis-grid">
      <article class="finance-analysis-panel finance-spending-panel"><div class="finance-panel-heading"><div><p class="finance-section-kicker">${t('dashboard_spending_analysis')}</p><h2>${t('dashboard_top_spending')}</h2><p>${t('dashboard_top_spending_sub')}</p></div></div>${categoryData.length ? `<div class="finance-spending-layout" dir="${isArabic ? 'rtl' : 'ltr'}"><div class="finance-donut-wrap"><canvas id="spending-donut-chart" aria-label="${t('dashboard_top_spending')}" role="img"></canvas><div class="finance-donut-fallback"><strong class="sensitive-value" dir="ltr">${formatCurrency(totalCategorySpend, userCurrency)}</strong><span>${t('dashboard_total_spent')}</span></div></div><div class="finance-category-list" role="list">${categoryData.slice(0, 5).map(categoryRow).join('')}</div></div>` : compactEmpty('pie-chart', t('dashboard_no_spending'), t('add_transaction'), 'btn-spending-add')}</article>
      <article class="finance-analysis-panel finance-budget-panel"><div class="finance-panel-heading"><div><p class="finance-section-kicker">${t('dashboard_budget_status')}</p><h2>${t('top_budgets')}</h2><p>${t('dashboard_budget_used')}</p></div><button class="dashboard-text-action" id="btn-view-all-budgets" type="button">${t('view_all')}</button></div>${mainBudget ? `<div class="finance-budget-summary"><div><span>${t('dashboard_budget_total')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(mainBudget.amount, userCurrency)}</strong></div><div><span>${t('budget_spent')}</span><strong class="sensitive-value is-expense" dir="ltr">${formatCurrency(mainBudget.spent, userCurrency)}</strong></div><div><span>${t('budget_remaining_label')}</span><strong class="sensitive-value ${budgetRemaining < 0 ? 'is-expense' : ''}" dir="ltr">${budgetRemaining < 0 ? '−' : ''}${formatCurrency(Math.abs(budgetRemaining), userCurrency)}</strong></div></div><div class="finance-budget-progress-wrap"><div class="finance-budget-progress-meta"><span>${budgetPercentage}% ${t('dashboard_budget_used')}</span><span class="${budgetState}">${budgetPercentage >= 100 ? t('overspent_label') : budgetPercentage >= 80 ? t('at_risk') : t('on_track')}</span></div><div class="finance-progress-track"><span class="${budgetState}" style="width:${Math.min(budgetPercentage,100)}%"></span></div></div><p class="finance-budget-insight ${budgetState}">${escapeHTML(insight)}</p>` : compactEmpty('wallet', t('dashboard_no_budgets'), t('dashboard_add_budget'), 'btn-create-budget')}</article>
    </section>

    <section class="finance-activity-card finance-activity-card-recomposed" aria-label="${t('dashboard_activity')}"><div class="finance-panel-heading"><div><p class="finance-section-kicker">${t('dashboard_activity')}</p><h2>${t('recent_transactions')}</h2><p>${t('this_month')}</p></div><button class="dashboard-text-action" id="btn-view-all-tx" type="button">${t('view_all')}</button></div>${recentTx.length ? `<div class="finance-activity-list">${recentTx.map(transaction => transactionRow(transaction, isArabic)).join('')}</div>` : compactEmpty('receipt', t('dashboard_no_activity'), t('add_transaction'), 'btn-activity-add')}</section>

    <section class="finance-intelligence-bar"><span class="finance-intelligence-icon">${renderIcon('sparkle', 16)}</span><div><strong>${t('dashboard_insight_title')}</strong><p>${escapeHTML(insight)}</p></div></section>
  `;
  document.getElementById('btn-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-empty-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-spending-add')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-activity-add')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-create-budget')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets', action: 'add' } })));
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions' } })));
  document.getElementById('btn-view-all-budgets')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } })));
  requestAnimationFrame(redrawCharts);
  if (isFirstRun && sessionStorage.getItem('hisba_onboarding_prompt_seen') !== '1') requestAnimationFrame(openOnboardingModal);
}

function compactEmpty(icon, copy, action, id) { return `<div class="finance-empty-state finance-empty-state-compact"><span aria-hidden="true">${renderIcon(icon, 21)}</span><p>${copy}</p><button class="btn btn-outline btn-sm" id="${id}" type="button">${action}</button></div>`; }
function categoryRow(category) { const total = categoryData.reduce((sum, item) => sum + Number(item.total || 0), 0); const share = total ? Math.round(Number(category.total || 0) / total * 100) : 0; const name = getLanguage().startsWith('ar') && category.name_ar ? category.name_ar : category.name || '—'; return `<div class="finance-category-row" role="listitem"><span class="finance-category-swatch" style="background:${sanitizeColor(category.color, '#176b73')}"></span><div class="finance-category-name"><strong>${escapeHTML(name)}</strong><span>${share}%</span></div><strong class="sensitive-value" dir="ltr">${formatCurrency(category.total, userCurrency)}</strong></div>`; }
function getInsight(mainBudget, budgetRemaining, topCategory, topCategoryShare, isArabic) { if (mainBudget && budgetRemaining < 0) return t('dashboard_insight_over_budget', { amount: formatCurrency(Math.abs(budgetRemaining), userCurrency) }); if (mainBudget && formatPercent(mainBudget.spent, mainBudget.amount) >= 80) return t('dashboard_insight_budget_close', { amount: formatCurrency(Math.max(0, budgetRemaining), userCurrency) }); if (topCategory) { const name = isArabic && topCategory.name_ar ? topCategory.name_ar : topCategory.name; return t('dashboard_insight_top_category', { category: name, percent: topCategoryShare }); } return t('dashboard_insight_no_budget'); }
function transactionRow(transaction, isArabic) { const color = sanitizeColor(transaction.category?.color, '#176b73'); const categoryName = isArabic && transaction.category?.name_ar ? transaction.category.name_ar : (transaction.category?.name || '—'); const prefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''; return `<article class="finance-activity-row"><span class="finance-activity-icon" style="--category-color:${color}">${renderIcon(transaction.category?.icon || 'receipt', 16)}</span><div class="finance-activity-copy"><strong>${escapeHTML(transaction.description || t('transaction_untitled'))}</strong><span>${escapeHTML(categoryName)}<i aria-hidden="true">·</i>${formatRelativeDate(transaction.date)}</span></div><strong class="finance-activity-amount sensitive-value ${transaction.type === 'income' ? 'is-income' : transaction.type === 'expense' ? 'is-expense' : ''}" dir="ltr">${prefix}${formatCurrency(transaction.amount, transaction.account?.currency || userCurrency)}</strong></article>`; }
function cashflowSeries(openingBalance) {
  const byDay = new Map();
  monthTx.forEach(transaction => {
    const date = String(transaction.date || '').slice(0, 10);
    if (!date) return;
    const move = transaction.type === 'income' ? Number(transaction.amount || 0) : transaction.type === 'expense' ? -Number(transaction.amount || 0) : 0;
    byDay.set(date, (byDay.get(date) || 0) + move);
  });
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!days.length) return [];
  let running = Number(openingBalance || 0);
  // Anchor the line at the beginning of the month so a single active day still has a meaningful trend.
  const points = [{ label: '1', value: running }];
  days.forEach(([date, move]) => {
    running += move;
    points.push({ label: String(Number(date.slice(8))), value: running });
  });
  return points;
}

function openOnboardingModal() { if (document.getElementById('onboarding-modal')) return; sessionStorage.setItem('hisba_onboarding_prompt_seen', '1'); createModal({ id:'onboarding-modal', title:t('onboarding_title'), size:'modal-sm', content:`<section class="onboarding-dialog" aria-describedby="onboarding-dialog-copy"><div class="onboarding-dialog-progress"><span class="onboarding-dialog-kicker">${t('onboarding_progress',{current:1,total:3})}</span><span class="onboarding-progress-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i></span></div><div class="onboarding-dialog-icon" aria-hidden="true">${renderIcon('wallet',28)}</div><div><h3 class="onboarding-dialog-title">${t('onboarding_step_account')}</h3><p class="onboarding-dialog-copy" id="onboarding-dialog-copy">${t('onboarding_step_account_sub')}</p></div></section>`, footerButtons:[`<button class="btn btn-outline" id="onboarding-later">${t('onboarding_not_now')}</button>`,`<button class="btn btn-primary" id="onboarding-start">${t('onboarding_start')}</button>`] }); openModal('onboarding-modal'); document.getElementById('onboarding-later')?.addEventListener('click',()=>closeModal('onboarding-modal')); document.getElementById('onboarding-start')?.addEventListener('click',()=>{closeModal('onboarding-modal');window.dispatchEvent(new CustomEvent('navigate',{detail:{page:'accounts',returnTo:'transactions',returnAction:'onboarding-transaction'}}));}); }
function openQuickAddModal() { if (!quickAccounts.length) { window.dispatchEvent(new CustomEvent('navigate',{detail:{page:'transactions',action:'add'}})); return; } const isArabic = getLanguage().startsWith('ar'); const expenseCats = quickCategories.filter(category => category.type === 'expense' || !category.type); createModal({id:'quick-tx-modal',title:t('quick_add'),content:`<div class="form-group"><label class="form-label">${t('transaction_type')}</label><select class="form-select" id="q-type"><option value="expense">${t('expense')}</option><option value="income">${t('income')}</option></select></div><div class="form-group"><label class="form-label">${t('amount')}</label><input type="number" class="form-input" id="q-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" autofocus><div class="form-error hidden" id="q-amount-err">${t('invalid_amount')}</div></div><div class="form-row"><div class="form-group"><label class="form-label">${t('account')}</label><select class="form-select" id="q-account">${quickAccounts.map(a=>`<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('category_optional')}</label><select class="form-select" id="q-category"><option value="">${t('no_category')}</option>${expenseCats.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(isArabic && c.name_ar ? c.name_ar : c.name)}</option>`).join('')}</select></div></div><div class="form-group"><label class="form-label">${t('short_description_optional')}</label><input class="form-input" id="q-description" maxlength="160" placeholder="${t('description_example')}"></div>`,footerButtons:[`<button class="btn btn-outline" id="q-cancel">${t('cancel')}</button>`,`<button class="btn btn-primary" id="q-save">${t('save')}</button>`]}); document.getElementById('q-cancel')?.addEventListener('click',()=>closeModal('quick-tx-modal')); document.getElementById('q-save')?.addEventListener('click',async()=>{const amount=document.getElementById('q-amount').value,error=document.getElementById('q-amount-err');if(!validateAmount(amount)){error.classList.remove('hidden');return;}error.classList.add('hidden');const saveButton=document.getElementById('q-save');saveButton.disabled=true;try{await createTransaction(userId,{type:document.getElementById('q-type').value,amount:Number(amount),account_id:document.getElementById('q-account').value,category_id:document.getElementById('q-category').value||null,description:document.getElementById('q-description').value.trim()||null,date:todayISO(),status:'completed'});closeModal('quick-tx-modal');toast.success(t('success'),t('added'));await loadData();render();}catch(errorValue){toast.error(t('error'),errorValue.message);saveButton.disabled=false;}}); }
function redrawCharts() { const line=document.getElementById('cashflow-line-chart'),donut=document.getElementById('spending-donut-chart'); if(line) drawLineChart('cashflow-line-chart',cashflowSeries(Number(summaryData.totalBalance||0)-Number(summaryData.net||0)),'#176b73'); if(donut&&categoryData.length) drawDonutChart('spending-donut-chart',categoryData.slice(0,6).map(c=>({color:sanitizeColor(c.color,'#176b73'),value:Number(c.total||0)})),formatCurrency(categoryData.reduce((sum,c)=>sum+Number(c.total||0),0),userCurrency)); }
