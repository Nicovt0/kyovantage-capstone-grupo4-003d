-- STAGING: restore the original TABLE SET without losing confirmed movements or request receipts.
-- Requires 20261018000000 and 20261018000001. Works with or without 00002/00003.
-- Reuses agenda_occurrence_payments for receipts and billing_statements for statement line items.
-- One transaction; missing/conflicting data aborts everything. No DROP CASCADE, TRUNCATE or balance replay.
begin;
lock table public.agenda_occurrence_payments,public.transactions,public.billing_statements,public.goals,public.recurring_templates in access exclusive mode;
alter table public.goals add column if not exists reminders boolean not null default true;
alter table public.goals add column if not exists plan_start_date date;
alter table public.billing_statements add column if not exists principal_items jsonb not null default '[]'::jsonb;
alter table public.billing_statements add constraint billing_principal_items_array check(jsonb_typeof(principal_items)='array');
alter table public.recurring_templates add column if not exists goal_id uuid references public.goals(id);
create unique index if not exists uq_recurring_goal on public.recurring_templates(goal_id);
alter table public.recurring_templates drop constraint if exists recurring_templates_expected_amount_check;
alter table public.recurring_templates add constraint recurring_templates_expected_amount_check
  check(expected_amount>0 or (expected_amount=0 and goal_id is not null and is_variable_amount));

-- Preserve every old template/date key while allowing non-template receipts in the SAME existing table.
alter table public.agenda_occurrence_payments add column if not exists id uuid not null default gen_random_uuid();
alter table public.agenda_occurrence_payments drop constraint agenda_occurrence_payments_pkey;
alter table public.agenda_occurrence_payments add primary key(id);
create unique index if not exists uq_agenda_template_date on public.agenda_occurrence_payments(template_id,occurrence_date);
alter table public.agenda_occurrence_payments alter column template_id drop not null;
alter table public.agenda_occurrence_payments alter column occurrence_date drop not null;
alter table public.agenda_occurrence_payments alter column transaction_id drop not null;
alter table public.agenda_occurrence_payments alter column account_id drop not null;
alter table public.agenda_occurrence_payments alter column amount drop not null;
alter table public.agenda_occurrence_payments add column receipt_type text not null default 'agenda';
alter table public.agenda_occurrence_payments add column statement_id uuid references public.billing_statements(id);
alter table public.agenda_occurrence_payments add column principal_amount numeric check(principal_amount>=0);
alter table public.agenda_occurrence_payments add column goal_id uuid references public.goals(id);
alter table public.agenda_occurrence_payments add column occurrence_month date;
alter table public.agenda_occurrence_payments add column destination_transaction_id uuid unique references public.transactions(id);
alter table public.agenda_occurrence_payments add column savings_account_id uuid references public.accounts(id);
alter table public.agenda_occurrence_payments add column request_id uuid;
alter table public.agenda_occurrence_payments add column fingerprint text;
alter table public.agenda_occurrence_payments add column result jsonb;
create unique index uq_receipt_request on public.agenda_occurrence_payments(user_id,request_id) where receipt_type='request';
create unique index uq_receipt_goal_month on public.agenda_occurrence_payments(goal_id,occurrence_month) where goal_id is not null;
alter table public.agenda_occurrence_payments add constraint receipt_shape check(
  (receipt_type='request' and request_id is not null and fingerprint is not null and result is not null
    and template_id is null and transaction_id is null and account_id is null and amount is null and statement_id is null and goal_id is null)
  or (receipt_type='agenda' and template_id is not null and occurrence_date is not null and transaction_id is not null and account_id is not null and amount>0 and amount is not null
    and request_id is null and statement_id is null)
  or (receipt_type='billing' and statement_id is not null and transaction_id is not null and account_id is not null and amount>0 and amount is not null
    and principal_amount is not null and principal_amount>=0 and request_id is null and template_id is null and goal_id is null)
);
alter table public.agenda_occurrence_payments enable row level security;
drop policy if exists agenda_payments_select on public.agenda_occurrence_payments;
create policy agenda_payments_select on public.agenda_occurrence_payments for select to authenticated
  using(user_id=(select auth.uid()) and receipt_type<>'request');
create policy receipt_owner_scope on public.agenda_occurrence_payments as restrictive for select to authenticated
  using(user_id=(select auth.uid()) and receipt_type<>'request');
grant select on public.agenda_occurrence_payments to authenticated;
revoke insert,update,delete on public.agenda_occurrence_payments from public,anon,authenticated;

