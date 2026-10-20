-- Solo staging. Reutiliza categories; no añade tablas, columnas ni colores.
begin;
alter table public.categories enable row level security;
-- Sustituir políticas anteriores: las permisivas se combinarían con OR.
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname='public' and tablename='categories' loop
    execute format('drop policy %I on public.categories', policy_row.policyname);
  end loop;
end $$;
grant select, insert, update, delete on public.categories to authenticated;
grant select on public.categories to anon;
create policy categories_read on public.categories for select to anon, authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy categories_insert_own on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update_own on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete_own on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));
-- Las FK existentes bloquean borrar categorías en uso, sin alterar historial.
commit;
