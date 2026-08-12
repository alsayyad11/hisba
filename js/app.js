/* ============================================================
   HISBA — MAIN APP
   Router + Shell + Session management
   ============================================================ */
import { initI18n, initTheme, setLanguage, toggleTheme, t, getLanguage } from './utils.js?v=lang-v3';
import { getSession, getUser, getProfile, signOut, onAuthChange } from './services/auth.js';
import { toast } from './toast.js';

// Pages (lazy-loaded on first visit)
const pageLoaders = {
  dashboard:    () => import('./pages/dashboard.js?v=lang-v3'),
  transactions: () => import('./pages/transactions.js?v=lang-v3'),
  accounts:     () => import('./pages/accounts.js?v=lang-v3'),
  budgets:      () => import('./pages/budgets.js?v=lang-v3'),
  goals:        () => import('./pages/goals.js?v=lang-v3'),
  reports:      () => import('./pages/reports.js?v=lang-v3'),
  categories:   () => import('./pages/categories.js?v=lang-v3'),
  bills:        () => import('./pages/bills.js?v=lang-v3'),
  settings:     () => import('./pages/settings.js?v=lang-v4'),
  help:         () => import('./pages/help.js?v=lang-v3'),
};

let currentUser = null;
let currentProfile = null;
let currentPage = 'dashboard';
let pageCache = {};

async function boot() {
  initI18n();
  initTheme();

  showLoadingOverlay();

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = await getUser();
  currentProfile = await getProfile(currentUser.id);

  // Sync stored prefs
  if (currentProfile?.language) setLanguage(currentProfile.language, false);
  // Keep the refreshed light theme as the safe default; only restore an explicit light preference.
  if (currentProfile?.theme === 'light') import('./utils.js?v=lang-v3').then(u => u.setTheme('light', false));

  renderShell();
  hideLoadingOverlay();

  // Handle initial route from hash
  const hash = window.location.hash.slice(1) || 'dashboard';
  await navigateTo(hash.split('?')[0] || 'dashboard');

  // Listen for navigation events from pages
  window.addEventListener('navigate', e => {
    const { page, action } = e.detail || {};
    navigateTo(page, { action });
  });

  // Rebuild the shell and active page exactly once when the language changes.
  // Individual pages do not register their own listeners, which prevents stale
  // labels, duplicated renders, and race conditions between settings and shell.
  window.addEventListener('languagechange', async () => {
    const page = currentPage;
    renderShell();
    await navigateTo(page);
  });

  // Auth state changes
  onAuthChange((event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'login.html';
  });
}

