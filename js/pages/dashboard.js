/* ============================================================
   HISBA — FINANCIAL DASHBOARD
   Product-recomposition release
   ============================================================ */
import { t, formatCurrency, formatRelativeDate, formatPercent, getMonthRange, getCurrentMonth, getLanguage, todayISO, validateAmount, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=currency-display-en-v2';
import { getDashboardSummary, getCategorySpending, getTransactions, getBudgets, getBudgetSpending, getAccounts, getCategories, createTransaction } from '../services/data.js?v=cloud-queue-unblock-v1';
import { createModal, openModal, closeModal } from '../components/modal.js?v=release-2.3.0';
import { toast } from '../toast.js?v=notification-v4';
import { drawLineChart, drawDonutChart } from '../components/charts.js?v=palette-system-v1';

let userId, userCurrency = 'USD', profileData = {};
let summaryData = {}, categoryData = [], recentTx = [], monthTx = [], budgets = [], quickAccounts = [], quickCategories = [];
let dataLoadError = null;

// Analytics must distinguish categories even when older category records share one saved colour.
// The sequence remains within Hisba's approved palette and preserves a user-selected colour when it is unique.
const SPENDING_ANALYTICS_COLORS = ['#3ec3d5', '#ff5460', '#41dc65', '#23233c', '#c8c7cd', '#e1e0e6'];

function assignDistinctSpendingColors(categories = []) {
  const usedColors = new Set();
  const colorByCategory = new Map();
  const categoryKey = category => String(category?.id || `${category?.name || ''}:${category?.name_ar || ''}`);
  const ordered = [...categories].sort((left, right) => categoryKey(left).localeCompare(categoryKey(right)));

  ordered.forEach((category, index) => {
    const savedColor = sanitizeColor(category?.color, '');
    const availableColor = savedColor && !usedColors.has(savedColor)
      ? savedColor
      : SPENDING_ANALYTICS_COLORS.find(color => !usedColors.has(color))
        || SPENDING_ANALYTICS_COLORS[index % SPENDING_ANALYTICS_COLORS.length];
    usedColors.add(availableColor);
    colorByCategory.set(categoryKey(category), availableColor);
  });

  return categories.map(category => ({
    ...category,
    analyticsColor: colorByCategory.get(categoryKey(category)) || SPENDING_ANALYTICS_COLORS[0],
  }));
}

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

function withLoadDeadline(promise, timeoutMs = 10_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error('DASHBOARD_LOAD_TIMEOUT');
      error.code = 'DASHBOARD_LOAD_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

async function loadData() {
  dataLoadError = null;
  const { year, month } = getCurrentMonth();
  const { start, end } = getMonthRange(year, month);
  try {
    const loaded = await withLoadDeadline((async () => {
      const [summary, categories, recent, allMonthTx, budgetList, accountList, categoryList] = await Promise.all([
        getDashboardSummary(userId, start, end),
        getCategorySpending(userId, start, end),
        getTransactions(userId, { start_date: start, end_date: end, limit: 6 }),
        getTransactions(userId, { start_date: start, end_date: end, limit: 300 }),
        getBudgets(userId),
        getAccounts(userId),
        getCategories(userId),
      ]);
      const spending = await getBudgetSpending(userId, budgetList || [], start, end, allMonthTx || []);
      return { summary, categories, recent, allMonthTx, budgetList, accountList, categoryList, spending };
    })());
    const { summary, categories, recent, allMonthTx, budgetList, accountList, categoryList, spending } = loaded;
    summaryData = summary || {};
    categoryData = assignDistinctSpendingColors(categories || []);
    recentTx = recent || [];
    monthTx = allMonthTx || [];
    quickAccounts = accountList || [];
    quickCategories = categoryList || [];
    budgets = (budgetList || []).map(budget => {
      const calculated = Number(spending[String(budget.category_id || '__total__')] || 0);
      return { ...budget, spent: calculated || (!budget.category_id ? Number(summaryData.expenses || 0) : 0) };
    });
  } catch (error) {
    dataLoadError = error;
  }
}

function render() {
  const el = document.getElementById('page-content');
  if (!el) return;
  if (dataLoadError) {
    renderDataUnavailable(el);
    return;
  }
  const { totalBalance = 0, income = 0, expenses = 0, net = 0 } = summaryData;
  const isArabic = getLanguage().startsWith('ar');
  const privacyActive = document.body.classList.contains('privacy-mask');
  const isFirstRun = !quickAccounts.length && !recentTx.length && !budgets.length;
  const openingBalance = Number(totalBalance) - Number(net);
  const cashflow = cashflowSeries(openingBalance);
  const mainBudget = budgets.find(budget => !budget.category_id) || budgets[0] || null;
  const budgetPercentage = mainBudget ? formatPercent(mainBudget.spent, mainBudget.amount) : 0;
  const budgetRemaining = mainBudget ? Number(mainBudget.amount || 0) - Number(mainBudget.spent || 0) : 0;
  const topCategory = categoryData[0] || null;
  const totalCategorySpend = categoryData.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const topCategoryShare = topCategory && totalCategorySpend > 0 ? Math.round((Number(topCategory.total || 0) / totalCategorySpend) * 100) : 0;
  const budgetState = budgetPercentage >= 100 ? 'is-over' : budgetPercentage >= 80 ? 'is-near' : 'is-safe';
  const insight = getInsight(mainBudget, budgetRemaining, topCategory, topCategoryShare, isArabic);
  const fallbackName = String(profileData.full_name || profileData.fullName || profileData.name || '').trim();
  const displayName = String(getLanguage() === 'en' ? (profileData.name_en || fallbackName) : (profileData.name_ar || fallbackName)).trim();
  const greeting = displayName ? t('dashboard_greeting_named', { name: escapeHTML(displayName) }) : t('dashboard_greeting_default');

  el.innerHTML = `
    <header class="dashboard-command-header">
      <div class="dashboard-welcome-copy">
        <p class="dashboard-welcome-kicker">${t('dashboard_title')}</p>
        <h1 class="dashboard-welcome-title">${greeting}</h1>
        <p class="dashboard-welcome-subtitle">${t('dashboard_overview_copy')}</p>
      </div>
      <button class="btn btn-primary dashboard-add-transaction" id="btn-add-tx" type="button">${renderIcon('plus', 17)}<span>${t('add_transaction')}</span></button>
    </header>

    ${privacyActive ? `<aside class="dashboard-privacy-notice" role="status"><span>${t('privacy_hidden')}</span><button type="button" id="btn-show-values">${t('privacy_visible')}</button></aside>` : ''}

    <section class="dashboard-kpi-grid" aria-label="${t('dashboard_financial_health')}">
      <article class="dashboard-kpi-card is-balance">
        <div class="dashboard-kpi-top"><span>${t('total_balance')}</span><i aria-hidden="true">${renderIcon('wallet', 17)}</i></div>
        <strong class="sensitive-value" dir="ltr">${formatCurrency(totalBalance, userCurrency)}</strong>
        <p class="${net >= 0 ? 'is-income' : 'is-expense'}">${renderIcon(net >= 0 ? 'arrow-up-right' : 'arrow-down-right', 13)} <span class="sensitive-value" dir="ltr">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net), userCurrency)}</span> ${t('this_month')}</p>
      </article>
      <article class="dashboard-kpi-card is-income">
        <div class="dashboard-kpi-top"><span>${t('monthly_income')}</span><i aria-hidden="true">${renderIcon('arrow-up-right', 17)}</i></div>
        <strong class="sensitive-value" dir="ltr">${formatCurrency(income, userCurrency)}</strong>
        <p>${t('this_month')}</p>
      </article>
      <article class="dashboard-kpi-card is-expense">
        <div class="dashboard-kpi-top"><span>${t('monthly_expenses')}</span><i aria-hidden="true">${renderIcon('arrow-down-right', 17)}</i></div>
        <strong class="sensitive-value" dir="ltr">${formatCurrency(expenses, userCurrency)}</strong>
        <p>${t('this_month')}</p>
      </article>
      <article class="dashboard-kpi-card is-budget">
        <div class="dashboard-kpi-top"><span>${t('budget_spent')}</span><i aria-hidden="true">${renderIcon('target', 17)}</i></div>
        <strong class="sensitive-value" dir="ltr">${mainBudget ? `${budgetPercentage}%` : '—'}</strong>
        <p>${mainBudget ? t('dashboard_budget_used') : t('dashboard_no_budgets')}</p>
      </article>
    </section>

    <section class="dashboard-command-grid">
      <div class="dashboard-main-column">
        <article class="dashboard-surface dashboard-assets-card" aria-label="${t('dashboard_cash_flow')}">
          <div class="dashboard-card-heading dashboard-card-heading-split">
            <div><p class="dashboard-section-kicker">${t('dashboard_financial_health')}</p><h2>${t('dashboard_cash_flow')}</h2><p>${t('dashboard_cash_flow_sub')}</p></div>
            <span class="dashboard-period-chip">${t('this_month')}</span>
          </div>
          <div class="dashboard-chart-legend" aria-hidden="true"><span><i></i>${t('total_balance')}</span></div>
          <div class="dashboard-asset-chart ${cashflow.length > 1 ? '' : 'is-empty'}">${cashflow.length > 1 ? '<canvas id="cashflow-line-chart" aria-label="Cash flow" role="img"></canvas>' : `<div class="finance-empty-chart finance-empty-chart-compact"><span aria-hidden="true">${renderIcon('chart-line', 22)}</span><div><strong>${t('dashboard_no_trend')}</strong><p>${t('dashboard_cashflow_empty')}</p></div><button class="btn btn-outline btn-sm" id="btn-empty-add-tx" type="button">${t('add_transaction')}</button></div>`}</div>
          <div class="dashboard-chart-footnote"><span>${t('dashboard_balance_start')} <strong class="sensitive-value" dir="ltr">${formatCurrency(openingBalance, userCurrency)}</strong></span><span>${t('net_savings')} <strong class="sensitive-value" dir="ltr">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net), userCurrency)}</strong></span></div>
        </article>

        <article class="dashboard-surface dashboard-activity-table-card" aria-label="${t('recent_transactions')}">
          <div class="dashboard-card-heading dashboard-card-heading-split"><div><p class="dashboard-section-kicker">${t('dashboard_activity')}</p><h2>${t('recent_transactions')}</h2></div><button class="dashboard-text-action" id="btn-view-all-tx" type="button">${t('view_all')}</button></div>
          ${recentTx.length ? `<div class="dashboard-transaction-table" role="table"><div class="dashboard-transaction-head" role="row"><span>${t('transaction_description')}</span><span>${t('transaction_date')}</span><span>${t('transaction_category')}</span><span>${t('transaction_amount')}</span></div><div class="dashboard-transaction-body">${recentTx.map(transaction => transactionTableRow(transaction, isArabic)).join('')}</div></div>` : compactEmpty('receipt', t('dashboard_no_activity'), t('add_transaction'), 'btn-activity-add')}
        </article>
      </div>

      <aside class="dashboard-right-rail">
        <article class="dashboard-surface dashboard-accounts-card" aria-label="${t('accounts_title')}">
          <div class="dashboard-card-heading dashboard-card-heading-split"><div><p class="dashboard-section-kicker">${t('accounts_title')}</p><h2>${t('account_balance')}</h2></div><button class="dashboard-text-action" id="btn-view-accounts" type="button">${t('view_all')}</button></div>
          ${quickAccounts.length ? `<div class="dashboard-account-stack">${quickAccounts.slice(0, 3).map(account => accountSummaryRow(account)).join('')}</div>` : `<div class="dashboard-rail-empty"><span aria-hidden="true">${renderIcon('wallet', 20)}</span><p>${t('no_accounts')}</p></div>`}
          <button class="dashboard-rail-action" id="btn-manage-accounts" type="button">${renderIcon('plus', 16)}<span>${t('accounts_title')}</span></button>
        </article>

        <article class="dashboard-surface dashboard-budget-card" aria-label="${t('dashboard_budget_status')}">
          <div class="dashboard-card-heading dashboard-card-heading-split"><div><p class="dashboard-section-kicker">${t('dashboard_budget_status')}</p><h2>${t('top_budgets')}</h2></div><button class="dashboard-text-action" id="btn-view-all-budgets" type="button">${t('view_all')}</button></div>
          ${mainBudget ? `<div class="dashboard-budget-amounts"><div><span>${t('budget_spent')}</span><strong class="sensitive-value is-expense" dir="ltr">${formatCurrency(mainBudget.spent, userCurrency)}</strong></div><div><span>${t('budget_remaining_label')}</span><strong class="sensitive-value ${budgetRemaining < 0 ? 'is-expense' : ''}" dir="ltr">${budgetRemaining < 0 ? '−' : ''}${formatCurrency(Math.abs(budgetRemaining), userCurrency)}</strong></div></div><div class="dashboard-budget-progress"><div><span>${budgetPercentage}% ${t('dashboard_budget_used')}</span><b class="${budgetState}">${budgetPercentage >= 100 ? t('overspent_label') : budgetPercentage >= 80 ? t('at_risk') : t('on_track')}</b></div><i><em class="${budgetState}" style="width:${Math.min(budgetPercentage, 100)}%"></em></i></div><p class="dashboard-budget-insight ${budgetState}">${escapeHTML(insight)}</p>` : `<div class="dashboard-rail-empty"><span aria-hidden="true">${renderIcon('target', 20)}</span><p>${t('dashboard_no_budgets')}</p><button class="btn btn-outline btn-sm" id="btn-create-budget" type="button">${t('dashboard_add_budget')}</button></div>`}
        </article>

        <article class="dashboard-surface dashboard-spending-card" aria-label="${t('dashboard_top_spending')}">
          <div class="dashboard-card-heading"><div><p class="dashboard-section-kicker">${t('dashboard_spending_analysis')}</p><h2>${t('dashboard_top_spending')}</h2></div></div>
          ${categoryData.length ? `<div class="dashboard-spending-compact" dir="${isArabic ? 'rtl' : 'ltr'}"><div class="dashboard-donut-wrap"><canvas id="spending-donut-chart" aria-label="${t('dashboard_top_spending')}" role="img"></canvas><div><strong class="sensitive-value" dir="ltr">${formatCurrency(totalCategorySpend, userCurrency)}</strong><span>${t('dashboard_total_spent')}</span></div></div><div class="dashboard-category-list" role="list">${categoryData.slice(0, 4).map(categoryRow).join('')}</div></div>` : `<div class="dashboard-rail-empty"><span aria-hidden="true">${renderIcon('pie-chart', 20)}</span><p>${t('dashboard_no_spending')}</p><button class="btn btn-outline btn-sm" id="btn-spending-add" type="button">${t('add_transaction')}</button></div>`}
        </article>
      </aside>
    </section>
  `;
  document.getElementById('btn-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-show-values')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hisba:toggle-privacy')));
  document.getElementById('btn-empty-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-spending-add')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-activity-add')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-create-budget')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets', action: 'add' } })));
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions' } })));
  document.getElementById('btn-view-all-budgets')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } })));
  document.getElementById('btn-view-accounts')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'accounts' } })));
  document.getElementById('btn-manage-accounts')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'accounts' } })));
  requestAnimationFrame(redrawCharts);
  if (isFirstRun && sessionStorage.getItem('hisba_onboarding_prompt_seen') !== '1') requestAnimationFrame(openOnboardingModal);
}

