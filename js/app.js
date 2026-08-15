/* ============================================================
   HISBA — MAIN APP
   Router + Shell + Session management
   ============================================================ */
import { initI18n, initTheme, setLanguage, setTheme, t, getLanguage, escapeHTML } from './utils.js?v=currency-display-en-v2';
import { getSession, getUser, waitForAuthenticatedUser, getProfile, signOut, onAuthChange } from './services/auth.js?v=session-storage-boot-v2';
import { subscribeToUserDataChanges, unsubscribeFromUserDataChanges } from './services/data.js?v=supabase-local-v1';
import { toast } from './toast.js?v=notification-v4';

// Pages (lazy-loaded on first visit)
const pageLoaders = {
  dashboard:    () => import('./pages/dashboard.js?v=supabase-local-v1'),
  transactions: () => import('./pages/transactions.js?v=cloud-queue-unblock-v1'),
  accounts:     () => import('./pages/accounts.js?v=cloud-queue-unblock-v1'),
  budgets:      () => import('./pages/budgets.js?v=cloud-queue-unblock-v1'),
  goals:        () => import('./pages/goals.js?v=cloud-queue-unblock-v1'),
  reports:      () => import('./pages/reports.js?v=cloud-queue-unblock-v1'),
  categories:   () => import('./pages/categories.js?v=cloud-queue-unblock-v1'),
  bills:        () => import('./pages/bills.js?v=cloud-queue-unblock-v1'),
  settings:     () => import('./pages/settings.js?v=password-change-on-demand-v1'),
  help:         () => import('./pages/help.js?v=release-2.3.0'),
};

let currentUser = null;
let currentProfile = null;
let currentPage = 'dashboard';
let pageCache = {};
let financialRefreshTimer = null;
let stopRemoteDataSync = null;

function profileNameForLanguage(profile = {}, user = currentUser, language = getLanguage()) {
  const metadata = user?.user_metadata || {};
  const fallback = profile.full_name || metadata.full_name || metadata.username || metadata.user_name || user?.email?.split('@')[0] || 'User';
  return String(language === 'en' ? (profile.name_en || metadata.name_en || fallback) : (profile.name_ar || metadata.name_ar || fallback)).trim();
}

