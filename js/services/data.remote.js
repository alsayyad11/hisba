/* ============================================================
   HISBA — DATA SERVICE
   Accounts, Categories, Transactions, Budgets, Goals, Bills
   ============================================================ */
import { supabase } from '../config.js?v=supabase-local-v1';

// ── Accounts ───────────────────────────────────────────────
export async function getAccounts(userId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function createAccount(userId, account) {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...account, user_id: userId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateAccount(id, userId, updates) {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteAccount(id, userId) {
  const { data, error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id).eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('ACCOUNT_DELETE_NOT_CONFIRMED');
}

export async function setDefaultAccount(id, userId) {
  const { error: clearError } = await supabase.from('accounts').update({ is_default: false }).eq('user_id', userId);
  if (clearError) throw clearError;
  const { data, error } = await supabase.from('accounts').update({ is_default: true }).eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('DEFAULT_ACCOUNT_NOT_CONFIRMED');
}

// ── Categories ─────────────────────────────────────────────
export async function getCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('is_predefined', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createCategory(userId, cat) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...cat, user_id: userId, is_predefined: cat.is_predefined ?? false })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, userId, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id, userId) {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id).eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('CATEGORY_DELETE_NOT_CONFIRMED');
}

// ── Transactions ───────────────────────────────────────────
export async function getTransactions(userId, filters = {}) {
  let q = supabase
    .from('transactions')
    .select(`*, account:accounts(id,name,color,currency), category:categories(id,name,name_ar,icon,color), transaction_tags(tag:tags(id,name,color))`)
    .eq('user_id', userId);

  if (filters.type && filters.type !== 'all')  q = q.eq('type', filters.type);
  if (filters.account_id)  q = q.eq('account_id', filters.account_id);
  if (filters.category_id) q = q.eq('category_id', filters.category_id);
  if (filters.start_date)  q = q.gte('date', filters.start_date);
  if (filters.end_date)    q = q.lte('date', filters.end_date);
  if (filters.status)      q = q.eq('status', filters.status);
  if (filters.search) {
    q = q.ilike('description', `%${filters.search}%`);
  }

  if (filters.sort === 'amount_desc') q = q.order('amount', { ascending: false });
  else if (filters.sort === 'amount_asc') q = q.order('amount', { ascending: true });
  else if (filters.sort === 'date_asc') q = q.order('date', { ascending: true }).order('created_at', { ascending: true });
  else q = q.order('date', { ascending: false }).order('created_at', { ascending: false });
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createTransaction(userId, tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...tx, user_id: userId })
    .select(`*, account:accounts(id,name,color,currency), category:categories(id,name,name_ar,icon,color), transaction_tags(tag:tags(id,name,color))`)
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, userId, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select(`*, account:accounts(id,name,color,currency), category:categories(id,name,name_ar,icon,color), transaction_tags(tag:tags(id,name,color))`)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id, userId) {
  const { data, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id).eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('TRANSACTION_DELETE_NOT_CONFIRMED');
}