-- Migrate card receipts, allocation snapshots and retry results BEFORE removing any table.
do $$ begin
  if to_regclass('public.billing_payments') is not null then
    insert into public.agenda_occurrence_payments(id,receipt_type,user_id,statement_id,transaction_id,account_id,amount,principal_amount,paid_at)
      select id,'billing',user_id,statement_id,transaction_id,account_id,amount,principal_amount,paid_at from public.billing_payments;
    if exists(select 1 from public.billing_payments b where not exists(select 1 from public.agenda_occurrence_payments p where p.id=b.id and p.receipt_type='billing' and p.amount=b.amount and p.principal_amount=b.principal_amount and p.transaction_id=b.transaction_id)) then
      raise exception 'No se pudieron conservar todos los pagos de tarjetas.';
    end if;
  end if;
  if to_regclass('private.billing_principal_items') is not null then
    if exists(select 1 from private.billing_principal_items i join public.billing_statements s on s.id=i.statement_id
      join public.credit_card_ledger l on l.id=i.ledger_id where s.user_id<>l.user_id or s.credit_card_id<>l.credit_card_id) then
      raise exception 'Las asignaciones de capital no coinciden con el propietario o tarjeta; requieren revisión.';
    end if;
    update public.billing_statements s set principal_items=x.items from (
      select statement_id,jsonb_agg(jsonb_build_object('ledger_id',ledger_id,'scheduled',scheduled,'paid',paid) order by ledger_id) items
      from private.billing_principal_items group by statement_id) x where s.id=x.statement_id;
    if exists(select 1 from private.billing_principal_items i where not exists(select 1 from public.billing_statements s,
      jsonb_to_recordset(s.principal_items) p(ledger_id uuid,scheduled numeric,paid numeric)
      where s.id=i.statement_id and p.ledger_id=i.ledger_id and p.scheduled=i.scheduled and p.paid=i.paid)) then
      raise exception 'No se pudieron conservar las asignaciones de capital.';
    end if;
  end if;
  if to_regclass('private.accounting_requests') is not null then
    insert into public.agenda_occurrence_payments(receipt_type,user_id,request_id,fingerprint,result,paid_at)
      select 'request',user_id,request_id,fingerprint,result,created_at from private.accounting_requests;
    if exists(select 1 from private.accounting_requests a where not exists(select 1 from public.agenda_occurrence_payments p
      where p.receipt_type='request' and p.user_id=a.user_id and p.request_id=a.request_id and p.fingerprint=a.fingerprint and p.result=a.result)) then
      raise exception 'No se pudieron conservar los resultados de reintentos.';
    end if;
  end if;
end $$;
create or replace function private.guard_transaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid;
begin
  if tg_op <> 'INSERT' then
    if exists(select 1 from public.agenda_occurrence_payments where transaction_id = old.id)
      or exists(select 1 from public.agenda_occurrence_payments where destination_transaction_id = old.id) then
      raise exception 'Pago confirmado protegido: requiere una reversión contable.';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if new.user_id is distinct from old.user_id then raise exception 'No se puede cambiar el propietario.'; end if;
  end if;
  if new.user_id is null or (auth.uid() is not null and new.user_id <> auth.uid()) then
    raise exception 'Propietario del movimiento inválido.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if new.amount is null or new.amount <= 0 or new.amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'El importe debe ser positivo y finito.';
  end if;
  if coalesce(new.status,'paid') not in ('paid','pending','cancelled') then raise exception 'Estado inválido.'; end if;
  if new.type not in ('income','expense','transfer') or new.type is null then raise exception 'Tipo inválido.'; end if;
  foreach v_id in array array[new.account_id,new.source_account_id,new.destination_account_id] loop
    if v_id is not null and not exists(select 1 from public.accounts where id=v_id and user_id=new.user_id and not coalesce(is_archived,false)) then
      raise exception 'Selecciona una cuenta propia activa.';
    end if;
  end loop;
  if new.credit_card_id is not null and not exists(select 1 from public.credit_cards where id=new.credit_card_id and user_id=new.user_id and not coalesce(is_archived,false)) then
    raise exception 'Selecciona una tarjeta propia activa.';
  end if;
  if new.goal_id is not null and not exists(select 1 from public.goals where id=new.goal_id and user_id=new.user_id) then
    raise exception 'La meta no pertenece al usuario.';
  end if;
  if new.category_id is not null and not exists(select 1 from public.categories where id=new.category_id and (user_id=new.user_id or user_id is null)) then
    raise exception 'La categoría no pertenece al usuario.';
  end if;
  if new.account_id is not null and new.credit_card_id is not null then raise exception 'Selecciona una sola fuente.'; end if;
  if new.type='transfer' then
    if coalesce(new.source_account_id,new.account_id) is null or new.destination_account_id is null
      or coalesce(new.source_account_id,new.account_id)=new.destination_account_id or new.credit_card_id is not null then
      raise exception 'La transferencia requiere dos cuentas distintas.';
    end if;
  elsif new.source_account_id is not null or new.destination_account_id is not null then
    raise exception 'Las cuentas origen y destino requieren una transferencia.';
  end if;
  if coalesce(new.status,'paid')='paid' and coalesce(new.account_id,new.source_account_id,new.credit_card_id) is null then
    raise exception 'El movimiento pagado requiere una cuenta.';
  end if;
  return new;
end $$;
create or replace function private.goal_plan_anchor() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.plan_start_date:=coalesce(new.plan_start_date,(new.start_date at time zone 'UTC')::date,(now() at time zone 'America/Santiago')::date);
  elsif new.target_amount is distinct from old.target_amount or new.deadline_date is distinct from old.deadline_date
    or new.contribution_type is distinct from old.contribution_type
    or (new.contribution_type='fixed' and new.contribution_amount is distinct from old.contribution_amount) then
    new.plan_start_date:=(now() at time zone 'America/Santiago')::date;
  else new.plan_start_date:=old.plan_start_date;
  end if;
  if tg_op='UPDATE' and new.contribution_type='auto' and new.current_amount is distinct from old.current_amount then
    new.contribution_amount:=private.goal_occurrence_amount(new,date_trunc('month',(now() at time zone 'America/Santiago'))::date);
  end if;
  return new;
end $$;
drop trigger if exists trg_goal_plan_anchor on public.goals;
create trigger trg_goal_plan_anchor before insert or update on public.goals for each row execute function private.goal_plan_anchor();

create or replace function private.goal_occurrence_date(g public.goals,m date) returns date
language sql stable set search_path='' as $$
  select m+(least(extract(day from coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date))::integer,
    extract(day from (m+interval '1 month - 1 day'))::integer)-1);
$$;
create or replace function private.goal_occurrence_amount(g public.goals,m date) returns numeric
language plpgsql stable security definer set search_path='' as $$
declare v_remaining numeric:=greatest(0,g.target_amount-coalesce(g.current_amount,0)); v_base date;
  v_reference date; v_end date; v_count integer; v_prior integer;
