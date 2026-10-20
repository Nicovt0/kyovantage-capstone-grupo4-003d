-- Roles are stored in auth.users.raw_app_meta_data and are not writable by clients.
create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'user');
$$;

create or replace function public.is_admin_or_superadmin()
returns boolean
language sql
stable
security invoker
as $$
  select public.current_app_role() in ('admin', 'superadmin');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security invoker
as $$
  select public.current_app_role() = 'superadmin';
$$;

-- Apply owner isolation to user-owned tables when they exist. Existing project
-- schemas can run this migration safely even if an optional table is absent.
do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'accounts', 'budgets', 'goals', 'credit_cards', 'transactions',
    'recurring_templates', 'billing_statements', 'credit_card_ledger',
    'notifications', 'user_custom_banks', 'user_custom_categories',
    'budget_historical_analytics', 'financial_health_snapshots',
    'kyo_score_historical_features', 'support_tickets', 'user_bank_settings'
  ] loop
    if to_regclass('public.' || v_table_name) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and information_schema.columns.table_name = v_table_name and column_name = 'user_id'
       ) then
      execute format('alter table public.%I enable row level security', v_table_name);
      execute format('drop policy if exists %I on public.%I', v_table_name || '_owner_select', v_table_name);
      execute format('drop policy if exists %I on public.%I', v_table_name || '_owner_insert', v_table_name);
      execute format('drop policy if exists %I on public.%I', v_table_name || '_owner_update', v_table_name);
      execute format('drop policy if exists %I on public.%I', v_table_name || '_owner_delete', v_table_name);
      execute format('create policy %I on public.%I for select using (user_id = auth.uid() or public.is_admin_or_superadmin())', v_table_name || '_owner_select', v_table_name);
      execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', v_table_name || '_owner_insert', v_table_name);
      execute format('create policy %I on public.%I for update using (user_id = auth.uid() or public.is_admin_or_superadmin()) with check (user_id = auth.uid() or public.is_admin_or_superadmin())', v_table_name || '_owner_update', v_table_name);
      execute format('create policy %I on public.%I for delete using (user_id = auth.uid() or public.is_admin_or_superadmin())', v_table_name || '_owner_delete', v_table_name);
    end if;
  end loop;
end $$;

-- Role changes must be performed with the Supabase dashboard, CLI, or a
-- server-side Edge Function using the Service Role Key. Never expose that key
-- to the browser or accept role values from user_metadata.
