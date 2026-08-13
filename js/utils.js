/* ============================================================
   HISBA — UTILITIES
   i18n, theme, format, validation
   ============================================================ */

// ── i18n ───────────────────────────────────────────────────
import { en } from '../locales/en.js?v=profile-v2';
import { ar } from '../locales/ar.js?v=profile-v2';
import { arEg } from '../locales/ar-eg.js?v=profile-v2';
import { arFusha } from '../locales/ar-fusha.js?v=tagline-fusha-v1';

const locales = { en, ar: arEg, 'ar-eg': arEg, 'ar-fusha': arFusha };
let currentLocale = 'ar-eg';

export function initI18n() {
  const saved = localStorage.getItem('Hisba_lang') || 'ar-eg';
  setLanguage(saved, false);
}

export function setLanguage(lang, save = true) {
  const normalizedLang = lang === 'ar' ? 'ar-eg' : lang;
  currentLocale = locales[normalizedLang] ? normalizedLang : 'en';
  const html = document.documentElement;
  html.lang = currentLocale;
  html.dir  = currentLocale.startsWith('ar') ? 'rtl' : 'ltr';
  document.title = currentLocale.startsWith('ar') ? 'حِسبة' : 'Hisba';
  if (save) localStorage.setItem('Hisba_lang', currentLocale);

  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const val = t(key);
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  });

  // Update lang button
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = currentLocale.startsWith('ar') ? 'EN' : 'ع';

  // Dispatch event for pages to react
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLocale } }));
}

export function t(key, vars = {}) {
  const locale = locales[currentLocale] || en;
  // Never fall back to another language: a missing key must remain visible as its key, not mixed copy.
  let str = locale[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return str;
}

export function getLanguage() { return currentLocale; }
export function isRTL() { return currentLocale.startsWith('ar'); }

// ── Theme ──────────────────────────────────────────────────
let currentTheme = 'light';

export function initTheme() {
  const saved = localStorage.getItem('Hisba_theme');
  setTheme(saved === 'dark' ? 'dark' : 'light', false);
}

export function setTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('Hisba_theme', theme);

  // Update theme toggle icon
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.innerHTML = theme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

export function toggleTheme() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function getTheme() { return currentTheme; }

// ── Format ─────────────────────────────────────────────────
export function formatCurrency(amount, currency = 'USD', locale = null) {
  const loc = locale || (getLanguage().startsWith('ar') ? 'ar-EG' : 'en-US');
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatAmount(amount, currency = 'USD') {
  return formatCurrency(Math.abs(amount), currency);
}

export function formatNumber(num, locale = null) {
  const loc = locale || (getLanguage().startsWith('ar') ? 'ar-EG' : 'en-US');
  return new Intl.NumberFormat(loc).format(num);
}

export function formatDate(dateStr, style = 'medium') {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const loc = getLanguage().startsWith('ar') ? 'ar-EG' : 'en-US';
  const options = {
    short:  { month: 'short', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long:   { year: 'numeric', month: 'long',  day: 'numeric' },
    full:   { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
  };
  return new Intl.DateTimeFormat(loc, options[style] || options.medium).format(date);
}

export function formatRelativeDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - date) / 86400000);

  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7)  return formatDate(dateStr, 'short');
  return formatDate(dateStr, 'medium');
}

