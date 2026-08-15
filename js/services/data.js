/* HISBA — OFFLINE-FIRST DATA SERVICE */
import { supabase } from '../config.js?v=supabase-local-v1';
import * as remote from './data.remote.js?v=server-write-v2';
import { getTable, replaceTable, upsertLocal, removeLocal, enqueue, ensureId, applyFilters, decorate, syncUser, bindSync, getQueue, getSyncMeta, hasHydratedTable, markTableHydrated, removeQueueItem, markQueueItemFailed, isOffline } from './offline.js?v=server-truth-v1';

const remoteClient = supabase;
const REALTIME_TABLES = ['accounts', 'categories', 'transactions', 'transaction_tags', 'budgets', 'goals', 'bills', 'tags', 'month_closures'];
let realtimeChannel = null;
let realtimeUserId = null;
const inFlightReads = new Map();
const inFlightSyncs = new Map();

function prepare(userId) {
  bindSync(userId, remoteClient);
  // Queue delivery is important, but it must not stop a new device from reading
  // the cloud copy. Keep one background sync per user and always let reads begin.
  if (!inFlightSyncs.has(userId)) {
    const job = Promise.resolve()
      .then(() => syncUser(userId, remoteClient))
      .catch(() => null)
      .finally(() => inFlightSyncs.delete(userId));
    inFlightSyncs.set(userId, job);
  }
}
async function readCached(userId, table, loader, transform = x => x) {
  const readKey = `${userId}:${table}`;
  if (inFlightReads.has(readKey)) return inFlightReads.get(readKey);
  const request = (async () => {
    try {
      prepare(userId);
      const rows = await loader();
      const pending = getQueue(userId).filter(op => op.table === table);
      if (pending.length) {
        const merged = [...(rows || [])];
        // The server is authoritative. Overlay only values touched by queued
        // operations, never every stale cached row from this device.
        pending.forEach(op => {
          if (op.action === 'delete') {
            const index = merged.findIndex(item => item.id === op.id);
            if (index >= 0) merged.splice(index, 1);
            return;
          }
          if (op.action !== 'upsert' && op.action !== 'update') return;
          const rowId = op.id || op.payload?.id;
          if (!rowId) return;
          const local = getTable(userId, table).find(item => item.id === rowId) || {};
          const overlay = op.action === 'upsert' ? { ...op.payload, ...local } : { ...op.payload, ...local };
          const index = merged.findIndex(item => item.id === rowId);
          if (index >= 0) merged[index] = { ...merged[index], ...overlay };
          else merged.push({ id: rowId, user_id: userId, ...overlay });
        });
        replaceTable(userId, table, merged);
        markTableHydrated(userId, table);
        return merged;
      }
      replaceTable(userId, table, rows || []);
      markTableHydrated(userId, table);
      return rows || [];
    } catch (cause) {
      const cached = getTable(userId, table);
      // A device with no successful remote read must never treat an empty cache as
      // the user's real financial data. Callers can show a loading/retry state instead.
      if (hasHydratedTable(userId, table) || cached.length) return transform(cached);
      const error = new Error('INITIAL_DATA_UNAVAILABLE');
      error.code = 'INITIAL_DATA_UNAVAILABLE';
      error.cause = cause;
      throw error;
    }
  })();
  inFlightReads.set(readKey, request);
  try { return await request; }
  finally {
    if (inFlightReads.get(readKey) === request) inFlightReads.delete(readKey);
  }
}
function notifySyncQueued(userId, operation, error = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('hisba:sync-queued', {
    detail: {
      userId,
      operation,
      error: error ? String(error?.message || error?.code || 'SYNC_FAILED') : null,
      at: Date.now(),
    },
  }));
}
function pendingResult(row) { return { ...row, __syncPending: true }; }
function queueAfterFailedWrite(userId, operation, error = null) {
  const op = enqueue(userId, operation);
  if (error) markQueueItemFailed(userId, op.opId, error);
  notifySyncQueued(userId, operation, error);
  return op;
}
async function save(userId, table, row, creator, payload = row) {
  const local = upsertLocal(userId, table, row);
  if (!isOffline()) {
    try {
      const result = await creator();
      return upsertLocal(userId, table, result || row);
    } catch (error) {
      queueAfterFailedWrite(userId, { action: 'upsert', table, payload }, error);
      return pendingResult(local);
    }
  }
  queueAfterFailedWrite(userId, { action: 'upsert', table, payload });
  return pendingResult(local);
}
async function patch(userId, table, id, updates, updater) {
  const current = getTable(userId, table).find(x => x.id === id) || { id, user_id: userId };
  const local = upsertLocal(userId, table, { ...current, ...updates, id });
  if (!isOffline()) {
    try {
      const result = await updater();
      return upsertLocal(userId, table, result || local);
    } catch (error) {
      queueAfterFailedWrite(userId, { action: 'update', table, id, payload: updates }, error);
      return pendingResult(local);
    }
  }
  queueAfterFailedWrite(userId, { action: 'update', table, id, payload: updates });
  return pendingResult(local);
}
async function remove(userId, table, id, deleter) {
  removeLocal(userId, table, id);
  if (!isOffline()) {
    try {
      await deleter();
      return { id, __syncPending: false };
    } catch (error) {
      queueAfterFailedWrite(userId, { action: 'delete', table, id }, error);
      return { id, __syncPending: true };
    }
  }
  queueAfterFailedWrite(userId, { action: 'delete', table, id });
  return { id, __syncPending: true };
}

