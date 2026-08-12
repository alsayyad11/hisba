-- Hisba: monthly budgets
-- Run this once in Supabase SQL Editor if the budgets table does not already have month_key.
alter table public.budgets
  add column if not exists month_key text,
  add column if not exists week_key text;

create index if not exists budgets_user_month_key_idx
  on public.budgets (user_id, month_key);

create index if not exists budgets_user_week_key_idx
  on public.budgets (user_id, week_key);