export function formatPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function getCurrentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0);
  return {
    start,
    end: `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  };
}

export function getLast30Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

export function getDateRange(preset) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s };
    }
    case 'this_week': {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      return { start: d.toISOString().split('T')[0], end: today };
    }
    case 'last_week': {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'this_month': {
      const { year, month } = getCurrentMonth();
      return getMonthRange(year, month);
    }
    case 'last_month': {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1);
    }
    case 'last_3_months': {
      const s = new Date(now); s.setMonth(s.getMonth() - 3);
      return { start: s.toISOString().split('T')[0], end: today };
    }
    case 'this_year': {
      return { start: `${now.getFullYear()}-01-01`, end: today };
    }
    default:
      return getMonthRange(now.getFullYear(), now.getMonth() + 1);
  }
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Validation ─────────────────────────────────────────────
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(pwd) {
  return pwd && pwd.length >= 6;
}

export function validateAmount(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n > 0;
}

export function validateRequired(val) {
  return val !== null && val !== undefined && String(val).trim() !== '';
}

// ── Color helpers ──────────────────────────────────────────
export const CATEGORY_COLORS = [
  '#ff4d8b', '#1a3a3a', '#b8a4ed', '#ffb084',
  '#e8b94a', '#a4d4c5', '#ff6b5a', '#22c55e',
  '#0a0a0a', '#6a6a6a', '#3a3a3a', '#ef4444',
];

export const ACCOUNT_COLORS = [
  '#0a0a0a', '#1a3a3a', '#a4d4c5', '#b8a4ed',
  '#ffb084', '#e8b94a', '#ff6b5a', '#6a6a6a',
];

/* ── Unified SVG icon system (replaces emoji UI symbols) ───── */
const ICON_PATHS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  car: '<path d="m5 17-1.2-5.2A2 2 0 0 1 5.75 9h12.5a2 2 0 0 1 1.95 2.8L19 17"/><path d="M4 17h16v3H4z"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>',
  plane: '<path d="m3 11 18-6-6 18-3-8-9-4Z"/><path d="m12 15 4-4"/>',
  school: '<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12v5c2 2 8 2 10 0v-5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5h4M11 18.5h2"/>',
  laptop: '<rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 20h20"/>',
  shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10c0 2 3 2 4 0 1 2 4 2 5 0 1 2 4 2 5 0 1 2 4 2 4 0"/><path d="M9 20v-5h6v5"/>',
  cart: '<circle cx="9" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/><path d="M3 4h2l2.4 11.3a2 2 0 0 0 2 1.7h8.7a2 2 0 0 0 1.9-1.5L22 8H6"/>',
  food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c3 1 3 5 0 6"/>',
  health: '<path d="M12 21S4 16 4 10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11Z"/><path d="M9 11h6M12 8v6"/>',
  entertainment: '<path d="m5 4 14 4-2 12-14-4Z"/><path d="m9 9 6 2-5 3Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
  wallet: '<path d="M4 6h16v14H4z"/><path d="M4 6V4h13M16 13h4"/><circle cx="16" cy="13" r=".5" fill="currentColor"/>',
  chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 10h2a3 3 0 0 1 0 6h-2M7 4c-1 1 1 2 0 3M11 4c-1 1 1 2 0 3"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8H8a2 2 0 1 1 2-2c2 0 2 2 2 2ZM12 8h4a2 2 0 1 0-2-2c-2 0-2 2-2 2Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  package: '<path d="m4 7 8-4 8 4v10l-8 4-8-4Z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.1-5.5 7-5.5s6.2 2 7 5.5"/>',
  'alert-triangle': '<path d="m12 3 9 17H3Z"/><path d="M12 9v4M12 17h.01"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
};
const ICON_ALIASES = {'🏠':'home','🚗':'car','✈️':'plane','🎓':'school','💍':'star','📱':'phone','💻':'laptop','🏖️':'plane','🛒':'cart','💊':'health','🎉':'star','💰':'wallet','🍔':'food','🚌':'car','🛍️':'shop','🎬':'entertainment','⚡':'bolt','📚':'book','👔':'shop','💅':'star','🐾':'goal','🎁':'gift','🛡️':'goal','🌐':'chart','☕':'coffee','⚽':'goal','🍽️':'food','📈':'chart','🏢':'home','💵':'wallet','📦':'package','🎯':'target','🎪':'star','🎭':'entertainment','🎮':'entertainment','🎨':'star','🏋️':'goal','🧘':'goal','🎵':'entertainment','📷':'phone','🛻':'car','⛽':'bolt','🔧':'bolt','🏥':'health','🎈':'star'};
export function icon(name = 'package', size = 20, className = 'hisba-icon') {
  const key = ICON_ALIASES[name] || name;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[key] || ICON_PATHS.package}</svg>`;
}
export function renderIcon(value, size = 20) { return icon(ICON_ALIASES[value] || value || 'package', size); }

export const GOAL_ICONS = ['home', 'car', 'plane', 'school', 'star', 'phone', 'laptop', 'cart', 'health', 'target', 'wallet', 'chart'];
export const CATEGORY_ICONS = {
  food: 'food', transport: 'car', shopping: 'shop', health: 'health',
  entertainment: 'entertainment', utilities: 'bolt', rent: 'home', salary: 'wallet',
  freelance: 'laptop', investment: 'chart', education: 'book', travel: 'plane',
  clothing: 'shop', sports: 'goal', restaurant: 'food', coffee: 'coffee',
  groceries: 'cart', insurance: 'goal', phone: 'phone', internet: 'chart',
  beauty: 'star', pets: 'goal', gifts: 'gift', other: 'package',
};
