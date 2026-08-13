/* ============================================================
   HISBA — BUDGETS PAGE
   ============================================================ */
import { t, formatCurrency, formatPercent, validateRequired, validateAmount, getMonthRange, getCurrentMonth, getDateRange, getLanguage, renderIcon } from '../utils.js?v=locale-preference-v1';
import { getBudgets, createBudget, updateBudget, deleteBudget, getCategories, getBudgetSpending } from '../services/data.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js';
import { toast } from '../toast.js';

let userId, userCurrency = 'USD';
let budgets = [], categories = [], spending = {};
let editingBudget = null;

export async function initBudgets(uid, profile) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  await loadData();
  renderPage();
}

async function loadData() {
  const { year, month } = getCurrentMonth();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const weekRange = getDateRange('this_week');
  const weekKey = weekRange.start.slice(0, 10);
  const { start, end } = getMonthRange(year, month);
  const [allBudgets, loadedCategories] = await Promise.all([
    getBudgets(userId).catch(() => []),
    getCategories(userId).catch(() => []),
  ]);
  categories = loadedCategories;
  budgets = allBudgets.filter(b => b.period === 'weekly' ? (!b.week_key || b.week_key === weekKey) : (!b.month_key || b.month_key === monthKey));
  const hasWeekly = budgets.some(b => b.period === 'weekly');
  const spendRange = hasWeekly ? weekRange : { start, end };
  spending = await getBudgetSpending(userId, budgets, spendRange.start, spendRange.end).catch(() => ({}));
  budgets = budgets.map(b => ({ ...b, spent: spending[String(b.category_id || '__total__')] || 0 }));
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const overBudgetCount = budgets.filter(b => Number(b.spent) > Number(b.amount)).length;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('budgets_title')}</h1>
        <p class="page-subtitle">${t('budgets_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-budget">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_budget')}
        </button>
      </div>
    </div>

    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-lg);margin-bottom:var(--sp-xl);">
      <div class="card">
        <div class="stat-card-label">${t('budget_amount')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;">${formatCurrency(totalBudgeted, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('budget_spent')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-error);">${formatCurrency(totalSpent, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('overspent_label')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${overBudgetCount > 0 ? 'var(--clr-error)' : 'var(--clr-success)'};">
          ${overBudgetCount} ${t('budgets_title').toLowerCase()}
        </div>
      </div>
    </div>

    ${budgets.length ? `
      <div style="display:flex;flex-direction:column;gap:var(--sp-lg);" id="budgets-list">
        ${budgets.map(budgetCard).join('')}
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-body-mid)" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <p class="empty-state-title">${t('no_budgets')}</p>
          <p class="empty-state-desc">${t('no_budgets_sub')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_budget')}</button>
        </div>
      </div>
    `}
  `;

  notifyBudgetAlerts();
  document.getElementById('btn-add-budget')?.addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);
  document.getElementById('budgets-list')?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    if (editBtn) openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
  });
}

function budgetCard(b) {
  const pct = formatPercent(b.spent, b.amount);
  const remaining = Number(b.amount) - Number(b.spent);
  const isOver = pct >= 100;
  const isAtRisk = pct >= 80 && !isOver;
  const statusLabel = isOver ? t('overspent_label') : isAtRisk ? t('at_risk') : t('on_track');
  const statusClass = isOver ? 'badge-error' : isAtRisk ? 'badge-warning' : 'badge-success';
  const fillClass = isOver ? 'error' : isAtRisk ? 'warning' : 'success';
  const lang = getLanguage();

  return `
    <div class="card card-hover" style="padding:var(--sp-xl);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-lg);">
        <div style="display:flex;align-items:center;gap:var(--sp-md);">
          <div class="cat-icon" style="background:${b.category?.color ? b.category.color + '22' : 'var(--clr-canvas-raised)'};">
            <span style="font-size:18px;">${renderIcon(b.category?.icon || 'package', 18)}</span>
          </div>
          <div>
            <div class="font-semibold" style="font-size:var(--text-md);">${b.name}</div>
            <div class="text-caption text-muted">${lang.startsWith('ar') && b.category?.name_ar ? b.category.name_ar : (b.category?.name || '—')} · ${t('period_' + b.period)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-md);">
          <span class="badge ${statusClass} badge-dot">${statusLabel}</span>
          <button class="btn btn-outline btn-sm budget-action-edit" data-edit="${b.id}" type="button" title="${getLanguage().startsWith('ar') ? 'تعديل الميزانية' : 'Edit budget'}" aria-label="${getLanguage().startsWith('ar') ? 'تعديل الميزانية' : 'Edit budget'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>${getLanguage().startsWith('ar') ? 'تعديل' : 'Edit'}</span>
          </button>
          <button class="btn btn-outline btn-sm budget-action-delete" data-delete="${b.id}" type="button" title="${getLanguage().startsWith('ar') ? 'حذف الميزانية' : 'Delete budget'}" aria-label="${getLanguage().startsWith('ar') ? 'حذف الميزانية' : 'Delete budget'}" style="color:var(--clr-error);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-sm);">
        <span class="text-caption"><strong>${formatCurrency(b.spent, userCurrency)}</strong> ${t('budget_of')} ${formatCurrency(b.amount, userCurrency)}</span>
        <span class="text-caption font-semibold">${pct}%</span>
      </div>
      <div class="progress-bar" style="height:10px;">
        <div class="progress-fill ${fillClass}" style="width:${Math.min(pct, 100)}%;"></div>
      </div>
      <div style="margin-top:var(--sp-sm);">
        <span class="text-caption ${isOver ? 'text-error' : 'text-muted'}">
          ${remaining >= 0 ? t('budget_remaining', { amount: formatCurrency(remaining, userCurrency) }) : t('overspent', { amount: formatCurrency(Math.abs(remaining), userCurrency) })}
        </span>
      </div>
    </div>`;
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
      <div class="form-group">
        <label class="form-label">${t('budget_name')}</label>
        <input type="text" class="form-input" id="b-name" placeholder="${t('budget_name')}" value="${b?.name || ''}">
        <div class="form-error hidden" id="b-name-err"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('budget_amount')}</label>
          <input type="number" class="form-input" id="b-amount" placeholder="0.00" min="0" step="0.01" value="${b?.amount || ''}">
          <div class="form-error hidden" id="b-amount-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('budget_period')}</label>
          <select class="form-select" id="b-period">
            <option value="weekly" ${b?.period === 'weekly' ? 'selected' : ''}>${getLanguage().startsWith('ar') ? 'أسبوعية' : 'Weekly'}</option>
            <option value="monthly" ${b?.period !== 'weekly' ? 'selected' : ''}>${t('period_monthly')}</option>
          </select>
        </div>
      </div>
      <div class="form-group" id="b-month-wrap" style="${b?.period === 'weekly' ? 'display:none;' : ''}">
        <label class="form-label">${getLanguage().startsWith('ar') ? 'شهر الميزانية' : 'Budget month'}</label>
        <input type="month" class="form-input" id="b-month" value="${b?.month_key || (() => { const c = getCurrentMonth(); return `${c.year}-${String(c.month).padStart(2, '0')}`; })()}">
      </div>
      <div class="form-group" id="b-week-wrap" style="${b?.period === 'weekly' ? '' : 'display:none;'}">
        <label class="form-label">${getLanguage().startsWith('ar') ? 'بداية الأسبوع' : 'Week starting'}</label>
        <input type="date" class="form-input" id="b-week" value="${b?.week_key || getDateRange('this_week').start.slice(0, 10)}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('budget_category')} <span class="text-caption text-muted">(${getLanguage().startsWith('ar') ? 'اختياري — ميزانية لكل المصروفات عند تركه فارغًا' : 'optional — leave empty for all expenses'})</span></label>
        <select class="form-select" id="b-category">
          <option value="">${t('select')}</option>
          ${categories.filter(c => c.type === 'expense' || !c.type).map(cat => `
            <option value="${cat.id}" ${b?.category_id === cat.id ? 'selected' : ''}>
              ${cat.icon || ''} ${lang.startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name}
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

    let valid = true;
    if (!validateRequired(name))   { showErr('b-name-err', t('required')); valid = false; } else hideErr('b-name-err');
    if (!validateAmount(amount))   { showErr('b-amount-err', t('invalid_amount')); valid = false; } else hideErr('b-amount-err');
    if (!valid) return;

    const btn = document.getElementById('b-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, amount: parseFloat(amount), period, month_key, week_key, category_id };
      if (isEdit) { await updateBudget(b.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createBudget(userId, payload); toast.success(t('success'), t('added')); }
      closeModal('budget-modal');
      await loadData();
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

  budgets.forEach(budget => {
    const amount = Number(budget.amount || 0);
    const pct = amount > 0 ? (Number(budget.spent || 0) / amount) * 100 : 0;
    const threshold = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (!threshold) return;
    const key = `${budget.id}:${threshold}`;
    if (notified[key]) return;
    const label = budget.name || t('budget_name');
    if (threshold === 100) {
      toast.budget('over', t('budget_alert_title'), t('budget_alert_over', { name: label }), pct, label);
    } else {
      toast.budget('warning', t('budget_alert_title'), t('budget_alert_risk', { name: label, percent: Math.round(pct) }), pct, label);
    }
    notified[key] = { notifiedAt: new Date().toISOString(), percent: Math.round(pct) };
  });
  try { localStorage.setItem(storageKey, JSON.stringify(notified)); } catch {}
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