function renderDataUnavailable(el) {
  el.innerHTML = `
    <section class="empty-state card dashboard-data-unavailable" aria-live="polite">
      <div class="empty-icon">${renderIcon('refresh', 26)}</div>
      <h2>${t('dashboard_data_waiting')}</h2>
      <p>${t('dashboard_data_waiting_sub')}</p>
      <button class="btn btn-primary" id="dashboard-data-retry" type="button">${t('reload')}</button>
    </section>`;
  document.getElementById('dashboard-data-retry')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    renderSkeleton();
    await loadData();
    render();
  });
}

function accountSummaryRow(account) {
  const color = sanitizeColor(account.color, '#3ec3d5');
  const balance = Number(account.balance || 0);
  return `<div class="dashboard-account-row"><span class="dashboard-account-mark" style="--account-color:${color}" aria-hidden="true">${renderIcon('wallet', 15)}</span><div><strong>${escapeHTML(account.name || t('account'))}</strong><span>${t('account_balance')}</span></div><b class="sensitive-value ${balance < 0 ? 'is-expense' : ''}" dir="ltr">${balance < 0 ? '−' : ''}${formatCurrency(Math.abs(balance), account.currency || userCurrency)}</b></div>`;
}

function transactionTableRow(transaction, isArabic) {
  const color = sanitizeColor(transaction.category?.color, '#3ec3d5');
  const categoryName = isArabic && transaction.category?.name_ar ? transaction.category.name_ar : (transaction.category?.name || '—');
  const prefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '';
  return `<article class="dashboard-transaction-row" role="row"><div class="dashboard-transaction-title"><span class="dashboard-transaction-icon" style="--category-color:${color}" aria-hidden="true">${renderIcon(transaction.category?.icon || 'receipt', 15)}</span><strong>${escapeHTML(transaction.description || t('transaction_untitled'))}</strong></div><time datetime="${escapeHTML(String(transaction.date || ''))}">${formatRelativeDate(transaction.date)}</time><span class="dashboard-category-chip" style="--category-color:${color}">${escapeHTML(categoryName)}</span><strong class="sensitive-value ${transaction.type === 'income' ? 'is-income' : transaction.type === 'expense' ? 'is-expense' : ''}" dir="ltr">${prefix}${formatCurrency(transaction.amount, transaction.account?.currency || userCurrency)}</strong></article>`;
}

