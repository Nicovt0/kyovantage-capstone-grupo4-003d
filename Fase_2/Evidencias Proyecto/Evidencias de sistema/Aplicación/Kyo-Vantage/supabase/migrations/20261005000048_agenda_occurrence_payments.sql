-- An occurrence is paid exactly once. No global template status is changed.
create table public.agenda_occurrence_payments (
  template_id uuid not null references public.recurring_templates(id),
  occurrence_date date not null,
  user_id uuid not null references auth.users(id),
  transaction_id uuid not null unique references public.transactions(id),
  account_id uuid not null references public.accounts(id),
  amount numeric not null check (amount > 0),
  paid_at timestamptz not null default now(),
  primary key (template_id, occurrence_date)
);
alter table public.agenda_occurrence_payments enable row level security;
create policy agenda_payments_select on public.agenda_occurrence_payments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy agenda_payments_insert on public.agenda_occurrence_payments
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.recurring_templates t where t.id = template_id and t.user_id = auth.uid())
    and exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()
      and t.type = 'expense' and t.amount = agenda_occurrence_payments.amount
      and t.account_id = agenda_occurrence_payments.account_id)
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
grant select, insert on public.agenda_occurrence_payments to authenticated;
revoke all on public.agenda_occurrence_payments from anon;

create or replace function public.pay_agenda_occurrence(
  p_template_id uuid, p_occurrence_date date, p_account_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_template public.recurring_templates%rowtype;
  v_transaction uuid;
  v_account public.accounts%rowtype;
  v_amount numeric;
  v_base_date date;
  v_month_start date;
  v_last_day integer;
  v_day integer;
  v_expected_date date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_occurrence_date is null or p_account_id is null then
    raise exception 'La fecha del compromiso y la cuenta de pago son obligatorias.';
  end if;
  select * into v_template from public.recurring_templates
    where id = p_template_id and user_id = auth.uid() for update;
  if not found then raise exception 'Compromiso inexistente o sin acceso.'; end if;
  -- Serialize on the template before checking idempotency, including concurrent retries.
  select transaction_id into v_transaction from public.agenda_occurrence_payments
    where template_id = p_template_id and occurrence_date = p_occurrence_date and user_id = auth.uid();
  if found then return v_transaction; end if;
  if v_template.is_active = false then raise exception 'El compromiso está inactivo.'; end if;
  if v_template.frequency is not null and v_template.frequency not in ('once','monthly','yearly') then
    raise exception 'Frecuencia del compromiso inválida.';
  end if;
  v_base_date := v_template.next_due_date;
  v_month_start := date_trunc('month', p_occurrence_date)::date;
  v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
  v_day := coalesce(v_template.day_of_month, extract(day from v_base_date)::integer, 1);
  if v_day < 1 or v_day > 31 then raise exception 'Día de pago inválido.'; end if;
  v_expected_date := v_month_start + (least(v_day, v_last_day) - 1);
  if coalesce(v_template.frequency, 'monthly') = 'once' then
    if v_base_date is null or p_occurrence_date <> v_base_date then raise exception 'Fecha del compromiso inválida.'; end if;
  elsif v_template.frequency = 'yearly' then
    if v_base_date is null or extract(month from p_occurrence_date) <> extract(month from v_base_date)
      or extract(day from p_occurrence_date) <> least(extract(day from v_base_date)::integer, v_last_day) then
      raise exception 'Fecha anual del compromiso inválida.';
    end if;
  elsif p_occurrence_date <> v_expected_date then
    raise exception 'Fecha mensual del compromiso inválida.';
  end if;
  v_amount := v_template.expected_amount;
  if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'El importe debe ser positivo y finito.';
  end if;
  select * into v_account from public.accounts
    where id = p_account_id and user_id = auth.uid() and coalesce(is_archived, false) = false for update;
  if not found then raise exception 'Selecciona una cuenta propia activa.'; end if;
  if v_template.category_id is not null and not exists (
    select 1 from public.categories where id = v_template.category_id and (user_id = auth.uid() or user_id is null)
  ) then raise exception 'La categoría no pertenece al usuario.'; end if;
  insert into public.transactions(user_id, account_id, category_id, type, amount, date, name, note)
    values(auth.uid(), p_account_id, v_template.category_id, 'expense', v_amount, now(),
      v_template.name, 'Pago de compromiso de agenda: ' || p_occurrence_date)
    returning id into v_transaction;
  update public.accounts set balance = balance - v_amount where id = p_account_id and user_id = auth.uid();
  if not found then raise exception 'No se pudo actualizar el saldo de la cuenta.'; end if;
  insert into public.agenda_occurrence_payments(template_id, occurrence_date, user_id, transaction_id, account_id, amount)
    values(p_template_id, p_occurrence_date, auth.uid(), v_transaction, p_account_id, v_amount);
  return v_transaction;
end;
$$;
revoke all on function public.pay_agenda_occurrence(uuid, date, uuid) from public, anon;
grant execute on function public.pay_agenda_occurrence(uuid, date, uuid) to authenticated;