begin
  if g.contribution_type='free' then return 0; end if;
  if v_remaining=0 then return 0; end if;
  v_base:=date_trunc('month',coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date))::date+interval '1 month';
  v_reference:=greatest(v_base,date_trunc('month',(now() at time zone 'America/Santiago'))::date);
  v_end:=(g.deadline_date at time zone 'UTC')::date;
  if g.contribution_type='fixed' then
    select count(*) into v_prior from generate_series(v_reference,m-interval '1 month',interval '1 month') d
      where private.goal_occurrence_date(g,d::date)<=v_end and not exists(select 1 from public.agenda_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=d::date);
    return least(coalesce(g.contribution_amount,0),greatest(0,v_remaining-v_prior*coalesce(g.contribution_amount,0)));
  end if;
  select count(*) into v_count from generate_series(v_reference,date_trunc('month',v_end)::date,interval '1 month') d
    where private.goal_occurrence_date(g,d::date)<=v_end
      and not exists(select 1 from public.agenda_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=d::date);
  return least(v_remaining,ceil(v_remaining/greatest(1,v_count)));
end $$;

create or replace function public.get_goal_agenda_occurrences(p_start date,p_end date)
returns table(goal_id uuid,title text,contribution_type text,occurrence_date date,amount numeric,status text,transaction_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare g public.goals; r public.agenda_occurrence_payments; d record; v_month date; v_due date; v_amount numeric; v_base date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end>p_start+interval '10 years' then raise exception 'Rango de agenda inválido.'; end if;
  for g in select * from public.goals x where x.user_id=auth.uid() loop
    for d in select generate_series(date_trunc('month',p_start),date_trunc('month',p_end),interval '1 month') as month loop
      v_month:=d.month::date;
      select * into r from public.agenda_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=v_month and p.user_id=auth.uid();
      if found then
        if r.occurrence_date between p_start and p_end then
          goal_id:=g.id;title:=g.name;contribution_type:=g.contribution_type;occurrence_date:=r.occurrence_date;amount:=r.amount;status:='paid';transaction_id:=r.transaction_id;return next;
        end if;
        continue;
      end if;
      if g.deadline_date is null or coalesce(g.current_amount,0)>=g.target_amount or coalesce(g.is_completed,false) or g.contribution_type not in ('auto','fixed','free') or g.contribution_type is null then continue; end if;
      v_base:=coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date);
      if v_month<=date_trunc('month',v_base)::date then continue; end if;
      v_due:=private.goal_occurrence_date(g,v_month);
      if v_due not between p_start and p_end or v_due>(g.deadline_date at time zone 'UTC')::date then continue; end if;
      v_amount:=private.goal_occurrence_amount(g,v_month);
      if v_amount<=0 and g.contribution_type<>'free' then continue; end if;
      goal_id:=g.id;title:=g.name;contribution_type:=g.contribution_type;occurrence_date:=v_due;amount:=v_amount;
      status:=case when v_due<(now() at time zone 'America/Santiago')::date then 'overdue' else 'pending' end;
      transaction_id:=null;return next;
    end loop;
  end loop;
end $$;

create or replace function public.pay_goal_occurrence(p_goal_id uuid,p_occurrence_date date,p_account_id uuid,p_amount numeric default null,p_savings_account_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.goals; r public.agenda_occurrence_payments; v_month date:=date_trunc('month',p_occurrence_date)::date;
  v_due date; v_expected numeric; v_amount numeric; v_id uuid; v_dest_id uuid; v_group uuid; v_base date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_occurrence_date is null or p_account_id is null then raise exception 'Selecciona fecha y cuenta de origen.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into g from public.goals where id=p_goal_id and user_id=auth.uid() for update;
  if not found then raise exception 'Meta inexistente o sin acceso.'; end if;
  select * into r from public.agenda_occurrence_payments where goal_id=g.id and occurrence_month=v_month and user_id=auth.uid();
  if found then
    if r.occurrence_date is distinct from p_occurrence_date or r.account_id is distinct from p_account_id or r.savings_account_id is distinct from p_savings_account_id
      or (p_amount is not null and r.amount<>p_amount) then raise exception 'El aporte de este mes ya está confirmado con otros datos.'; end if;
    return r.transaction_id;
  end if;
  v_base:=coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date);
  v_due:=private.goal_occurrence_date(g,v_month);
  if g.deadline_date is null or v_month<=date_trunc('month',v_base)::date or p_occurrence_date<>v_due or v_due>(g.deadline_date at time zone 'UTC')::date
    or coalesce(g.current_amount,0)>=g.target_amount or coalesce(g.is_completed,false) then raise exception 'La fecha no corresponde a un aporte pendiente de esta meta.'; end if;
  if exists(select 1 from public.transactions t where t.goal_id=g.id and t.user_id=auth.uid() and t.status='pending' and date_trunc('month',t.date at time zone 'UTC')::date=v_month) then
    raise exception 'Existe un aporte pendiente heredado para este mes; requiere conciliación antes de confirmar otro.';
  end if;
  v_expected:=private.goal_occurrence_amount(g,v_month);
  v_amount:=coalesce(p_amount,v_expected);
  if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Define un aporte positivo y finito.'; end if;
  if g.contribution_type not in ('auto','fixed','free') or g.contribution_type is null then raise exception 'Configura el plan de la meta antes de aportar.'; end if;
  if g.contribution_type<>'free' and v_amount<>v_expected then raise exception 'El aporte cambió según el plan. Actualiza Agenda antes de confirmar.'; end if;
  if v_amount>g.target_amount-coalesce(g.current_amount,0) then raise exception 'El aporte supera lo que falta para completar la meta.'; end if;
  if p_savings_account_id=p_account_id then raise exception 'Selecciona dos cuentas distintas.'; end if;
  v_group:=case when p_savings_account_id is not null then gen_random_uuid() else null end;
  insert into public.transactions(user_id,account_id,goal_id,type,amount,name,status,date,transfer_group_id)
    values(auth.uid(),p_account_id,g.id,'expense',v_amount,'Aporte a meta: '||g.name,'paid',now(),v_group) returning id into v_id;
  if p_savings_account_id is not null then
    insert into public.transactions(user_id,account_id,type,amount,name,status,date,transfer_group_id)
      values(auth.uid(),p_savings_account_id,'income',v_amount,'Aporte a meta: '||g.name||' (Ahorro)','paid',now(),v_group) returning id into v_dest_id;
  end if;
  insert into public.agenda_occurrence_payments(template_id,goal_id,occurrence_month,occurrence_date,user_id,transaction_id,destination_transaction_id,account_id,savings_account_id,amount)
    values(private.ensure_goal_template(g),g.id,v_month,p_occurrence_date,auth.uid(),v_id,v_dest_id,p_account_id,p_savings_account_id,v_amount);
  if g.contribution_type='auto' then
    select * into g from public.goals where id=p_goal_id and user_id=auth.uid();
    update public.goals set contribution_amount=private.goal_occurrence_amount(g,v_month) where id=g.id;
  end if;
  return v_id;
