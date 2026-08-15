/* HISBA — Offline-first local store and sync queue */
const PREFIX = 'hisba_offline_v1_';
const TABLES = ['accounts','categories','transactions','budgets','goals','bills','tags','month_closures'];

function key(userId) { return `${PREFIX}${userId}`; }
function empty() { return { tables: Object.fromEntries(TABLES.map(t => [t, []])), hydratedTables: {}, queue: [], sync: { lastError: null, lastAttemptAt: null, lastSuccessAt: null }, updatedAt: Date.now() }; }
function read(userId) {
  try { return { ...empty(), ...(JSON.parse(localStorage.getItem(key(userId)) || '{}')) }; }
  catch { return empty(); }
}
function write(userId, state) {
  state.updatedAt = Date.now();
  localStorage.setItem(key(userId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('offline-store-changed', { detail: { userId } }));
  window.dispatchEvent(new CustomEvent('hisba:sync-status-changed', { detail: { userId } }));
  return state;
}
function id() { return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function now() { return new Date().toISOString(); }

export function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
export function getTable(userId, table) { return read(userId).tables[table] || []; }
export function replaceTable(userId, table, rows) { const s = read(userId); s.tables[table] = rows || []; write(userId, s); return s.tables[table]; }
export function upsertLocal(userId, table, row) { const s = read(userId); const rows = s.tables[table] || []; const i = rows.findIndex(x => x.id === row.id); if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row); s.tables[table] = rows; write(userId, s); return rows.find(x => x.id === row.id); }
export function removeLocal(userId, table, rowId) { const s = read(userId); s.tables[table] = (s.tables[table] || []).filter(x => x.id !== rowId); write(userId, s); }
export function enqueue(userId, op) { const s = read(userId); s.queue.push({ ...op, opId: id(), queuedAt: now() }); write(userId, s); return s.queue.at(-1); }
export function removeQueueItem(userId, opId) { const s = read(userId); s.queue = s.queue.filter(x => x.opId !== opId); write(userId, s); }
export function getQueue(userId) { return read(userId).queue || []; }
export function getSyncMeta(userId) { return read(userId).sync || { lastError: null, lastAttemptAt: null, lastSuccessAt: null }; }
export function markQueueItemFailed(userId, opId, error) {
  const state = read(userId);
  const item = state.queue.find(entry => entry.opId === opId);
  if (!item) return;
  const rawMessage = String(error?.message || error?.code || 'SYNC_FAILED');
  item.attempts = Number(item.attempts || 0) + 1;
  item.lastAttemptAt = now();
  item.lastError = rawMessage.slice(0, 500);
  state.sync = { ...(state.sync || {}), lastError: item.lastError, lastAttemptAt: item.lastAttemptAt };
  write(userId, state);
}
function recordSyncResult(userId, { error = null, attempted = false, synced = 0 } = {}) {
  const state = read(userId);
  const timestamp = now();
  state.sync = {
    ...(state.sync || {}),
    lastAttemptAt: attempted ? timestamp : state.sync?.lastAttemptAt || null,
    lastSuccessAt: synced > 0 ? timestamp : state.sync?.lastSuccessAt || null,
    lastError: error ? String(error?.message || error?.code || 'SYNC_FAILED').slice(0, 500) : (state.queue.length ? state.sync?.lastError || null : null),
  };
  write(userId, state);
}
export function ensureId(row) { return row.id ? row : { ...row, id: id() }; }
export function hasHydratedTable(userId, table) { return Boolean(read(userId).hydratedTables?.[table]); }
export function markTableHydrated(userId, table) {
  const state = read(userId);
  state.hydratedTables = { ...(state.hydratedTables || {}), [table]: true };
  write(userId, state);
}

export function applyFilters(rows, filters = {}) {
  let out = [...rows];
  if (filters.type && filters.type !== 'all') out = out.filter(x => x.type === filters.type);
  if (filters.account_id) out = out.filter(x => x.account_id === filters.account_id);
  if (filters.category_id) out = out.filter(x => x.category_id === filters.category_id);
  if (filters.start_date) out = out.filter(x => String(x.date || '') >= filters.start_date);
  if (filters.end_date) out = out.filter(x => String(x.date || '') <= filters.end_date);
  if (filters.status) out = out.filter(x => x.status === filters.status);
  if (filters.search) out = out.filter(x => String(x.description || '').toLowerCase().includes(filters.search.toLowerCase()));
  const sort = filters.sort || 'date_desc';
  if (sort === 'amount_desc') out.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  else if (sort === 'amount_asc') out.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
  else if (sort === 'date_asc') out.sort((a,b) => String(a.date || a.created_at || '').localeCompare(String(b.date || b.created_at || '')));
  else out.sort((a,b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || '')));
  return filters.limit ? out.slice(0, filters.limit) : out;
}