// A semantic event is emitted only after a financial mutation is complete. Pages
// can refresh derived views (balances, budgets, reports) from the same local-first cache.
export function notifyFinancialDataChanged(userId, entities = ['transactions', 'accounts']) {
  if (!userId || typeof window === 'undefined') return;
  const detail = { userId, entities, at: Date.now() };
  window.dispatchEvent(new CustomEvent('hisba:financial-data-changed', { detail }));
  try { localStorage.setItem('hisba_financial_data_changed', JSON.stringify(detail)); } catch {}
}

/**
 * Subscribes only to rows owned by the signed-in user. Remote events never
 * carry financial values into the UI directly: listeners simply request a
 * fresh local-first read so RLS remains the sole authorization boundary.
 */
export function subscribeToUserDataChanges(userId, onChange) {
  unsubscribeFromUserDataChanges();
  if (!userId || typeof onChange !== 'function' || typeof remoteClient?.channel !== 'function') return () => {};

  let debounceTimer = null;
  const notify = payload => {
    const row = payload?.new || payload?.old || {};
    if (row.user_id && row.user_id !== userId) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      onChange({ userId, table: payload?.table || null, at: Date.now() });
    }, 350);
  };

  const channel = remoteClient.channel(`hisba-user-sync-${userId}`);
  REALTIME_TABLES.forEach(table => {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      filter: `user_id=eq.${userId}`,
    }, notify);
  });
  channel.subscribe();

  realtimeChannel = channel;
  realtimeUserId = userId;
  return () => unsubscribeFromUserDataChanges(userId);
}

export function unsubscribeFromUserDataChanges(userId) {
  if (!realtimeChannel || (userId && realtimeUserId !== userId)) return;
  try { realtimeChannel.unsubscribe(); } catch {}
  try { remoteClient.removeChannel(realtimeChannel); } catch {}
  realtimeChannel = null;
  realtimeUserId = null;
}

// Accounts
export async function getAccounts(userId) { return readCached(userId, 'accounts', () => remote.getAccounts(userId)); }
export async function createAccount(userId, account) { const row = ensureId({ ...account, user_id: userId, created_at: account.created_at || new Date().toISOString() }); return save(userId, 'accounts', row, () => remote.createAccount(userId, row), row); }
export async function updateAccount(id, userId, updates) { return patch(userId, 'accounts', id, updates, () => remote.updateAccount(id, userId, updates)); }
export async function deleteAccount(id, userId) { return remove(userId, 'accounts', id, () => remote.deleteAccount(id, userId)); }
export async function setDefaultAccount(id, userId) {
  const rows = getTable(userId, 'accounts').map(a => ({ ...a, is_default: a.id === id })); replaceTable(userId, 'accounts', rows);
  if (!isOffline()) {
    try { await remote.setDefaultAccount(id, userId); return { id, __syncPending: false }; }
    catch (error) {
      rows.forEach(account => queueAfterFailedWrite(userId, { action: 'update', table: 'accounts', id: account.id, payload: { is_default: account.is_default } }, error));
      return { id, __syncPending: true };
    }
  }
  rows.forEach(account => queueAfterFailedWrite(userId, { action: 'update', table: 'accounts', id: account.id, payload: { is_default: account.is_default } }));
  return { id, __syncPending: true };
}