end $$;

-- Return NEW on update so unrelated transactions are not overwritten with OLD.
create or replace function private.guard_goal_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.agenda_occurrence_payments p where p.transaction_id=old.id or p.destination_transaction_id=old.id) then
    raise exception 'Aporte confirmado protegido: requiere una reversión contable.';
  end if;
  if tg_op='UPDATE' then return new; end if;
  return old;
end $$;
drop trigger if exists trg_guard_goal_payment on public.transactions;
create trigger trg_guard_goal_payment before update or delete on public.transactions for each row execute function private.guard_goal_payment();

create or replace function private.ensure_goal_template(g public.goals) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_anchor date; v_month date; v_expected numeric;
begin
  if g.contribution_type is null or g.contribution_type not in ('auto','fixed','free') then return null; end if;
  v_anchor:=coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date);
  if v_anchor is null then raise exception 'La meta necesita revisar su fecha inicial antes de generar compromisos.'; end if;
  v_month:=(date_trunc('month',v_anchor)+interval '1 month')::date;
  v_expected:=case when g.contribution_type='free' then 0 else coalesce(g.contribution_amount,0) end;
  insert into public.recurring_templates(user_id,goal_id,name,expected_amount,is_variable_amount,frequency,day_of_month,next_due_date,is_active)
    values(g.user_id,g.id,'Aporte a meta: '||g.name,v_expected,g.contribution_type='free' or v_expected=0,'monthly',extract(day from v_anchor)::integer,
      private.goal_occurrence_date(g,v_month),coalesce(g.current_amount,0)<g.target_amount and g.deadline_date is not null and (g.contribution_type='free' or v_expected>0))
    on conflict(goal_id) do update set name=excluded.name,expected_amount=excluded.expected_amount,is_variable_amount=excluded.is_variable_amount,
      day_of_month=excluded.day_of_month,next_due_date=excluded.next_due_date,is_active=excluded.is_active
    returning id into v_id;
  return v_id;
end $$;
create or replace function private.sync_goal_template() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.ensure_goal_template(new); return new; end $$;
create trigger trg_sync_goal_template after insert or update on public.goals for each row execute function private.sync_goal_template();
do $$ declare g public.goals; begin
  for g in select * from public.goals where contribution_type in ('auto','fixed','free') loop perform private.ensure_goal_template(g); end loop;
  if to_regclass('public.goal_occurrence_payments') is not null then
    insert into public.agenda_occurrence_payments(template_id,goal_id,occurrence_month,occurrence_date,user_id,transaction_id,destination_transaction_id,account_id,savings_account_id,amount,paid_at)
      select t.id,p.goal_id,p.occurrence_month,p.occurrence_date,p.user_id,p.transaction_id,p.destination_transaction_id,p.account_id,p.savings_account_id,p.amount,p.paid_at
      from public.goal_occurrence_payments p join public.recurring_templates t on t.goal_id=p.goal_id and t.user_id=p.user_id;
    if exists(select 1 from public.goal_occurrence_payments p where not exists(select 1 from public.agenda_occurrence_payments r
      where r.goal_id=p.goal_id and r.occurrence_month=p.occurrence_month and r.transaction_id=p.transaction_id and r.amount=p.amount
        and r.destination_transaction_id is not distinct from p.destination_transaction_id and r.savings_account_id is not distinct from p.savings_account_id)) then
      raise exception 'No se pudieron conservar todos los aportes confirmados.';
    end if;
  end if;
end $$;
create or replace function private.guard_goal_template() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and ((tg_op<>'INSERT' and old.goal_id is not null) or (tg_op<>'DELETE' and new.goal_id is not null)) then
    raise exception 'Edita el plan desde la meta para modificar sus compromisos.';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger trg_guard_goal_template before insert or update or delete on public.recurring_templates for each row execute function private.guard_goal_template();
