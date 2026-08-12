/* HISBA — OFFLINE-FIRST DATA SERVICE */
import { supabase } from '../config.js';
import * as remote from './data.remote.js';
import { getTable, replaceTable, upsertLocal, removeLocal, enqueue, ensureId, applyFilters, decorate, syncUser, bindSync, getQueue } from './offline.js';

const remoteClient = supabase;
async function prepare(userId) { bindSync(userId, remoteClient); await syncUser(userId, remoteClient); }
async function readCached(userId, table, loader, transform = x => x) {
  try {
    await prepare(userId);
    const rows = await loader();
    const pending = getQueue(userId).filter(op => op.table === table);
    if (pending.length) {
      const local = getTable(userId, table);
      const merged = [...(rows || [])];
      local.forEach(localRow => { const i = merged.findIndex(r => r.id === localRow.id); if (i >= 0) merged[i] = { ...merged[i], ...localRow }; else merged.push(localRow); });
      replaceTable(userId, table, merged); return merged;
    }
    replaceTable(userId, table, rows || []); return rows || [];
  } catch { return transform(getTable(userId, table)); }
}
async function save(userId, table, row, creator, payload = row) {
  const local = upsertLocal(userId, table, row); const op = enqueue(userId, { action: 'upsert', table, payload });
  try { const result = await creator(); removeQueueFor(userId, op); return upsertLocal(userId, table, result || row); } catch { return local; }
}
async function patch(userId, table, id, updates, updater) {
  const current = getTable(userId, table).find(x => x.id === id) || { id, user_id: userId };
  const local = upsertLocal(userId, table, { ...current, ...updates, id }); const op = enqueue(userId, { action: 'update', table, id, payload: updates });
  try { const result = await updater(); removeQueueFor(userId, op); return upsertLocal(userId, table, result || local); } catch { return local; }
}
async function remove(userId, table, id, deleter) {
  removeLocal(userId, table, id); const op = enqueue(userId, { action: 'delete', table, id });
  try { await deleter(); removeQueueFor(userId, op); } catch {}
}
function removeQueueFor(userId, op) { import('./offline.js').then(({ removeQueueItem }) => removeQueueItem(userId, op.opId)); }

// Accounts
export async function getAccounts(userId) { return readCached(userId, 'accounts', () => remote.getAccounts(userId)); }
export async function createAccount(userId, account) { const row = ensureId({ ...account, user_id: userId, created_at: account.created_at || new Date().toISOString() }); return save(userId, 'accounts', row, () => remote.createAccount(userId, row), row); }
export async function updateAccount(id, userId, updates) { return patch(userId, 'accounts', id, updates, () => remote.updateAccount(id, userId, updates)); }
export async function deleteAccount(id, userId) { return remove(userId, 'accounts', id, () => remote.deleteAccount(id, userId)); }
export async function setDefaultAccount(id, userId) {
  const rows = getTable(userId, 'accounts').map(a => ({ ...a, is_default: a.id === id })); replaceTable(userId, 'accounts', rows);
  enqueue(userId, { action: 'update', table: 'accounts', id, payload: { is_default: true } });
  try { await remote.setDefaultAccount(id, userId); await syncUser(userId, remoteClient); } catch {}
}

// Categories
const DEFAULT_CATEGORIES = [
  ['المواصلات', 'Transportation', 'car', '#4f8cc9'],
  ['الأكل خارج البيت', 'Eating out', 'food', '#d94f87'],
  ['التسوق', 'Shopping', 'shop', '#8d6acb'],
  ['الفواتير', 'Bills', 'bolt', '#e09a3e'],
  ['السكن', 'Housing', 'home', '#1f6f68'],
  ['الصحة', 'Health', 'health', '#238b5a'],
  ['التعليم', 'Education', 'book', '#6b7fd7'],
  ['الترفيه', 'Entertainment', 'entertainment', '#c35a8d'],
  ['الاشتراكات', 'Subscriptions', 'phone', '#7d8796'],
  ['العناية الشخصية', 'Personal care', 'star', '#b56a9f'],
].map(([name_ar, name, icon, color]) => ({ name_ar, name, icon, color, type: 'expense', is_predefined: true }));

