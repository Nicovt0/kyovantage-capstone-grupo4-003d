-- Read only. Run exclusively in staging to check the existing subscription table.
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='push_subscriptions';
select policyname,cmd,roles,qual,with_check from pg_policies
where schemaname='public' and tablename='push_subscriptions';
select has_table_privilege('authenticated','public.push_subscriptions','SELECT') as can_read,
  has_table_privilege('authenticated','public.push_subscriptions','INSERT') as can_insert,
  has_table_privilege('authenticated','public.push_subscriptions','UPDATE') as can_update,
  has_table_privilege('authenticated','public.push_subscriptions','DELETE') as can_delete;