create or replace function private.ledger_accounting() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old numeric:=0; v_new numeric:=0; v_card uuid; v_user uuid; v_delta numeric;
begin
  if tg_op<>'INSERT' then
    v_old:=coalesce(old.remaining_principal,case when old.status='paid' then 0 else old.amount_total end);
    v_card:=old.credit_card_id; v_user:=old.user_id;
    if tg_op='DELETE' and exists(select 1 from public.agenda_occurrence_payments p join public.billing_statements s on s.id=p.statement_id where s.credit_card_id=v_card) then
      raise exception 'Una compra con pagos registrados requiere una reversión.';
    end if;
  end if;
  if tg_op<>'DELETE' then
    v_card:=new.credit_card_id; v_user:=new.user_id;
    if tg_op='UPDATE' and (new.credit_card_id<>old.credit_card_id or new.user_id<>old.user_id) then raise exception 'No se puede reasignar una compra.'; end if;
    if new.amount_total is null or new.amount_total<=0 or new.amount_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Importe de compra inválido.'; end if;
    if new.installment_total<1 or new.amount_per_installment<=0 then raise exception 'Cuotas inválidas.'; end if;
    if new.remaining_principal is null then new.remaining_principal:=case when new.status='paid' then 0 else new.amount_total end; end if;
    v_new:=new.remaining_principal;
    if v_new<0 or v_new>new.amount_total or v_new::text in ('NaN','Infinity','-Infinity') then raise exception 'Capital pendiente inválido.'; end if;
    if not exists(select 1 from public.credit_cards where id=v_card and user_id=v_user and not coalesce(is_archived,false)) then raise exception 'Tarjeta propia activa requerida.'; end if;
    if new.category_id is not null and not exists(select 1 from public.categories where id=new.category_id and (user_id=v_user or user_id is null)) then raise exception 'Categoría sin acceso.'; end if;
  end if;
  if auth.uid() is not null and auth.uid()<>v_user then raise exception 'Compra sin acceso.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  v_delta:=v_new-v_old;
  update public.credit_cards set current_debt=coalesce(current_debt,0)+v_delta
    where id=v_card and user_id=v_user and coalesce(current_debt,0)+v_delta>=0;
  if not found then raise exception 'La deuda no permite esta operación.'; end if;
  return coalesce(new,old);
