/* ============================================================
   HISBA — REPORTS PAGE
   ============================================================ */
import { t, formatCurrency, formatDate, getDateRange, getLanguage, getMonthRange, getCurrentMonth, renderIcon } from '../utils.js?v=locale-preference-v1';
import { getTransactions, getAccounts, getDashboardSummary } from '../services/data.js';
import { exportCSV, exportExcel, exportPDF } from '../services/export.js';
import { drawBarChart, drawDonutChart } from '../components/charts.js';
import { getCategorySpending } from '../services/data.js';
import { toast } from '../toast.js';

let userId, userCurrency = 'USD';
let accounts = [];
let reportData = { transactions: [], summary: {}, categories: [], monthlyComparison: [] };
let filters = { period: 'this_month', account_id: '', template: 'minimal', compare_from: '', compare_to: '' };

export async function initReports(uid, profile) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  accounts = await getAccounts(userId).catch(() => []);
  await generateReport();
  renderPage();
}

async function generateReport() {
  const range = getDateRange(filters.period);
  const txFilters = { start_date: range.start, end_date: range.end };
  if (filters.account_id) txFilters.account_id = filters.account_id;

  const [transactions, categories] = await Promise.all([
    getTransactions(userId, txFilters).catch(() => []),
    getCategorySpending(userId, range.start, range.end).catch(() => []),
  ]);
  const income   = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const expenses = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);

  const monthlyComparison = await loadMonthlyComparison();
  reportData = {
    transactions,
    categories,
    monthlyComparison,
    summary: { income, expenses, net: income - expenses, currency: userCurrency },
    period: `${formatDate(range.start, 'medium')} — ${formatDate(range.end, 'medium')}`,
    range,
  };
}

