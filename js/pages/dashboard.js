/* ============================================================
   HISBA — DASHBOARD PAGE
   ============================================================ */
import { t, formatCurrency, formatRelativeDate, formatPercent, getMonthRange, getCurrentMonth, getLanguage, todayISO, validateAmount, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=release-2.1.0';
import { getDashboardSummary, getMonthlyTrend, getCategorySpending, getTransactions, getBudgets, getBudgetSpending, getAccounts, getCategories, createTransaction } from '../services/data.js';
import { createModal, openModal, closeModal } from '../components/modal.js?v=release-2.1.0';
import { toast } from '../toast.js?v=release-2.1.0';
import { drawLineChart, drawDonutChart } from '../components/charts.js?v=release-2.1.0';

let userId, userCurrency = 'USD';
let summaryData = {}, trendData = [], categoryData = [], recentTx = [], budgets = [], quickAccounts = [], quickCategories = [];

export async function initDashboard(uid, profile) {
  userId = uid;
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
    <div class="page-header">
      <div><div class="skeleton skeleton-title" style="width:200px;height:32px;"></div><div class="skeleton skeleton-text" style="width:140px;margin-top:8px;"></div></div>
    </div>
    <div class="stats-grid">
      ${[1,2,3,4].map(() => `<div class="stat-card"><div class="skeleton skeleton-card"></div></div>`).join('')}
    </div>
    <div class="dashboard-grid">
      <div class="card"><div class="skeleton" style="height:280px;"></div></div>
      <div class="card"><div class="skeleton" style="height:280px;"></div></div>
    </div>`;
}

async function loadData() {
  const { year, month } = getCurrentMonth();
  const { start, end } = getMonthRange(year, month);
  const lastMonth = getMonthRange(year, month - 1 || 12, month === 1 ? year - 1 : year);

  const [summary, trend, categories, recent, budgetList, accountList, categoryList] = await Promise.all([
    getDashboardSummary(userId, start, end).catch(() => ({ totalBalance: 0, income: 0, expenses: 0, net: 0, transactions: [] })),
    getMonthlyTrend(userId, 6).catch(() => []),
    getCategorySpending(userId, start, end).catch(() => []),
    getTransactions(userId, { start_date: start, end_date: end, limit: 8 }).catch(() => []),
    getBudgets(userId).catch(() => []),
    getAccounts(userId).catch(() => []),
    getCategories(userId).catch(() => []),
  ]);

  summaryData = summary;
  trendData = trend;
  categoryData = categories;
  recentTx = recent;
  budgets = budgetList;
  quickAccounts = accountList;
  quickCategories = categoryList;

  // Budget spending
  const spending = await getBudgetSpending(userId, budgets, start, end).catch(() => ({}));
  budgets = budgets.map(b => {
    const key = String(b.category_id || '__total__');
    const calculated = Number(spending[key] || 0);
    const spent = calculated || (!b.category_id ? Number(summaryData.expenses || 0) : 0);
    return { ...b, spent };
  });
}

function render() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const { totalBalance = 0, income = 0, expenses = 0, net = 0 } = summaryData;
  const isFirstRun = !quickAccounts.length && !recentTx.length && !budgets.length;
  const isArabic = getLanguage().startsWith('ar');
  const accountRows = quickAccounts.slice(0, 4);

  el.innerHTML = `
    <div class="page-header dashboard-reference-header">
      <div>
        <h1 class="page-title">${t('dashboard_title')}</h1>
        <p class="page-subtitle">${t('dashboard_subtitle')}</p>
      </div>
    </div>

    <div class="dashboard-reference-top">
      <section class="dashboard-panel dashboard-accounts-snapshot" aria-label="${t('nav_accounts')}">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('nav_accounts')}</h2>
            <p class="dashboard-panel-caption">${t('total_balance')}</p>
          </div>
          <button class="dashboard-icon-action" id="btn-view-all-accounts" type="button" aria-label="${t('nav_accounts')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        ${accountRows.length ? `
          <div class="dashboard-account-list">
            ${accountRows.map((account, index) => `
              <article class="dashboard-account-row">
                <span class="dashboard-account-icon accent-${index % 4}">${renderIcon(account.icon || (account.type === 'cash' ? 'wallet' : 'credit-card'), 16)}</span>
                <div class="dashboard-account-copy"><strong>${escapeHTML(account.name || '—')}</strong><span>${escapeHTML(account.type || '')}</span></div>
                <strong class="dashboard-account-balance sensitive-value" dir="ltr">${formatCurrency(account.balance || 0, account.currency || userCurrency)}</strong>
              </article>
            `).join('')}
          </div>
        ` : `
          <button class="dashboard-empty-account" id="btn-add-account" type="button">
            <span class="dashboard-account-icon accent-0">${renderIcon('wallet', 16)}</span>
            <span>${t('onboarding_step_account')}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        `}
      </section>

      <section class="dashboard-overview-card" aria-label="${t('total_balance')}">
        <div class="dashboard-overview-header">
          <div>
            <p class="dashboard-overview-kicker">${t('total_balance')}</p>
            <p class="dashboard-overview-balance sensitive-value" dir="ltr">${formatCurrency(totalBalance, userCurrency)}</p>
          </div>
          <button class="dashboard-overview-add" id="btn-add-tx" type="button" aria-label="${t('quick_add')}" title="${t('quick_add')}">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div class="dashboard-overview-period">
          <span>${t('this_month')}</span>
          <span class="dashboard-overview-change sensitive-value ${net < 0 ? 'is-negative' : ''}" dir="ltr">${net >= 0 ? '+' : ''}${formatCurrency(net, userCurrency)}</span>
        </div>
        <div class="dashboard-overview-chart-shell">
          <canvas id="balance-line-chart" aria-label="${t('total_balance')}" role="img"></canvas>
        </div>
        <div class="dashboard-overview-metrics">
          <div><span>${t('monthly_income')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(income, userCurrency)}</strong></div>
          <div><span>${t('monthly_expenses')}</span><strong class="sensitive-value is-expense" dir="ltr">${formatCurrency(expenses, userCurrency)}</strong></div>
          <div><span>${t('net_savings')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(net, userCurrency)}</strong></div>
        </div>
      </section>
    </div>

    <div class="dashboard-reference-grid">
      <section class="dashboard-panel dashboard-categories-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('category_breakdown')}</h2>
            <p class="dashboard-panel-caption">${t('monthly_expenses')}</p>
          </div>
        </div>
        <div class="category-breakdown-layout" dir="${isArabic ? 'rtl' : 'ltr'}">
          <div class="category-chart-panel">
            <div class="category-chart-wrap"><canvas id="donut-chart" aria-label="${t('category_breakdown')}" role="img"></canvas></div>
            <div class="category-total-label">${t('monthly_expenses')}</div>
            <div class="category-total-value sensitive-value" dir="ltr">${categoryData.length ? formatCurrency(categoryData.reduce((sum, category) => sum + category.total, 0), userCurrency) : formatCurrency(0, userCurrency)}</div>
          </div>
          <div class="category-legend" aria-label="${t('category_breakdown')}" role="list">
            ${categoryData.slice(0, 5).map(category => `
              <div class="category-legend-row" role="listitem">
                <div class="category-legend-main"><span class="category-color-dot" style="background:${sanitizeColor(category.color)};"></span><span class="category-legend-name">${escapeHTML(isArabic && category.name_ar ? category.name_ar : category.name)}</span></div>
                <span class="category-legend-amount sensitive-value" dir="ltr">${formatCurrency(category.total, userCurrency)}</span>
              </div>
            `).join('') || `<p class="category-empty text-caption text-muted">${t('no_data')}</p>`}
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-budget-panel">
        <div class="dashboard-panel-header">
          <div><h2 class="dashboard-panel-title">${t('top_budgets')}</h2><p class="dashboard-panel-caption">${t('this_month')}</p></div>
          <button class="dashboard-text-action" id="btn-view-all-budgets" type="button">${t('view_all')}</button>
        </div>
        <div class="dashboard-budget-list">
          ${budgets.length ? budgets.slice(0, 3).map(budget => {
            const percentage = formatPercent(budget.spent, budget.amount);
            const status = percentage >= 100 ? 'error' : percentage >= 80 ? 'warning' : 'success';
            return `<div class="dashboard-budget-row"><div class="dashboard-budget-row-head"><div class="dashboard-budget-name"><span class="dashboard-category-icon" style="--category-color:${budget.category?.color && sanitizeColor(budget.category.color).startsWith('#') ? sanitizeColor(budget.category.color) : 'var(--clr-primary)'};">${renderIcon(budget.category?.icon || 'package', 15)}</span><span>${escapeHTML(budget.name)}</span></div><span class="dashboard-budget-percent">${percentage}%</span></div><div class="dashboard-budget-track"><span class="is-${status}" style="width:${Math.min(percentage, 100)}%;"></span></div><p class="dashboard-budget-amount sensitive-value" dir="ltr">${formatCurrency(budget.spent, userCurrency)} / ${formatCurrency(budget.amount, userCurrency)}</p></div>`;
          }).join('') : `<div class="dashboard-compact-empty">${t('no_budgets_sub')}</div>`}
        </div>
      </section>
    </div>

    <section class="dashboard-panel dashboard-transactions-panel dashboard-reference-transactions">
      <div class="dashboard-panel-header">
        <div><h2 class="dashboard-panel-title">${t('recent_transactions')}</h2><p class="dashboard-panel-caption">${t('this_month')}</p></div>
        <button class="dashboard-text-action" id="btn-view-all-tx" type="button">${t('view_all')}</button>
      </div>
      ${recentTx.length ? `<div class="dashboard-transaction-list">${recentTx.slice(0, 6).map(transaction => `<article class="dashboard-transaction-row"><span class="dashboard-category-icon" style="--category-color:${transaction.category?.color && sanitizeColor(transaction.category.color).startsWith('#') ? sanitizeColor(transaction.category.color) : 'var(--clr-primary)'};">${renderIcon(transaction.category?.icon || 'package', 16)}</span><div class="dashboard-transaction-copy"><strong>${escapeHTML(transaction.description || '—')}</strong><span>${escapeHTML(isArabic && transaction.category?.name_ar ? transaction.category.name_ar : (transaction.category?.name || '—'))} <i aria-hidden="true">·</i> ${formatRelativeDate(transaction.date)}</span></div><strong class="dashboard-transaction-amount sensitive-value ${transaction.type === 'income' ? 'is-income' : transaction.type === 'expense' ? 'is-expense' : ''}" dir="ltr">${transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''}${formatCurrency(transaction.amount, transaction.account?.currency || userCurrency)}</strong></article>`).join('')}</div>` : `<div class="dashboard-compact-empty">${t('no_transactions_sub')}</div>`}
    </section>
  `;

  document.getElementById('btn-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-add-account')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'accounts', action: 'add' } })));
  document.getElementById('btn-view-all-accounts')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'accounts' } })));
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions' } })));
  document.getElementById('btn-view-all-budgets')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } })));

  requestAnimationFrame(() => redrawCharts());
  if (isFirstRun && sessionStorage.getItem('hisba_onboarding_prompt_seen') !== '1') requestAnimationFrame(openOnboardingModal);
}

