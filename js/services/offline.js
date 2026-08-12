/* HISBA — Offline-first local store and sync queue */
const PREFIX = 'hisba_offline_v1_';
const TABLES = ['accounts','categories','transactions','budgets','goals','bills'];

function key(userId) { return `${PREFIX}${userId}`; }
function empty() { return { tables: Object.fromEntries(TABLES.map(t => [t, []])), queue: [], updatedAt: Date.now() }; }
function read(userId) {
  try { return { ...empty(), ...(JSON.parse(localStorage.getItem(key(userId)) || '{}')) }; }
  catch { return empty(); }
}
function write(userId, state) { state.updatedAt = Date.now(); localStorage.setItem(key(userId), JSON.stringify(state)); window.dispatchEvent(new CustomEvent('offline-store-changed')); return state; }
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
export function ensureId(row) { return row.id ? row : { ...row, id: id() }; }

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

export async function syncUser(userId, remote) {
  if (isOffline()) return { synced: false, pending: getQueue(userId).length };
  const queue = [...getQueue(userId)]; let synced = 0;
  for (const op of queue) {
    try {
      let q = remote.from(op.table);
      if (op.action === 'upsert') await q.upsert({ ...op.payload, user_id: userId }, { onConflict: 'id' });
      if (op.action === 'update') await q.update(op.payload).eq('id', op.id).eq('user_id', userId);
      if (op.action === 'delete') await q.delete().eq('id', op.id).eq('user_id', userId);
      removeQueueItem(userId, op.opId); synced++;
    } catch { break; }
  }
  return { synced, pending: getQueue(userId).length };
}

let listenersBound = false;
export function bindSync(userId, remote) {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('online', () => syncUser(userId, remote));
}
