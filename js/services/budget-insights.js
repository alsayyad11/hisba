/* HISBA — Budget insights and month-closing calculations */

function isoDate(value) { return String(value || '').slice(0, 10); }
function amount(value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }
function isPosted(transaction) { return transaction && (transaction.status === 'completed' || !transaction.status); }

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(monthKey = currentMonthKey()) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error('Invalid month key');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function daysRemainingInMonth(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(1, Math.floor((last - today) / 86400000) + 1);
}

export function monthlyExpenseTransactions(transactions, monthKey = currentMonthKey()) {
  const { start, end } = monthRange(monthKey);
  return (transactions || []).filter(transaction =>
    transaction.type === 'expense' && isPosted(transaction) &&
    isoDate(transaction.date || transaction.created_at) >= start &&
    isoDate(transaction.date || transaction.created_at) <= end,
  );
}

function usableMonthlyBudgets(budgets, monthKey) {
  const monthly = (budgets || []).filter(budget => budget.period !== 'weekly' && (!budget.month_key || budget.month_key === monthKey));
  const global = monthly.filter(budget => !budget.category_id);
  return global.length ? global : monthly;
}

export function getDailyBudgetIndicator({ budgets = [], transactions = [], monthKey = currentMonthKey(), date = new Date() } = {}) {
  const scope = usableMonthlyBudgets(budgets, monthKey);
  const budgeted = scope.reduce((sum, budget) => sum + amount(budget.amount), 0);
  const spent = monthlyExpenseTransactions(transactions, monthKey).reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const remaining = budgeted - spent;
  const daysRemaining = daysRemainingInMonth(date);
  return {
    monthKey,
    budgeted,
    spent,
    remaining,
    daysRemaining,
    dailyAllowance: Math.max(0, remaining) / daysRemaining,
    percent: budgeted > 0 ? (spent / budgeted) * 100 : 0,
    hasBudget: budgeted > 0,
  };
}

export function getBudgetAlerts(budgets = [], spending = {}, thresholds = [70, 90, 100]) {
  return (budgets || []).flatMap(budget => {
    const planned = amount(budget.amount);
    const spent = amount(budget.spent ?? spending[String(budget.category_id || '__total__')]);
    const percent = planned > 0 ? (spent / planned) * 100 : 0;
    const threshold = [...thresholds].sort((a, b) => b - a).find(item => percent >= item);
    if (!threshold) return [];
    return [{
      budgetId: budget.id,
      name: budget.name,
      percent,
      threshold,
      severity: threshold >= 100 ? 'over' : threshold >= 90 ? 'warning' : 'notice',
      remaining: planned - spent,
    }];
  });
}

export function buildMonthClosure({ monthKey, budgets = [], transactions = [], closedAt = new Date().toISOString() } = {}) {
  const safeMonthKey = monthKey || currentMonthKey();
  const { start, end } = monthRange(safeMonthKey);
  const rows = (transactions || []).filter(transaction => {
    const date = isoDate(transaction.date || transaction.created_at);
    return isPosted(transaction) && date >= start && date <= end;
  });
  const income = rows.filter(transaction => transaction.type === 'income').reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const expenses = rows.filter(transaction => transaction.type === 'expense').reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const budgeted = usableMonthlyBudgets(budgets, safeMonthKey).reduce((sum, budget) => sum + amount(budget.amount), 0);
  const carryForward = Math.max(0, budgeted - expenses);
  return {
    month_key: safeMonthKey,
    closed_at: closedAt,
    carry_forward: carryForward,
    budget_snapshot: usableMonthlyBudgets(budgets, safeMonthKey).map(budget => ({
      id: budget.id,
      name: budget.name,
      category_id: budget.category_id || null,
      amount: amount(budget.amount),
      spent: amount(budget.spent),
    })),
    summary: {
      monthKey: safeMonthKey,
      income,
      expenses,
      net: income - expenses,
      budgeted,
      carryForward,
      transactionCount: rows.length,
    },
  };
}

export function hasClosure(closures = [], monthKey) {
  return (closures || []).some(closure => closure.month_key === monthKey);
}
