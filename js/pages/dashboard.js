/* ============================================================
   HISBA — DASHBOARD PAGE
   ============================================================ */
import { t, formatCurrency, formatRelativeDate, formatPercent, getMonthRange, getCurrentMonth, getLanguage, todayISO, validateAmount, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=release-2.0.2';
import { getDashboardSummary, getMonthlyTrend, getCategorySpending, getTransactions, getBudgets, getBudgetSpending, getAccounts, getCategories, createTransaction } from '../services/data.js';
import { createModal, openModal, closeModal } from '../components/modal.js?v=release-2.0.2';
import { toast } from '../toast.js?v=release-2.0.2';
import { drawBarChart, drawDonutChart } from '../components/charts.js?v=release-2.0.2';

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

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('dashboard_title')}</h1>
        <p class="page-subtitle">${t('dashboard_subtitle')}</p>
      </div>

    </div>


    <section class="dashboard-hero" aria-label="${t('total_balance')}">
      <div class="dashboard-hero-main">
        <div>
          <p class="dashboard-hero-kicker">${t('total_balance')}</p>
          <p class="dashboard-hero-balance sensitive-value" dir="ltr">${formatCurrency(totalBalance, userCurrency)}</p>
          <p class="dashboard-hero-caption">${t('this_month')}</p>
        </div>
        <button class="dashboard-hero-add" id="btn-add-tx" type="button">
          <span aria-hidden="true">+</span>
          <span>${t('quick_add')}</span>
        </button>
      </div>
      <div class="dashboard-hero-metrics">
        <div class="dashboard-hero-metric is-income">
          <span>${t('monthly_income')}</span>
          <strong class="sensitive-value" dir="ltr">${formatCurrency(income, userCurrency)}</strong>
        </div>
        <div class="dashboard-hero-metric is-expense">
          <span>${t('monthly_expenses')}</span>
          <strong class="sensitive-value" dir="ltr">${formatCurrency(expenses, userCurrency)}</strong>
        </div>
        <div class="dashboard-hero-metric">
          <span>${t('net_savings')}</span>
          <strong class="sensitive-value" dir="ltr">${formatCurrency(net, userCurrency)}</strong>
        </div>
      </div>
    </section>

    <div class="dashboard-insight-grid">
      <section class="dashboard-panel dashboard-trend-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('income_vs_expense')}</h2>
            <p class="dashboard-panel-caption">${t('this_month')}</p>
          </div>
        </div>
        <div class="dashboard-chart-shell">
          <canvas id="bar-chart" aria-label="${t('income_vs_expense')}" role="img"></canvas>
        </div>
      </section>
      <section class="dashboard-panel dashboard-budget-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('top_budgets')}</h2>
            <p class="dashboard-panel-caption">${t('this_month')}</p>
          </div>
          <button class="dashboard-text-action" id="btn-view-all-budgets" type="button">${t('view_all')}</button>
        </div>
        <div class="dashboard-budget-list">
          ${budgets.length ? budgets.slice(0, 3).map(b => {
            const pct = formatPercent(b.spent, b.amount);
            const status = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
            return `
              <div class="dashboard-budget-row">
                <div class="dashboard-budget-row-head">
                  <div class="dashboard-budget-name">
                    <span class="dashboard-category-icon" style="--category-color:${b.category?.color && sanitizeColor(b.category.color).startsWith('#') ? sanitizeColor(b.category.color) : 'var(--clr-primary)'};">${renderIcon(b.category?.icon || 'package', 15)}</span>
                    <span>${escapeHTML(b.name)}</span>
                  </div>
                  <span class="dashboard-budget-percent">${pct}%</span>
                </div>
                <div class="dashboard-budget-track"><span class="is-${status}" style="width:${Math.min(pct, 100)}%;"></span></div>
                <p class="dashboard-budget-amount sensitive-value" dir="ltr">${formatCurrency(b.spent, userCurrency)} / ${formatCurrency(b.amount, userCurrency)}</p>
              </div>
            `;
          }).join('') : `<div class="dashboard-compact-empty">${t('no_budgets_sub')}</div>`}
        </div>
      </section>
    </div>

    <div class="dashboard-content-grid">
      <section class="dashboard-panel dashboard-transactions-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('recent_transactions')}</h2>
            <p class="dashboard-panel-caption">${t('this_month')}</p>
          </div>
          <button class="dashboard-text-action" id="btn-view-all-tx" type="button">${t('view_all')}</button>
        </div>
        ${recentTx.length ? `
          <div class="dashboard-transaction-list">
            ${recentTx.slice(0, 6).map(tx => `
              <article class="dashboard-transaction-row">
                <span class="dashboard-category-icon" style="--category-color:${tx.category?.color && sanitizeColor(tx.category.color).startsWith('#') ? sanitizeColor(tx.category.color) : 'var(--clr-primary)'};">${renderIcon(tx.category?.icon || 'package', 16)}</span>
                <div class="dashboard-transaction-copy">
                  <strong>${escapeHTML(tx.description || '—')}</strong>
                  <span>${escapeHTML(getLanguage().startsWith('ar') && tx.category?.name_ar ? tx.category.name_ar : (tx.category?.name || '—'))} <i aria-hidden="true">·</i> ${formatRelativeDate(tx.date)}</span>
                </div>
                <strong class="dashboard-transaction-amount sensitive-value ${tx.type === 'income' ? 'is-income' : tx.type === 'expense' ? 'is-expense' : ''}" dir="ltr">${tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}${formatCurrency(tx.amount, tx.account?.currency || userCurrency)}</strong>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="dashboard-compact-empty">${t('no_transactions_sub')}</div>
        `}
      </section>

      <section class="dashboard-panel dashboard-categories-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${t('category_breakdown')}</h2>
            <p class="dashboard-panel-caption">${t('monthly_expenses')}</p>
          </div>
        </div>
        <div class="category-breakdown-layout" dir="${getLanguage().startsWith('ar') ? 'rtl' : 'ltr'}">
          <div class="category-chart-panel">
            <div class="category-chart-wrap">
              <canvas id="donut-chart" aria-label="${t('category_breakdown')}" role="img"></canvas>
            </div>
            <div class="category-total-label">${t('monthly_expenses')}</div>
            <div class="category-total-value sensitive-value">${categoryData.length ? formatCurrency(categoryData.reduce((s, c) => s + c.total, 0), userCurrency) : formatCurrency(0, userCurrency)}</div>
          </div>
          <div class="category-legend" aria-label="${t('category_breakdown')}" role="list">
            ${categoryData.slice(0, 5).map(cat => `
              <div class="category-legend-row" role="listitem">
                <div class="category-legend-main">
                  <span class="category-color-dot" style="background:${sanitizeColor(cat.color)};"></span>
                  <span class="category-legend-name">${escapeHTML(getLanguage().startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name)}</span>
                </div>
                <span class="category-legend-amount sensitive-value" dir="ltr">${formatCurrency(cat.total, userCurrency)}</span>
              </div>
            `).join('') || `<p class="category-empty text-caption text-muted">${t('no_data')}</p>`}
          </div>
        </div>
      </section>
    </div>
  `;

  // Wire up navigation buttons
  document.getElementById('btn-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions' } }));
  });
  document.getElementById('btn-view-all-budgets')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } }));
  });

  // Draw charts after DOM is rendered
  requestAnimationFrame(() => redrawCharts());
  if (isFirstRun && sessionStorage.getItem('hisba_onboarding_prompt_seen') !== '1') {
    requestAnimationFrame(openOnboardingModal);
  }
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
  drawBarChart('bar-chart', trendData.length ? trendData : [{ month: 'Now', income: summaryData.income || 0, expenses: summaryData.expenses || 0 }]);
  drawDonutChart('donut-chart', categoryData.slice(0, 6).map(c => ({ color: sanitizeColor(c.color, '#0a0a0a'), value: c.total })),
    categoryData.length ? formatCurrency(categoryData.reduce((s, c) => s + c.total, 0), userCurrency) : '');
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
