-- Apply exclusively to staging after 20261018000004. No data or table changes.
-- Patch only the known account-count guard, preserving the deployed function.
begin;
do $migration$
declare
  definition text;
  guard text := $guard$if (select count(*) from public.accounts where user_id=v_user and not coalesce(is_archived,false) and coalesce((to_jsonb(accounts)->>'is_active')::boolean,true))>=5 then raise exception 'Límite Beta: 5 cuentas activas.'; end if;$guard$;
begin
  select pg_get_functiondef('public.accounting_mutate(text,jsonb,uuid)'::regprocedure) into definition;
  if strpos(definition, guard) > 0 then
    execute replace(definition, guard, '-- Account count is unrestricted for staging testing.');
  elsif strpos(definition, 'Límite Beta: 5 cuentas activas.') > 0 then
    raise exception 'El límite desplegado difiere del esperado. Revisar accounting_mutate antes de continuar.';
  else
    raise notice 'El límite conocido de cuentas ya está retirado.';
  end if;
end
$migration$;
commit;
