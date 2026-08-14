/* ============================================================
   HISBA — TRANSACTIONS PAGE
   ============================================================ */
import { t, formatCurrency, formatDate, formatRelativeDate, getDateRange, todayISO, validateRequired, validateAmount, getLanguage, renderIcon, escapeHTML, sanitizeColor } from '../utils.js?v=release-2.3.0';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, getAccounts, getCategories, getTags, createTag, setTransactionTags } from '../services/data.js?v=release-2.3.3';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js?v=release-2.3.0';
import { toast } from '../toast.js?v=release-2.3.0';

let userId, userCurrency = 'USD';
let transactions = [], accounts = [], categories = [], tags = [];
let filters = { type: 'all', period: 'this_month', search: '', category_id: '', account_id: '', status: '', sort: 'date_desc' };
let editingTx = null;
let onboardingActive = false;

export async function initTransactions(uid, profile, opts = {}) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  onboardingActive = opts.action === 'onboarding-transaction';
  await loadMeta();
  await loadTransactions();
  renderPage();
  if (opts.action === 'add' || opts.action === 'onboarding-transaction') setTimeout(() => openAddModal(), 100);
}

async function loadMeta() {
  [accounts, categories, tags] = await Promise.all([
    getAccounts(userId).catch(() => []),
    getCategories(userId).catch(() => []),
    getTags(userId).catch(() => []),
  ]);
}

