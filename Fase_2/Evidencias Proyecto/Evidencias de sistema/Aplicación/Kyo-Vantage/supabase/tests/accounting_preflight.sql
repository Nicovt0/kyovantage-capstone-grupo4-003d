-- READ ONLY. Run against staging before applying 20261018000000_atomic_accounting.sql.
-- Review results; this script never fixes, deletes or recomputes financial history.
select current_database() as database_name, current_user as role;
select n.nspname as schema_name,c.relname as table_name,t.tgname,
  pg_get_triggerdef(t.oid) as trigger_definition,p.proname as function_name
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and n.nspname='public'
  and c.relname in ('accounts','transactions','credit_card_ledger','billing_statements')
order by c.relname,t.tgname;
select p.oid::regprocedure as function_name,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('handle_transaction_balance_update','pay_agenda_occurrence','update_account_balance','decrement_account_balance');
select credit_card_id,billing_period,count(*) as duplicate_count from public.billing_statements
  group by credit_card_id,billing_period having count(*)>1;
select transfer_group_id,count(*) as legs,count(distinct user_id) as owners,
  sum(case when type='income' then amount when type='expense' then -amount else 0 end) as net_amount
from public.transactions where transfer_group_id is not null group by transfer_group_id
having count(*)<>2 or count(distinct user_id)<>1
  or sum(case when type='income' then amount when type='expense' then -amount else 0 end)<>0;
-- Flag cards requiring historical principal reconciliation, not a correction to apply automatically.
select credit_card_id,count(*) as statements_with_old_payments
from public.billing_statements where coalesce(amount_paid,0)>0 group by credit_card_id;
select count(*) as accounts_with_unsynchronized_balances from public.accounts
where to_jsonb(accounts)->>'current_balance' is distinct from to_jsonb(accounts)->>'balance';

select credit_card_id,count(*) as purchases_without_registration_date
from public.credit_card_ledger l where l.status in ('active','refinanced') and to_jsonb(l)->>'created_at' is null
  group by credit_card_id;