async function boot() {
  initI18n();
  initTheme();
  applyPrivacyState(localStorage.getItem('hisba_privacy') === '1');

  showLoadingOverlay();

  try {
    currentUser = await waitForAuthenticatedUser();
  } catch (error) {
    if (error?.code === 'AUTH_SESSION_NOT_READY') {
      window.location.replace('/login');
      return;
    }
    document.body.innerHTML = `<main class="auth-page"><section class="auth-card"><h1>${escapeHTML(t('dashboard_data_waiting'))}</h1><p>${escapeHTML(t('dashboard_data_waiting_sub'))}</p><button class="btn btn-primary" id="session-retry" type="button">${escapeHTML(t('reload'))}</button></section></main>`;
    document.getElementById('session-retry')?.addEventListener('click', () => window.location.reload());
    hideLoadingOverlay();
    return;
  }
  const remoteProfile = await getProfile(currentUser.id);
  // Auth metadata is the durable source for localized names on both new and legacy profiles.
  currentProfile = { ...(currentUser?.user_metadata || {}), ...(remoteProfile || {}) };

  // A language explicitly selected on this device takes precedence over a stale remote profile preference.
  const storedLanguage = localStorage.getItem('hisba_lang') || localStorage.getItem('Hisba_lang');
  if (!storedLanguage && currentProfile?.language) setLanguage(currentProfile.language, false);
  // Keep the refreshed light theme as the safe default; only restore an explicit light preference.
  if (currentProfile?.theme === 'light') setTheme('light', false);

  renderShell();
  hideLoadingOverlay();

  // Resolve the initial route from the clean pathname; legacy hashes are only a fallback.
  const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const legacyHash = window.location.hash.slice(1).split('?')[0];
  const initialPage = (cleanPath && cleanPath !== 'index.html' ? cleanPath : legacyHash) || 'dashboard';
  await navigateTo(pageLoaders[initialPage] ? initialPage : 'dashboard');

  // Listen for navigation events from pages
  window.addEventListener('navigate', e => {
    const { page, action, returnTo, returnAction } = e.detail || {};
    navigateTo(page, { action, returnTo, returnAction });
  });

  // Refresh any active financial view after a transaction mutation. Every view
  // recalculates from the same local-first cache, so balances, budgets and reports
  // remain consistent even before a remote sync finishes.
  const refreshFinancialView = detail => {
    if (detail?.userId && detail.userId !== currentUser?.id) return;
    window.clearTimeout(financialRefreshTimer);
    financialRefreshTimer = window.setTimeout(() => {
      // Let an active form finish its own save/render cycle rather than replacing it.
      if (document.querySelector('.modal-backdrop:not(.hidden), .modal-overlay:not(.hidden)')) return;
      navigateTo(currentPage);
    }, 180);
  };
  window.addEventListener('hisba:financial-data-changed', event => refreshFinancialView(event.detail));
  window.addEventListener('storage', event => {
    if (event.key !== 'hisba_financial_data_changed' || !event.newValue) return;
    try { refreshFinancialView(JSON.parse(event.newValue)); } catch {}
  });

  // Remote database changes (from another device) are handled exactly like a
  // local financial change: refresh the active view through the protected data
  // service rather than applying untrusted payload values to the page.
  stopRemoteDataSync = subscribeToUserDataChanges(currentUser.id, refreshFinancialView);
  const refreshWhenBack = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    refreshFinancialView({ userId: currentUser?.id, at: Date.now() });
  };
  window.addEventListener('focus', refreshWhenBack);
  window.addEventListener('online', refreshWhenBack);
  document.addEventListener('visibilitychange', refreshWhenBack);
  window.addEventListener('pagehide', () => {
    stopRemoteDataSync?.();
    unsubscribeFromUserDataChanges(currentUser?.id);
  }, { once: true });

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
    if (event === 'SIGNED_OUT') {
      stopRemoteDataSync?.();
      unsubscribeFromUserDataChanges(currentUser?.id);
      window.location.href = '/login';
    }
  });
}