// ── Budgets ────────────────────────────────────────────────
export async function getBudgets(userId) {
  const { data, error } = await supabase
    .from('budgets')
    .select(`*, category:categories(id,name,name_ar,icon,color)`)
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function createBudget(userId, budget) {
  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...budget, user_id: userId })
    .select(`*, category:categories(id,name,name_ar,icon,color)`)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBudget(id, userId, updates) {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select(`*, category:categories(id,name,name_ar,icon,color)`)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id, userId) {
  const { data, error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('BUDGET_DELETE_NOT_CONFIRMED');
}

// Calculate budget spending for current period
export async function getBudgetSpending(userId, budgets, periodStart, periodEnd) {
  if (!budgets.length) return {};
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', periodStart)
    .lte('date', periodEnd);
  if (error) throw error;

  const spending = {};
  (data || []).forEach(tx => {
    spending[tx.category_id] = (spending[tx.category_id] || 0) + Number(tx.amount);
  });
  return spending;
}

// ── Goals ──────────────────────────────────────────────────
export async function getGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function createGoal(userId, goal) {
  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: userId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id, userId, updates) {
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id, userId) {
  const { data, error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('GOAL_DELETE_NOT_CONFIRMED');
}

export async function addGoalFunds(id, userId, amount) {
  const { data: goal, error: readError } = await supabase
    .from('goals')
    .select('current_amount')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (readError || !goal) throw readError || new Error('Goal not found');
  const newAmount = Number(goal.current_amount || 0) + Number(amount);
  return updateGoal(id, userId, { current_amount: newAmount });
}

// ── Bills ──────────────────────────────────────────────────
export async function getBills(userId) {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('due_day');
  if (error) throw error;
  return data || [];
}

export async function createBill(userId, bill) {
  const { data, error } = await supabase
    .from('bills')
    .insert({ ...bill, user_id: userId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateBill(id, userId, updates) {
  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', id).eq('user_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteBill(id, userId) {
  const { data, error } = await supabase.from('bills').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('BILL_DELETE_NOT_CONFIRMED');
}

// ── Tags ───────────────────────────────────────────────────
export async function getTags(userId) {
  const { data, error } = await supabase.from('tags').select('*').eq('user_id', userId).order('name');
  if (error) throw error;
  return data || [];
}

export async function createTag(userId, tag) {
  const { data, error } = await supabase.from('tags').insert({ ...tag, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTag(id, userId, updates) {
  const { data, error } = await supabase.from('tags').update(updates).eq('id', id).eq('user_id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTag(id, userId) {
  const { data, error } = await supabase.from('tags').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('TAG_DELETE_NOT_CONFIRMED');
}

export async function replaceTransactionTags(transactionId, userId, tagIds) {
  const ids = [...new Set((tagIds || []).filter(Boolean))];
  const { error: deleteError } = await supabase
    .from('transaction_tags').delete().eq('transaction_id', transactionId).eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('transaction_tags')
    .insert(ids.map(tag_id => ({ transaction_id: transactionId, tag_id, user_id: userId })))
    .select('transaction_id, tag:tags(id,name,color)');
  if (error) throw error;
  return data || [];
}

// ── Month closures ─────────────────────────────────────────
export async function getMonthClosures(userId) {
  const { data, error } = await supabase.from('month_closures').select('*').eq('user_id', userId).order('month_key', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveMonthClosure(userId, closure) {
  const { data, error } = await supabase
    .from('month_closures')
    .upsert({ ...closure, user_id: userId }, { onConflict: 'user_id,month_key' })
    .select().single();
  if (error) throw error;
  return data;
}

// ── Dashboard summary ─────────────────────────────────────
export async function getDashboardSummary(userId, startDate, endDate) {
  const [txResult, accountsResult] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, category_id, account_id, date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase.from('accounts')
      .select('balance, currency')
      .eq('user_id', userId),
  ]);

  // A permission, network, or session error must never be converted into an
  // empty financial snapshot. The caller can then show a retry state instead
  // of presenting zero balances as if they were real data.
  if (txResult.error) throw txResult.error;
  if (accountsResult.error) throw accountsResult.error;

  const transactions = txResult.data || [];
  const accounts = accountsResult.data || [];

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  return { totalBalance, income, expenses, net: income - expenses, transactions };
}

export async function getMonthlyTrend(userId, months = 6) {
  const results = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('date', start)
      .lte('date', end);
    if (error) throw error;
    const income = (data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = (data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    results.push({ month: d.toLocaleString('en', { month: 'short' }), year: d.getFullYear(), income, expenses });
  }
  return results;
}

export async function getCategorySpending(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category:categories(id,name,name_ar,icon,color)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('status', 'completed')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;

  const map = {};
  (data || []).forEach(tx => {
    if (!tx.category) return;
    const id = tx.category.id;
    if (!map[id]) map[id] = { ...tx.category, total: 0 };
    map[id].total += Number(tx.amount);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}
