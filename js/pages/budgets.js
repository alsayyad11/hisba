/* ============================================================
   HISBA — BUDGETS PAGE
   ============================================================ */
import { t, formatCurrency, formatPercent, validateRequired, validateAmount, getMonthRange, getCurrentMonth, getDateRange, getLanguage, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=release-2.3.0';
import { getBudgets, createBudget, updateBudget, deleteBudget, getCategories, getBudgetSpending, getTransactions, getMonthClosures, saveMonthClosure } from '../services/data.js';
import { getDailyBudgetIndicator, getBudgetAlerts, buildMonthClosure, currentMonthKey, hasClosure } from '../services/budget-insights.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js?v=release-2.3.0';
import { toast } from '../toast.js?v=release-2.3.0';

let userId, userCurrency = 'USD';
let budgets = [], categories = [], spending = {}, transactions = [], closures = [];
let editingBudget = null;
let onboardingActive = false;

export async function initBudgets(uid, profile, opts = {}) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  onboardingActive = opts.action === 'onboarding-budget';
  await loadData();
  renderPage();
  if (onboardingActive && !budgets.length) setTimeout(openAddModal, 100);
}

async function loadData() {
  const { year, month } = getCurrentMonth();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const weekRange = getDateRange('this_week');
  const weekKey = weekRange.start.slice(0, 10);
  const { start, end } = getMonthRange(year, month);
  const [allBudgets, loadedCategories, loadedTransactions, loadedClosures] = await Promise.all([
    getBudgets(userId).catch(() => []),
    getCategories(userId).catch(() => []),
    getTransactions(userId).catch(() => []),
    getMonthClosures(userId).catch(() => []),
  ]);
  categories = loadedCategories;
  transactions = loadedTransactions;
  closures = loadedClosures;
  budgets = allBudgets.filter(b => b.period === 'weekly' ? (!b.week_key || b.week_key === weekKey) : (!b.month_key || b.month_key === monthKey));
  const hasWeekly = budgets.some(b => b.period === 'weekly');
  const spendRange = hasWeekly ? weekRange : { start, end };
  spending = await getBudgetSpending(userId, budgets, spendRange.start, spendRange.end).catch(() => ({}));
  budgets = budgets.map(b => ({ ...b, spent: spending[String(b.category_id || '__total__')] || 0 }));
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const totalBudgeted = budgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = budgets.filter(budget => Number(budget.spent || 0) > Number(budget.amount || 0)).length;
  const totalUsed = formatPercent(totalSpent, totalBudgeted);
  const indicator = getDailyBudgetIndicator({ budgets, transactions });
  const activeMonthKey = currentMonthKey();
  const isClosed = hasClosure(closures, activeMonthKey);
  const healthClass = totalRemaining < 0 ? 'is-over' : totalUsed >= 80 ? 'is-near' : 'is-safe';

  el.innerHTML = `
    <header class="page-header finance-page-header budget-page-header">
      <div><p class="finance-eyebrow">${t('budget_daily_allowance')}</p><h1 class="page-title">${t('budgets_title')}</h1><p class="page-subtitle">${t('budgets_subtitle')}</p></div>
      <div class="page-actions budget-page-actions">
        <button class="btn btn-outline" id="btn-close-month" ${isClosed ? 'disabled' : ''} title="${t('close_month_subtitle')}">${renderIcon('calendar', 16)}<span>${isClosed ? t('month_closed') : t('close_month')}</span></button>
        <button class="btn btn-primary" id="btn-add-budget">${renderIcon('plus', 17)}<span>${t('add_budget')}</span></button>
      </div>
    </header>

    <section class="budget-health-panel ${healthClass}" aria-label="${t('budgets_title')}">
      <div class="budget-health-primary"><span>${t('budget_daily_allowance')}</span><strong class="sensitive-value" dir="ltr">${indicator.hasBudget ? formatCurrency(indicator.dailyAllowance, userCurrency) : '—'}</strong><p>${indicator.hasBudget ? t('budget_days_remaining', { days: indicator.daysRemaining }) : t('budget_no_monthly_plan')}</p></div>
      <div class="budget-health-stat"><span>${t('budget_amount')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(totalBudgeted, userCurrency)}</strong></div>
      <div class="budget-health-stat is-spent"><span>${t('budget_spent')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(totalSpent, userCurrency)}</strong></div>
      <div class="budget-health-stat ${totalRemaining < 0 ? 'is-over' : ''}"><span>${t('budget_remaining_label')}</span><strong class="sensitive-value" dir="ltr">${totalRemaining < 0 ? '−' : ''}${formatCurrency(Math.abs(totalRemaining), userCurrency)}</strong></div>
      <div class="budget-health-progress"><div><span>${totalUsed}% ${t('dashboard_budget_used')}</span><b class="${healthClass}">${overBudgetCount ? `${overBudgetCount} ${t('overspent_label')}` : t('on_track')}</b></div><div class="finance-progress-track"><span class="${healthClass}" style="width:${Math.min(totalUsed, 100)}%"></span></div></div>
    </section>

    <section class="budget-ledger-section">
      <div class="finance-panel-heading"><div><p class="finance-section-kicker">${t('budget_amount')}</p><h2>${t('budgets_title')}</h2><p>${t('budget_daily_amount', { amount: indicator.hasBudget ? formatCurrency(indicator.dailyAllowance, userCurrency) : '—' })}</p></div><span class="budget-ledger-count">${budgets.length}</span></div>
      ${budgets.length ? `<div class="budget-ledger-list" id="budgets-list">${budgets.map(budgetCard).join('')}</div>` : `<div class="finance-empty-state budget-empty-state"><span aria-hidden="true">${renderIcon('wallet', 23)}</span><p>${t('no_budgets_sub')}</p><button class="btn btn-primary" id="btn-empty-add" type="button">${renderIcon('plus', 16)}<span>${t('add_budget')}</span></button></div>`}
    </section>
  `;

  notifyBudgetAlerts();
  document.getElementById('btn-add-budget')?.addEventListener('click', openAddModal);
  document.getElementById('btn-close-month')?.addEventListener('click', confirmCloseMonth);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);
  document.getElementById('budgets-list')?.addEventListener('click', event => {
    const editBtn = event.target.closest('[data-edit]');
    const deleteBtn = event.target.closest('[data-delete]');
    if (editBtn) openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
  });
}

