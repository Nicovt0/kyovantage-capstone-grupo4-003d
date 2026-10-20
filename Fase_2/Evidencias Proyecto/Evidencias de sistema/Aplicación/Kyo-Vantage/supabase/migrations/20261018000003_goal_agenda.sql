-- Goal commitments are projected from the plan; only confirmed contributions create movements.
-- Staging only. Apply after 20261018000002. No historical transactions are rewritten.
begin;
alter table public.goals add column if not exists plan_start_date date;
create table public.goal_occurrence_payments (
  goal_id uuid not null references public.goals(id),
  occurrence_month date not null check (extract(day from occurrence_month)=1),
  occurrence_date date not null,
  user_id uuid not null references auth.users(id),
  transaction_id uuid not null unique references public.transactions(id),
  destination_transaction_id uuid unique references public.transactions(id),
  account_id uuid not null references public.accounts(id),
  savings_account_id uuid references public.accounts(id),
  amount numeric not null check(amount>0),
  paid_at timestamptz not null default now(),
  primary key(goal_id,occurrence_month)
);
alter table public.goal_occurrence_payments enable row level security;
create policy goal_payments_owner on public.goal_occurrence_payments for select to authenticated using(user_id=(select auth.uid()));
grant select on public.goal_occurrence_payments to authenticated;
revoke insert,update,delete on public.goal_occurrence_payments from public,anon,authenticated;

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
      where private.goal_occurrence_date(g,d::date)<=v_end and not exists(select 1 from public.goal_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=d::date);
    return least(coalesce(g.contribution_amount,0),greatest(0,v_remaining-v_prior*coalesce(g.contribution_amount,0)));
  end if;
  select count(*) into v_count from generate_series(v_reference,date_trunc('month',v_end)::date,interval '1 month') d
    where private.goal_occurrence_date(g,d::date)<=v_end
      and not exists(select 1 from public.goal_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=d::date);
  return least(v_remaining,ceil(v_remaining/greatest(1,v_count)));
end $$;

create or replace function public.get_goal_agenda_occurrences(p_start date,p_end date)
returns table(goal_id uuid,title text,contribution_type text,occurrence_date date,amount numeric,status text,transaction_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare g public.goals; r public.goal_occurrence_payments; d record; v_month date; v_due date; v_amount numeric; v_base date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end>p_start+interval '10 years' then raise exception 'Rango de agenda inválido.'; end if;
  for g in select * from public.goals x where x.user_id=auth.uid() loop
    for d in select generate_series(date_trunc('month',p_start),date_trunc('month',p_end),interval '1 month') as month loop
      v_month:=d.month::date;
      select * into r from public.goal_occurrence_payments p where p.goal_id=g.id and p.occurrence_month=v_month and p.user_id=auth.uid();
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
declare g public.goals; r public.goal_occurrence_payments; v_month date:=date_trunc('month',p_occurrence_date)::date;
  v_due date; v_expected numeric; v_amount numeric; v_id uuid; v_dest_id uuid; v_group uuid; v_base date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_occurrence_date is null or p_account_id is null then raise exception 'Selecciona fecha y cuenta de origen.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into g from public.goals where id=p_goal_id and user_id=auth.uid() for update;
  if not found then raise exception 'Meta inexistente o sin acceso.'; end if;
  select * into r from public.goal_occurrence_payments where goal_id=g.id and occurrence_month=v_month and user_id=auth.uid();
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
  insert into public.goal_occurrence_payments(goal_id,occurrence_month,occurrence_date,user_id,transaction_id,destination_transaction_id,account_id,savings_account_id,amount)
    values(g.id,v_month,p_occurrence_date,auth.uid(),v_id,v_dest_id,p_account_id,p_savings_account_id,v_amount);
  if g.contribution_type='auto' then
    select * into g from public.goals where id=p_goal_id and user_id=auth.uid();
    update public.goals set contribution_amount=private.goal_occurrence_amount(g,v_month) where id=g.id;
  end if;
  return v_id;
end $$;

-- Return NEW on update so unrelated transactions are not overwritten with OLD.
create or replace function private.guard_goal_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.goal_occurrence_payments p where p.transaction_id=old.id or p.destination_transaction_id=old.id) then
    raise exception 'Aporte confirmado protegido: requiere una reversión contable.';
  end if;
  if tg_op='UPDATE' then return new; end if;
  return old;
end $$;
create trigger trg_guard_goal_payment before update or delete on public.transactions for each row execute function private.guard_goal_payment();
revoke all on function public.get_goal_agenda_occurrences(date,date) from public,anon;
revoke all on function public.pay_goal_occurrence(uuid,date,uuid,numeric,uuid) from public,anon;
grant execute on function public.get_goal_agenda_occurrences(date,date),public.pay_goal_occurrence(uuid,date,uuid,numeric,uuid) to authenticated;
revoke all on function private.goal_plan_anchor(),private.goal_occurrence_date(public.goals,date),
  private.goal_occurrence_amount(public.goals,date),private.guard_goal_payment() from public,anon,authenticated;
commit;