function renderShell() {
  const isArabic = getLanguage().startsWith('ar');
  const brandName = isArabic ? 'حِسبة' : 'Hisba';
  document.title = brandName;
  const name = profileNameForLanguage(currentProfile || {}, currentUser, getLanguage());
  const initial = name.charAt(0).toUpperCase();
  const safeName = escapeHTML(name);
  const safeEmail = escapeHTML(currentUser?.email || '');
  const safeJobTitle = escapeHTML(currentProfile?.job_title || '');
  const sidebarCollapsed = localStorage.getItem('hisba-sidebar-collapsed') === 'true';
  const privacyEnabled = localStorage.getItem('hisba_privacy') === '1';
  const privacyLabel = t('privacy_mode');
  const collapseLabel = isArabic ? 'طي الشريط الجانبي' : 'Collapse sidebar';
  const expandLabel = isArabic ? 'فتح الشريط الجانبي' : 'Expand sidebar';
  const avatarMarkup = currentProfile?.avatar_url
    ? `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`
    : escapeHTML(initial);

  document.body.innerHTML = `
    <div id="toast-container"></div>
    <div id="loading-overlay" class="loading-overlay hidden">
      <div class="loading-logo"><img class="hisba-logo-image" src="/assets/hisba-logo-transparent-gold-final.png" alt="${brandName}"><span class="hisba-logo-wordmark">${brandName}</span></div>
      <div class="loading-spinner"></div>
    </div>

    <div class="app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <a class="sidebar-brand" href="#" data-nav="dashboard">
            <img class="sidebar-brand-logo" src="/assets/hisba-logo-transparent-gold-final.png" alt="${brandName}">
            <span class="sidebar-brand-name">${brandName}</span>
          </a>
          <button class="sidebar-collapse-toggle" id="sidebar-collapse-toggle" type="button" aria-label="${sidebarCollapsed ? expandLabel : collapseLabel}" aria-expanded="${!sidebarCollapsed}" title="${sidebarCollapsed ? expandLabel : collapseLabel}">
            <svg class="collapse-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${navItem('dashboard', t('nav_dashboard'), dashIcon())}

          <span class="sidebar-section-label">${t('nav_finance')}</span>
          ${navItem('transactions', t('nav_transactions'), txIcon())}
          ${navItem('accounts',     t('nav_accounts'),     accIcon())}
          ${navItem('budgets',      t('nav_budgets'),      budgetIcon())}
          ${navItem('goals',        t('nav_goals'),        goalIcon())}
          ${navItem('categories',   t('nav_categories'),   catIcon())}

          <span class="sidebar-section-label">${t('nav_insights')}</span>
          ${navItem('reports', t('nav_reports'), reportIcon())}
          ${navItem('bills', t('bills_title'), billsIcon())}

          <span class="sidebar-section-label">${t('nav_account_section')}</span>
          ${navItem('settings', t('nav_settings'), settingsIcon())}

          <span class="sidebar-section-label">${t('nav_support')}</span>
          ${navItem('help', t('nav_help'), helpIcon())}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebar-user-menu">
            <div class="avatar">${avatarMarkup}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${safeName}</div>
              ${safeJobTitle ? `<div class="sidebar-user-role">${safeJobTitle}</div>` : ''}
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
          <div class="topbar-tagline" id="topbar-tagline" aria-label="${t('brand_tagline')}">${t('brand_tagline')}</div>
          <div class="topbar-actions">
            <button class="topbar-action-btn" id="privacy-toggle" type="button" aria-label="${privacyLabel}" title="${privacyLabel}" aria-pressed="${privacyEnabled}">
              ${privacyEnabled ? privacyOffIcon() : privacyOnIcon()}
            </button>
            <div class="dropdown" id="user-dropdown">
              <button class="topbar-action-btn" id="user-menu-btn" aria-haspopup="true">
                <div class="avatar avatar-sm">${avatarMarkup}</div>
              </button>
              <div class="dropdown-menu hidden" id="user-menu">
                <div style="padding:var(--sp-sm) var(--sp-md) var(--sp-xs);">
                  <div class="text-caption font-semibold">${safeName}</div>
                  <div class="text-fine text-muted">${safeEmail}</div>
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

    <button class="mobile-quick-entry" id="mobile-quick-entry" type="button" aria-label="${t('quick_add')}" title="${t('quick_add')}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
    <nav class="mobile-bottom-nav" aria-label="${t('menu')}">
      ${mobileNavItem('dashboard', t('nav_dashboard'), dashIcon())}
      ${mobileNavItem('transactions', t('nav_transactions'), txIcon())}
      <button class="mobile-nav-add" id="mobile-nav-add" type="button" aria-label="${t('quick_add')}" title="${t('quick_add')}"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
      ${mobileNavItem('budgets', t('nav_budgets'), budgetIcon())}
      ${mobileNavItem('reports', t('nav_reports'), reportIcon())}
    </nav>
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

  // Sidebar controls: collapse on desktop, drawer toggle on smaller screens.
  document.getElementById('sidebar-collapse-toggle')?.addEventListener('click', toggleSidebarCollapse);
  document.getElementById('menu-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  syncSidebarControls();

  document.getElementById('privacy-toggle')?.addEventListener('click', togglePrivacyMode);
  const openQuickEntry = () => navigateTo('transactions', { action: 'add' });
  document.getElementById('mobile-quick-entry')?.addEventListener('click', openQuickEntry);
  document.getElementById('mobile-nav-add')?.addEventListener('click', openQuickEntry);

  // Connectivity, theme, and language are managed from Settings only.

  // User dropdown
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenu    = document.getElementById('user-menu');
  userMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    userMenu?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => userMenu?.classList.add('hidden'));

  // Keep profile identity current after name or photo updates from Settings.
  window.addEventListener('profileupdated', e => {
    const updates = e.detail || {};
    currentProfile = { ...(currentProfile || {}), ...updates };
    const name = profileNameForLanguage(currentProfile, currentUser, getLanguage());
    const safeName = escapeHTML(name);
    document.querySelectorAll('.sidebar-user-name, #user-menu .font-semibold').forEach(el => { el.textContent = name; });
    document.querySelectorAll('.sidebar-user .avatar, #user-menu-btn .avatar').forEach(el => {
      if (updates.avatar_url) {
        el.innerHTML = `<img src="${escapeHTML(updates.avatar_url)}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
      } else if (!currentProfile?.avatar_url) {
        el.textContent = safeName.charAt(0).toUpperCase();
      }
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut().catch(() => {});
    window.location.href = '/login';
  });
}