async function loadTransactions() {
  const range = getDateRange(filters.period);
  const f = { ...range, type: filters.type === 'all' ? undefined : filters.type, search: filters.search || undefined, category_id: filters.category_id || undefined, account_id: filters.account_id || undefined, status: filters.status || undefined, sort: filters.sort };
  transactions = await getTransactions(userId, f).catch(() => []);
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  el.innerHTML = `
    <section class="transactions-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('transactions_title')}</h1>
        <p class="page-subtitle">${t('transactions_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-tx">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_transaction')}
        </button>
      </div>
    </div>

    ${transactions.length ? `
    <!-- Summary Strip -->
    <div class="transactions-summary">
      <div class="card transaction-summary-card transaction-summary-income">
        <div class="stat-card-label">${t('filter_income')}</div>
        <div class="sensitive-value" style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-success);">+${formatCurrency(income, userCurrency)}</div>
      </div>
      <div class="card transaction-summary-card transaction-summary-expense">
        <div class="stat-card-label">${t('filter_expense')}</div>
        <div class="sensitive-value" style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-error);">-${formatCurrency(expenses, userCurrency)}</div>
      </div>
      <div class="card transaction-summary-card transaction-summary-net">
        <div class="stat-card-label">${t('net_savings')}</div>
        <div class="sensitive-value" style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${income - expenses >= 0 ? 'var(--clr-success)' : 'var(--clr-error)'};">
          ${income - expenses >= 0 ? '+' : ''}${formatCurrency(income - expenses, userCurrency)}
        </div>
      </div>
      <div class="card transaction-summary-card transaction-summary-count">
        <div class="stat-card-label">${t('report_transactions_count')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;">${transactions.length}</div>
      </div>
    </div>
    ` : ''}

    ${transactions.length ? `
    <!-- Filter bar -->
    <div class="transactions-filter-panel">
      <!-- Type filter -->
      <div style="display:flex;gap:var(--sp-xs);">
        ${['all','income','expense'].map(type => `
          <button class="filter-chip ${filters.type === type ? 'active' : ''}" data-type="${type}">
            ${t('filter_' + type)}
          </button>`).join('')}
      </div>
      <!-- Period filter -->
      <select class="form-select" id="period-select" style="width:auto;padding-right:2.5rem;">
        ${[
          ['this_month', t('this_month')],
          ['last_month', t('last_month')],
          ['this_week', t('this_week')],
          ['last_week', t('last_week')],
          ['today', t('today')],
          ['this_year', t('this_year')],
        ].map(([val, lbl]) => `<option value="${val}" ${filters.period === val ? 'selected' : ''}>${lbl}</option>`).join('')}
      </select>
      <!-- Advanced filters -->
      <select class="form-select" id="category-filter" style="width:auto;min-width:150px;padding-right:2.5rem;">
        <option value="">${t('filter_category')}</option>
        ${categories.map(cat => `<option value="${escapeHTML(cat.id)}" ${filters.category_id === cat.id ? 'selected' : ''}>${escapeHTML(getLanguage().startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name)}</option>`).join('')}
      </select>
      <select class="form-select" id="account-filter" style="width:auto;min-width:140px;padding-right:2.5rem;">
        <option value="">${t('filter_account')}</option>
        ${accounts.map(acc => `<option value="${escapeHTML(acc.id)}" ${filters.account_id === acc.id ? 'selected' : ''}>${escapeHTML(acc.name)}</option>`).join('')}
      </select>
      <select class="form-select" id="status-filter" style="width:auto;min-width:130px;padding-right:2.5rem;">
        <option value="">${t('filter_status')}</option>
        <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>${t('status_completed')}</option>
        <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>${t('status_pending')}</option>
      </select>
      <!-- Search -->
      <div class="search-input" style="flex:1;min-width:200px;max-width:360px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="search-input" placeholder="${t('search_transactions')}" value="${escapeHTML(filters.search)}">
      </div>
      <select class="form-select" id="sort-filter" style="width:auto;min-width:145px;padding-right:2.5rem;">
        <option value="date_desc" ${filters.sort === 'date_desc' ? 'selected' : ''}>${t('sort_newest')}</option>
        <option value="date_asc" ${filters.sort === 'date_asc' ? 'selected' : ''}>${t('sort_oldest')}</option>
        <option value="amount_desc" ${filters.sort === 'amount_desc' ? 'selected' : ''}>${t('sort_amount_high')}</option>
        <option value="amount_asc" ${filters.sort === 'amount_asc' ? 'selected' : ''}>${t('sort_amount_low')}</option>
      </select>
    </div>
    ` : ''}

    <!-- Transactions Table -->
    <div class="card transaction-ledger">
      ${transactions.length ? `
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>${t('description')}</th>
              <th>${t('category')}</th>
              <th>${t('account')}</th>
              <th>${t('date')}</th>
              <th>${t('status')}</th>
              <th style="text-align:right;">${t('amount')}</th>
              <th style="width:80px;"></th>
            </tr></thead>
            <tbody id="tx-tbody">
              ${transactions.map(tx => txRow(tx)).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state first-run-empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" stroke-width="1.5" stroke-linecap="round"><path d="M12 3v18M3 12h18"/></svg>
          </div>
          <p class="empty-state-title">${t('no_transactions')}</p>
          <p class="empty-state-desc">${t('no_transactions_sub')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_transaction')}</button>
        </div>
      `}
    </div>
    </section>
  `;

  // Events
  document.getElementById('btn-add-tx')?.addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);

  document.querySelectorAll('.filter-chip[data-type]').forEach(btn => {
    btn.addEventListener('click', async () => {
      filters.type = btn.dataset.type;
      await loadTransactions();
      renderPage();
    });
  });

  document.getElementById('period-select')?.addEventListener('change', async (e) => {
    filters.period = e.target.value;
    await loadTransactions();
    renderPage();
  });

  const reloadForFilter = async (key, value) => { filters[key] = value; await loadTransactions(); renderPage(); };
  document.getElementById('category-filter')?.addEventListener('change', e => reloadForFilter('category_id', e.target.value));
  document.getElementById('account-filter')?.addEventListener('change', e => reloadForFilter('account_id', e.target.value));
  document.getElementById('status-filter')?.addEventListener('change', e => reloadForFilter('status', e.target.value));
  document.getElementById('sort-filter')?.addEventListener('change', e => reloadForFilter('sort', e.target.value));

  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      filters.search = e.target.value;
      await loadTransactions();
      renderPage();
    }, 350);
  });

  const transactionBody = document.getElementById('tx-tbody');
  transactionBody?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const row = e.target.closest('[data-tx]');
    if (editBtn) openEditModal(editBtn.dataset.edit);
    else if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
    else if (row) openEditModal(row.dataset.tx);
  });
  transactionBody?.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('button')) return;
    const row = e.target.closest('[data-tx]');
    if (!row) return;
    e.preventDefault();
    openEditModal(row.dataset.tx);
  });
}