// Categories
const DEFAULT_CATEGORIES = [
  ['المواصلات', 'Transportation', 'car', '#3ec3d5'],
  ['الأكل خارج البيت', 'Eating out', 'food', '#ff5460'],
  ['التسوق', 'Shopping', 'shop', '#23233c'],
  ['الفواتير', 'Bills', 'bolt', '#c8c7cd'],
  ['السكن', 'Housing', 'home', '#23233c'],
  ['الصحة', 'Health', 'health', '#41dc65'],
  ['التعليم', 'Education', 'book', '#3ec3d5'],
  ['الترفيه', 'Entertainment', 'entertainment', '#ff5460'],
  ['الاشتراكات', 'Subscriptions', 'phone', '#c8c7cd'],
  ['العناية الشخصية', 'Personal care', 'star', '#3ec3d5'],
].map(([name_ar, name, icon, color]) => ({ name_ar, name, icon, color, type: 'expense', is_predefined: true }));

export async function getCategories(userId) {
  const rows = await readCached(userId, 'categories', () => remote.getCategories(userId));
  if (rows.length) return rows;
  // Seed in parallel so a first run cannot add ten network waits to the
  // dashboard's initial render on a mobile connection.
  return Promise.all(DEFAULT_CATEGORIES.map(async cat => {
    try { return await createCategory(userId, cat); }
    catch { return ensureId({ ...cat, user_id: userId }); }
  }));
}
export async function createCategory(userId, cat) { const row = ensureId({ ...cat, user_id: userId, is_predefined: cat.is_predefined ?? false }); return save(userId, 'categories', row, () => remote.createCategory(userId, row), row); }
export async function updateCategory(id, userId, updates) { return patch(userId, 'categories', id, updates, () => remote.updateCategory(id, userId, updates)); }
export async function deleteCategory(id, userId) { return remove(userId, 'categories', id, () => remote.deleteCategory(id, userId)); }

// Transactions
function isPostedTransaction(tx) { return tx && (tx.status === 'completed' || !tx.status); }
function transactionImpact(tx) {
  if (!isPostedTransaction(tx)) return 0;
  const amount = Number(tx.amount || 0);
  if (tx.type === 'income') return amount;
  if (tx.type === 'expense') return -amount;
  // Transfers need a destination account to move money safely; they do not alter a balance yet.
  return 0;
}
async function adjustAccountBalance(userId, accountId, delta) {
  if (!accountId || !delta) return;
  const account = getTable(userId, 'accounts').find(a => a.id === accountId);
  if (!account) return;
  const balance = Number(account.balance || 0) + Number(delta);
  try { await updateAccount(accountId, userId, { balance }); } catch { upsertLocal(userId, 'accounts', { ...account, balance }); }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function addFrequency(date, frequency) {
  const d = new Date(`${date}T12:00:00`);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function recurringId(parentId, date) { return `${parentId}__${date}`; }

async function materializeRecurring(userId, rows) {
  const today = todayISO();
  const recurring = rows.filter(tx => tx.is_recurring && tx.frequency && !tx.recurrence_parent_id && tx.date);
  if (!recurring.length) return rows;
  const localRows = getTable(userId, 'transactions');
  const created = [];
  for (const parent of recurring) {
    let next = parent.date;
    while (next < today) {
      next = addFrequency(next, parent.frequency);
      if (next > today) break;
      const id = recurringId(parent.id, next);
      if (localRows.some(tx => tx.id === id) || rows.some(tx => tx.id === id)) continue;
      const child = ensureId({ ...parent, id, date: next, created_at: new Date(`${next}T12:00:00`).toISOString(), is_recurring: false, recurrence_parent_id: parent.id, recurrence_last_generated: next });
      const saved = await save(userId, 'transactions', child, () => remote.createTransaction(userId, child), child);
      created.push(saved || child);
      await adjustAccountBalance(userId, child.account_id, transactionImpact(child));
    }
    if (parent.recurrence_last_generated !== today) {
      upsertLocal(userId, 'transactions', { ...parent, recurrence_last_generated: today });
    }
  }
  return [...rows, ...created];
}

export async function getTransactions(userId, filters = {}) {
  let rows = await readCached(userId, 'transactions', () => remote.getTransactions(userId, {}), x => x);
  rows = await materializeRecurring(userId, rows);
  rows = rows.map(row => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : (row.transaction_tags || []).map(link => link?.tag).filter(Boolean),
  }));
  const accounts = getTable(userId, 'accounts'), categories = getTable(userId, 'categories');
  return decorate(applyFilters(rows, filters), accounts, categories);
}
export async function createTransaction(userId, tx) {
  const row = ensureId({ ...tx, user_id: userId, created_at: tx.created_at || new Date().toISOString() });
  const saved = await save(userId, 'transactions', row, () => remote.createTransaction(userId, row), row);
  await adjustAccountBalance(userId, saved?.account_id || row.account_id, transactionImpact(saved || row));
  notifyFinancialDataChanged(userId);
  return saved;
}
export async function updateTransaction(id, userId, updates) {
  const current = getTable(userId, 'transactions').find(x => x.id === id) || { id, user_id: userId };
  const next = { ...current, ...updates, id };
  const oldImpact = transactionImpact(current);
  if (current.account_id) await adjustAccountBalance(userId, current.account_id, -oldImpact);
  const saved = await patch(userId, 'transactions', id, updates, () => remote.updateTransaction(id, userId, updates));
  await adjustAccountBalance(userId, saved?.account_id || next.account_id, transactionImpact(saved || next));
  notifyFinancialDataChanged(userId);
  return saved;
}
export async function deleteTransaction(id, userId) {
  const current = getTable(userId, 'transactions').find(x => x.id === id);
  const result = await remove(userId, 'transactions', id, () => remote.deleteTransaction(id, userId));
  if (current) await adjustAccountBalance(userId, current.account_id, -transactionImpact(current));
  notifyFinancialDataChanged(userId);
  return result;
}

