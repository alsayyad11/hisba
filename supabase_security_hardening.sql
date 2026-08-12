-- Hisba security hardening for Supabase
-- Run this in Supabase SQL Editor after reviewing the existing schema.
-- The policies require authenticated users and scope private rows to auth.uid().

alter table if exists public.profiles enable row level security;
alter table if exists public.accounts enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.budgets enable row level security;
alter table if exists public.goals enable row level security;
alter table if exists public.bills enable row level security;
alter table if exists public.categories enable row level security;

-- Profiles are keyed by id; all other private tables are keyed by user_id.
drop policy if exists hisba_profiles_select on public.profiles;
drop policy if exists hisba_profiles_insert on public.profiles;
drop policy if exists hisba_profiles_update on public.profiles;
drop policy if exists hisba_profiles_delete on public.profiles;
create policy hisba_profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy hisba_profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy hisba_profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy hisba_profiles_delete on public.profiles for delete to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','budgets','goals','bills'] loop
    execute format('drop policy if exists hisba_select_own on public.%I', t);
    execute format('drop policy if exists hisba_insert_own on public.%I', t);
    execute format('drop policy if exists hisba_update_own on public.%I', t);
    execute format('drop policy if exists hisba_delete_own on public.%I', t);
    execute format('create policy hisba_select_own on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy hisba_insert_own on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy hisba_update_own on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy hisba_delete_own on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Categories: predefined rows (user_id is null) are readable, but only user-owned rows are writable.
drop policy if exists hisba_categories_select on public.categories;
drop policy if exists hisba_categories_insert on public.categories;
drop policy if exists hisba_categories_update on public.categories;
drop policy if exists hisba_categories_delete on public.categories;
create policy hisba_categories_select on public.categories for select to authenticated
  using (user_id = auth.uid() or user_id is null);
create policy hisba_categories_insert on public.categories for insert to authenticated
  with check (user_id = auth.uid() and coalesce(is_predefined, false) = false);
create policy hisba_categories_update on public.categories for update to authenticated
  using (user_id = auth.uid() and coalesce(is_predefined, false) = false)
  with check (user_id = auth.uid() and coalesce(is_predefined, false) = false);
create policy hisba_categories_delete on public.categories for delete to authenticated
  using (user_id = auth.uid() and coalesce(is_predefined, false) = false);

-- Recommended integrity constraints; only add if compatible with the existing schema.
-- alter table public.transactions add constraint transactions_amount_positive check (amount > 0);
-- alter table public.budgets add constraint budgets_amount_nonnegative check (amount >= 0);
-- alter table public.goals add constraint goals_target_positive check (target_amount > 0);

-- Storage: use a private avatars bucket and user-scoped object paths.
-- Create the bucket in Storage if it does not exist, then apply these policies.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;
drop policy if exists hisba_avatar_read on storage.objects;
drop policy if exists hisba_avatar_insert on storage.objects;
drop policy if exists hisba_avatar_update on storage.objects;
drop policy if exists hisba_avatar_delete on storage.objects;
create policy hisba_avatar_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy hisba_avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy hisba_avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy hisba_avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
