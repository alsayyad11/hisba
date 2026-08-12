/* ============================================================
   HISBA — AUTH PAGE
   ============================================================ */
import { signIn, signUp, resetPassword } from '../services/auth.js';
import { t, validateEmail, validatePassword, validateRequired, setLanguage, getLanguage, toggleTheme, initTheme, initI18n } from '../utils.js?v=lang-v5';
import { toast } from '../toast.js';

let currentView = 'login';

export function initAuthPage() {
  initI18n();
  initTheme();
  renderAuthPage();
}

function renderAuthPage() {
  document.body.innerHTML = `
    <div id="toast-container"></div>
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-brand">
          <img class="auth-brand-logo" src="/assets/hisba-logo-transparent-gold-final.png" alt="حِسبة | Hisba">
          <div class="auth-brand-name"><span lang="ar">حِسبة</span><span class="brand-divider" aria-hidden="true">|</span><span lang="en">Hisba</span></div>
        </div>
        <div id="auth-card" class="auth-card animate-scale-in"></div>
        <div id="auth-footer" class="auth-footer"></div>
      </div>
      <div style="position:fixed;top:var(--sp-xl);right:var(--sp-xl);display:flex;gap:var(--sp-sm);">
        <button id="auth-lang-btn" class="topbar-lang-btn">عر</button>
        <button id="auth-theme-btn" class="topbar-action-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.getElementById('auth-lang-btn').addEventListener('click', () => {
    const nl = getLanguage().startsWith('ar') ? 'en' : 'ar-eg';
    setLanguage(nl);
    document.getElementById('auth-lang-btn').textContent = nl.startsWith('ar') ? 'EN' : 'ع';
    renderView();
  });
  document.getElementById('auth-theme-btn').addEventListener('click', toggleTheme);
  renderView();
}

function renderView() {
  const card = document.getElementById('auth-card');
  const footer = document.getElementById('auth-footer');
  switch (currentView) {
    case 'login':      renderLogin(card, footer); break;
    case 'signup':     renderSignup(card, footer); break;
    case 'reset':      renderReset(card, footer); break;
    case 'reset-sent': renderResetSent(card, footer); break;
  }
}

function renderLogin(card, footer) {
  card.innerHTML = `
    <div class="auth-card-title">${t('auth_welcome')}</div>
    <div class="auth-card-subtitle">${t('auth_welcome_sub')}</div>
    <form class="auth-form" id="login-form" novalidate>
      <div class="form-group">
        <label class="form-label">${t('email')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <input type="email" class="form-input" id="login-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-error hidden" id="login-email-err"></div>
      </div>
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <label class="form-label">${t('password')}</label>
          <a href="#" class="text-caption" id="forgot-link">${t('forgot_password')}</a>
        </div>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input type="password" class="form-input" id="login-password" placeholder="••••••••" autocomplete="current-password">
          <button type="button" class="input-icon-right" id="toggle-pw">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div class="form-error hidden" id="login-pw-err"></div>
      </div>
      <button type="submit" class="btn btn-primary w-full" id="login-btn">${t('login')}</button>
    </form>`;
  footer.innerHTML = `${t('no_account')} <a href="#" id="go-signup">${t('signup')}</a>`;
  document.getElementById('forgot-link').addEventListener('click', e => { e.preventDefault(); currentView = 'reset'; renderView(); });
  document.getElementById('go-signup').addEventListener('click', e => { e.preventDefault(); currentView = 'signup'; renderView(); });
  document.getElementById('toggle-pw').addEventListener('click', () => togglePw('login-password'));
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function renderSignup(card, footer) {
  card.innerHTML = `
    <div class="auth-card-title">${t('auth_signup_title')}</div>
    <div class="auth-card-subtitle">${t('auth_signup_sub')}</div>
    <form class="auth-form" id="signup-form" novalidate>
      <div class="form-group">
        <label class="form-label">${t('full_name')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input type="text" class="form-input" id="signup-name" placeholder="${t('full_name')}" autocomplete="name">
        </div>
        <div class="form-error hidden" id="signup-name-err"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('email')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <input type="email" class="form-input" id="signup-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-error hidden" id="signup-email-err"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('password')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input type="password" class="form-input" id="signup-password" placeholder="••••••••" autocomplete="new-password">
          <button type="button" class="input-icon-right" id="toggle-pw2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div class="form-error hidden" id="signup-pw-err"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('confirm_password')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input type="password" class="form-input" id="signup-confirm" placeholder="••••••••" autocomplete="new-password">
        </div>
        <div class="form-error hidden" id="signup-confirm-err"></div>
      </div>
      <button type="submit" class="btn btn-primary w-full" id="signup-btn">${t('signup')}</button>
    </form>`;
  footer.innerHTML = `${t('have_account')} <a href="#" id="go-login">${t('login')}</a>`;
  document.getElementById('go-login').addEventListener('click', e => { e.preventDefault(); currentView = 'login'; renderView(); });
  document.getElementById('toggle-pw2').addEventListener('click', () => togglePw('signup-password'));
  document.getElementById('signup-form').addEventListener('submit', handleSignup);
}

function renderReset(card, footer) {
  card.innerHTML = `
    <div class="auth-card-title">${t('auth_reset_title')}</div>
    <div class="auth-card-subtitle">${t('auth_reset_sub')}</div>
    <form class="auth-form" id="reset-form" novalidate>
      <div class="form-group">
        <label class="form-label">${t('email')}</label>
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <input type="email" class="form-input" id="reset-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-error hidden" id="reset-email-err"></div>
      </div>
      <button type="submit" class="btn btn-primary w-full" id="reset-btn">${t('send_reset')}</button>
    </form>`;
  footer.innerHTML = `<a href="#" id="go-login2">${t('back_to_login')}</a>`;
  document.getElementById('go-login2').addEventListener('click', e => { e.preventDefault(); currentView = 'login'; renderView(); });
  document.getElementById('reset-form').addEventListener('submit', handleReset);
}

function renderResetSent(card, footer) {
  const email = card.dataset.email || '';
  card.innerHTML = `
    <div style="text-align:center;padding:var(--sp-lg) 0;">
      <div style="width:56px;height:56px;background:var(--clr-success-bg);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-xl);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-success)" stroke-width="2" stroke-linecap="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
      </div>
      <div class="auth-card-title">${t('reset_sent')}</div>
      <div class="auth-card-subtitle" style="margin-top:var(--sp-sm);">${t('reset_sent_sub')}<br><strong>${email}</strong></div>
    </div>`;
  footer.innerHTML = `<a href="#" id="go-login3">${t('back_to_login')}</a>`;
  document.getElementById('go-login3').addEventListener('click', e => { e.preventDefault(); currentView = 'login'; renderView(); });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  let valid = true;
  if (!validateEmail(email)) { showErr('login-email-err', t('invalid_email')); valid = false; } else hideErr('login-email-err');
  if (!validatePassword(password)) { showErr('login-pw-err', t('password_min')); valid = false; } else hideErr('login-pw-err');
  if (!valid) return;
  const btn = document.getElementById('login-btn');
  setLoading(btn, t('logging_in'));
  try {
    await signIn(email, password);
    window.location.href = '/dashboard';
  } catch (err) {
    toast.error(t('error'), err.message || t('error'));
    setLoading(btn, t('login'), false);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  let valid = true;
  if (!validateRequired(name))     { showErr('signup-name-err', t('required')); valid = false; } else hideErr('signup-name-err');
  if (!validateEmail(email))       { showErr('signup-email-err', t('invalid_email')); valid = false; } else hideErr('signup-email-err');
  if (!validatePassword(password)) { showErr('signup-pw-err', t('password_min')); valid = false; } else hideErr('signup-pw-err');
  if (password !== confirm)        { showErr('signup-confirm-err', t('passwords_no_match')); valid = false; } else hideErr('signup-confirm-err');
  if (!valid) return;
  const btn = document.getElementById('signup-btn');
  setLoading(btn, t('creating_account'));
  try {
    await signUp(email, password, name);
    toast.success(t('success'), t('account_created_check_email'));
    setTimeout(() => { currentView = 'login'; renderView(); }, 1500);
  } catch (err) {
    toast.error(t('error'), err.message || t('error'));
    setLoading(btn, t('signup'), false);
  }
}

async function handleReset(e) {
  e.preventDefault();
  const email = document.getElementById('reset-email').value.trim();
  if (!validateEmail(email)) { showErr('reset-email-err', t('invalid_email')); return; }
  hideErr('reset-email-err');
  const btn = document.getElementById('reset-btn');
  setLoading(btn, t('sending'));
  try {
    await resetPassword(email);
    const card = document.getElementById('auth-card');
    card.dataset.email = email;
    currentView = 'reset-sent';
    renderView();
  } catch (err) {
    toast.error(t('error'), err.message || t('error'));
    setLoading(btn, t('send_reset'), false);
  }
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function togglePw(id) { const i = document.getElementById(id); if (i) i.type = i.type === 'password' ? 'text' : 'password'; }
function setLoading(btn, label, loading = true) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<div class="btn-spinner"></div><span>${label}</span>` : label;
}