function txRow(tx) {
  const cat = tx.category;
  const acc = tx.account;
  const lang = getLanguage();
  const categoryColor = sanitizeColor(cat?.color, 'var(--clr-canvas-raised)');
  const accountColor = sanitizeColor(acc?.color);
  return `
    <tr class="transaction-row" data-tx="${escapeHTML(tx.id)}" tabindex="0" aria-label="${t('edit_transaction')}">
      <td>
        <div style="display:flex;align-items:center;gap:var(--sp-sm);">
          <div class="cat-icon transaction-category-icon" style="background:${categoryColor.startsWith('#') ? `${categoryColor}22` : categoryColor};">
            <span style="font-size:14px;">${renderIcon(cat?.icon || 'package', 14)}</span>
          </div>
          <div>
            <div class="font-medium truncate transaction-description" style="max-width:200px;">${escapeHTML(tx.description || t('transaction_untitled'))}</div>
            ${tx.notes ? `<div class="text-fine text-muted truncate" style="max-width:200px;">${escapeHTML(tx.notes)}</div>` : ''}
            ${Array.isArray(tx.tags) && tx.tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">${tx.tags.slice(0, 3).map(tag => `<span class="badge" style="background:var(--clr-primary-subtle);color:var(--clr-primary);border:1px solid var(--clr-primary-border);font-size:10px;">${escapeHTML(tag.name)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="text-caption">${escapeHTML(lang.startsWith('ar') && cat?.name_ar ? cat.name_ar : (cat?.name || '—'))}</span></td>
      <td>
        ${acc ? `<span class="account-badge" style="--account-color:${accountColor};">${escapeHTML(acc.name)}</span>` : '—'}
      </td>
      <td><span class="text-caption text-muted">${formatRelativeDate(tx.date)}</span></td>
      <td>
        <span class="badge ${tx.status === 'completed' ? 'badge-success' : 'badge-warning'} badge-dot">
          ${tx.status === 'completed' ? t('status_completed') : t('status_pending')}
        </span>
      </td>
      <td style="text-align:right;">
        <span class="font-semibold sensitive-value ${tx.type === 'income' ? 'amount-income' : tx.type === 'expense' ? 'amount-expense' : 'amount-neutral'}">
          ${tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${formatCurrency(tx.amount, acc?.currency || userCurrency)}
        </span>
      </td>
      <td>
        <div class="transaction-row-actions">
          <button class="btn btn-ghost btn-icon-sm" data-edit="${escapeHTML(tx.id)}" title="${t('edit')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm delete-btn" data-delete="${escapeHTML(tx.id)}" title="${t('delete')}" aria-label="${t('delete')}" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function onboardingProgress(current) {
  return `
    <div class="onboarding-form-progress">
      <span>${t('onboarding_progress', { current, total: 3 })}</span>
      <span class="onboarding-progress-dots" aria-hidden="true">${[1, 2, 3].map(step => `<i class="${step <= current ? 'is-active' : ''}"></i>`).join('')}</span>
    </div>`;
}

function openAddModal() {
  if (!accounts.length) {
    openTransactionSetupPrompt();
    return;
  }
  editingTx = null;
  buildTxModal(null);
  openModal('tx-modal');
}

function openTransactionSetupPrompt() {
  createModal({
    id: 'transaction-setup-modal',
    title: t('onboarding_title'),
    size: 'modal-sm',
    content: `
      <section class="onboarding-dialog" aria-describedby="transaction-setup-copy">
        <div class="onboarding-dialog-progress">
          <span class="onboarding-dialog-kicker">${t('onboarding_progress', { current: 1, total: 3 })}</span>
          <span class="onboarding-progress-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i></span>
        </div>
        <div class="onboarding-dialog-icon" aria-hidden="true">${renderIcon('wallet', 28)}</div>
        <div>
          <h3 class="onboarding-dialog-title">${t('onboarding_step_account')}</h3>
          <p class="onboarding-dialog-copy" id="transaction-setup-copy">${t('onboarding_step_account_sub')}</p>
        </div>
      </section>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="setup-close">${t('onboarding_not_now')}</button>`,
      `<button class="btn btn-primary" id="setup-add-account">${t('onboarding_start')}</button>`,
    ],
  });
  openModal('transaction-setup-modal');
  document.getElementById('setup-close')?.addEventListener('click', () => closeModal('transaction-setup-modal'));
  document.getElementById('setup-add-account')?.addEventListener('click', () => {
    closeModal('transaction-setup-modal');
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'accounts', returnTo: 'transactions', returnAction: 'onboarding-transaction' },
    }));
  });
}