async function navigateTo(page, opts = {}) {
  if (!pageLoaders[page]) page = 'dashboard';

  currentPage = page;
  // Keep navigation URLs clean and extension-free.
  const cleanUrl = page === 'dashboard' ? '/dashboard' : `/${page}`;
  if (window.location.pathname !== cleanUrl || window.location.hash) {
    window.history.replaceState({ page }, '', cleanUrl);
  }

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
        <p class="empty-state-desc">${escapeHTML(err?.message || t('error'))}</p>
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

function toggleSidebarCollapse() {
  if (window.matchMedia('(max-width: 768px)').matches) {
    toggleSidebar();
    return;
  }
  const shell = document.querySelector('.app-shell');
  if (!shell) return;
  const collapsed = shell.classList.toggle('sidebar-collapsed');
  localStorage.setItem('hisba-sidebar-collapsed', String(collapsed));
  syncSidebarControls();
}

function syncSidebarControls() {
  const shell = document.querySelector('.app-shell');
  const button = document.getElementById('sidebar-collapse-toggle');
  if (!shell || !button) return;
  const collapsed = shell.classList.contains('sidebar-collapsed');
  const isArabic = getLanguage().startsWith('ar');
  const label = collapsed
    ? (isArabic ? 'فتح الشريط الجانبي' : 'Expand sidebar')
    : (isArabic ? 'طي الشريط الجانبي' : 'Collapse sidebar');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.classList.toggle('is-collapsed', collapsed);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

function applyPrivacyState(enabled) {
  document.body.classList.toggle('privacy-mask', Boolean(enabled));
  const button = document.getElementById('privacy-toggle');
  if (!button) return;
  const isEnabled = Boolean(enabled);
  button.setAttribute('aria-pressed', String(isEnabled));
  button.setAttribute('aria-label', isEnabled ? t('privacy_visible') : t('privacy_hide'));
  button.setAttribute('title', isEnabled ? t('privacy_visible') : t('privacy_hide'));
  button.classList.toggle('is-active', isEnabled);
  button.innerHTML = isEnabled ? privacyOffIcon() : privacyOnIcon();
}

function togglePrivacyMode() {
  const enabled = !document.body.classList.contains('privacy-mask');
  applyPrivacyState(enabled);
  localStorage.setItem('hisba_privacy', enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent('hisba:privacy-change', { detail: { enabled } }));
  toast(enabled ? t('privacy_hidden') : t('privacy_visible'), 'info');
}

window.addEventListener('hisba:toggle-privacy', togglePrivacyMode);

function showLoadingOverlay() {
  const body = document.body;
  const brandName = getLanguage().startsWith('ar') ? 'حِسبة' : 'Hisba';
  body.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-logo"><img class="hisba-logo-image" src="/assets/hisba-logo-transparent-gold-final.png" alt="${brandName}"><span class="hisba-logo-wordmark">${brandName}</span></div>
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

function mobileNavItem(id, label, icon) {
  return `<button class="mobile-nav-item" data-nav="${id}" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span></button>`;
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
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;font-family:system-ui;"><div><h2>Something went wrong</h2><p>${escapeHTML(err?.message || 'Unexpected error')}</p><a href="/login">Back to login</a></div></div>`;
});

function catIcon()   { return `<tag><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></tag>`.replace(/tag/g,''); }
function billsIcon() { return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`; }
function privacyOnIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`; }
function privacyOffIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18.4 18.4 0 0 1-3.1 4.1"/><path d="M6.6 6.6C3.7 8.6 2 12 2 12s3.5 8 10 8c1.3 0 2.5-.3 3.6-.8"/></svg>`; }