export function decorate(rows, accounts, categories) {
  return rows.map(r => ({ ...r, account: r.account || accounts.find(a => a.id === r.account_id), category: r.category || categories.find(c => c.id === r.category_id) }));
}

const SYNC_PRIORITY = {
  categories: 10,
  accounts: 20,
  tags: 30,
  transactions: 40,
  transaction_tags: 50,
  budgets: 60,
  goals: 70,
  bills: 80,
  month_closures: 90,
};

function orderedQueue(userId) {
  return [...getQueue(userId)].sort((left, right) => {
    const leftPriority = left.action === 'replace_tags' ? 50 : (SYNC_PRIORITY[left.table] ?? 999);
    const rightPriority = right.action === 'replace_tags' ? 50 : (SYNC_PRIORITY[right.table] ?? 999);
    return leftPriority - rightPriority || String(left.queuedAt || '').localeCompare(String(right.queuedAt || ''));
  });
}

export async function syncUser(userId, remote) {
  if (isOffline()) return { synced: false, pending: getQueue(userId).length, failed: 0, offline: true };
  const queue = orderedQueue(userId); let synced = 0; let lastError = null; let failed = 0;
  for (const op of queue) {
    try {
      if (op.action === 'replace_tags') {
        const tagIds = [...new Set((op.payload?.tag_ids || []).filter(Boolean))];
        const { error: deleteError } = await remote.from('transaction_tags').delete().eq('transaction_id', op.id).eq('user_id', userId);
        if (deleteError) throw deleteError;
        if (tagIds.length) {
          const { error: insertError } = await remote.from('transaction_tags').insert(tagIds.map(tag_id => ({ transaction_id: op.id, tag_id, user_id: userId })));
          if (insertError) throw insertError;
        }
      } else {
        const q = remote.from(op.table);
        let result;
        if (op.action === 'upsert') result = await q.upsert({ ...op.payload, user_id: userId }, { onConflict: 'id' });
        if (op.action === 'update') result = await q.update(op.payload).eq('id', op.id).eq('user_id', userId);
        if (op.action === 'delete') result = await q.delete().eq('id', op.id).eq('user_id', userId);
        if (result?.error) throw result.error;
      }
      removeQueueItem(userId, op.opId); synced++;
    } catch (error) {
      // Keep only the failed operation for a later retry. Continuing with later
      // independent rows prevents one malformed legacy row from trapping every
      // account and transaction on the device where it was originally created.
      lastError = lastError || error;
      failed += 1;
      markQueueItemFailed(userId, op.opId, error);
    }
  }
  const result = { synced, pending: getQueue(userId).length, failed, error: lastError };
  recordSyncResult(userId, { error: lastError, attempted: queue.length > 0, synced });
  return result;
}

const syncBindings = new Map();
export function bindSync(userId, remote) {
  if (syncBindings.has(userId) || typeof window === 'undefined') return;
  const retry = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    void syncUser(userId, remote);
  };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  document.addEventListener('visibilitychange', retry);
  // Mobile browsers can delay online/focus events. A modest visible-tab retry
  // makes a queued desktop record reach Supabase even when those events are
  // suppressed by Chrome's background lifecycle.
  const timer = window.setInterval(retry, 30_000);
  syncBindings.set(userId, { retry, timer });
}
