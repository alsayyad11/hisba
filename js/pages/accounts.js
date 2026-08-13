/* ============================================================
   HISBA — ACCOUNTS PAGE
   ============================================================ */
import { t, formatCurrency, validateRequired, validateAmount, ACCOUNT_COLORS, getLanguage, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=security-audit-v1';
import { getAccounts, createAccount, updateAccount, deleteAccount, setDefaultAccount } from '../services/data.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js?v=security-audit-v1';
import { toast } from '../toast.js?v=security-audit-v1';

let userId, userCurrency = 'USD';
let accounts = [];
let editingAcc = null;
let returnTo = null;
let returnAction = null;

const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'investment'];
const TYPE_ICONS = { checking: 'wallet', savings: 'wallet', cash: 'wallet', credit: 'wallet', investment: 'chart' };

export async function initAccounts(uid, profile, opts = {}) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  returnTo = opts.returnTo || null;
  returnAction = opts.returnAction || null;
  accounts = await getAccounts(userId).catch(() => []);
  renderPage();
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('accounts_title')}</h1>
        <p class="page-subtitle">${t('accounts_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-acc">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_account')}
        </button>
      </div>
    </div>
    <div class="card accounts-summary" style="margin-bottom:var(--sp-xl);padding:var(--sp-lg) var(--sp-xl);">
      <div style="display:flex;align-items:center;gap:var(--sp-xl);flex-wrap:wrap;">
        <div>
          <div class="stat-card-label">${t('total_balance')}</div>
          <div style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:700;">${formatCurrency(totalBalance, userCurrency)}</div>
        </div>
        <div style="flex:1;"></div>
        <div class="text-caption text-muted">${accounts.length} ${t('accounts_title').toLowerCase()}</div>
      </div>
    </div>
    ${accounts.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-lg);" id="accounts-grid">
        ${accounts.map(accCard).join('')}
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${renderIcon('wallet', 28)}</div>
          <p class="empty-state-title">${t('no_accounts')}</p>
          <p class="empty-state-desc">${t('no_accounts_sub')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_account')}</button>
        </div>
      </div>
    `}
  `;

  document.getElementById('btn-add-acc')?.addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);
  document.getElementById('accounts-grid')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const defaultBtn = e.target.closest('[data-default]');
    if (editBtn) openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
    if (defaultBtn) await handleSetDefault(defaultBtn.dataset.default);
  });
}

function accCard(acc) {
  const typeIcon = TYPE_ICONS[acc.type] || 'wallet';
  return `
    <div class="card card-hover" style="position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${sanitizeColor(acc.color).startsWith('#') ? sanitizeColor(acc.color) : ACCOUNT_COLORS[0]};"></div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-lg);margin-top:var(--sp-sm);">
        <div style="display:flex;align-items:center;gap:var(--sp-md);">
          <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${sanitizeColor(acc.color).startsWith('#') ? `${sanitizeColor(acc.color)}22` : 'var(--clr-canvas-raised)'};display:flex;align-items:center;justify-content:center;font-size:22px;">
            ${renderIcon(typeIcon, 22)}
          </div>
          <div>
            <div class="font-semibold" style="color:var(--clr-ink);">${escapeHTML(acc.name)}</div>
            <div class="text-caption text-muted">${t('account_type_' + (ACCOUNT_TYPES.includes(acc.type) ? acc.type : 'cash'))}</div>
          </div>
        </div>
        ${acc.is_default ? `<span class="badge badge-primary">${t('default')}</span>` : ''}
      </div>
      <div style="margin-bottom:var(--sp-lg);">
        <div class="stat-card-label">${t('account_balance')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${Number(acc.balance) < 0 ? 'var(--clr-error)' : 'var(--clr-ink)'};">
          ${formatCurrency(acc.balance, acc.currency || userCurrency)}
        </div>
      </div>
      <div class="account-card-actions" style="display:flex;gap:var(--sp-sm);flex-wrap:wrap;">
        ${!acc.is_default ? `<button class="btn btn-ghost btn-sm" data-default="${escapeHTML(acc.id)}">${t('set_default')}</button>` : ''}
        <button class="btn btn-ghost btn-sm account-action" data-edit="${escapeHTML(acc.id)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${t('edit')}
        </button>
        <button class="btn btn-ghost btn-sm account-action account-delete" data-delete="${escapeHTML(acc.id)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          ${t('delete')}
        </button>
      </div>
    </div>`;
}

