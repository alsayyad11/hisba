/* ============================================================
   HISBA — AUTH SERVICE
   ============================================================ */
import { supabase } from '../config.js';

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;

  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName,
      email,
      currency: 'USD',
      language: 'en',
      theme: 'light',
    }, { onConflict: 'id' });
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Supabase manages the persisted session itself; never duplicate access tokens in app storage.
  try { localStorage.setItem('hisba_cached_user', JSON.stringify(data.user)); } catch {}
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  try { localStorage.removeItem('hisba_cached_session'); localStorage.removeItem('hisba_cached_user'); localStorage.removeItem('hisba_cached_profile'); } catch {}
  if (error) throw error;
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  } catch {
    return null;
  }
}

export async function getUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (user) {
      try { localStorage.setItem('hisba_cached_user', JSON.stringify(user)); } catch {}
    }
    return user || null;
  } catch {
    return null;
  }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html#settings',
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error && data) {
      const resolved = await resolveProfileAvatar(data);
      localStorage.setItem(`hisba_cached_profile_${userId}`, JSON.stringify(resolved));
      return resolved;
    }
  } catch {}
  try { return JSON.parse(localStorage.getItem(`hisba_cached_profile_${userId}`) || 'null'); } catch { return null; }
}

export async function updateProfile(userId, updates) {
  const current = (() => { try { return JSON.parse(localStorage.getItem(`hisba_cached_profile_${userId}`) || '{}'); } catch { return {}; } })();
  try {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) throw error;
    const resolved = await resolveProfileAvatar(data);
    localStorage.setItem(`hisba_cached_profile_${userId}`, JSON.stringify(resolved)); return resolved;
  } catch {
    const local = { ...current, id: userId, ...updates };
    localStorage.setItem(`hisba_cached_profile_${userId}`, JSON.stringify(local));
    Object.defineProperty(local, '__offline', { value: true, enumerable: false });
    return local;
  }
}

export async function uploadProfileAvatar(userId, file) {
  if (!file || !userId) throw new Error('No image selected');
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) throw new Error('Please select a JPG, PNG, or WebP image');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MB');

  const normalized = await normalizeAvatar(file);
  const path = `${userId}/avatar-${Date.now()}.webp`;
  if (!navigator.onLine) throw await createPendingAvatarError(userId, normalized, 'OFFLINE');

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, normalized, {
    upsert: false,
    contentType: 'image/webp',
    cacheControl: '3600',
  });
  if (uploadError) throw await createPendingAvatarError(userId, normalized, uploadError.message || 'STORAGE_UPLOAD_FAILED', uploadError);

  const { data: signedData, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signedError || !signedData?.signedUrl) throw new Error('Supabase did not return a signed avatar URL');
  const avatarUrl = `${signedData.signedUrl}&v=${Date.now()}`;

  // Store only the private object path in the profile row, never a public bucket URL.
  const savedProfile = await updateProfile(userId, { avatar_url: path });
  if (savedProfile?.__offline) throw await createPendingAvatarError(userId, normalized, 'PROFILE_UPDATE_FAILED');
  localStorage.removeItem(`hisba_pending_avatar_${userId}`);
  return avatarUrl;
}

async function resolveProfileAvatar(profile) {
  if (!profile?.avatar_url || profile.avatar_url.startsWith('data:') || profile.avatar_url.startsWith('blob:')) return profile;
  const value = profile.avatar_url;
  const marker = '/storage/v1/object/public/avatars/';
  const path = value.includes(marker) ? value.split(marker)[1].split('?')[0] : value;
  if (/^[^/]+\/avatar-[^/]+\.webp$/.test(path)) {
    try {
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 30);
      if (!error && data?.signedUrl) return { ...profile, avatar_url: `${data.signedUrl}&v=${Date.now()}` };
    } catch {}
  }
  return profile;
}

async function createPendingAvatarError(userId, blob, reason, cause) {
  const localUrl = await blobToDataUrl(blob);
  localStorage.setItem(`hisba_pending_avatar_${userId}`, JSON.stringify({ dataUrl: localUrl, createdAt: Date.now() }));
  const error = new Error(reason === 'OFFLINE'
    ? 'You are offline. The photo was saved on this device.'
    : 'The photo was saved on this device, but could not sync to the account.');
  error.code = reason;
  error.localUrl = localUrl;
  error.cause = cause;
  return error;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not cache the image locally'));
    reader.readAsDataURL(blob);
  });
}

async function normalizeAvatar(file) {
  const bitmap = await createImageBitmap(file);
  const max = 512;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not process image')), 'image/webp', 0.86));
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
