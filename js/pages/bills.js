/* ============================================================
   HISBA — BILLS PAGE
   ============================================================ */
import { t, formatCurrency, validateRequired, validateAmount, getLanguage, escapeHTML } from '../utils.js?v=release-2.3.0';
import { getBills, createBill, updateBill, deleteBill, getCategories } from '../services/data.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js?v=release-2.3.0';
import { toast } from '../toast.js?v=release-2.3.0';

let userId, userCurrency = 'USD';
let bills = [], categories = [];
let editingBill = null;

export async function initBills(uid, profile) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  [bills, categories] = await Promise.all([
    getBills(userId).catch(() => []),
    getCategories(userId).catch(() => []),
  ]);
  renderPage();
}

function getBillStatus(dueDay) {
  const today = new Date().getDate();
  const diff = dueDay - today;
  if (diff < 0)  return { label: t('overdue'),   cls: 'badge-error',   days: Math.abs(diff) };
  if (diff <= 5) return { label: t('due_soon'),   cls: 'badge-warning', days: diff };
  return           { label: t('upcoming'),         cls: 'badge-neutral', days: diff };
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const totalMonthly = bills.reduce((s, b) => s + Number(b.amount), 0);
  const overdue = bills.filter(b => getBillStatus(b.due_day).label === t('overdue')).length;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('bills_title')}</h1>
        <p class="page-subtitle">${t('bills_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-bill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_bill')}
        </button>
      </div>
    </div>

    <div class="bills-summary">
      <div class="card">
        <div class="stat-card-label">${t('monthly_total')}</div>
        <div class="sensitive-value bill-summary-value" style="font-size:var(--text-xl);font-weight:700;">${formatCurrency(totalMonthly, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('total_bills')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;">${bills.length}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('overdue')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${overdue > 0 ? 'var(--clr-error)' : 'var(--clr-success)'};">${overdue}</div>
      </div>
    </div>

    ${bills.length ? `
      <div class="card bills-ledger">
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>${t('bill_name')}</th>
              <th>${t('category')}</th>
              <th>${t('bill_due_day')}</th>
              <th>${t('status')}</th>
              <th style="text-align:right;">${t('amount')}</th>
              <th style="width:100px;"></th>
            </tr></thead>
            <tbody id="bills-tbody">
              ${bills.map(billRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-body-mid)" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <p class="empty-state-title">${t('no_bills')}</p>
          <p class="empty-state-desc">${t('no_bills_sub')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_bill')}</button>
        </div>
      </div>
    `}
  `;

  document.getElementById('btn-add-bill')?.addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);
  document.getElementById('bills-tbody')?.addEventListener('click', async e => {
    const editBtn   = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const paidBtn   = e.target.closest('[data-paid]');
    if (editBtn)   openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
    if (paidBtn)   await handleMarkPaid(paidBtn.dataset.paid);
  });
}

function billRow(b) {
  const status = getBillStatus(b.due_day);
  const lang = getLanguage();
  const catName = lang.startsWith('ar') && b.category?.name_ar ? b.category.name_ar : (b.category?.name || '—');
  return `
    <tr class="bill-row">
      <td><span class="font-medium">${escapeHTML(b.name)}</span></td>
      <td><span class="text-caption text-muted">${escapeHTML(catName)}</span></td>
      <td><span class="text-caption">${t('day_number', { day: b.due_day })}</span></td>
      <td><span class="badge ${status.cls} badge-dot">${status.label}</span></td>
      <td style="text-align:right;">
        <span class="font-semibold sensitive-value bill-amount">${formatCurrency(b.amount, userCurrency)}</span>
      </td>
      <td>
        <div class="bill-row-actions">
          ${!b.is_paid ? `
            <button class="btn btn-ghost btn-sm bill-mark-paid" data-paid="${escapeHTML(b.id)}">
              ${t('mark_paid')}
            </button>` : ''}
          <button class="btn btn-ghost btn-icon-sm" data-edit="${escapeHTML(b.id)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm bill-delete" data-delete="${escapeHTML(b.id)}" aria-label="${t('delete')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function openAddModal() { editingBill = null; buildModal(null); openModal('bill-modal'); }
function openEditModal(id) {
  editingBill = bills.find(b => b.id === id);
  if (!editingBill) return;
  buildModal(editingBill);
  openModal('bill-modal');
}

function buildModal(b) {
  const isEdit = !!b;
  const lang = getLanguage();
  createModal({
    id: 'bill-modal',
    title: isEdit ? t('edit') : t('add_bill'),
    content: `
      <div class="form-group">
        <label class="form-label">${t('bill_name')}</label>
        <input type="text" class="form-input" id="bill-name" placeholder="${t('bill_name')}" maxlength="100" value="${escapeHTML(b?.name || '')}">
        <div class="form-error hidden" id="bill-name-err"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('bill_amount')}</label>
          <input type="number" class="form-input" id="bill-amount" placeholder="0.00" min="0.01" step="0.01" value="${Number.isFinite(Number(b?.amount)) ? Number(b.amount) : ''}">
          <div class="form-error hidden" id="bill-amount-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('bill_due_day')}</label>
          <input type="number" class="form-input" id="bill-day" placeholder="1-31" min="1" max="31" step="1" value="${Number.isInteger(Number(b?.due_day)) ? Number(b.due_day) : ''}">
          <div class="form-error hidden" id="bill-day-err"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('category')}</label>
        <select class="form-select" id="bill-category">
          <option value="">${t('select')}</option>
          ${categories.filter(c => c.type === 'expense' || !c.type).map(cat => `
            <option value="${escapeHTML(cat.id)}" ${b?.category_id === cat.id ? 'selected' : ''}>
              ${escapeHTML(cat.icon || '')} ${escapeHTML(lang.startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name)}
            </option>`).join('')}
        </select>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="bill-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="bill-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  document.getElementById('bill-cancel')?.addEventListener('click', () => closeModal('bill-modal'));
  document.getElementById('bill-save')?.addEventListener('click', async () => {
    const name        = document.getElementById('bill-name').value.trim();
    const amount      = document.getElementById('bill-amount').value;
    const due_day     = parseInt(document.getElementById('bill-day').value);
    const category_id = document.getElementById('bill-category').value || null;

    let valid = true;
    if (!validateRequired(name) || name.length > 100) { showErr('bill-name-err', t('required')); valid = false; } else hideErr('bill-name-err');
    if (!validateAmount(amount))   { showErr('bill-amount-err', t('invalid_amount')); valid = false; } else hideErr('bill-amount-err');
    if (!Number.isInteger(due_day) || due_day < 1 || due_day > 31) { showErr('bill-day-err', t('day_range_error')); valid = false; } else hideErr('bill-day-err');
    if (category_id && !categories.some(cat => cat.id === category_id && (cat.type === 'expense' || !cat.type))) { toast.error(t('error'), t('error')); return; }
    if (!valid) return;

    const btn = document.getElementById('bill-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, amount: parseFloat(amount), due_day, category_id };
      if (isEdit) { await updateBill(b.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createBill(userId, payload); toast.success(t('success'), t('added')); }
      closeModal('bill-modal');
      bills = await getBills(userId);
      renderPage();
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
    }
  });
}

async function handleMarkPaid(id) {
  try {
    await updateBill(id, userId, { is_paid: true, last_paid: new Date().toISOString().split('T')[0] });
    toast.success(t('success'), t('mark_paid'));
    bills = await getBills(userId);
    renderPage();
  } catch (err) { toast.error(t('error'), err.message); }
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteBill(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        bills = await getBills(userId);
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