export async function getCategories(userId) {
  const rows = await readCached(userId, 'categories', () => remote.getCategories(userId));
  if (rows.length) return rows;
  const seeded = [];
  for (const cat of DEFAULT_CATEGORIES) {
    try { seeded.push(await createCategory(userId, cat)); } catch { seeded.push(ensureId({ ...cat, user_id: userId })); }
  }
  return seeded;
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
  const accounts = getTable(userId, 'accounts'), categories = getTable(userId, 'categories');
  return decorate(applyFilters(rows, filters), accounts, categories);
}
export async function createTransaction(userId, tx) {
  const row = ensureId({ ...tx, user_id: userId, created_at: tx.created_at || new Date().toISOString() });
  const saved = await save(userId, 'transactions', row, () => remote.createTransaction(userId, row), row);
  await adjustAccountBalance(userId, saved?.account_id || row.account_id, transactionImpact(saved || row));
  return saved;
}
export async function updateTransaction(id, userId, updates) {
  const current = getTable(userId, 'transactions').find(x => x.id === id) || { id, user_id: userId };
  const next = { ...current, ...updates, id };
  const oldImpact = transactionImpact(current);
  if (current.account_id) await adjustAccountBalance(userId, current.account_id, -oldImpact);
  const saved = await patch(userId, 'transactions', id, updates, () => remote.updateTransaction(id, userId, updates));
  await adjustAccountBalance(userId, saved?.account_id || next.account_id, transactionImpact(saved || next));
  return saved;
}
export async function deleteTransaction(id, userId) {
  const current = getTable(userId, 'transactions').find(x => x.id === id);
  const result = await remove(userId, 'transactions', id, () => remote.deleteTransaction(id, userId));
  if (current) await adjustAccountBalance(userId, current.account_id, -transactionImpact(current));
  return result;
}

// Budgets
export async function getBudgets(userId) { return readCached(userId, 'budgets', () => remote.getBudgets(userId)); }
export async function createBudget(userId, budget) { const row = ensureId({ ...budget, user_id: userId, created_at: budget.created_at || new Date().toISOString() }); return save(userId, 'budgets', row, () => remote.createBudget(userId, row), row); }
export async function updateBudget(id, userId, updates) { return patch(userId, 'budgets', id, updates, () => remote.updateBudget(id, userId, updates)); }
export async function deleteBudget(id, userId) { return remove(userId, 'budgets', id, () => remote.deleteBudget(id, userId)); }
function normalizeId(value) { return value === null || value === undefined || value === '' ? null : String(value).trim(); }
function normalizeDate(value) { return String(value || '').slice(0, 10); }

export async function getBudgetSpending(userId, budgets = [], periodStart, periodEnd) {
  const start = normalizeDate(periodStart);
  const end = normalizeDate(periodEnd);
  // Use the complete cache, then normalize date values locally. This supports
  // offline rows, ISO timestamps, and UUID/string category IDs consistently.
  const rows = await getTransactions(userId);
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

// Derived dashboard data, always available from the local cache.
export async function getDashboardSummary(userId, startDate, endDate) { const txs = await getTransactions(userId, { start_date: startDate, end_date: endDate }); const accounts = getTable(userId, 'accounts'); const completed = txs.filter(t => t.status === 'completed' || !t.status); const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0); const income = completed.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0); const expenses = completed.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0); return { totalBalance, income, expenses, net: income - expenses, transactions: completed }; }
export async function getMonthlyTrend(userId, months = 6) { const all = await getTransactions(userId); const out = []; const now = new Date(); for (let i = months - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const rows = all.filter(t => String(t.date || '').startsWith(ym)); out.push({ month: d.toLocaleString('en', { month: 'short' }), year: d.getFullYear(), income: rows.filter(t => t.type === 'income').reduce((s,t) => s+Number(t.amount||0),0), expenses: rows.filter(t => t.type === 'expense').reduce((s,t) => s+Number(t.amount||0),0) }); } return out; }
export async function getCategorySpending(userId, startDate, endDate) { const rows = await getTransactions(userId, { start_date: startDate, end_date: endDate, type: 'expense' }); const map = {}; rows.filter(t => t.status === 'completed' || !t.status).forEach(tx => { if (!tx.category) return; const id = tx.category.id; if (!map[id]) map[id] = { ...tx.category, total: 0 }; map[id].total += Number(tx.amount || 0); }); return Object.values(map).sort((a,b) => b.total - a.total); }

export function getSyncStatus(userId) { return { pending: getQueue(userId).length }; }
