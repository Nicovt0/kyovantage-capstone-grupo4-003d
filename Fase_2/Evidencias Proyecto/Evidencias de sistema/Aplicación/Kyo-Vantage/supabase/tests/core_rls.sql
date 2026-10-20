-- Run as the staging database owner, in one connection / one transaction.
-- No fixture survives this transaction. An assertion failure aborts it; ROLLBACK
-- (or connection close) is required before reusing that connection after failure.
-- This tests actual policies as authenticated, with synthetic user JWT claims.
-- It does not validate browser sessions, login or REST/PostgREST configuration.
begin;
set local statement_timeout = '30s';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temporary table core_rls_fixtures (
  owner_a uuid, owner_b uuid,
  account_a uuid, account_b uuid,
  budget_a uuid, budget_b uuid,
  goal_a uuid, goal_b uuid, category uuid
) on commit drop;
insert into core_rls_fixtures select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
grant select on core_rls_fixtures to authenticated;

-- Service-role claim allows administrative creation through the signup gate.
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select owner_a, 'authenticated', 'authenticated', 'core-rls-a-' || owner_a || '@example.invalid', now(), '{"role":"user"}'::jsonb, '{}'::jsonb, now(), now() from core_rls_fixtures
union all
select owner_b, 'authenticated', 'authenticated', 'core-rls-b-' || owner_b || '@example.invalid', now(), '{"role":"user"}'::jsonb, '{}'::jsonb, now(), now() from core_rls_fixtures;

insert into public.categories (id, name, type)
select category, 'Core RLS test expense', 'expense' from core_rls_fixtures;
insert into public.accounts (id, user_id, name, type, balance)
select account_a, owner_a, 'Core RLS account A', 'cash', 100 from core_rls_fixtures
union all select account_b, owner_b, 'Core RLS account B', 'cash', 200 from core_rls_fixtures;
insert into public.budgets (id, user_id, category_id, limit_amount)
select budget_a, owner_a, category, 1000 from core_rls_fixtures
union all select budget_b, owner_b, category, 2000 from core_rls_fixtures;
insert into public.goals (id, user_id, name, target_amount, current_amount, deadline_date)
select goal_a, owner_a, 'Core RLS goal A', 1000, 100, now() + interval '1 month' from core_rls_fixtures
union all select goal_b, owner_b, 'Core RLS goal B', 2000, 200, now() + interval '1 month' from core_rls_fixtures;

select set_config('request.jwt.claim.sub', owner_a::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', owner_a, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'user'))::text, true)
from core_rls_fixtures;
set local role authenticated;

do $$
declare
  fixture record;
  item record;
  seen integer;
  affected integer;
  denied boolean;
begin
  select * into strict fixture from core_rls_fixtures;
  if current_user <> 'authenticated' or auth.uid() is distinct from fixture.owner_a then
    raise exception 'Invalid authenticated test context';
  end if;
  for item in select * from (values
    ('accounts', fixture.account_a, fixture.account_b, 'balance'),
    ('budgets', fixture.budget_a, fixture.budget_b, 'limit_amount'),
    ('goals', fixture.goal_a, fixture.goal_b, 'current_amount')
  ) as checks(table_name, own_id, other_id, amount_column) loop
    execute format('select count(*) from public.%I where id = $1', item.table_name) into seen using item.own_id;
    if seen <> 1 then raise exception '%: own row not visible', item.table_name; end if;
    execute format('select count(*) from public.%I where id = $1', item.table_name) into seen using item.other_id;
    if seen <> 0 then raise exception '%: another user row visible', item.table_name; end if;
    -- Confirm legitimate updates work, rather than mistaking a missing grant
    -- or globally blocked UPDATE for owner isolation.
    execute format('update public.%I set %I = %I + 1 where id = $1', item.table_name, item.amount_column, item.amount_column) using item.own_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception '%: own update failed', item.table_name; end if;
    execute format('update public.%I set %I = %I + 999 where id = $1', item.table_name, item.amount_column, item.amount_column) using item.other_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '%: another user update allowed', item.table_name; end if;
    if not has_column_privilege(current_user, 'public.' || item.table_name, 'user_id', 'UPDATE') then
      raise exception '%: missing ownership-column UPDATE grant; cannot verify WITH CHECK', item.table_name;
    end if;
    -- Exercise WITH CHECK using an initially visible row. Subtransaction
    -- rolls back only the attempted transfer when the expected error occurs.
    denied := false;
    begin
      execute format('update public.%I set user_id = $1 where id = $2', item.table_name) using fixture.owner_b, item.own_id;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception '%: ownership reassignment was not rejected', item.table_name; end if;
    raise notice '%: owner SELECT/UPDATE allowed; other SELECT/UPDATE blocked; ownership reassignment rejected', item.table_name;
  end loop;
end $$;

-- Repeat isolation in the opposite direction with the second user.
select set_config('request.jwt.claim.sub', owner_b::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', owner_b, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'user'))::text, true)
from core_rls_fixtures;
do $$
declare fixture record; item record; seen integer;
begin
  select * into strict fixture from core_rls_fixtures;
  if auth.uid() is distinct from fixture.owner_b then raise exception 'Invalid user B context'; end if;
  for item in select * from (values
    ('accounts', fixture.account_b, fixture.account_a),
    ('budgets', fixture.budget_b, fixture.budget_a),
    ('goals', fixture.goal_b, fixture.goal_a)
  ) as checks(table_name, own_id, other_id) loop
    execute format('select count(*) from public.%I where id = $1', item.table_name) into seen using item.own_id;
    if seen <> 1 then raise exception '%: B own row not visible', item.table_name; end if;
    execute format('select count(*) from public.%I where id = $1', item.table_name) into seen using item.other_id;
    if seen <> 0 then raise exception '%: A row visible to B', item.table_name; end if;
  end loop;
end $$;
reset role;
select 'PASS: core owner isolation, update checks and reassignment checks; fixtures rolled back' as result;
rollback;