end $$;
create or replace function public.accounting_mutate(p_operation text,p_payload jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_result jsonb; v_fingerprint text;
  v_tx public.transactions; v_other public.transactions; v_group uuid; v_destination uuid;
  v_account public.accounts; v_goal public.goals; v_card public.credit_cards;
  v_statement public.billing_statements; v_purchase public.credit_card_ledger;
  v_amount numeric; v_initial numeric; v_fees numeric; v_principal numeric; v_left numeric; v_allocation numeric;
  v_old_paid numeric; v_new_paid numeric; v_id uuid; v_data jsonb; r record;
begin
  if v_user is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_request_id is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Solicitud contable inválida.'; end if;
  -- Serialize accounting for one owner, never for all users.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  v_fingerprint:=md5(p_operation||p_payload::text);
  select result into v_result from public.agenda_occurrence_payments where receipt_type='request' and user_id=v_user and request_id=p_request_id;
  if found then
    if not exists(select 1 from public.agenda_occurrence_payments where receipt_type='request' and user_id=v_user and request_id=p_request_id and fingerprint=v_fingerprint) then
      raise exception 'La clave de reintento pertenece a otra operación.';
    end if;
    return v_result;
  end if;

  if p_operation='create_transaction' then
    v_tx:=jsonb_populate_record(null::public.transactions,p_payload);
    v_tx.id:=gen_random_uuid(); v_tx.user_id:=v_user; v_tx.date:=coalesce(v_tx.date,now()); v_tx.created_at:=now();
    v_tx.name:=coalesce(nullif(trim(v_tx.name),''),'Movimiento'); v_tx.status:=coalesce(v_tx.status,'paid');
    v_tx.installment_current:=coalesce(v_tx.installment_current,1); v_tx.installment_total:=coalesce(v_tx.installment_total,1);
    if v_tx.credit_card_id is not null then raise exception 'Registra las compras de tarjeta desde su formulario de compra.'; end if;
    v_destination:=v_tx.destination_account_id;
    if v_destination is not null then
      if v_tx.account_id is null or v_tx.account_id=v_destination then raise exception 'Selecciona dos cuentas distintas.'; end if;
      v_group:=gen_random_uuid(); v_tx.type:='expense'; v_tx.transfer_group_id:=v_group;
      v_tx.destination_account_id:=null; v_tx.source_account_id:=null;
      insert into public.transactions select (v_tx).* returning * into v_tx;
      v_other:=v_tx; v_other.id:=gen_random_uuid(); v_other.type:='income'; v_other.account_id:=v_destination;
      v_other.goal_id:=null; v_other.name:=v_tx.name||' (Recibida)';
      insert into public.transactions select (v_other).*;
    else
      v_tx.transfer_group_id:=null;
      insert into public.transactions select (v_tx).* returning * into v_tx;
    end if;
    v_result:=to_jsonb(v_tx);

  elsif p_operation in ('update_transaction','delete_transaction','confirm_pending') then
    select * into v_tx from public.transactions where id=(p_payload->>'id')::uuid and user_id=v_user for update;
    if not found then raise exception 'Movimiento inexistente o sin acceso.'; end if;
    if exists(select 1 from public.agenda_occurrence_payments where transaction_id=v_tx.id)
      or exists(select 1 from public.agenda_occurrence_payments where transaction_id=v_tx.id) then
      raise exception 'Pago confirmado protegido: requiere una reversión contable.';
    end if;
    if v_tx.transfer_group_id is not null then
      select * into strict v_other from public.transactions where transfer_group_id=v_tx.transfer_group_id and user_id=v_user and id<>v_tx.id for update;
    end if;
    if p_operation='delete_transaction' then
      if coalesce((p_payload->>'revert_balance')::boolean,true)=false and coalesce(v_tx.status,'paid')='paid' then
        raise exception 'Eliminar un movimiento pagado exige revertir su efecto contable.';
      end if;
      delete from public.transactions where user_id=v_user and (id=v_tx.id or (v_tx.transfer_group_id is not null and transfer_group_id=v_tx.transfer_group_id));
      v_result:=jsonb_build_object('deleted',true);
    else
      if p_operation='confirm_pending' and coalesce(v_tx.status,'paid')<>'pending' then
        -- A retry under a different key must not create a second savings leg.
        if v_tx.status='paid' then
          if coalesce((p_payload->'updates'->>'amount')::numeric,v_tx.amount)<>v_tx.amount
            or coalesce((p_payload->'updates'->>'account_id')::uuid,v_tx.account_id) is distinct from v_tx.account_id
            or (p_payload->>'savings_account_id' is not null and (p_payload->>'savings_account_id')::uuid is distinct from v_other.account_id) then
            raise exception 'El pago ya está confirmado con otros datos; revisa el movimiento registrado.';
          end if;
          return to_jsonb(v_tx);
        end if;
        raise exception 'El movimiento no está pendiente.';
      end if;
      v_data:=coalesce(p_payload->'updates','{}'::jsonb);
      v_tx:=jsonb_populate_record(v_tx,v_data-'id'-'user_id'-'transfer_group_id'-'source_account_id'-'destination_account_id');
      if p_operation='confirm_pending' then v_tx.status:='paid'; v_tx.validated_at:=now(); end if;
      if v_other.id is not null and v_tx.account_id=coalesce((v_data->>'destination_account_id')::uuid,v_other.account_id) then
        raise exception 'Selecciona dos cuentas distintas.';
      end if;
      if v_tx.type='transfer' and v_other.id is null then
        v_tx.destination_account_id:=coalesce((v_data->>'destination_account_id')::uuid,v_tx.destination_account_id);
      end if;
      update public.transactions set name=v_tx.name,amount=v_tx.amount,account_id=v_tx.account_id,
        source_account_id=v_tx.source_account_id,destination_account_id=v_tx.destination_account_id,
        category_id=v_tx.category_id,goal_id=v_tx.goal_id,type=v_tx.type,date=v_tx.date,note=v_tx.note,
        status=v_tx.status,validated_at=v_tx.validated_at where id=v_tx.id;
      if v_other.id is not null then
        if v_tx.type=v_other.type then raise exception 'No se puede cambiar el tipo de una transferencia.'; end if;
        update public.transactions set amount=v_tx.amount,date=v_tx.date,status=v_tx.status,
          name=v_tx.name||' (Recibida)',
          account_id=coalesce((v_data->>'destination_account_id')::uuid,v_other.account_id)
          where id=v_other.id;
      elsif p_operation='confirm_pending' and v_tx.goal_id is not null and p_payload->>'savings_account_id' is not null then
        v_destination:=(p_payload->>'savings_account_id')::uuid;
        if v_destination=v_tx.account_id then raise exception 'El ahorro requiere otra cuenta destino.'; end if;
        v_group:=gen_random_uuid();
        update public.transactions set transfer_group_id=v_group where id=v_tx.id;
        v_other:=v_tx; v_other.id:=gen_random_uuid(); v_other.type:='income'; v_other.goal_id:=null;
        v_other.account_id:=v_destination; v_other.transfer_group_id:=v_group; v_other.name:=v_tx.name||' (Ahorro)';
        insert into public.transactions select (v_other).*;
      end if;
      v_result:=to_jsonb(v_tx);
    end if;

  elsif p_operation='skip_pending' then
    select * into v_tx from public.transactions where id=(p_payload->>'id')::uuid and user_id=v_user for update;
    if not found or v_tx.status is distinct from 'pending' then raise exception 'Solo se pueden omitir movimientos pendientes.'; end if;
    if p_payload->>'goal_id' is not null then
      if v_tx.goal_id is distinct from (p_payload->>'goal_id')::uuid then raise exception 'La meta no coincide con el movimiento.'; end if;
      select * into v_goal from public.goals where id=v_tx.goal_id and user_id=v_user for update;
      if not found then raise exception 'Meta sin acceso.'; end if;
      if v_goal.contribution_type='fixed' then
        update public.goals set deadline_date=deadline_date+interval '1 month' where id=v_goal.id;
      elsif v_goal.contribution_type='auto' then
        update public.goals set contribution_amount=ceil((target_amount-current_amount)/greatest(1,
          (extract(year from deadline_date)-extract(year from current_date))*12+extract(month from deadline_date)-extract(month from current_date)))
          where id=v_goal.id;
      end if;
    end if;
    delete from public.transactions where id=v_tx.id;
    v_result:=jsonb_build_object('skipped',true);

  elsif p_operation='create_account' then
    v_initial:=coalesce((p_payload->>'balance')::numeric,0);
    if v_initial<0 or v_initial::text in ('NaN','Infinity','-Infinity') then raise exception 'Saldo inicial inválido.'; end if;
    if (select count(*) from public.accounts where user_id=v_user and not coalesce(is_archived,false) and coalesce((to_jsonb(accounts)->>'is_active')::boolean,true))>=5 then raise exception 'Límite Beta: 5 cuentas activas.'; end if;
    if exists(select 1 from public.accounts where user_id=v_user and name=p_payload->>'name' and not coalesce(is_archived,false)) then raise exception 'Ya existe una cuenta activa con este nombre.'; end if;
    v_account:=jsonb_populate_record(null::public.accounts,p_payload);
    v_account.id:=gen_random_uuid(); v_account.user_id:=v_user; v_account.balance:=0;
    v_account.currency:=coalesce(v_account.currency,'CLP'); v_account.created_at:=now();
    insert into public.accounts select (v_account).* returning * into v_account;
    if v_initial>0 then
      insert into public.transactions(user_id,account_id,type,amount,name,status,date)
        values(v_user,v_account.id,'income',v_initial,'Saldo Inicial de Cuenta','paid',now());
    end if;
    select to_jsonb(a) into v_result from public.accounts a where id=v_account.id;

  elsif p_operation='create_purchase' then
    v_purchase:=jsonb_populate_record(null::public.credit_card_ledger,p_payload);
    v_purchase.id:=gen_random_uuid(); v_purchase.user_id:=v_user; v_purchase.created_at:=now();
    v_purchase.purchase_date:=coalesce(v_purchase.purchase_date,now());
    v_purchase.installment_current:=1; v_purchase.status:='active'; v_purchase.remaining_principal:=v_purchase.amount_total;
    insert into public.credit_card_ledger select (v_purchase).* returning * into v_purchase;
    v_result:=to_jsonb(v_purchase);

  elsif p_operation='pay_statement' then
    v_amount:=(p_payload->>'amount')::numeric;
    if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Importe de pago inválido.'; end if;
    select * into v_statement from public.billing_statements where id=(p_payload->>'statement_id')::uuid and user_id=v_user for update;
    if not found then raise exception 'Estado de cuenta sin acceso.'; end if;
    select * into v_card from public.credit_cards where id=v_statement.credit_card_id and user_id=v_user and not coalesce(is_archived,false) for update;
    if not found then raise exception 'Tarjeta sin acceso.'; end if;
    if exists(select 1 from public.credit_card_ledger l where l.credit_card_id=v_card.id and l.status in ('active','refinanced') and l.created_at is null) then
      raise exception 'Conciliar las compras históricas sin fecha de registro antes de registrar otro pago.';
    end if;
    if exists(select 1 from public.credit_card_ledger l where l.credit_card_id=v_card.id and l.status in ('active','refinanced') and l.remaining_principal is null)
      and exists(select 1 from public.billing_statements s where s.credit_card_id=v_card.id and coalesce(s.amount_paid,0)>0
        and not exists(select 1 from public.agenda_occurrence_payments p where p.statement_id=s.id)) then
      raise exception 'Conciliar el capital de las compras con pagos anteriores antes de registrar otro pago.';
    end if;
    if p_payload->>'card_id' is not null and (p_payload->>'card_id')::uuid<>v_card.id then raise exception 'Tarjeta y estado de cuenta no coinciden.'; end if;
    v_old_paid:=coalesce(v_statement.amount_paid,0); v_new_paid:=v_old_paid+v_amount;
    if v_new_paid>v_statement.total_due then raise exception 'El pago supera el saldo pendiente.'; end if;
    v_fees:=coalesce(v_statement.maintenance_cost,0)+coalesce((to_jsonb(v_statement)->>'interest_amount')::numeric,0);
    v_principal:=greatest(0,v_new_paid-v_fees)-greatest(0,v_old_paid-v_fees);
    v_principal:=least(v_principal,coalesce(v_card.current_debt,0));
    insert into public.transactions(user_id,account_id,type,amount,name,status,date)
      values(v_user,(p_payload->>'account_id')::uuid,'expense',v_amount,
        coalesce(nullif(p_payload->>'name',''),'Pago Tarjeta de Crédito'),'paid',coalesce((p_payload->>'date')::timestamptz,now()))
      returning id into v_id;
    -- Snapshot eligible purchases at the first payment, without advancing all active purchases.
    update public.billing_statements s set principal_items=s.principal_items||coalesce((
      select jsonb_agg(jsonb_build_object('ledger_id',l.id,'scheduled',least(coalesce(l.remaining_principal,l.amount_total),
        case when l.installment_total>1 and l.installment_current<l.installment_total then l.amount_per_installment else coalesce(l.remaining_principal,l.amount_total) end),'paid',0))
      from public.credit_card_ledger l where l.credit_card_id=v_card.id and l.user_id=v_user
        and l.status in ('active','refinanced') and l.created_at<=v_statement.created_at
        and l.purchase_date<(v_statement.billing_date+1)::timestamptz
        and (l.installment_total>1 or l.purchase_date>=((v_statement.billing_date-interval '1 month')::date+1)::timestamptz)
        and not exists(select 1 from jsonb_to_recordset(s.principal_items) i(ledger_id uuid) where i.ledger_id=l.id)
    ),'[]'::jsonb) where s.id=v_statement.id;
    v_left:=v_principal;
    for r in select v_statement.id as statement_id,i.*,l.remaining_principal,l.amount_total,l.amount_per_installment,l.installment_total
      from public.billing_statements s cross join lateral jsonb_to_recordset(s.principal_items) i(ledger_id uuid,scheduled numeric,paid numeric)
      join public.credit_card_ledger l on l.id=i.ledger_id
      where s.id=v_statement.id and l.user_id=v_user and l.credit_card_id=v_card.id order by l.purchase_date,l.id for update of l loop
      exit when v_left<=0;
      v_allocation:=least(v_left,greatest(0,r.scheduled-r.paid),coalesce(r.remaining_principal,r.amount_total));
      if v_allocation<=0 then continue; end if;
      update public.billing_statements s set principal_items=(select jsonb_agg(
        case when (i->>'ledger_id')::uuid=r.ledger_id then jsonb_set(i,'{paid}',to_jsonb((i->>'paid')::numeric+v_allocation)) else i end)
        from jsonb_array_elements(s.principal_items) i) where s.id=v_statement.id;
      update public.credit_card_ledger set remaining_principal=coalesce(remaining_principal,amount_total)-v_allocation,
        installment_current=least(installment_total,1+floor((amount_total-(coalesce(remaining_principal,amount_total)-v_allocation))/nullif(amount_per_installment,0)))::integer,
        status=case when coalesce(remaining_principal,amount_total)-v_allocation=0 then 'paid' else status end
        where id=r.ledger_id;
      v_left:=v_left-v_allocation;
    end loop;
    -- Any opening debt or legacy transaction debt has no ledger item; still release it exactly once.
    if v_left>0 then update public.credit_cards set current_debt=current_debt-v_left where id=v_card.id; end if;
    update public.billing_statements set amount_paid=v_new_paid,
      status=case when v_new_paid=total_due then 'paid' else 'pending' end where id=v_statement.id;
    insert into public.agenda_occurrence_payments(receipt_type,user_id,statement_id,transaction_id,account_id,amount,principal_amount)
      values('billing',v_user,v_statement.id,v_id,(p_payload->>'account_id')::uuid,v_amount,v_principal);
    select jsonb_build_object('transaction_id',v_id,'current_debt',current_debt,'amount_paid',v_new_paid)
      into v_result from public.credit_cards where id=v_card.id;

  elsif p_operation='archive_account' then
    update public.accounts set is_archived=true,include_in_total=false where id=(p_payload->>'id')::uuid and user_id=v_user;
    if not found then raise exception 'Cuenta sin acceso.'; end if;
    v_result:=jsonb_build_object('archived',true);
  elsif p_operation='archive_card' then
    if exists(select 1 from public.credit_cards where id=(p_payload->>'id')::uuid and user_id=v_user and coalesce(current_debt,0)>0)
      or exists(select 1 from public.billing_statements where credit_card_id=(p_payload->>'id')::uuid and user_id=v_user and coalesce(amount_paid,0)<coalesce(total_due,0)) then
      raise exception 'Paga la deuda y los estados de cuenta pendientes antes de archivar la tarjeta.';
    end if;
    update public.credit_cards set is_archived=true where id=(p_payload->>'id')::uuid and user_id=v_user;
    if not found then raise exception 'Tarjeta sin acceso.'; end if;
    v_result:=jsonb_build_object('archived',true);
  else
    raise exception 'Operación contable desconocida.';
  end if;
  insert into public.agenda_occurrence_payments(receipt_type,user_id,request_id,fingerprint,result)
    values('request',v_user,p_request_id,v_fingerprint,v_result);
  return v_result;
end $$;
revoke all on function public.accounting_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.accounting_mutate(text,jsonb,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.pay_agenda_occurrence(
  p_template_id uuid, p_occurrence_date date, p_account_id uuid, p_amount numeric DEFAULT NULL
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_template public.recurring_templates%rowtype;
  v_goal_id uuid;
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
  select goal_id into v_goal_id from public.recurring_templates where id=p_template_id and user_id=auth.uid();
  if v_goal_id is not null then return public.pay_goal_occurrence(v_goal_id,p_occurrence_date,p_account_id,p_amount,null); end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into v_template from public.recurring_templates
    where id = p_template_id and user_id = auth.uid() for update;
  if not found then raise exception 'Compromiso inexistente o sin acceso.'; end if;

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
  v_amount := coalesce(p_amount, v_template.expected_amount);
  if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'El importe debe ser positivo y finito.';
  end if;
  select * into v_account from public.accounts
    where id = p_account_id and user_id = auth.uid() and coalesce(is_archived, false) = false for update;
  if not found then raise exception 'Selecciona una cuenta propia activa.'; end if;
  if v_template.category_id is not null and not exists (
    select 1 from public.categories where id = v_template.category_id and (user_id = auth.uid() or user_id is null)
  ) then raise exception 'La categoría no pertenece al usuario.'; end if;

  -- 1. Insert transaction: trg_handle_transaction_balance automatically decrements accounts balance!
  insert into public.transactions(user_id, account_id, category_id, type, amount, date, name, note)
    values(auth.uid(), p_account_id, v_template.category_id, 'expense', v_amount, now(),
      v_template.name, 'Pago de compromiso de agenda: ' || p_occurrence_date)
    returning id into v_transaction;

  -- 2. Register occurrence confirmation
  insert into public.agenda_occurrence_payments(template_id, occurrence_date, user_id, transaction_id, account_id, amount)
    values(p_template_id, p_occurrence_date, auth.uid(), v_transaction, p_account_id, v_amount);

  return v_transaction;
end;
$$;

revoke all on function public.pay_agenda_occurrence(uuid, date, uuid, numeric) from public, anon;
grant execute on function public.pay_agenda_occurrence(uuid, date, uuid, numeric) to authenticated;

revoke all on function public.get_goal_agenda_occurrences(date,date),public.pay_goal_occurrence(uuid,date,uuid,numeric,uuid) from public,anon;
grant execute on function public.get_goal_agenda_occurrences(date,date),public.pay_goal_occurrence(uuid,date,uuid,numeric,uuid) to authenticated;
revoke all on function private.goal_plan_anchor(),private.goal_occurrence_date(public.goals,date),private.goal_occurrence_amount(public.goals,date),
  private.guard_goal_payment(),private.ensure_goal_template(public.goals),private.sync_goal_template(),private.guard_goal_template() from public,anon,authenticated;
create or replace function private.guard_statement_items() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and
    ((tg_op='INSERT' and new.principal_items<>'[]'::jsonb) or (tg_op='UPDATE' and new.principal_items is distinct from old.principal_items)) then
    raise exception 'El detalle de capital se calcula al confirmar pagos; no admite escritura directa.';
  end if;
  return new;
end $$;
create trigger trg_guard_statement_items before insert or update on public.billing_statements for each row execute function private.guard_statement_items();
revoke all on function private.guard_statement_items() from public,anon,authenticated;
-- Explicit drops only. Unknown external dependencies make the whole migration fail and roll back.
drop table if exists public.goal_occurrence_payments;
drop table if exists public.billing_payments;
drop table if exists private.billing_principal_items;
drop table if exists private.accounting_requests;
commit;

-- Verification output: public table names; the four added tables must be absent.
select schemaname,tablename from pg_tables where schemaname in ('public','private') order by schemaname,tablename;
