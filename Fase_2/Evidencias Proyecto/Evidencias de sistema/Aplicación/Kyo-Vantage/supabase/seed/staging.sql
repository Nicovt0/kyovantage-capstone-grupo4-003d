-- Safe, repeatable seed for staging. It contains no auth users or personal data.
do $$
begin
  if not exists (select 1 from public.banks where name = 'Banco de Chile') then
    insert into public.banks (name, color) values ('Banco de Chile', '#7C3AED');
  end if;
  if not exists (select 1 from public.banks where name = 'Banco Estado') then
    insert into public.banks (name, color) values ('Banco Estado', '#2563EB');
  end if;
  if not exists (select 1 from public.banks where name = 'Santander') then
    insert into public.banks (name, color) values ('Santander', '#DC2626');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from public.categories where name = 'Sueldo') then
    insert into public.categories (name, type, color, icon_name) values ('Sueldo', 'income', '#16A34A', 'BriefcaseBusiness');
  end if;
  if not exists (select 1 from public.categories where name = 'Alimentación') then
    insert into public.categories (name, type, color, icon_name) values ('Alimentación', 'expense', '#F97316', 'Utensils');
  end if;
  if not exists (select 1 from public.categories where name = 'Transporte') then
    insert into public.categories (name, type, color, icon_name) values ('Transporte', 'expense', '#2563EB', 'Car');
  end if;
  if not exists (select 1 from public.categories where name = 'Vivienda') then
    insert into public.categories (name, type, color, icon_name) values ('Vivienda', 'expense', '#7C3AED', 'House');
  end if;
  if not exists (select 1 from public.categories where name = 'Saldo Inicial') then
    insert into public.categories (name, type, color, icon_name) values ('Saldo Inicial', 'income', '#6D28D9', 'Wallet');
  end if;
end $$;