function onboardingProgress(current) {
  return `
    <div class="onboarding-form-progress">
      <span>${t('onboarding_progress', { current, total: 3 })}</span>
      <span class="onboarding-progress-dots" aria-hidden="true">${[1, 2, 3].map(step => `<i class="${step <= current ? 'is-active' : ''}"></i>`).join('')}</span>
    </div>`;
}

function budgetCard(b) {
  const pct = formatPercent(b.spent, b.amount);
  const remaining = Number(b.amount || 0) - Number(b.spent || 0);
  const isOver = pct >= 100;
  const isAtRisk = pct >= 80 && !isOver;
  const statusLabel = isOver ? t('overspent_label') : isAtRisk ? t('at_risk') : t('on_track');
  const statusClass = isOver ? 'is-over' : isAtRisk ? 'is-near' : 'is-safe';
  const lang = getLanguage();
  const categoryName = lang.startsWith('ar') && b.category?.name_ar ? b.category.name_ar : (b.category?.name || '—');
  const categoryColor = sanitizeColor(b.category?.color, '#176b73');

  return `<article class="budget-ledger-card ${statusClass}">
    <div class="budget-ledger-main"><span class="budget-category-icon" style="--budget-category-color:${categoryColor}">${renderIcon(b.category?.icon || 'package', 18)}</span><div><h3>${escapeHTML(b.name)}</h3><p>${escapeHTML(categoryName)}<i aria-hidden="true">·</i>${t('period_' + (b.period === 'weekly' ? 'weekly' : 'monthly'))}</p></div></div>
    <div class="budget-ledger-values"><div><span>${t('budget_spent')}</span><strong class="sensitive-value is-expense" dir="ltr">${formatCurrency(b.spent, userCurrency)}</strong></div><div><span>${t('budget_amount')}</span><strong class="sensitive-value" dir="ltr">${formatCurrency(b.amount, userCurrency)}</strong></div><div><span>${t('budget_remaining_label')}</span><strong class="sensitive-value ${remaining < 0 ? 'is-expense' : ''}" dir="ltr">${remaining < 0 ? '−' : ''}${formatCurrency(Math.abs(remaining), userCurrency)}</strong></div></div>
    <div class="budget-ledger-progress"><div><span>${pct}%</span><b class="${statusClass}">${statusLabel}</b></div><div class="finance-progress-track"><span class="${statusClass}" style="width:${Math.min(pct, 100)}%"></span></div></div>
    <div class="budget-ledger-actions"><button class="btn btn-quiet btn-sm budget-action-edit" data-edit="${escapeHTML(b.id)}" type="button" title="${t('edit_budget')}" aria-label="${t('edit_budget')}">${renderIcon('edit', 15)}<span>${t('edit')}</span></button><button class="icon-btn-danger budget-action-delete" data-delete="${escapeHTML(b.id)}" type="button" title="${t('delete_budget')}" aria-label="${t('delete_budget')}">${renderIcon('trash', 16)}</button></div>
  </article>`;
}

