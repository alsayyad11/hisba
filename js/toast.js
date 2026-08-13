/* ============================================================
   HISBA — TOAST NOTIFICATIONS
   ============================================================ */
import { t } from './utils.js?v=locale-singleton-v1';

let container = null;

function getContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

const iconSVG = {
  success: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
  error: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 16H3L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
};

function escapeText(value) {
  return value == null ? '' : String(value);
}

function show(type, title, message = '', duration = 4200, meta = {}) {
  const c = getContainer();
  const el = document.createElement('article');
  const hasProgress = Number.isFinite(Number(meta.percent));
  const percent = Math.max(0, Math.min(100, Number(meta.percent || 0)));
  const variant = meta.variant || type;
  el.className = `toast toast-${variant} animate-fade-in${hasProgress ? ' toast-with-progress' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="toast-icon-wrap">${iconSVG[variant] || iconSVG.info}</div>
    <div class="toast-content">
      <div class="toast-title"></div>
      <div class="toast-message"></div>
      ${hasProgress ? `<div class="toast-meta"><span class="toast-percent"></span><span class="toast-meta-label">${escapeText(meta.label || '')}</span></div><div class="toast-progress"><span></span></div>` : ''}
    </div>
    <button class="toast-close" type="button" aria-label="${escapeText(t('close') || 'Close')}">×</button>
  `;
  el.querySelector('.toast-title').textContent = escapeText(title);
  const msg = el.querySelector('.toast-message');
  msg.textContent = escapeText(message);
  if (!message) msg.hidden = true;
  if (hasProgress) {
    el.querySelector('.toast-percent').textContent = `${Math.round(percent)}%`;
    el.querySelector('.toast-progress span').style.width = `${percent}%`;
  }

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.add('removing');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  if (duration > 0) setTimeout(remove, duration);
  c.appendChild(el);
  return el;
}

export const toast = {
  success: (title, message, duration) => show('success', title, message, duration),
  deleted: (title, message, duration) => show('delete', title, message, duration),
  error: (title, message, duration) => show('error', title, message, duration),
  warning: (title, message, duration) => show('warning', title, message, duration),
  info: (title, message, duration) => show('info', title, message, duration),
  budget: (type, title, message, percent, label, duration = 6500) => show(type, title, message, duration, { percent, label, variant: type === 'over' ? 'error' : 'warning' })
};
