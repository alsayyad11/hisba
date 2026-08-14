/* ============================================================
   HISBA — SETTINGS PAGE
   ============================================================ */
import { t, setLanguage, getLanguage, getTheme, setTheme, validateRequired, validatePassword, renderIcon } from '../utils.js?v=release-2.2.1';
import { getProfile, updateProfile, updatePassword, uploadProfileAvatar, signOut } from '../services/auth.js';
import { showConfirm } from '../components/modal.js?v=release-2.2.1';
import { toast } from '../toast.js?v=release-2.2.1';

let userId, profile = {};

const CURRENCIES = [
  { code: 'USD', en: 'US Dollar ($)', ar: 'الدولار الأمريكي ($)' },
  { code: 'EUR', en: 'Euro (€)', ar: 'اليورو (€)' },
  { code: 'GBP', en: 'British Pound (£)', ar: 'الجنيه الإسترليني (£)' },
  { code: 'SAR', en: 'Saudi Riyal (ر.س)', ar: 'الريال السعودي (ر.س)' },
  { code: 'AED', en: 'UAE Dirham (د.إ)', ar: 'الدرهم الإماراتي (د.إ)' },
  { code: 'EGP', en: 'Egyptian Pound (E£)', ar: 'الجنيه المصري (E£)' },
  { code: 'KWD', en: 'Kuwaiti Dinar (KD)', ar: 'الدينار الكويتي (KD)' },
  { code: 'QAR', en: 'Qatari Riyal (QR)', ar: 'الريال القطري (QR)' },
  { code: 'JOD', en: 'Jordanian Dinar (JD)', ar: 'الدينار الأردني (JD)' },
  { code: 'MAD', en: 'Moroccan Dirham (DH)', ar: 'الدرهم المغربي (DH)' },
  { code: 'CAD', en: 'Canadian Dollar (C$)', ar: 'الدولار الكندي (C$)' },
  { code: 'AUD', en: 'Australian Dollar (A$)', ar: 'الدولار الأسترالي (A$)' },
  { code: 'JPY', en: 'Japanese Yen (¥)', ar: 'الين الياباني (¥)' },
  { code: 'TRY', en: 'Turkish Lira (₺)', ar: 'الليرة التركية (₺)' },
];

function currencyName(currency, language) {
  return language.startsWith('ar') ? currency.ar : currency.en;
}

export async function initSettings(uid, prof) {
  userId = uid;
  profile = prof || {};
  renderPage();
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}