async function loadMonthlyComparison() {
  const current = getCurrentMonth();
  const currentKey = `${current.year}-${String(current.month).padStart(2, '0')}`;
  const fromKey = filters.compare_from || (() => { const d = new Date(current.year, current.month - 6, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const toKey = filters.compare_to || currentKey;
  const [fy, fm] = fromKey.split('-').map(Number); const [ty, tm] = toKey.split('-').map(Number);
  const startIndex = fy * 12 + fm - 1; const endIndex = ty * 12 + tm - 1;
  const count = Math.max(1, Math.min(24, endIndex - startIndex + 1));
  const months = Array.from({ length: count }, (_, index) => { const date = new Date(fy, fm - 1 + index, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; });
  const rows = await Promise.all(months.map(async ({ year, month }) => {
    const range = getMonthRange(year, month);
    const txs = await getTransactions(userId, { start_date: range.start, end_date: range.end, type: 'expense', ...(filters.account_id ? { account_id: filters.account_id } : {}) }).catch(() => []);
    return { year, month, total: txs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0), count: txs.length, label: new Date(year, month - 1, 1).toLocaleDateString(getLanguage().startsWith('ar') ? 'ar-EG' : 'en-US', { month: 'short' }) };
  }));
  return rows;
}

function renderMonthlyComparison(rows) {
  const max = Math.max(...rows.map(row => row.total), 1);
  return `<div class="monthly-comparison" id="monthly-comparison-bars">${rows.map(row => `<button class="monthly-bar" type="button" data-total="${row.total}" data-count="${row.count}" data-label="${row.label}" style="--bar-height:${Math.max(6, Math.round((row.total / max) * 100))}%"><span class="monthly-bar-fill"></span><span class="monthly-bar-label">${row.label}</span></button>`).join('')}</div><div class="monthly-chart-detail text-caption" id="monthly-chart-detail">${t('chart_tap_month')}</div>`;
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const { summary, transactions, period } = reportData;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('reports_title')}</h1>
        <p class="page-subtitle">${t('reports_subtitle')}</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="card" style="margin-bottom:var(--sp-xl);">
      <div style="display:flex;gap:var(--sp-lg);flex-wrap:wrap;align-items:flex-end;">
        <div class="form-group" style="flex:1;min-width:160px;">
          <label class="form-label">${t('report_period')}</label>
          <select class="form-select" id="report-period">
            <option value="this_month"   ${filters.period === 'this_month'   ? 'selected' : ''}>${t('this_month')}</option>
            <option value="last_month"   ${filters.period === 'last_month'   ? 'selected' : ''}>${t('last_month')}</option>
            <option value="this_year"    ${filters.period === 'this_year'    ? 'selected' : ''}>${t('this_year')}</option>
            <option value="last_3_months" ${filters.period === 'last_3_months' ? 'selected' : ''}>${t('last_3_months')}</option>
          </select>
        </div>
        <div class="form-group" style="min-width:150px;">
          <label class="form-label">${getLanguage().startsWith('ar') ? 'من شهر' : 'From month'}</label>
          <input type="month" class="form-input" id="compare-from" value="${filters.compare_from}">
        </div>
        <div class="form-group" style="min-width:150px;">
          <label class="form-label">${getLanguage().startsWith('ar') ? 'إلى شهر' : 'To month'}</label>
          <input type="month" class="form-input" id="compare-to" value="${filters.compare_to}">
        </div>
        <div class="form-group" style="flex:1;min-width:160px;">
          <label class="form-label">${t('report_account')}</label>
          <select class="form-select" id="report-account">
            <option value="">${t('filter_all')}</option>
            ${accounts.map(a => `<option value="${a.id}" ${filters.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:160px;">
          <label class="form-label">Template</label>
          <select class="form-select" id="report-template">
            <option value="minimal"   ${filters.template === 'minimal'   ? 'selected' : ''}>${t('template_minimal')}</option>
            <option value="corporate" ${filters.template === 'corporate' ? 'selected' : ''}>${t('template_corporate')}</option>
            <option value="modern"    ${filters.template === 'modern'    ? 'selected' : ''}>${t('template_modern')}</option>
            <option value="dark"      ${filters.template === 'dark'      ? 'selected' : ''}>${t('template_dark')}</option>
          </select>
        </div>
        <button class="btn btn-secondary" id="btn-generate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${t('generate_report')}
        </button>
      </div>
    </div>

    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-lg);margin-bottom:var(--sp-xl);">
      <div class="card">
        <div class="stat-card-label">${t('report_total_income')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-success);">${formatCurrency(summary.income || 0, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('report_total_expenses')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-error);">${formatCurrency(summary.expenses || 0, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('report_net')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${(summary.net||0) >= 0 ? 'var(--clr-success)' : 'var(--clr-error)'};">
          ${formatCurrency(summary.net || 0, userCurrency)}
        </div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('report_transactions_count')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;">${transactions.length}</div>
      </div>
    </div>

    <!-- Monthly comparison -->
    <div class="card" style="margin-bottom:var(--sp-xl);">
      <div class="card-header"><span class="card-title">${t('monthly_comparison')}</span><span class="text-caption text-muted">${t('last_6_months')}</span></div>
      ${renderMonthlyComparison(reportData.monthlyComparison)}
    </div>

    <!-- Chart + Category -->
    <div class="dashboard-grid" style="margin-bottom:var(--sp-xl);">
      <div class="card">
        <div class="card-header"><span class="card-title">${t('income_vs_expense')}</span></div>
        <div style="position:relative;height:220px;">
          <canvas id="report-bar-chart" style="width:100%;height:100%;display:block;"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">${t('category_breakdown')}</span></div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-sm);">
          ${reportData.categories.slice(0, 6).map(cat => {
            const pct = Math.round((cat.total / (summary.expenses || 1)) * 100);
            return `
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                  <span style="display:flex;align-items:center;gap:var(--sp-sm);font-size:var(--text-xs);">
                    <span class="category-icon-render">${renderIcon(cat.icon || 'package', 18)}</span>
                    <span>${getLanguage().startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name}</span>
                  </span>
                  <span class="text-caption font-semibold">${formatCurrency(cat.total, userCurrency)}</span>
                </div>
                <div class="progress-bar" style="height:6px;">
                  <div class="progress-fill" style="width:${pct}%;background:${cat.color || 'var(--clr-primary)'};"></div>
                </div>
              </div>`;
          }).join('') || `<p class="text-caption text-muted">${t('no_data')}</p>`}
        </div>
      </div>
    </div>

    <!-- Export Buttons -->
    <div class="card" style="margin-bottom:var(--sp-xl);">
      <div class="card-header">
        <span class="card-title">${t('generate_report')}</span>
        <span class="text-caption text-muted">${period || ''}</span>
      </div>
      <div style="display:flex;gap:var(--sp-md);flex-wrap:wrap;">
        <button class="btn btn-outline" id="btn-pdf">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          ${t('export_pdf')}
        </button>
        <button class="btn btn-outline" id="btn-csv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          ${t('export_csv')}
        </button>
        <button class="btn btn-outline" id="btn-excel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
          ${t('export_excel')}
        </button>
      </div>
    </div>

    <!-- Transactions table -->
    ${transactions.length ? `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:var(--sp-lg) var(--sp-xl);border-bottom:1px solid var(--clr-border);">
          <span class="card-title">${t('report_transactions')}</span>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>${t('date')}</th>
              <th>${t('description')}</th>
              <th>${t('category')}</th>
              <th>${t('account')}</th>
              <th>${t('type')}</th>
              <th style="text-align:right;">${t('amount')}</th>
            </tr></thead>
            <tbody>
              ${transactions.map(tx => `
                <tr>
                  <td><span class="text-caption text-muted">${formatDate(tx.date)}</span></td>
                  <td><span class="font-medium">${tx.description || '—'}</span></td>
                  <td><span class="text-caption">${getLanguage().startsWith('ar') && tx.category?.name_ar ? tx.category.name_ar : (tx.category?.name || '—')}</span></td>
                  <td><span class="text-caption">${tx.account?.name || '—'}</span></td>
                  <td>
                    <span class="badge ${tx.type === 'income' ? 'badge-success' : tx.type === 'expense' ? 'badge-error' : 'badge-neutral'}">
                      ${t(tx.type)}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <span class="font-semibold ${tx.type === 'income' ? 'amount-income' : tx.type === 'expense' ? 'amount-expense' : 'amount-neutral'}">
                      ${tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${formatCurrency(tx.amount, tx.account?.currency || userCurrency)}
                    </span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-body-mid)" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p class="empty-state-title">${t('no_report_data')}</p>
        </div>
      </div>
    `}
  `;

  // Wire events
  document.getElementById('btn-generate')?.addEventListener('click', async () => {
    filters.period     = document.getElementById('report-period').value;
    filters.account_id = document.getElementById('report-account').value;
    filters.template   = document.getElementById('report-template').value;
    filters.compare_from = document.getElementById('compare-from')?.value || '';
    filters.compare_to = document.getElementById('compare-to')?.value || '';
    await generateReport();
    renderPage();
    toast.info(t('info'), t('generate_report'));
  });

  document.querySelectorAll('.monthly-bar').forEach(bar => bar.addEventListener('click', () => {
    const detail = document.getElementById('monthly-chart-detail');
    if (detail) detail.textContent = `${bar.dataset.label}: ${formatCurrency(Number(bar.dataset.total), userCurrency)} · ${bar.dataset.count} ${t('report_transactions_count')}`;
    document.querySelectorAll('.monthly-bar').forEach(item => item.classList.remove('is-selected'));
    bar.classList.add('is-selected');
  }));

  document.getElementById('btn-pdf')?.addEventListener('click', () => {
    if (!transactions.length) { toast.warning(t('warning'), t('no_report_data')); return; }
    exportPDF({ ...reportData }, filters.template);
  });

  document.getElementById('btn-csv')?.addEventListener('click', () => {
    if (!transactions.length) { toast.warning(t('warning'), t('no_report_data')); return; }
    exportCSV(transactions, `Hisba-${filters.period}`);
    toast.success(t('success'), t('export_csv'));
  });

  document.getElementById('btn-excel')?.addEventListener('click', () => {
    if (!transactions.length) { toast.warning(t('warning'), t('no_report_data')); return; }
    exportExcel(transactions, summary, `Hisba-${filters.period}`, reportData.categories);
    toast.success(t('success'), t('export_excel'));
  });

  // Draw chart
  requestAnimationFrame(() => {
    drawBarChart('report-bar-chart', [
      { month: t('filter_income'), income: summary.income || 0, expenses: 0 },
      { month: t('filter_expense'), income: 0, expenses: summary.expenses || 0 },
    ]);
  });
}