// Tags
export async function getTags(userId) { return readCached(userId, 'tags', () => remote.getTags(userId)); }
export async function createTag(userId, tag) {
  const row = ensureId({ ...tag, user_id: userId, created_at: tag.created_at || new Date().toISOString() });
  return save(userId, 'tags', row, () => remote.createTag(userId, row), row);
}
export async function updateTag(id, userId, updates) { return patch(userId, 'tags', id, updates, () => remote.updateTag(id, userId, updates)); }
export async function deleteTag(id, userId) {
  const transactions = getTable(userId, 'transactions').map(tx => ({
    ...tx,
    tags: (tx.tags || []).filter(tag => tag.id !== id),
    transaction_tags: (tx.transaction_tags || []).filter(link => link?.tag?.id !== id),
  }));
  replaceTable(userId, 'transactions', transactions);
  return remove(userId, 'tags', id, () => remote.deleteTag(id, userId));
}
export async function setTransactionTags(transactionId, userId, tagIds) {
  const ids = [...new Set((tagIds || []).filter(Boolean))];
  const validTags = getTable(userId, 'tags').filter(tag => ids.includes(tag.id));
  const current = getTable(userId, 'transactions').find(tx => tx.id === transactionId);
  if (!current) throw new Error('Transaction not found');
  const local = upsertLocal(userId, 'transactions', {
    ...current,
    tags: validTags,
    transaction_tags: validTags.map(tag => ({ tag })),
  });
  if (!isOffline()) {
    try {
      await remote.replaceTransactionTags(transactionId, userId, ids);
      return local;
    } catch (error) {
      queueAfterFailedWrite(userId, { action: 'replace_tags', table: 'transaction_tags', id: transactionId, payload: { tag_ids: ids } }, error);
      return pendingResult(local);
    }
  }
  queueAfterFailedWrite(userId, { action: 'replace_tags', table: 'transaction_tags', id: transactionId, payload: { tag_ids: ids } });
  return pendingResult(local);
}

// Budgets
export async function getBudgets(userId) { return readCached(userId, 'budgets', () => remote.getBudgets(userId)); }
export async function createBudget(userId, budget) { const row = ensureId({ ...budget, user_id: userId, created_at: budget.created_at || new Date().toISOString() }); return save(userId, 'budgets', row, () => remote.createBudget(userId, row), row); }
export async function updateBudget(id, userId, updates) { return patch(userId, 'budgets', id, updates, () => remote.updateBudget(id, userId, updates)); }
export async function deleteBudget(id, userId) { return remove(userId, 'budgets', id, () => remote.deleteBudget(id, userId)); }

// Monthly closing snapshots
export async function getMonthClosures(userId) { return readCached(userId, 'month_closures', () => remote.getMonthClosures(userId)); }
export async function saveMonthClosure(userId, closure) {
  const existing = getTable(userId, 'month_closures').find(item => item.month_key === closure.month_key);
  const row = ensureId({ ...existing, ...closure, user_id: userId, closed_at: closure.closed_at || new Date().toISOString() });
  return save(userId, 'month_closures', row, () => remote.saveMonthClosure(userId, row), row);
}

function normalizeId(value) { return value === null || value === undefined || value === '' ? null : String(value).trim(); }
function normalizeDate(value) { return String(value || '').slice(0, 10); }