function openAddModal() { editingAcc = null; buildModal(null); openModal('acc-modal'); }
function openEditModal(id) {
  editingAcc = accounts.find(a => a.id === id);
  if (!editingAcc) return;
  buildModal(editingAcc);
  openModal('acc-modal');
}

function buildModal(acc) {
  const isEdit = !!acc;
  createModal({
    id: 'acc-modal',
    title: isEdit ? t('edit_account') : t('add_account'),
    content: `
      <div class="form-group">
        <label class="form-label">${t('account_name')}</label>
        <input type="text" class="form-input" id="acc-name" placeholder="${t('account_name')}" maxlength="80" value="${escapeHTML(acc?.name || '')}">
        <div class="form-error hidden" id="acc-name-err"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('account_type')}</label>
          <select class="form-select" id="acc-type">
            ${ACCOUNT_TYPES.map(type => `<option value="${type}" ${acc?.type === type ? 'selected' : ''}>${t('account_type_' + type)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('account_balance')}</label>
          <input type="number" class="form-input" id="acc-balance" placeholder="0.00" step="0.01" value="${Number.isFinite(Number(acc?.balance)) ? Number(acc.balance) : '0'}">
          <div class="form-error hidden" id="acc-balance-err"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('account_color')}</label>
        <div class="color-options" id="acc-colors">
          ${ACCOUNT_COLORS.map(c => `
            <div class="color-option ${(acc?.color || ACCOUNT_COLORS[0]) === c ? 'selected' : ''}"
              style="background:${c};" data-color="${c}"></div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" id="acc-default" ${acc?.is_default ? 'checked' : ''}>
          <div class="toggle-track"></div>
          <span class="toggle-label">${t('set_default')}</span>
        </label>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="acc-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="acc-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  let selectedColor = acc?.color || ACCOUNT_COLORS[0];
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.color;
    });
  });

  document.getElementById('acc-cancel')?.addEventListener('click', () => closeModal('acc-modal'));
  document.getElementById('acc-save')?.addEventListener('click', async () => {
    const name = document.getElementById('acc-name').value.trim();
    const type = document.getElementById('acc-type').value;
    const balance = document.getElementById('acc-balance').value;
    const is_default = document.getElementById('acc-default').checked;

    let valid = true;
    if (!validateRequired(name) || name.length > 80) { showErr('acc-name-err', t('required')); valid = false; } else hideErr('acc-name-err');
    if (!Number.isFinite(Number(balance))) { showErr('acc-balance-err', t('invalid_amount')); valid = false; } else hideErr('acc-balance-err');
    if (!ACCOUNT_TYPES.includes(type) || !ACCOUNT_COLORS.includes(selectedColor)) { toast.error(t('error'), t('error')); return; }
    if (!valid) return;

    const btn = document.getElementById('acc-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, type, balance: parseFloat(balance), color: selectedColor, is_default, currency: userCurrency };
      if (isEdit) { await updateAccount(acc.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createAccount(userId, payload); toast.success(t('success'), t('added')); }
      closeModal('acc-modal');
      const wasFirstAccount = !isEdit && accounts.length === 0;
      accounts = await getAccounts(userId);
      renderPage();
      if (wasFirstAccount && returnTo === 'transactions') {
        const nextAction = returnAction || 'add';
        returnTo = null;
        returnAction = null;
        window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'transactions', action: nextAction } }));
      }
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
    }
  });
}

async function handleSetDefault(id) {
  try {
    await setDefaultAccount(id, userId);
    accounts = await getAccounts(userId);
    renderPage();
    toast.success(t('success'), t('saved'));
  } catch (err) { toast.error(t('error'), err.message); }
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete_account'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteAccount(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        accounts = await getAccounts(userId);
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
