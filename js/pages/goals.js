/* ============================================================
   HISBA — SAVINGS GOALS PAGE
   ============================================================ */
import { t, formatCurrency, formatDate, formatPercent, validateRequired, validateAmount, GOAL_ICONS, CATEGORY_COLORS, todayISO, renderIcon } from '../utils.js?v=fusha-v2';
import { getGoals, createGoal, updateGoal, deleteGoal, addGoalFunds } from '../services/data.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js';
import { toast } from '../toast.js';

let userId, userCurrency = 'USD';
let goals = [];
let editingGoal = null;

export async function initGoals(uid, profile) {
  userId = uid;
  userCurrency = profile?.currency || 'USD';
  goals = await getGoals(userId).catch(() => []);
  renderPage();
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved  = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const completed   = goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('goals_title')}</h1>
        <p class="page-subtitle">${t('goals_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-goal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_goal')}
        </button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-lg);margin-bottom:var(--sp-xl);">
      <div class="card">
        <div class="stat-card-label">${t('goal_target')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;">${formatCurrency(totalTarget, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('goal_current')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-success);">${formatCurrency(totalSaved, userCurrency)}</div>
      </div>
      <div class="card">
        <div class="stat-card-label">${t('goal_completed')}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--clr-primary);">${completed}</div>
      </div>
    </div>

    ${goals.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--sp-lg);" id="goals-grid">
        ${goals.map(goalCard).join('')}
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${renderIcon('target', 28)}</div>
          <p class="empty-state-title">${t('no_goals')}</p>
          <p class="empty-state-desc">${t('no_goals_sub')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_goal')}</button>
        </div>
      </div>
    `}
  `;

  document.getElementById('btn-add-goal')?.addEventListener('click', () => openAddModal());
  document.getElementById('btn-empty-add')?.addEventListener('click', () => openAddModal());
  document.getElementById('goals-grid')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const fundsBtn  = e.target.closest('[data-funds]');
    if (editBtn)   openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
    if (fundsBtn)  openFundsModal(fundsBtn.dataset.funds);
  });
}