function safeAvatarUrl(value = '') {
  try { const url = new URL(value, window.location.origin); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
}

function renderPage() {
  const el = document.getElementById('page-content');
  if (!el) return;
  const currentLang = getLanguage();
  const isArabic = currentLang.startsWith('ar');
  const isFusha = currentLang === 'ar-fusha';
  const safeName = escapeHTML(profile.full_name || '');
  const safeEmail = escapeHTML(profile.email || '');
  const safeJobTitle = escapeHTML(profile.job_title || '');
  const safeAvatar = safeAvatarUrl(profile.avatar_url || '');
  const label = (en, arEg, arFusha = arEg) => isFusha ? arFusha : (isArabic ? arEg : en);

  el.innerHTML = `
    <div class="page-header settings-page-header">
      <div>
        <div class="settings-eyebrow">${label('Account control center', 'مركز التحكم في الحساب')}</div>
        <h1 class="page-title">${t('settings_title')}</h1>
        <p class="page-subtitle">${t('settings_subtitle')}</p>
      </div>
    </div>
    <main class="settings-shell" aria-label="${t('settings_title')}">
      <section class="settings-card settings-section" id="profile">
        <div class="settings-section-head"><div class="settings-section-icon">${renderIcon('user', 18)}</div><div><h2>${t('profile_settings')}</h2><p>${label('Keep your identity and sign-in details up to date.', 'خلي بياناتك الأساسية محدثة عشان حسابك يفضل واضح وآمن.', 'حافظ على تحديث بيانات هويتك وتسجيل دخولك.')}</p></div></div>
        <div class="profile-identity-row"><div class="profile-avatar-wrap"><div class="avatar avatar-lg profile-avatar" id="profile-avatar-preview" aria-label="${label('Profile photo', 'صورة الحساب')}">${safeAvatar ? '' : escapeHTML((profile.full_name || 'U').charAt(0).toUpperCase())}</div><label class="profile-avatar-upload" for="profile-avatar-input" title="${label('Choose a photo', 'اختار صورة', 'اختر صورة')}" aria-label="${label('Choose a photo', 'اختار صورة', 'اختر صورة')}">${renderIcon('edit', 13)}</label><input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/webp" hidden></div><div class="profile-identity-copy"><strong>${safeName || label('Your name', 'اسمك')}</strong>${safeJobTitle ? `<span class="profile-job-title">${safeJobTitle}</span>` : ''}<small>${label('PNG, JPG or WebP. A clear square photo works best.', 'استخدم صورة مربعة وواضحة بصيغة PNG أو JPG أو WebP.')}</small></div></div>
        <div class="settings-form single-column-form"><div class="form-group"><label class="form-label" for="s-name">${t('profile_name')}</label><input type="text" class="form-input" id="s-name" value="${safeName}" autocomplete="name"></div><div class="form-group"><label class="form-label" for="s-job-title">${t('profile_job_title')}</label><input type="text" class="form-input" id="s-job-title" value="${safeJobTitle}" autocomplete="organization-title" placeholder="${t('profile_job_title_optional')}"></div><div class="form-group"><label class="form-label" for="s-email">${t('profile_email')}</label><input type="email" class="form-input" id="s-email" value="${safeEmail}" readonly aria-describedby="email-hint"><small class="field-hint" id="email-hint">${label('Your sign-in email is managed by your account provider.', 'الإيميل ده مرتبط بتسجيل الدخول ومش بيتغير من هنا.', 'يرتبط هذا البريد الإلكتروني بتسجيل الدخول ولا يمكن تغييره من هنا.')}</small></div><button class="btn btn-primary settings-action" id="btn-save-profile">${t('save_changes')}</button></div>
        <div class="settings-subsection"><div class="settings-subsection-head"><h3>${t('change_password')}</h3><p>${label('Choose a strong password that you do not reuse elsewhere.', 'اختار كلمة سر قوية وماتستخدمهاش في مكان تاني.', 'اختر كلمة مرور قوية لا تستخدمها في أي مكان آخر.')}</p></div><div class="settings-form single-column-form"><div class="form-group"><label class="form-label" for="s-new-pw">${t('new_password')}</label><input type="password" class="form-input" id="s-new-pw" autocomplete="new-password"><div class="form-error hidden" id="s-pw-err"></div></div><div class="form-group"><label class="form-label" for="s-confirm-pw">${t('confirm_password')}</label><input type="password" class="form-input" id="s-confirm-pw" autocomplete="new-password"><div class="form-error hidden" id="s-confirm-err"></div></div><button class="btn btn-outline settings-action" id="btn-change-pw">${t('change_password')}</button></div></div>
      </section>
      <section class="settings-card settings-section" id="language"><div class="settings-section-head"><div class="settings-section-icon">${renderIcon('book', 18)}</div><div><h2>${t('language_region')}</h2><p>${label('Choose the language that feels most natural to you.', 'اختار اللغة الأقرب لطريقتك في الاستخدام.', 'اختر اللغة الأقرب إلى أسلوب استخدامك.')}</p></div></div><div class="language-list" role="radiogroup" aria-label="${t('language_label')}">${['en','ar-eg','ar-fusha'].map(lang => `<label class="language-choice ${currentLang === lang ? 'is-selected' : ''}"><input type="radio" name="lang" value="${lang}" ${currentLang === lang ? 'checked' : ''} class="lang-radio"><span class="language-choice-copy"><strong>${lang === 'ar-eg' ? t('lang_ar_eg') : lang === 'ar-fusha' ? t('lang_ar_fusha') : t('lang_en')}</strong><small>${isArabic ? (lang === 'en' ? 'الإنجليزية' : lang === 'ar-eg' ? 'عامية مصرية' : 'صياغة عربية رسمية') : (lang === 'en' ? 'English' : lang === 'ar-eg' ? 'Egyptian Arabic' : 'Standard Arabic')}</small></span><span class="language-choice-mark">${renderIcon('check', 16)}</span></label>`).join('')}</div></section>
      <section class="settings-card settings-section" id="appearance"><div class="settings-section-head"><div class="settings-section-icon">${renderIcon('settings', 18)}</div><div><h2>${label('Appearance', 'المظهر')}</h2><p>${label('Choose how Hisba looks on your device.', 'اختار شكل حِسبة على جهازك.', 'اختر مظهر حِسبة على جهازك.')}</p></div></div><div class="language-list theme-list" role="radiogroup" aria-label="${label('Appearance', 'المظهر')}">${['light','dark'].map(theme => `<label class="language-choice ${getTheme() === theme ? 'is-selected' : ''}"><input type="radio" name="theme" value="${theme}" ${getTheme() === theme ? 'checked' : ''} class="theme-radio"><span class="language-choice-copy"><strong>${theme === 'dark' ? label('Dark mode', 'الوضع الداكن', 'الوضع الداكن') : label('Light mode', 'الوضع الفاتح', 'الوضع الفاتح')}</strong><small>${theme === 'dark' ? label('A darker palette for low-light use.', 'ألوان أغمق للاستخدام في الإضاءة الهادية.', 'ألوان داكنة للاستخدام في الإضاءة المنخفضة.') : label('A bright, clear interface for daytime.', 'واجهة واضحة ومريحة للاستخدام النهاري.', 'واجهة واضحة ومريحة للاستخدام النهاري.')}</small></span><span class="language-choice-mark">${renderIcon(theme === 'dark' ? 'moon' : 'sun', 16)}</span></label>`).join('')}</div></section>
      <section class="settings-card settings-section" id="currency"><div class="settings-section-head"><div class="settings-section-icon">${renderIcon('wallet', 18)}</div><div><h2>${t('currency_settings')}</h2><p>${label('This currency is used across budgets, transactions, and reports.', 'العملة دي هتظهر في الميزانيات والمعاملات والتقارير.', 'تُستخدم هذه العملة في الميزانيات والمعاملات والتقارير.')}</p></div></div><div class="settings-form single-column-form compact-form"><div class="form-group"><label class="form-label" for="s-currency">${t('currency_label')}</label><select class="form-select" id="s-currency">${CURRENCIES.map(c => `<option value="${c.code}" ${(profile.currency || 'USD') === c.code ? 'selected' : ''}>${currencyName(c, currentLang)}</option>`).join('')}</select></div><button class="btn btn-primary settings-action" id="btn-save-currency">${t('save_changes')}</button></div></section>
      <section class="settings-card settings-section settings-danger" id="danger"><div class="settings-section-head"><div class="settings-section-icon is-danger">${renderIcon('alert-triangle', 18)}</div><div><h2>${t('danger_zone')}</h2><p>${label('These actions cannot be undone.', 'الإجراءات دي نهائية ومش ممكن التراجع عنها.', 'هذه الإجراءات نهائية ولا يمكن التراجع عنها.')}</p></div></div><div class="danger-action-row"><div><strong>${t('delete_account_action')}</strong><p>${t('delete_account_warning')}</p></div><button class="btn btn-danger" id="btn-delete-account">${t('delete_account_action')}</button></div></section>
    </main>
  `;

  const initialAvatar = document.getElementById('profile-avatar-preview');
  let pendingAvatar = null;
  try { pendingAvatar = JSON.parse(localStorage.getItem(`hisba_pending_avatar_${userId}`) || 'null')?.dataUrl || null; } catch {}
  const displayedAvatar = pendingAvatar || safeAvatar;
  if (initialAvatar && displayedAvatar) { initialAvatar.style.backgroundImage = `url("${displayedAvatar}")`; initialAvatar.style.backgroundSize = 'cover'; initialAvatar.style.backgroundPosition = 'center'; initialAvatar.style.color = 'transparent'; }

  document.getElementById('profile-avatar-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) {
      preview.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.style.color = 'transparent';
      preview.textContent = '';
    }
    const language = getLanguage();
    const isArabicLocale = language.startsWith('ar');
    const isFushaLocale = language === 'ar-fusha';
    const localized = (english, egyptian, fusha) => isFushaLocale ? fusha : (isArabicLocale ? egyptian : english);
    try {
      const avatarUrl = await uploadProfileAvatar(userId, file);
      profile.avatar_url = avatarUrl;
      window.dispatchEvent(new CustomEvent('profileupdated', { detail: { avatar_url: avatarUrl } }));
      toast.success(localized('Photo saved', 'اتحفظت الصورة', 'تم حفظ الصورة'), localized('Your profile photo was updated.', 'صورة البروفايل اتحدثت على حسابك.', 'تم تحديث صورة ملفك الشخصي.'));
    } catch (err) {
      if (err?.localUrl) {
        if (preview) {
          preview.style.backgroundImage = `url("${err.localUrl}")`;
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
        }
        profile.avatar_url = err.localUrl;
        window.dispatchEvent(new CustomEvent('profileupdated', { detail: { avatar_url: err.localUrl } }));
        toast.warning(
          err.code === 'OFFLINE'
            ? localized('Saved on this device', 'اتحفظت على الجهاز', 'تم الحفظ على هذا الجهاز')
            : localized('Saved locally for now', 'اتحفظت مؤقتاً', 'تم الحفظ محليًا مؤقتًا'),
          localized('It will sync when you are back online.', 'الصورة هتتزامن أول ما الإنترنت يرجع.', 'ستتم مزامنتها عند عودة الاتصال بالإنترنت.'),
          7000
        );
      } else {
        toast.error(localized('Photo was not saved', 'الصورة ما اتحفظتش', 'تعذر حفظ الصورة'), err?.message || localized('The photo could not be saved.', 'تعذر حفظ الصورة.', 'تعذر حفظ الصورة.'));
      }
    }
  });

  document.getElementById('btn-save-profile')?.addEventListener('click', async () => { const name = document.getElementById('s-name').value.trim(); const jobTitle = document.getElementById('s-job-title')?.value.trim() || ''; if (!name) return; const btn = document.getElementById('btn-save-profile'); btn.disabled = true; btn.textContent = t('saving'); try { await updateProfile(userId, { full_name: name, job_title: jobTitle || null }); profile.full_name = name; profile.job_title = jobTitle; toast.success(t('success'), t('saved')); renderPage(); } catch (err) { toast.error(t('error'), err.message); } btn.disabled = false; btn.textContent = t('save_changes'); });

  document.getElementById('btn-change-pw')?.addEventListener('click', async () => { const newPw = document.getElementById('s-new-pw').value; const confirm = document.getElementById('s-confirm-pw').value; let valid = true; if (!validatePassword(newPw)) { showErr('s-pw-err', t('password_min')); valid = false; } else hideErr('s-pw-err'); if (newPw !== confirm) { showErr('s-confirm-err', t('passwords_no_match')); valid = false; } else hideErr('s-confirm-err'); if (!valid) return; const btn = document.getElementById('btn-change-pw'); btn.disabled = true; try { await updatePassword(newPw); toast.success(t('success'), t('saved')); document.getElementById('s-new-pw').value = ''; document.getElementById('s-confirm-pw').value = ''; } catch (err) { toast.error(t('error'), err.message); } btn.disabled = false; });

  document.querySelectorAll('.lang-radio').forEach(radio => radio.addEventListener('change', async () => {
    const nextLanguage = radio.value;
    if (!nextLanguage || nextLanguage === getLanguage()) return;
    setLanguage(nextLanguage);
    profile.language = nextLanguage;
    try {
      await updateProfile(userId, { language: nextLanguage });
    } catch (err) {
      // The local preference remains active for offline-first use.
      console.warn('Language preference will sync later:', err);
    }
  }));
  document.querySelectorAll('.theme-radio').forEach(radio => radio.addEventListener('change', () => {
    setTheme(radio.value);
    document.querySelectorAll('.theme-radio').forEach(input => input.closest('.language-choice')?.classList.toggle('is-selected', input.checked));
  }));
  document.getElementById('btn-save-currency')?.addEventListener('click', async () => { const currency = document.getElementById('s-currency').value; try { await updateProfile(userId, { currency }); profile.currency = currency; toast.success(t('success'), t('saved')); } catch (err) { toast.error(t('error'), err.message); } });
  document.getElementById('btn-delete-account')?.addEventListener('click', () => { showConfirm({ title: t('delete_account_action'), message: t('delete_account_warning'), confirmText: t('delete'), confirmClass: 'btn-danger', onConfirm: async () => { try { await signOut(); window.location.href = 'login.html'; } catch (err) { toast.error(t('error'), err.message); } } }); });
}

function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideErr(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
