/* ============================================================
   HISBA — DASHBOARD PAGE
   ============================================================ */
import { t, formatCurrency, formatRelativeDate, formatPercent, getMonthRange, getCurrentMonth, getLanguage, todayISO, validateAmount, renderIcon } from '../utils.js?v=locale-shell-v2';
import { getDashboardSummary, getMonthlyTrend, getCategorySpending, getTransactions, getBudgets, getBudgetSpending, getAccounts, getCategories, createTransaction } from '../services/data.js';
import { createModal, openModal, closeModal } from '../components/modal.js';
import { toast } from '../toast.js';
import { drawBarChart, drawDonutChart } from '../components/charts.js?v=legend-v3';

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
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-tx">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${getLanguage().startsWith('ar') ? 'تسجيل سريع' : 'Quick add'}
        </button>
      </div>
    </div>

    ${isFirstRun ? `
      <section class="card onboarding-card" aria-labelledby="onboarding-title" style="margin-bottom:var(--sp-xl);">
        <div class="card-header" style="align-items:flex-start;">
          <div>
            <h2 class="card-title" id="onboarding-title">${t('onboarding_title')}</h2>
            <p class="text-caption text-muted" style="margin-top:var(--sp-xs);max-width:620px;">${t('onboarding_subtitle')}</p>
          </div>
          <span class="badge badge-primary">1 / 3</span>
        </div>
        <div class="onboarding-steps">
          <button class="onboarding-step" id="onboarding-add-account" type="button">
            <span class="onboarding-step-number">1</span>
            <span class="onboarding-step-copy"><strong>${t('onboarding_step_account')}</strong><small>${t('onboarding_step_account_sub')}</small></span>
            <span class="onboarding-step-cta">${t('onboarding_start')}</span>
          </button>
          <button class="onboarding-step" id="onboarding-add-transaction" type="button">
            <span class="onboarding-step-number">2</span>
            <span class="onboarding-step-copy"><strong>${t('onboarding_step_transaction')}</strong><small>${t('onboarding_step_transaction_sub')}</small></span>
          </button>
          <button class="onboarding-step" id="onboarding-add-budget" type="button">
            <span class="onboarding-step-number">3</span>
            <span class="onboarding-step-copy"><strong>${t('onboarding_step_budget')}</strong><small>${t('onboarding_step_budget_sub')}</small></span>
          </button>
        </div>
      </section>
    ` : ''}

    <!-- Stats grid -->
    <div class="stats-grid">
      ${statCard(t('total_balance'), formatCurrency(totalBalance, userCurrency), 'balance', null, '#1f6f68')}
      ${statCard(t('monthly_income'), formatCurrency(income, userCurrency), 'income', null, '#238b5a')}
      ${statCard(t('monthly_expenses'), formatCurrency(expenses, userCurrency), 'expense', null, 'var(--clr-error)')}
      ${statCard(t('net_savings'), formatCurrency(net, userCurrency), 'savings', null, net >= 0 ? '#238b5a' : '#d94f87')}
    </div>

    <!-- Charts row -->
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t('income_vs_expense')}</span>
          <span class="text-caption text-muted">${t('this_month')}</span>
        </div>
        <div style="position:relative;height:260px;">
          <canvas id="bar-chart" style="width:100%;height:100%;display:block;"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t('category_breakdown')}</span>
        </div>
        <div class="category-breakdown-layout" dir="${getLanguage().startsWith('ar') ? 'rtl' : 'ltr'}">
          <div class="category-chart-panel">
            <div class="category-chart-wrap">
              <canvas id="donut-chart" aria-label="${t('category_breakdown')}" role="img"></canvas>
            </div>
            <div class="category-total-label">${getLanguage().startsWith('ar') ? 'إجمالي الإنفاق' : 'Total spending'}</div>
            <div class="category-total-value">${categoryData.length ? formatCurrency(categoryData.reduce((s, c) => s + c.total, 0), userCurrency) : formatCurrency(0, userCurrency)}</div>
          </div>
          <div class="category-legend" aria-label="${t('category_breakdown')}" role="list">
            ${categoryData.slice(0, 5).map(cat => `
              <div class="category-legend-row" role="listitem">
                <div class="category-legend-main">
                  <span class="category-color-dot" style="background:${cat.color || 'var(--clr-primary)'};"></span>
                  <span class="category-legend-name">${getLanguage().startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name}</span>
                </div>
                <span class="category-legend-amount" dir="ltr">${formatCurrency(cat.total, userCurrency)}</span>
              </div>
            `).join('') || `<p class="category-empty text-caption text-muted">${t('no_data')}</p>`}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom row: Recent Transactions + Budget Status -->
    <div class="dashboard-grid" style="margin-top:var(--sp-xl);">
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t('recent_transactions')}</span>
          <button class="btn btn-ghost btn-sm" id="btn-view-all-tx">${t('view_all')}</button>
        </div>
        ${recentTx.length ? `
          <div class="table-wrapper">
            <table class="table">
              <thead><tr>
                <th>${t('description')}</th>
                <th>${t('category')}</th>
                <th>${t('date')}</th>
                <th style="text-align:right;">${t('amount')}</th>
              </tr></thead>
              <tbody>
                ${recentTx.map(tx => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:var(--sp-sm);">
                        <div class="cat-icon" style="background:${tx.category?.color ? tx.category.color + '22' : 'var(--clr-canvas-raised)'};">
                          <span style="font-size:14px;">${renderIcon(tx.category?.icon || 'package', 14)}</span>
                        </div>
                        <span class="font-medium truncate" style="max-width:160px;">${tx.description || '—'}</span>
                      </div>
                    </td>
                    <td><span class="text-caption text-muted">${getLanguage().startsWith('ar') && tx.category?.name_ar ? tx.category.name_ar : (tx.category?.name || '—')}</span></td>
                    <td><span class="text-caption text-muted">${formatRelativeDate(tx.date)}</span></td>
                    <td style="text-align:right;">
                      <span class="${tx.type === 'income' ? 'amount-income' : tx.type === 'expense' ? 'amount-expense' : 'amount-neutral'}">
                        ${tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${formatCurrency(tx.amount, tx.account?.currency || userCurrency)}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="padding:var(--sp-2xl) var(--sp-lg);">
            <div class="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-body-mid)" stroke-width="1.5" stroke-linecap="round"><path d="M3 3h18v18H3z" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <p class="empty-state-title">${t('no_transactions')}</p>
            <p class="empty-state-desc">${t('no_transactions_sub')}</p>
          </div>
        `}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">${t('top_budgets')}</span>
          <button class="btn btn-ghost btn-sm" id="btn-view-all-budgets">${t('view_all')}</button>
        </div>
        ${budgets.length ? budgets.slice(0, 4).map(b => {
          const pct = formatPercent(b.spent, b.amount);
          const status = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
          const remaining = Number(b.amount) - Number(b.spent);
          return `
            <div style="margin-bottom:var(--sp-lg);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-xs);">
                <div style="display:flex;align-items:center;gap:var(--sp-sm);">
                  <div class="cat-icon" style="width:28px;height:28px;background:${b.category?.color ? b.category.color + '22' : 'var(--clr-canvas-raised)'};">
                    <span style="font-size:12px;">${renderIcon(b.category?.icon || 'package', 12)}</span>
                  </div>
                  <span class="text-caption font-semibold">${b.name}</span>
                </div>
                <span class="text-caption text-muted">${pct}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${status}" style="width:${Math.min(pct, 100)}%;"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:var(--sp-xs);">
                <span class="text-fine text-muted">${formatCurrency(b.spent, userCurrency)} ${t('budget_of')} ${formatCurrency(b.amount, userCurrency)}</span>
                <span class="text-fine ${status === 'error' ? 'text-error' : 'text-muted'}">
                  ${remaining >= 0 ? t('budget_remaining', { amount: formatCurrency(remaining, userCurrency) }) : t('overspent', { amount: formatCurrency(Math.abs(remaining), userCurrency) })}
                </span>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state" style="padding:var(--sp-xl);">
            <p class="empty-state-title">${t('no_budgets')}</p>
            <p class="empty-state-desc">${t('no_budgets_sub')}</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Wire up navigation buttons
  document.getElementById('btn-add-tx')?.addEventListener('click', openQuickAddModal);
  document.getElementById('onboarding-add-account')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'accounts', returnTo: 'transactions', returnAction: 'add' } }));
  });
  document.getElementById('onboarding-add-transaction')?.addEventListener('click', openQuickAddModal);
  document.getElementById('onboarding-add-budget')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } }));
  });
  document.getElementById('btn-view-all-tx')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions' } }));
  });
  document.getElementById('btn-view-all-budgets')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets' } }));
  });

  // Draw charts after DOM is rendered
  requestAnimationFrame(() => redrawCharts());
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
        <div class="form-group"><label class="form-label">${t('account')}</label><select class="form-select" id="q-account">${quickAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">${t('category_optional')}</label><select class="form-select" id="q-category"><option value="">${t('no_category')}</option>${expenseCats.map(c => `<option value="${c.id}">${renderIcon(c.icon || 'package', 16)} ${ar && c.name_ar ? c.name_ar : c.name}</option>`).join('')}</select></div>
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
  drawDonutChart('donut-chart', categoryData.slice(0, 6).map(c => ({ color: c.color || '#0a0a0a', value: c.total })),
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
      <div class="stat-card-value" style="color:${color};">${value}</div>
    </div>`;
}
