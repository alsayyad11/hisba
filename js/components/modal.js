/* ============================================================
   HISBA — MODAL COMPONENT
   ============================================================ */
import { t } from '../utils.js?v=locale-singleton-v1';

export function createModal({ id, title, size = '', content = '', footerButtons = [] }) {
  let backdrop = document.getElementById(id);
  if (backdrop) backdrop.remove();

  backdrop = document.createElement('div');
  backdrop.id = id;
  backdrop.className = 'modal-backdrop hidden';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <div class="modal-header">
        <h2 class="modal-title" id="${id}-title">${title}</h2>
        <button class="modal-close" data-close aria-label="${t('close')}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">${content}</div>
      ${footerButtons.length ? `<div class="modal-footer">${footerButtons.join('')}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close(id);
  });

  // Close on X button
  backdrop.querySelector('[data-close]').addEventListener('click', () => close(id));

  // Close on Escape
  const escHandler = (e) => { if (e.key === 'Escape') close(id); };
  document.addEventListener('keydown', escHandler);
  backdrop._escHandler = escHandler;

  return backdrop;
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const first = modal.querySelector('input, select, textarea, button:not([data-close])');
    if (first) setTimeout(() => first.focus(), 100);
  }
}

export function closeModal(id) {
  close(id);
}

function close(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
  }
}

export function showConfirm({ title, message, confirmText, confirmClass = 'btn-danger', onConfirm }) {
  const id = 'confirm-modal';
  createModal({
    id,
    title,
    size: 'modal-sm',
    content: `
      <div style="text-align:center;padding:var(--sp-md) 0;">
        <p style="color:var(--clr-body);font-size:var(--text-sm);line-height:1.6;">${message}</p>
      </div>
    `,
    footerButtons: [
      `<button class="btn btn-outline" data-close>${t('cancel')}</button>`,
      `<button class="btn ${confirmClass}" id="confirm-action-btn">${confirmText || t('confirm')}</button>`,
    ],
  });

  const modal = document.getElementById(id);
  modal.querySelector('#confirm-action-btn').addEventListener('click', () => {
    close(id);
    if (onConfirm) onConfirm();
  });
  modal.querySelector('[data-close]').addEventListener('click', () => close(id));

  openModal(id);
}