function compactEmpty(icon, copy, action, id) { return `<div class="finance-empty-state finance-empty-state-compact"><span aria-hidden="true">${renderIcon(icon, 21)}</span><p>${copy}</p><button class="btn btn-outline btn-sm" id="${id}" type="button">${action}</button></div>`; }

function categoryRow(category) { const total = categoryData.reduce((sum, item) => sum + Number(item.total || 0), 0); const share = total ? Math.round(Number(category.total || 0) / total * 100) : 0; const name = getLanguage().startsWith('ar') && category.name_ar ? category.name_ar : category.name || '—'; const color = category.analyticsColor || sanitizeColor(category.color, '#3ec3d5'); return `<div class="dashboard-category-row" role="listitem"><span style="background:${color}" aria-hidden="true"></span><strong>${escapeHTML(name)}</strong><b class="sensitive-value" dir="ltr">${formatCurrency(category.total, userCurrency)}</b></div>`; }
function getInsight(mainBudget, budgetRemaining, topCategory, topCategoryShare, isArabic) { if (mainBudget && budgetRemaining < 0) return t('dashboard_insight_over_budget', { amount: formatCurrency(Math.abs(budgetRemaining), userCurrency) }); if (mainBudget && formatPercent(mainBudget.spent, mainBudget.amount) >= 80) return t('dashboard_insight_budget_close', { amount: formatCurrency(Math.max(0, budgetRemaining), userCurrency) }); if (topCategory) { const name = isArabic && topCategory.name_ar ? topCategory.name_ar : topCategory.name; return t('dashboard_insight_top_category', { category: name, percent: topCategoryShare }); } return t('dashboard_insight_no_budget'); }
function transactionRow(transaction, isArabic) { const color = sanitizeColor(transaction.category?.color, '#3ec3d5'); const categoryName = isArabic && transaction.category?.name_ar ? transaction.category.name_ar : (transaction.category?.name || '—'); const prefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''; return `<article class="finance-activity-row"><span class="finance-activity-icon" style="--category-color:${color}">${renderIcon(transaction.category?.icon || 'receipt', 16)}</span><div class="finance-activity-copy"><strong>${escapeHTML(transaction.description || t('transaction_untitled'))}</strong><span>${escapeHTML(categoryName)}<i aria-hidden="true">·</i>${formatRelativeDate(transaction.date)}</span></div><strong class="finance-activity-amount sensitive-value ${transaction.type === 'income' ? 'is-income' : transaction.type === 'expense' ? 'is-expense' : ''}" dir="ltr">${prefix}${formatCurrency(transaction.amount, transaction.account?.currency || userCurrency)}</strong></article>`; }
function cashflowSeries(openingBalance) {
  if (!monthTx.length) return [];
  const { year, month } = getCurrentMonth();
  const byDay = new Map();
  monthTx.forEach(transaction => {
    const date = String(transaction.date || '').slice(0, 10);
    if (!date) return;
    const move = transaction.type === 'income' ? Number(transaction.amount || 0) : transaction.type === 'expense' ? -Number(transaction.amount || 0) : 0;
    byDay.set(date, (byDay.get(date) || 0) + move);
  });
  const [todayYear, todayMonth, todayDay] = todayISO().split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const visibleDay = todayYear === year && todayMonth === month ? Math.min(todayDay, lastDay) : lastDay;
  let running = Number(openingBalance || 0);
  const points = [];
  for (let day = 1; day <= Math.max(1, visibleDay); day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    running += Number(byDay.get(date) || 0);
    points.push({ label: String(day), value: running });
  }
  return points;
}