export async function getBudgetSpending(userId, budgets = [], periodStart, periodEnd, preloadedTransactions = null) {
  const start = normalizeDate(periodStart);
  const end = normalizeDate(periodEnd);
  // Use the complete cache, then normalize date values locally. This supports
  // offline rows, ISO timestamps, and UUID/string category IDs consistently.
  const rows = Array.isArray(preloadedTransactions) ? preloadedTransactions : await getTransactions(userId);
  const txs = rows.filter(tx => {
    const date = normalizeDate(tx.date || tx.created_at);
    const status = tx.status;
    return tx.type === 'expense' && (status === 'completed' || !status) &&
      (!start || date >= start) && (!end || date <= end);
  });
  const spending = { __total__: 0 };
  txs.forEach(tx => {
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount < 0) return;
    const categoryId = normalizeId(tx.category_id || tx.category?.id);
    if (categoryId) spending[categoryId] = (spending[categoryId] || 0) + amount;
    spending.__total__ += amount;
  });
  return spending;
}

// Goals
export async function getGoals(userId) { return readCached(userId, 'goals', () => remote.getGoals(userId)); }
export async function createGoal(userId, goal) { const row = ensureId({ ...goal, user_id: userId }); return save(userId, 'goals', row, () => remote.createGoal(userId, row), row); }
export async function updateGoal(id, userId, updates) { return patch(userId, 'goals', id, updates, () => remote.updateGoal(id, userId, updates)); }
export async function deleteGoal(id, userId) { return remove(userId, 'goals', id, () => remote.deleteGoal(id, userId)); }
export async function addGoalFunds(id, userId, amount) { const goal = getTable(userId, 'goals').find(x => x.id === id) || {}; return updateGoal(id, userId, { current_amount: Number(goal.current_amount || 0) + Number(amount) }); }

// Bills
export async function getBills(userId) { return readCached(userId, 'bills', () => remote.getBills(userId)); }
export async function createBill(userId, bill) { const row = ensureId({ ...bill, user_id: userId }); return save(userId, 'bills', row, () => remote.createBill(userId, row), row); }
export async function updateBill(id, userId, updates) { return patch(userId, 'bills', id, updates, () => remote.updateBill(id, userId, updates)); }
export async function deleteBill(id, userId) { return remove(userId, 'bills', id, () => remote.deleteBill(id, userId)); }

// Derived dashboard data. Hydrate accounts from Supabase before calculating totals so a
// fresh device does not mistake an empty local cache for a real zero-balance account.
export async function getDashboardSummary(userId, startDate, endDate) { const [txs, accounts] = await Promise.all([getTransactions(userId, { start_date: startDate, end_date: endDate }), getAccounts(userId)]); const completed = txs.filter(t => t.status === 'completed' || !t.status); const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0); const income = completed.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0); const expenses = completed.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0); return { totalBalance, income, expenses, net: income - expenses, transactions: completed }; }
export async function getMonthlyTrend(userId, months = 6) { const all = await getTransactions(userId); const out = []; const now = new Date(); for (let i = months - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const rows = all.filter(t => String(t.date || '').startsWith(ym)); out.push({ month: d.toLocaleString('en', { month: 'short' }), year: d.getFullYear(), income: rows.filter(t => t.type === 'income').reduce((s,t) => s+Number(t.amount||0),0), expenses: rows.filter(t => t.type === 'expense').reduce((s,t) => s+Number(t.amount||0),0) }); } return out; }
export async function getCategorySpending(userId, startDate, endDate) { const rows = await getTransactions(userId, { start_date: startDate, end_date: endDate, type: 'expense' }); const map = {}; rows.filter(t => t.status === 'completed' || !t.status).forEach(tx => { if (!tx.category) return; const id = tx.category.id; if (!map[id]) map[id] = { ...tx.category, total: 0 }; map[id].total += Number(tx.amount || 0); }); return Object.values(map).sort((a,b) => b.total - a.total); }

export async function forceSync(userId) {
  const result = await syncUser(userId, remoteClient);
  if (result.synced > 0) notifyFinancialDataChanged(userId);
  return result;
}
export function getSyncStatus(userId) {
  const queue = getQueue(userId);
  const meta = getSyncMeta(userId);
  return {
    pending: queue.length,
    failed: queue.filter(item => item.lastError).length,
    lastError: meta.lastError || null,
    lastAttemptAt: meta.lastAttemptAt || null,
    lastSuccessAt: meta.lastSuccessAt || null,
  };
}
