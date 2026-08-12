/* ============================================================
   HISBA — CATEGORIES PAGE
   ============================================================ */
import { t, validateRequired, CATEGORY_COLORS, CATEGORY_ICONS, getLanguage, renderIcon } from '../utils.js?v=lang-v5';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/data.js';
import { createModal, openModal, closeModal, showConfirm } from '../components/modal.js';
import { toast } from '../toast.js';

let userId;
let categories = [];
let editingCat = null;
let activeTab = 'expense';

const ICON_LIST = ['food','cart','shop','car','health','entertainment','bolt','home','book','plane','phone','laptop','gift','goal','chart','coffee','wallet','package','target','school','star'];

export async function initCategories(uid, profile) {
  userId = uid;
  categories = await getCategories(userId).catch(() => []);
  renderPage();
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const lang = getLanguage();

  const expenseCats  = categories.filter(c => c.type === 'expense' || !c.type);
  const incomeCats   = categories.filter(c => c.type === 'income');
  const shown        = activeTab === 'income' ? incomeCats : expenseCats;
  const predefined   = shown.filter(c => c.is_predefined);
  const custom       = shown.filter(c => !c.is_predefined);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${t('categories_title')}</h1>
        <p class="page-subtitle">${t('categories_subtitle')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-add-cat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('add_category')}
        </button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn ${activeTab === 'expense' ? 'active' : ''}" data-tab="expense">${t('expense')}</button>
      <button class="tab-btn ${activeTab === 'income'  ? 'active' : ''}" data-tab="income">${t('income')}</button>
    </div>

    ${custom.length ? `
      <div style="margin-bottom:var(--sp-2xl);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-lg);">
          <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--clr-body-mid);text-transform:uppercase;letter-spacing:0.06em;">${t('custom_cat')}</h3>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--sp-md);" id="custom-cats">
          ${custom.map(cat => catCard(cat, lang, true)).join('')}
        </div>
      </div>
    ` : ''}

    ${predefined.length ? `
      <div>
        <div style="margin-bottom:var(--sp-lg);">
          <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--clr-body-mid);text-transform:uppercase;letter-spacing:0.06em;">${t('predefined')}</h3>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--sp-md);">
          ${predefined.map(cat => catCard(cat, lang, false)).join('')}
        </div>
      </div>
    ` : ''}

    ${!shown.length ? `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${renderIcon('package', 28)}</div>
          <p class="empty-state-title">${t('no_categories')}</p>
          <button class="btn btn-primary" id="btn-empty-add">${t('add_category')}</button>
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('btn-add-cat')?.addEventListener('click', openAddModal);
  document.getElementById('btn-empty-add')?.addEventListener('click', openAddModal);

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderPage();
    });
  });

  document.getElementById('custom-cats')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    if (editBtn)   openEditModal(editBtn.dataset.edit);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.delete);
  });
}

function catCard(cat, lang, editable) {
  const name = lang.startsWith('ar') && cat.name_ar ? cat.name_ar : cat.name;
  return `
    <div class="card card-hover" style="padding:var(--sp-lg);display:flex;align-items:center;gap:var(--sp-md);">
      <div class="cat-icon" style="background:${cat.color}22;flex-shrink:0;">
        <span class="category-icon-render">${renderIcon(cat.icon || 'package', 18)}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="font-semibold truncate">${name}</div>
        <div class="text-caption text-muted">${cat.type || 'expense'}</div>
      </div>
      ${editable ? `
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn btn-ghost btn-icon-sm" data-edit="${cat.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm" data-delete="${cat.id}" style="color:var(--clr-error);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      ` : ''}
    </div>`;
}

function openAddModal() { editingCat = null; buildModal(null); openModal('cat-modal'); }
function openEditModal(id) {
  editingCat = categories.find(c => c.id === id);
  if (!editingCat) return;
  buildModal(editingCat);
  openModal('cat-modal');
}

function buildModal(cat) {
  const isEdit = !!cat;
  let selectedColor = cat?.color || CATEGORY_COLORS[0];
  let selectedIcon  = cat?.icon  || 'package';

  createModal({
    id: 'cat-modal',
    title: isEdit ? t('edit_category') : t('add_category'),
    content: `
      <div class="form-group">
        <label class="form-label">${t('category_name')}</label>
        <input type="text" class="form-input" id="cat-name" placeholder="${t('category_name')}" value="${cat?.name || ''}">
        <div class="form-error hidden" id="cat-name-err"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('category_name_ar')}</label>
        <input type="text" class="form-input" id="cat-name-ar" placeholder="الاسم بالعربية" value="${cat?.name_ar || ''}" dir="rtl">
      </div>
      <div class="form-group">
        <label class="form-label">${t('category_type')}</label>
        <select class="form-select" id="cat-type">
          <option value="expense" ${(cat?.type || activeTab) === 'expense' ? 'selected' : ''}>${t('expense')}</option>
          <option value="income"  ${cat?.type === 'income' ? 'selected' : ''}>${t('income')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('category_icon')}</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;max-height:140px;overflow-y:auto;" id="cat-icons">
          ${ICON_LIST.map(ic => `
            <div class="cat-icon-btn" data-icon="${ic}" style="width:36px;height:36px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;border:2px solid ${selectedIcon === ic ? 'var(--clr-primary)' : 'var(--clr-border)'};background:${selectedIcon === ic ? 'var(--clr-primary-subtle)' : 'transparent'};transition:all var(--transition-fast);">
              ${renderIcon(ic, 20)}
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('category_color')}</label>
        <div class="color-options" id="cat-colors">
          ${CATEGORY_COLORS.map(c => `
            <div class="color-option ${selectedColor === c ? 'selected' : ''}" style="background:${c};" data-color="${c}"></div>`).join('')}
        </div>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" id="cat-cancel">${t('cancel')}</button>`,
      `<button class="btn btn-primary" id="cat-save">${isEdit ? t('save') : t('add')}</button>`,
    ],
  });

  document.querySelectorAll('.cat-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedIcon = btn.dataset.icon;
      document.querySelectorAll('.cat-icon-btn').forEach(b => {
        b.style.borderColor = 'var(--clr-border)';
        b.style.background  = 'transparent';
      });
      btn.style.borderColor = 'var(--clr-primary)';
      btn.style.background  = 'var(--clr-primary-subtle)';
    });
  });

  document.querySelectorAll('#cat-colors .color-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#cat-colors .color-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.color;
    });
  });

  document.getElementById('cat-cancel')?.addEventListener('click', () => closeModal('cat-modal'));
  document.getElementById('cat-save')?.addEventListener('click', async () => {
    const name    = document.getElementById('cat-name').value.trim();
    const name_ar = document.getElementById('cat-name-ar').value.trim();
    const type    = document.getElementById('cat-type').value;
    if (!validateRequired(name)) { showErr('cat-name-err', t('required')); return; }
    hideErr('cat-name-err');

    const btn = document.getElementById('cat-save');
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const payload = { name, name_ar: name_ar || null, type, icon: selectedIcon, color: selectedColor };
      if (isEdit) { await updateCategory(cat.id, userId, payload); toast.success(t('success'), t('updated')); }
      else        { await createCategory(userId, payload); toast.success(t('success'), t('added')); }
      closeModal('cat-modal');
      categories = await getCategories(userId);
      renderPage();
    } catch (err) {
      toast.error(t('error'), err.message);
      btn.disabled = false; btn.textContent = isEdit ? t('save') : t('add');
    }
  });
}

function confirmDelete(id) {
  showConfirm({
    title: t('delete_category'),
    message: t('delete_confirm_sub'),
    confirmText: t('delete'),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteCategory(id, userId);
        toast.deleted(t('deleted'), t('deleted'));
        categories = await getCategories(userId);
        renderPage();
      } catch (err) { toast.error(t('error'), err.message); }
    },
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