function openOnboardingModal() { if (document.getElementById('onboarding-modal')) return; sessionStorage.setItem('hisba_onboarding_prompt_seen', '1'); createModal({ id:'onboarding-modal', title:t('onboarding_title'), size:'modal-sm', content:`<section class="onboarding-dialog" aria-describedby="onboarding-dialog-copy"><div class="onboarding-dialog-progress"><span class="onboarding-dialog-kicker">${t('onboarding_progress',{current:1,total:3})}</span><span class="onboarding-progress-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i></span></div><div class="onboarding-dialog-icon" aria-hidden="true">${renderIcon('wallet',28)}</div><div><h3 class="onboarding-dialog-title">${t('onboarding_step_account')}</h3><p class="onboarding-dialog-copy" id="onboarding-dialog-copy">${t('onboarding_step_account_sub')}</p></div></section>`, footerButtons:[`<button class="btn btn-outline" id="onboarding-later">${t('onboarding_not_now')}</button>`,`<button class="btn btn-primary" id="onboarding-start">${t('onboarding_start')}</button>`] }); openModal('onboarding-modal'); document.getElementById('onboarding-later')?.addEventListener('click',()=>closeModal('onboarding-modal')); document.getElementById('onboarding-start')?.addEventListener('click',()=>{closeModal('onboarding-modal');window.dispatchEvent(new CustomEvent('navigate',{detail:{page:'accounts',returnTo:'transactions',returnAction:'onboarding-transaction'}}));}); }
function openQuickAddModal() { if (!quickAccounts.length) { window.dispatchEvent(new CustomEvent('navigate',{detail:{page:'transactions',action:'add'}})); return; } const isArabic = getLanguage().startsWith('ar'); const expenseCats = quickCategories.filter(category => category.type === 'expense' || !category.type); createModal({id:'quick-tx-modal',title:t('quick_add'),content:`<div class="form-group"><label class="form-label">${t('transaction_type')}</label><select class="form-select" id="q-type"><option value="expense">${t('expense')}</option><option value="income">${t('income')}</option></select></div><div class="form-group"><label class="form-label">${t('amount')}</label><input type="number" class="form-input" id="q-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" autofocus><div class="form-error hidden" id="q-amount-err">${t('invalid_amount')}</div></div><div class="form-row"><div class="form-group"><label class="form-label">${t('account')}</label><select class="form-select" id="q-account">${quickAccounts.map(a=>`<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('category_optional')}</label><select class="form-select" id="q-category"><option value="">${t('no_category')}</option>${expenseCats.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(isArabic && c.name_ar ? c.name_ar : c.name)}</option>`).join('')}</select></div></div><div class="form-group"><label class="form-label">${t('short_description_optional')}</label><input class="form-input" id="q-description" name="hisba-quick-transaction-description" maxlength="160" autocomplete="off" aria-autocomplete="none" placeholder="${t('description_example')}"></div>`,footerButtons:[`<button class="btn btn-outline" id="q-cancel">${t('cancel')}</button>`,`<button class="btn btn-primary" id="q-save">${t('save')}</button>`]}); openModal('quick-tx-modal'); document.getElementById('q-cancel')?.addEventListener('click',()=>closeModal('quick-tx-modal')); document.getElementById('q-save')?.addEventListener('click',async()=>{const amount=document.getElementById('q-amount').value,error=document.getElementById('q-amount-err');if(!validateAmount(amount)){error.classList.remove('hidden');return;}error.classList.add('hidden');const saveButton=document.getElementById('q-save');saveButton.disabled=true;try{await createTransaction(userId,{type:document.getElementById('q-type').value,amount:Number(amount),account_id:document.getElementById('q-account').value,category_id:document.getElementById('q-category').value||null,description:document.getElementById('q-description').value.trim()||null,date:todayISO(),status:'completed'});closeModal('quick-tx-modal');toast.success(t('success'),t('added'));await loadData();render();}catch(errorValue){toast.error(t('error'),errorValue.message);saveButton.disabled=false;}}); }
function redrawCharts() { const line=document.getElementById('cashflow-line-chart'),donut=document.getElementById('spending-donut-chart'); if(line) drawLineChart('cashflow-line-chart',cashflowSeries(Number(summaryData.totalBalance||0)-Number(summaryData.net||0)),'#3ec3d5'); if(donut&&categoryData.length) drawDonutChart('spending-donut-chart',categoryData.slice(0,6).map(c=>({color:c.analyticsColor || sanitizeColor(c.color,'#3ec3d5'),value:Number(c.total||0)}))); }