function openOnboardingModal() {
  if (document.getElementById('onboarding-modal')) return;
  sessionStorage.setItem('hisba_onboarding_prompt_seen', '1');
  createModal({
    id: 'onboarding-modal',
    title: t('onboarding_title'),
    size: 'modal-sm',
    content: `
      <section class="onboarding-dialog" aria-describedby="onboarding-dialog-copy">
        <div class="onboarding-dialog-progress">
          <span class="onboarding-dialog-kicker">${t('onboarding_progress', { current: 1, total: 3 })}</span>
          <span class="onboarding-progress-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i></span>
        </div>
        <div class="onboarding-dialog-icon" aria-hidden="true">${renderIcon('wallet', 28)}</div>
        <div>
          <h3 class="onboarding-dialog-title">${t('onboarding_step_account')}</h3>
          <p class="onboarding-dialog-copy" id="onboarding-dialog-copy">${t('onboarding_step_account_sub')}</p>
        </div>
      </section>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="onboarding-later">${t('onboarding_not_now')}</button>`,
      `<button class="btn btn-primary" id="onboarding-start">${t('onboarding_start')}</button>`,
    ],
  });
  openModal('onboarding-modal');
  document.getElementById('onboarding-later')?.addEventListener('click', () => closeModal('onboarding-modal'));
  document.getElementById('onboarding-start')?.addEventListener('click', () => {
    closeModal('onboarding-modal');
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'accounts', returnTo: 'transactions', returnAction: 'onboarding-transaction' },
    }));
  });
}