function openAddModal() { editingBudget = null; buildModal(null); openModal('budget-modal'); }
function openEditModal(id) {
  editingBudget = budgets.find(b => b.id === id);
  if (!editingBudget) return;
  buildModal(editingBudget);
  openModal('budget-modal');
}

function buildModal(b) {
  const isEdit = !!b;
  const lang = getLanguage();
  createModal({
    id: 'budget-modal',
    title: isEdit ? t('edit_budget') : t('add_budget'),
    content: `
      ${!isEdit && onboardingActive ? onboardingProgress(3) : ''}
      <div class="form-group">
        <label class="form-label">${t('budget_name')}</label>
        <input type="text" class="form-input" id="b-name" placeholder="${t('budget_name')}" maxlength="100" value="${escapeHTML(b?.name || '')}">
        <div class="form-error hidden" id="b-name-err"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('budget_amount')}</label>
          <input type="number" class="form-input" id="b-amount" placeholder="0.00" min="0.01" step="0.01" value="${Number.isFinite(Number(b?.amount)) ? Number(b.amount) : ''}">
          <div class="form-error hidden" id="b-amount-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('budget_period')}</label>
          <select class="form-select" id="b-period">
            <option value="weekly" ${b?.period === 'weekly' ? 'selected' : ''}>${t('period_weekly')}</option>
            <option value="monthly" ${b?.period !== 'weekly' ? 'selected' : ''}>${t('period_monthly')}</option>
          </select>
        </div>
      </div>
      <div class="form-group" id="b-month-wrap" style="${b?.period === 'weekly' ? 'display:none;' : ''}">
        <label class="form-label">${t('budget_month')}</label>
        <input type="month" class="form-input" id="b-month" value="${b?.month_key || (() => { const c = getCurrentMonth(); return `${c.year}-${String(c.month).padStart(2, '0')}`; })()}">
      </div>
      <div class="form-group" id="b-week-wrap" style="${b?.period === 'weekly' ? '' : 'display:none;'}">
        <label class="form-label">${t('week_starting')}</label>
        <input type="date" class="form-input" id="b-week" value="${b?.week_key || getDateRange('this_week').start.slice(0, 10)}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('budget_category')} <span class="text-caption text-muted">(${t('budget_category_optional')})</span></label>
        <select class="form-select" id="b-category">
          <option value="">${t('select')}</option>
          ${categories.filter(c => c.type === 'expense' || !c.type).map(cat => `
            <option value="${escapeHTML(cat.id)}" ${b?.category_id === cat.id ? 'selected' : ''}>
              ${renderIcon(cat.icon || 'package', 16)} ${escapeHTML(lang.startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name)}
            </option>`).join('')}
        </select>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="b-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="b-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  document.getElementById('b-period')?.addEventListener('change', (e) => {
    const weekly = e.target.value === 'weekly';
    document.getElementById('b-month-wrap').style.display = weekly ? 'none' : '';
    document.getElementById('b-week-wrap').style.display = weekly ? '' : 'none';
  });
  document.getElementById('b-cancel')?.addEventListener('click', () => closeModal('budget-modal'));
  document.getElementById('b-save')?.addEventListener('click', async () => {
    const name     = document.getElementById('b-name').value.trim();
    const amount   = document.getElementById('b-amount').value;
    const period   = document.getElementById('b-period').value;
    const month_key = period === 'monthly' ? document.getElementById('b-month').value : null;
    const week_key = period === 'weekly' ? document.getElementById('b-week').value : null;
    const category_id = document.getElementById('b-category').value || null;
    const shouldCompleteOnboarding = onboardingActive && !isEdit && budgets.length === 0;

    let valid = true;
    if (!validateRequired(name) || name.length > 100) { showErr('b-name-err', t('required')); valid = false; } else hideErr('b-name-err');
    if (!validateAmount(amount)) { showErr('b-amount-err', t('invalid_amount')); valid = false; } else hideErr('b-amount-err');
    const validPeriod = ['weekly', 'monthly'].includes(period);
    const validDate = period === 'weekly' ? /^\d{4}-\d{2}-\d{2}$/.test(week_key || '') : /^\d{4}-\d{2}$/.test(month_key || '');
    const validCategory = !category_id || categories.some(category => category.id === category_id && (category.type === 'expense' || !category.type));
    if (!validPeriod || !validDate || !validCategory) { toast.error(t('error'), t('error')); return; }
    if (!valid) return;

    const btn = document.getElementById('b-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, amount: parseFloat(amount), period, month_key, week_key, category_id };
      if (isEdit) { await updateBudget(b.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createBudget(userId, payload); toast.success(shouldCompleteOnboarding ? t('onboarding_complete') : t('success'), shouldCompleteOnboarding ? t('onboarding_complete_sub') : t('added')); }
      closeModal('budget-modal');
      await loadData();
      onboardingActive = false;
      renderPage();
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
    }
  });
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete_budget'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteBudget(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        await loadData();
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function notifyBudgetAlerts() {
  const periodKey = budgets.map(b => `${b.id}:${b.period}:${b.month_key || b.week_key || ''}`).sort().join('|') || 'empty';
  const storageKey = `hisba_budget_alerts:${userId}:${periodKey}`;
  let notified = {};
  try { notified = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { notified = {}; }

  getBudgetAlerts(budgets).forEach(alert => {
    const key = `${alert.budgetId}:${alert.threshold}`;
    if (notified[key]) return;
    const label = escapeHTML(alert.name || t('budget_name'));
    const message = alert.threshold >= 100
      ? t('overspent_label')
      : alert.threshold >= 90
        ? t('budget_alert_90', { name: label })
        : t('budget_alert_70', { name: label });
    toast.budget(alert.severity === 'over' ? 'over' : 'warning', t('budget_alert_title'), message, alert.percent, label);
    notified[key] = { notifiedAt: new Date().toISOString(), percent: Math.round(alert.percent) };
  });
  try { localStorage.setItem(storageKey, JSON.stringify(notified)); } catch {}
}

function confirmCloseMonth() {
  const monthKey = currentMonthKey();
  if (hasClosure(closures, monthKey)) { toast.success(t('month_closed'), t('month_already_closed')); return; }
  showConfirm({
    title: t('close_month'),
    message: t('close_month_confirm', { month: monthKey }),
    confirmText: t('close_month'),
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      try {
        const closure = buildMonthClosure({ monthKey, budgets, transactions });
        await saveMonthClosure(userId, closure);
        toast.success(t('month_closed'), t('carried_forward', { amount: formatCurrency(closure.carry_forward, userCurrency) }));
        await loadData();
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