function goalCard(g) {
  const pct = formatPercent(g.current_amount, g.target_amount);
  const isComplete = pct >= 100;
  const color = g.color || CATEGORY_COLORS[0];

  return `
    <div class="card card-hover" style="position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color};"></div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-lg);margin-top:var(--sp-sm);">
        <div style="display:flex;align-items:center;gap:var(--sp-md);">
          <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${color}22;display:flex;align-items:center;justify-content:center;font-size:22px;">
            ${renderIcon(g.icon || 'target', 22)}
          </div>
          <div>
            <div class="font-semibold" style="color:var(--clr-ink);">${g.name}</div>
            ${g.deadline ? `<div class="text-caption text-muted">${t('goal_deadline').replace(' (optional)','')}: ${formatDate(g.deadline, 'short')}</div>` : ''}
          </div>
        </div>
        ${isComplete ? `<span class="badge badge-success badge-dot">${t('goal_completed')}</span>` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:var(--sp-sm);">
        <div>
          <div class="stat-card-label">${t('goal_current')}</div>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${color};">
            ${formatCurrency(g.current_amount, userCurrency)}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="stat-card-label">${t('goal_target')}</div>
          <div class="text-caption font-semibold">${formatCurrency(g.target_amount, userCurrency)}</div>
        </div>
      </div>

      <div class="progress-bar" style="height:8px;margin-bottom:var(--sp-sm);">
        <div class="progress-fill" style="width:${Math.min(pct, 100)}%;background:${color};"></div>
      </div>
      <div class="text-caption text-muted" style="margin-bottom:var(--sp-lg);">${pct}% ${t('budget_of')} ${t('goal_target').toLowerCase()}</div>

      <div style="display:flex;gap:var(--sp-sm);">
        ${!isComplete ? `
          <button class="btn btn-primary btn-sm" data-funds="${g.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${t('add_funds')}
          </button>` : ''}
        <button class="btn btn-ghost btn-sm" data-edit="${g.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${t('edit')}
        </button>
        <button class="btn btn-ghost btn-sm" data-delete="${g.id}" style="color:var(--clr-error);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
}

function openAddModal() { editingGoal = null; buildGoalModal(null); openModal('goal-modal'); }
function openEditModal(id) {
  editingGoal = goals.find(g => g.id === id);
  if (!editingGoal) return;
  buildGoalModal(editingGoal);
  openModal('goal-modal');
}

function buildGoalModal(g) {
  const isEdit = !!g;
  let selectedIcon  = g?.icon  || GOAL_ICONS[0];
  let selectedColor = g?.color || CATEGORY_COLORS[0];

  createModal({
    id: 'goal-modal',
    title: isEdit ? t('edit_goal') : t('add_goal'),
    content: `
      <div class="form-group">
        <label class="form-label">${t('goal_name')}</label>
        <input type="text" class="form-input" id="g-name" placeholder="${t('goal_name')}" value="${g?.name || ''}">
        <div class="form-error hidden" id="g-name-err"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('goal_target')}</label>
          <input type="number" class="form-input" id="g-target" placeholder="0.00" min="0" step="0.01" value="${g?.target_amount || ''}">
          <div class="form-error hidden" id="g-target-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('goal_current')}</label>
          <input type="number" class="form-input" id="g-current" placeholder="0.00" min="0" step="0.01" value="${g?.current_amount || '0'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('goal_deadline')}</label>
        <input type="date" class="form-input" id="g-deadline" value="${g?.deadline || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('goal_icon')}</label>
        <div style="display:flex;gap:var(--sp-sm);flex-wrap:wrap;" id="goal-icons">
          ${GOAL_ICONS.map(ic => `
            <div class="color-option" data-icon="${ic}" style="width:36px;height:36px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;border:2px solid ${selectedIcon === ic ? 'var(--clr-primary)' : 'var(--clr-border)'};background:${selectedIcon === ic ? 'var(--clr-primary-subtle)' : 'var(--clr-canvas-soft)'};">
              ${renderIcon(ic, 22)}
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('goal_color')}</label>
        <div class="color-options" id="goal-colors">
          ${CATEGORY_COLORS.map(c => `
            <div class="color-option ${selectedColor === c ? 'selected' : ''}" style="background:${c};" data-color="${c}"></div>`).join('')}
        </div>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="g-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="g-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  document.querySelectorAll('#goal-icons .color-option').forEach(el => {
    el.addEventListener('click', () => {
      selectedIcon = el.dataset.icon;
      document.querySelectorAll('#goal-icons .color-option').forEach(e => {
        e.style.borderColor = 'var(--clr-border)';
        e.style.background = 'var(--clr-canvas-soft)';
      });
      el.style.borderColor = 'var(--clr-primary)';
      el.style.background = 'var(--clr-primary-subtle)';
    });
  });

  document.querySelectorAll('#goal-colors .color-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#goal-colors .color-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.color;
    });
  });

  document.getElementById('g-cancel')?.addEventListener('click', () => closeModal('goal-modal'));
  document.getElementById('g-save')?.addEventListener('click', async () => {
    const name    = document.getElementById('g-name').value.trim();
    const target  = document.getElementById('g-target').value;
    const current = document.getElementById('g-current').value || '0';
    const deadline = document.getElementById('g-deadline').value || null;
    let valid = true;
    if (!validateRequired(name)) { showErr('g-name-err', t('required')); valid = false; } else hideErr('g-name-err');
    if (!validateAmount(target)) { showErr('g-target-err', t('invalid_amount')); valid = false; } else hideErr('g-target-err');
    if (!valid) return;
    const btn = document.getElementById('g-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, target_amount: parseFloat(target), current_amount: parseFloat(current), deadline, icon: selectedIcon, color: selectedColor };
      if (isEdit) { await updateGoal(g.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createGoal(userId, payload); toast.success(t('success'), t('added')); }
      closeModal('goal-modal');
      goals = await getGoals(userId);
      renderPage();
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
    }
  });
}

function openFundsModal(id) {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  createModal({
    id: 'funds-modal',
    title: t('add_funds_title', { goal: goal.name }),
    size: 'modal-sm',
    content: `
      <div class="form-group">
        <label class="form-label">${t('funds_amount')}</label>
        <input type="number" class="form-input" id="funds-amount" placeholder="0.00" min="0.01" step="0.01">
        <div class="form-error hidden" id="funds-err"></div>
      </div>`,
    footerButtons: [
      `<button class="btn btn-outline" id="funds-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="funds-save">${t('add_funds')}</button>`,
    ],
  });
  document.getElementById('funds-cancel')?.addEventListener('click', () => closeModal('funds-modal'));
  document.getElementById('funds-save')?.addEventListener('click', async () => {
    const amount = document.getElementById('funds-amount').value;
    if (!validateAmount(amount)) { showErr('funds-err', t('invalid_amount')); return; }
    const btn = document.getElementById('funds-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      await addGoalFunds(id, userId, parseFloat(amount));
      toast.success(t('success'), t('updated'));
      closeModal('funds-modal');
      goals = await getGoals(userId);
      renderPage();
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = t('add_funds');
    }
  });
  openModal('funds-modal');
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete_goal'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteGoal(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        goals = await getGoals(userId);
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
