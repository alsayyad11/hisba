/* ============================================================
   HISBA — SUPABASE CONFIG
   Edit SUPABASE_URL and SUPABASE_ANON_KEY before deploying.
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// These are injected from vercel environment variables at build time
// For local dev, edit these directly (do not commit with real keys)
const SUPABASE_URL = window.HISBA_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = window.HISBA_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const REQUEST_TIMEOUT_MS = 8_000;

// Mobile browsers can leave a fetch pending indefinitely after a network handoff
// (for example, switching between Wi‑Fi and cellular data). A bounded request
// lets the offline layer return cached data or a clear retry state instead.
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abortFromUpstream();
    else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
  }
  const timer = globalThis.setTimeout(() => {
    const error = new Error('HISBA_NETWORK_TIMEOUT');
    error.name = 'TimeoutError';
    controller.abort(error);
  }, REQUEST_TIMEOUT_MS);

  return fetch(url, { ...options, cache: 'no-store', signal: controller.signal }).finally(() => {
    globalThis.clearTimeout(timer);
    upstreamSignal?.removeEventListener?.('abort', abortFromUpstream);
  });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Financial data must always come from Supabase after a session is restored.
  // This avoids a mobile browser reusing a stale REST response after switching
  // devices, while the offline layer remains responsible for deliberate local
  // offline caching.
  global: {
    fetch: fetchWithTimeout,
  },
});

export function isConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}
