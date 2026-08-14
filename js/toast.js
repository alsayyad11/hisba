/* ============================================================
   HISBA — TOAST NOTIFICATIONS
   ============================================================ */
import { t } from './utils.js?v=release-2.3.0';

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
  success: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7.5 12.25 3 3L16.75 9"/></svg>',
  error: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 7.25v5.5m0 3.15h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 10.5v5m0-8h.01"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8.25h8m-6.25 3v4.25m2.5-4.25v4.25M9 8.25l.55 8.25h4.9L15 8.25M10.25 8.25V6.8h3.5v1.45"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7.75 7.75 8.5 8.5m0-8.5-8.5 8.5"/></svg>'
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
  el.className = `toast toast-${variant}${hasProgress ? ' toast-with-progress' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `
    <div class="toast-icon-wrap">${iconSVG[variant] || iconSVG.info}</div>
    <div class="toast-content">
      <div class="toast-title"></div>
      <div class="toast-message"></div>
      ${hasProgress ? `<div class="toast-meta"><span class="toast-percent"></span><span class="toast-meta-label"></span></div><div class="toast-progress"><span></span></div>` : ''}
    </div>
    <button class="toast-close" type="button" aria-label="${escapeText(t('close') || 'Close')}">${iconSVG.close}</button>
  `;
  el.querySelector('.toast-title').textContent = escapeText(title);
  const msg = el.querySelector('.toast-message');
  msg.textContent = escapeText(message);
  if (!message) msg.hidden = true;
  if (hasProgress) {
    el.querySelector('.toast-percent').textContent = `${Math.round(percent)}%`;
    el.querySelector('.toast-meta-label').textContent = escapeText(meta.label || '');
    el.querySelector('.toast-progress span').style.width = `${percent}%`;
  }

  let removed = false;
  let timeoutId = null;
  const remove = () => {
    if (removed) return;
    removed = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    el.classList.add('removing');
    window.setTimeout(() => el.remove(), 180);
  };
  const scheduleRemoval = () => {
    if (duration > 0 && !removed) timeoutId = window.setTimeout(remove, duration);
  };

  el.querySelector('.toast-close').addEventListener('click', remove);
  el.addEventListener('mouseenter', () => { if (timeoutId) window.clearTimeout(timeoutId); });
  el.addEventListener('mouseleave', scheduleRemoval);
  el.addEventListener('focusin', () => { if (timeoutId) window.clearTimeout(timeoutId); });
  el.addEventListener('focusout', () => window.setTimeout(scheduleRemoval, 0));
  c.appendChild(el);
  scheduleRemoval();
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