function openQuickAddModal() {
  if (!quickAccounts.length) {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions', action: 'add' } }));
    return;
  }
  const ar = getLanguage().startsWith('ar');
  const expenseCats = quickCategories.filter(c => c.type === 'expense' || !c.type);
  createModal({
    id: 'quick-tx-modal',
    title: t('quick_add'),
    content: `
      <div class="form-group">
        <label class="form-label">${t('transaction_type')}</label>
        <select class="form-select" id="q-type"><option value="expense">${t('expense')}</option><option value="income">${t('income')}</option></select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('amount')}</label>
        <input type="number" class="form-input" id="q-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" autofocus>
        <div class="form-error hidden" id="q-amount-err">${t('invalid_amount')}</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('account')}</label><select class="form-select" id="q-account">${quickAccounts.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">${t('category_optional')}</label><select class="form-select" id="q-category"><option value="">${t('no_category')}</option>${expenseCats.map(c => `<option value="${escapeHTML(c.id)}">${renderIcon(c.icon || 'package', 16)} ${escapeHTML(ar && c.name_ar ? c.name_ar : c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label class="form-label">${t('short_description_optional')}</label><input class="form-input" id="q-description" maxlength="160" placeholder="${t('description_example')}"></div>
    `,
    footerButtons: [`<button class="btn btn-outline" id="q-cancel">${t('cancel')}</button>`, `<button class="btn btn-primary" id="q-save">${t('save')}</button>`],
  });
  document.getElementById('q-cancel')?.addEventListener('click', () => closeModal('quick-tx-modal'));
  document.getElementById('q-save')?.addEventListener('click', async () => {
    const amount = document.getElementById('q-amount').value;
    const err = document.getElementById('q-amount-err');
    if (!validateAmount(amount)) { err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    const btn = document.getElementById('q-save'); btn.disabled = true;
    try {
      await createTransaction(userId, { type: document.getElementById('q-type').value, amount: Number(amount), account_id: document.getElementById('q-account').value, category_id: document.getElementById('q-category').value || null, description: document.getElementById('q-description').value.trim() || null, date: todayISO(), status: 'completed' });
      closeModal('quick-tx-modal'); toast.success(ar ? 'اتسجلت' : 'Saved', ar ? 'اتسجلت المعاملة بنجاح' : 'Transaction saved'); await loadData(); render();
    } catch (e) { toast.error(ar ? 'حصل خطأ' : 'Error', e.message); btn.disabled = false; }
  });
}

function redrawCharts() {
  const balanceTrend = trendData.length
    ? trendData.map(item => ({ label: item.month || '', value: Math.max(0, Number(item.balance ?? item.net ?? (Number(item.income || 0) - Number(item.expenses || 0)))) }))
    : [{ label: t('this_month'), value: Math.max(0, Number(summaryData.totalBalance || 0)) }, { label: '', value: Math.max(0, Number(summaryData.totalBalance || 0)) }];
  drawLineChart('balance-line-chart', balanceTrend, '#176b73');
  drawDonutChart('donut-chart', categoryData.slice(0, 6).map(category => ({ color: sanitizeColor(category.color, '#0a0a0a'), value: category.total })),
    categoryData.length ? formatCurrency(categoryData.reduce((sum, category) => sum + category.total, 0), userCurrency) : '');
}

function statCard(label, value, type, change, color) {
  const iconMap = {
    balance:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    income:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    expense:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
    savings:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>`,
  };
  return `
    <div class="stat-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-md);">
        <span class="stat-card-label">${label}</span>
        <div class="stat-card-icon" style="background:${color}22;color:${color};">${iconMap[type] || ''}</div>
      </div>
      <div class="stat-card-value sensitive-value" style="color:${color};">${value}</div>
    </div>`;
}