function openEditModal(id) {
  editingTx = transactions.find(tx => tx.id === id);
  if (!editingTx) return;
  buildTxModal(editingTx);
  openModal('tx-modal');
}

function buildTxModal(tx) {
  const isEdit = !!tx;
  const isFirstTransaction = !tx && transactions.length === 0;
  const expenseCats = categories.filter(c => c.type === 'expense' || !c.type);
  const incomeCats = categories.filter(c => c.type === 'income');

  createModal({
    id: 'tx-modal',
    title: isEdit ? t('edit_transaction') : t('add_transaction'),
    content: `
      ${!isEdit && onboardingActive ? onboardingProgress(2) : ''}
      <div class="form-group">
        <label class="form-label">${t('transaction_type')}</label>
        <div style="display:flex;gap:var(--sp-sm);">
          ${['expense','income'].map(type => `
            <label style="flex:1;cursor:pointer;">
              <input type="radio" name="tx-type" value="${type}" ${(tx?.type || 'expense') === type ? 'checked' : ''} style="display:none;" class="type-radio">
              <div class="type-chip ${(tx?.type || 'expense') === type ? 'active' : ''}" data-type="${type}"
                style="text-align:center;padding:var(--sp-sm);border:2px solid var(--clr-border);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:600;transition:all var(--transition-fast);cursor:pointer;">
                ${t(type)}
              </div>
            </label>`).join('')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('amount')}</label>
          <div class="input-group">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <input type="number" class="form-input" id="tx-amount" placeholder="0.00" min="0" step="0.01" value="${tx?.amount || ''}">
          </div>
          <div class="form-error hidden" id="tx-amount-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('date')}</label>
          <input type="date" class="form-input" id="tx-date" value="${tx?.date || todayISO()}">
          <div class="form-error hidden" id="tx-date-err"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('description')} <span class="field-optional">(${t('optional')})</span></label>
        <input type="text" class="form-input" id="tx-description" placeholder="${t('description_optional')}" value="${escapeHTML(tx?.description || '')}">
        <div class="form-error hidden" id="tx-desc-err"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('tags')} <span class="field-optional">(${t('optional')})</span></label>
        <input type="text" class="form-input" id="tx-tags" maxlength="255" placeholder="${t('add_tag')}" value="${escapeHTML((tx?.tags || []).map(tag => tag.name).filter(Boolean).join(', '))}">
        <p class="text-fine text-muted" style="margin-top:6px;">${t('tag_name')}</p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('category')}</label>
          <select class="form-select" id="tx-category">
            <option value="">${t('select')}</option>
            ${categories.map(cat => `
              <option value="${escapeHTML(cat.id)}" ${tx?.category_id === cat.id ? 'selected' : ''}>
                ${renderIcon(cat.icon || 'package', 16)} ${escapeHTML(getLanguage().startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name)}
              </option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('account')}</label>
          <select class="form-select" id="tx-account">
            <option value="">${t('select')}</option>
            ${accounts.map(acc => `
              <option value="${escapeHTML(acc.id)}" ${(tx?.account_id === acc.id || (!tx && acc.is_default)) ? 'selected' : ''}>
                ${escapeHTML(acc.name)}
              </option>`).join('')}
          </select>
          <div class="form-error hidden" id="tx-account-err"></div>
        </div>
      </div>
      ${isFirstTransaction ? '' : `
      <div class="form-group">
        <label class="form-label">${t('status')}</label>
        <select class="form-select" id="tx-status">
          <option value="completed" ${(tx?.status || 'completed') === 'completed' ? 'selected' : ''}>${t('status_completed')}</option>
          <option value="pending" ${tx?.status === 'pending' ? 'selected' : ''}>${t('status_pending')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('notes')}</label>
        <textarea class="form-textarea" id="tx-notes" placeholder="${t('transaction_notes')}" style="min-height:72px;">${escapeHTML(tx?.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" id="tx-recurring" ${tx?.is_recurring ? 'checked' : ''}>
          <div class="toggle-track"></div>
          <span class="toggle-label">${t('is_recurring')}</span>
        </label>
      </div>
      <div id="recurring-options" ${tx?.is_recurring ? '' : 'style="display:none;"'}>
        <div class="form-group">
          <label class="form-label">${t('frequency')}</label>
          <select class="form-select" id="tx-frequency">
            <option value="daily" ${tx?.frequency === 'daily' ? 'selected' : ''}>${t('daily')}</option>
            <option value="weekly" ${tx?.frequency === 'weekly' ? 'selected' : ''}>${t('weekly')}</option>
            <option value="monthly" ${(tx?.frequency === 'monthly' || !tx?.frequency) ? 'selected' : ''}>${t('monthly')}</option>
            <option value="yearly" ${tx?.frequency === 'yearly' ? 'selected' : ''}>${t('yearly')}</option>
          </select>
        </div>
      </div>`}
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="tx-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="tx-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  // Type chip interactivity
  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.type-chip').forEach(c => {
        c.style.borderColor = 'var(--clr-border)';
        c.style.background = '';
        c.style.color = '';
      });
      chip.style.borderColor = 'var(--clr-primary)';
      chip.style.background = 'var(--clr-primary-subtle)';
      chip.style.color = 'var(--clr-primary)';
      const radio = document.querySelector(`input[type=radio][value="${chip.dataset.type}"]`);
      if (radio) radio.checked = true;
    });
  });

  // Highlight current selection
  const activeChip = document.querySelector(`.type-chip[data-type="${tx?.type || 'expense'}"]`);
  if (activeChip) {
    activeChip.style.borderColor = 'var(--clr-primary)';
    activeChip.style.background = 'var(--clr-primary-subtle)';
    activeChip.style.color = 'var(--clr-primary)';
  }

  // Recurring toggle
  document.getElementById('tx-recurring')?.addEventListener('change', (e) => {
    const recurringOptions = document.getElementById('recurring-options');
    if (recurringOptions) recurringOptions.style.display = e.target.checked ? '' : 'none';
  });

  document.getElementById('tx-cancel')?.addEventListener('click', () => closeModal('tx-modal'));
  document.getElementById('tx-save')?.addEventListener('click', () => saveTx(isEdit));
}