function renderShell() {
  const name = currentProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.username || currentUser?.user_metadata?.user_name || currentUser?.email?.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();
  const avatarMarkup = currentProfile?.avatar_url
    ? `<img src="${currentProfile.avatar_url}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`
    : initial;

  document.body.innerHTML = `
    <div id="toast-container"></div>
    <div id="loading-overlay" class="loading-overlay hidden">
      <div class="loading-logo"><img class="hisba-logo-image" src="assets/hisba-logo-gold.png" alt="Hisba"><span class="hisba-logo-wordmark">حِسبة</span><small class="hisba-tagline">يا ترى فلوسي راحت فين؟</small></div>
      <div class="loading-spinner"></div>
    </div>

    <div class="app-shell">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <a class="sidebar-brand" href="#" data-nav="dashboard">
            <img class="sidebar-brand-logo" src="assets/hisba-logo-gold.png" alt="Hisba">
            <span class="sidebar-brand-name">حِسبة</span>
          </a>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          <span class="sidebar-section-label" data-i18n="nav_dashboard">${t('nav_dashboard')}</span>
          ${navItem('dashboard', t('nav_dashboard'), dashIcon())}

          <span class="sidebar-section-label" style="margin-top:var(--sp-lg);">${t('nav_finance')}</span>
          ${navItem('transactions', t('nav_transactions'), txIcon())}
          ${navItem('accounts',     t('nav_accounts'),     accIcon())}
          ${navItem('budgets',      t('nav_budgets'),      budgetIcon())}
          ${navItem('goals',        t('nav_goals'),        goalIcon())}

          <span class="sidebar-section-label" style="margin-top:var(--sp-lg);">${t('nav_insights')}</span>
          ${navItem('reports', t('nav_reports'), reportIcon())}
          ${navItem('bills', t('bills_title'), billsIcon())}

          <span class="sidebar-section-label" style="margin-top:var(--sp-lg);">${t('nav_manage')}</span>
          ${navItem('categories', t('nav_categories'), catIcon())}

          <span class="sidebar-section-label" style="margin-top:var(--sp-lg);">${t('nav_account_section')}</span>
          ${navItem('settings', t('nav_settings'), settingsIcon())}

          <span class="sidebar-section-label" style="margin-top:var(--sp-lg);">${t('nav_support')}</span>
          ${navItem('help', t('nav_help'), helpIcon())}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebar-user-menu">
            <div class="avatar">${avatarMarkup}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${name}</div>
              <div class="sidebar-user-email">${currentUser?.email || ''}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--clr-body-mid);flex-shrink:0;"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </div>
        </div>
      </aside>

      <!-- Sidebar overlay for mobile -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- Main -->
      <div class="main-wrapper">
        <!-- Topbar -->
        <header class="topbar">
          <button class="topbar-menu-toggle" id="menu-toggle" aria-label="${t('menu')}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="topbar-title" id="topbar-title">${t('nav_dashboard')}</div>
          <div class="topbar-actions">
            <span class="connection-status is-online" id="connection-status" role="status" aria-live="polite"><span class="connection-dot"></span><span class="connection-label">${navigator.onLine ? t('online') : t('offline')}</span></span>
            <button class="topbar-action-btn" id="btn-theme" title="${t('toggle_theme')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <button class="topbar-lang-btn" id="btn-lang">${getLanguage().startsWith('ar') ? 'EN' : 'عر'}</button>
            <div class="dropdown" id="user-dropdown">
              <button class="topbar-action-btn" id="user-menu-btn" aria-haspopup="true">
                <div class="avatar avatar-sm">${avatarMarkup}</div>
              </button>
              <div class="dropdown-menu hidden" id="user-menu">
                <div style="padding:var(--sp-sm) var(--sp-md) var(--sp-xs);">
                  <div class="text-caption font-semibold">${name}</div>
                  <div class="text-fine text-muted">${currentUser?.email || ''}</div>
                </div>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" data-nav="settings">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  ${t('nav_settings')}
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" id="btn-logout">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  ${t('logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Content -->
        <main class="content-area">
          <div class="page-content" id="page-content">
            <!-- Page renders here -->
          </div>
        </main>
      </div>
    </div>
  `;

  // Sidebar nav clicks
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.nav;
      navigateTo(page);
      closeSidebar();
    });
  });

  // Profile card in the sidebar opens account settings from any click target.
  const sidebarUser = document.getElementById('sidebar-user-menu');
  sidebarUser?.setAttribute('role', 'button');
  sidebarUser?.setAttribute('tabindex', '0');
  const openAccountSettings = e => {
    e?.preventDefault();
    navigateTo('settings');
    closeSidebar();
  };
  sidebarUser?.addEventListener('click', openAccountSettings);
  sidebarUser?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') openAccountSettings(e);
  });

  // Mobile sidebar toggle
  document.getElementById('menu-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Connectivity indicator: data is saved locally first and syncs when online.
  const updateConnectivityStatus = () => {
    const el = document.getElementById('connection-status');
    if (!el) return;
    const online = navigator.onLine;
    el.classList.toggle('is-online', online);
    el.classList.toggle('is-offline', !online);
    const label = el.querySelector('.connection-label');
    if (label) label.textContent = t(online ? 'online' : 'offline');
  };
  window.addEventListener('online', updateConnectivityStatus);
  window.addEventListener('offline', updateConnectivityStatus);
  updateConnectivityStatus();

  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);

  // Language toggle
  document.getElementById('btn-lang')?.addEventListener('click', () => {
    const next = getLanguage().startsWith('ar') ? 'en' : 'ar';
    setLanguage(next);
    document.getElementById('btn-lang').textContent = next === 'ar' ? 'EN' : 'عر';
  });

  // User dropdown
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenu    = document.getElementById('user-menu');
  userMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    userMenu?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => userMenu?.classList.add('hidden'));

  // Refresh avatars after a profile photo upload
  window.addEventListener('profileupdated', e => {
    const url = e.detail?.avatar_url;
    if (!url) return;
    document.querySelectorAll('.sidebar-user .avatar, #user-menu-btn .avatar').forEach(el => {
      el.innerHTML = `<img src="${url}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut().catch(() => {});
    window.location.href = 'login.html';
  });
}

async function navigateTo(page, opts = {}) {
  if (!pageLoaders[page]) page = 'dashboard';

  currentPage = page;
  window.location.hash = page;

  // Update active nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === page);
  });

  // Update topbar title
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = t(`nav_${page}`);

  // Show loading with a short exit/enter handoff so page changes feel continuous.
  const contentEl = document.getElementById('page-content');
  if (contentEl) {
    contentEl.classList.remove('page-enter', 'page-exit');
    contentEl.classList.add('page-exit');
  }
  if (contentEl) contentEl.innerHTML = `
    <div class="stats-grid">
      ${[1,2,3,4].map(() => `<div class="skeleton skeleton-card" style="height:110px;border-radius:var(--radius-md);"></div>`).join('')}
    </div>
    <div class="card"><div class="skeleton" style="height:300px;"></div></div>
  `;

  try {
    const mod = await pageLoaders[page]();
    const initFn = Object.values(mod).find(v => typeof v === 'function');
    if (initFn) await initFn(currentUser.id, { ...currentProfile, email: currentProfile?.email || currentUser?.email || '' }, opts);
    if (contentEl) {
      requestAnimationFrame(() => {
        contentEl.classList.remove('page-exit');
        contentEl.classList.add('page-enter');
      });
    }
  } catch (err) {
    console.error('Page load error:', err);
    if (contentEl) contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--clr-error)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p class="empty-state-title">${t('error')}</p>
        <p class="empty-state-desc">${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">${t('reload')}</button>
      </div>`;
  }
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar?.classList.contains('open');
  sidebar?.classList.toggle('open', !isOpen);
  overlay?.classList.toggle('visible', !isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

function showLoadingOverlay() {
  const body = document.body;
  body.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-logo"><img class="hisba-logo-image" src="assets/hisba-logo-gold.png" alt="Hisba"><span class="hisba-logo-wordmark">حِسبة</span><small class="hisba-tagline">يا ترى فلوسي راحت فين؟</small></div>
      <div class="loading-spinner"></div>
    </div>`;
}

function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

// ── Nav icon helpers ───────────────────────────────────────
function navItem(id, label, icon) {
  return `
    <button class="nav-item" data-nav="${id}">
      <svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${icon}</svg>
      <span class="nav-item-label">${label}</span>
    </button>`;
}

function dashIcon()    { return `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`; }
function txIcon()      { return `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`; }
function accIcon()     { return `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`; }
function budgetIcon()  { return `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`; }
function goalIcon()    { return `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`; }
function reportIcon()  { return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`; }
function helpIcon()    { return `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3"/>`; }
function settingsIcon(){ return `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`; }

// Boot!
boot().catch(err => {
  console.error('Boot failed:', err);
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;font-family:system-ui;"><div><h2>Something went wrong</h2><p>${err.message}</p><a href="login.html">Back to login</a></div></div>`;
});

function catIcon()   { return `<tag><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></tag>`.replace(/tag/g,''); }
function billsIcon() { return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`; }