async function saveTx(isEdit) {
  const type = document.querySelector('input[name="tx-type"]:checked')?.value || 'expense';
  const amount = document.getElementById('tx-amount').value;
  const date = document.getElementById('tx-date').value;
  const description = document.getElementById('tx-description').value.trim();
  const category_id = document.getElementById('tx-category').value;
  const account_id = document.getElementById('tx-account').value;
  const status = document.getElementById('tx-status')?.value || 'completed';
  const notes = document.getElementById('tx-notes')?.value.trim() || '';
  const is_recurring = document.getElementById('tx-recurring')?.checked || false;
  const frequency = document.getElementById('tx-frequency')?.value;
  const tagNames = [...new Set((document.getElementById('tx-tags')?.value || '')
    .split(/[,،]/)
    .map(name => name.trim().replace(/\s+/g, ' '))
    .filter(name => name.length > 0))].slice(0, 8);
  const shouldContinueOnboarding = onboardingActive && !isEdit && transactions.length === 0;

  let valid = true;
  if (!validateAmount(amount)) { showErr('tx-amount-err', t('invalid_amount')); valid = false; } else hideErr('tx-amount-err');
  if (!validateRequired(date)) { showErr('tx-date-err', t('required')); valid = false; } else hideErr('tx-date-err');
  hideErr('tx-desc-err');
  if (!account_id) { showErr('tx-account-err', t('required')); valid = false; } else hideErr('tx-account-err');
  if (tagNames.some(name => name.length > 32)) { toast.error(t('error'), t('tag_name')); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('tx-save');
  btn.disabled = true; btn.textContent = t('saving');

  const payload = {
    type, amount: parseFloat(amount), date, description,
    category_id: category_id || null,
    account_id,
    status, notes: notes || null,
    is_recurring, frequency: is_recurring ? frequency : null,
  };

  try {
    let savedTransaction;
    if (isEdit && editingTx) {
      savedTransaction = await updateTransaction(editingTx.id, userId, payload);
      toast.success(t('success'), t('updated'));
    } else {
      savedTransaction = await createTransaction(userId, payload);
      const language = getLanguage();
      const ar = language.startsWith('ar');
      const isFusha = language === 'ar-fusha';
      const humanNote = type === 'expense'
        ? (isFusha ? 'تم التسجيل. سيسهل عليك تذكّر مصروفك عند مراجعة الشهر.' : (ar ? 'تمام، اتسجل. كده هتفتكر مصروفك بسهولة لما تراجع الشهر.' : 'Saved. It will be easier to understand your month when you review it.'))
        : (isFusha ? 'تم تسجيل الدخل. تزداد صورتك المالية وضوحاً مع كل معاملة.' : (ar ? 'تمام، اتسجل الدخل. الصورة بتوضح أكتر مع كل معاملة.' : 'Saved. Your picture becomes clearer with every transaction.'));
      toast.success(isFusha ? 'تم التسجيل' : (ar ? 'اتسجلت' : 'Saved'), humanNote);
    }

    if (savedTransaction?.id) {
      const knownByName = new Map(tags.map(tag => [String(tag.name || '').trim().toLocaleLowerCase(), tag]));
      const selectedTagIds = [];
      for (const name of tagNames) {
        const normalized = name.toLocaleLowerCase();
        let tag = knownByName.get(normalized);
        if (!tag) {
          tag = await createTag(userId, { name, color: '#176b73' });
          tags = [...tags, tag];
          knownByName.set(normalized, tag);
        }
        if (tag?.id) selectedTagIds.push(tag.id);
      }
      await setTransactionTags(savedTransaction.id, userId, selectedTagIds);
    }
    closeModal('tx-modal');
    await loadTransactions();
    renderPage();
    if (shouldContinueOnboarding) {
      onboardingActive = false;
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'budgets', action: 'onboarding-budget' } }));
    }
  } catch (err) {
    toast.error(t('error'), err.message);
    btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
  }
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete_transaction'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteTransaction(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        await loadTransactions();
        renderPage();
      } catch (err) {
        toast.error(t('error'), err.message);
      }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
