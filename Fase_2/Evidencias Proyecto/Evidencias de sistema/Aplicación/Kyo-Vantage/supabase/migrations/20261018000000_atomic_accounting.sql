-- Atomic accounting authority. Apply in staging BEFORE deploying its frontend.
-- Existing balances are baselines: this migration does not replay history or repair old totals.
begin;
create schema if not exists private;
-- Abort rather than silently choosing a winner among historical duplicate statements.
create unique index if not exists uq_billing_card_period on public.billing_statements(credit_card_id,billing_period);
create table if not exists private.accounting_requests (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
revoke all on private.accounting_requests from public, anon, authenticated;

-- Reference exports differ in timestamp/archive columns. Do not fabricate historical timestamps.
alter table public.accounts add column if not exists created_at timestamptz;
alter table public.accounts alter column created_at set default now();
alter table public.transactions add column if not exists created_at timestamptz;
alter table public.transactions alter column created_at set default now();
alter table public.credit_card_ledger add column if not exists created_at timestamptz;
alter table public.credit_card_ledger alter column created_at set default now();
alter table public.credit_cards add column if not exists is_archived boolean default false;
alter table public.transactions add column if not exists validated_at timestamptz;
alter table public.transactions add column if not exists due_date timestamptz;
alter table public.transactions add column if not exists is_recurring boolean default false;
alter table public.credit_card_ledger add column if not exists remaining_principal numeric;
alter table public.goals add column if not exists contribution_type text;
alter table public.goals add column if not exists contribution_amount numeric;

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  statement_id uuid not null references public.billing_statements(id),
  transaction_id uuid not null unique references public.transactions(id),
  account_id uuid not null references public.accounts(id),
  amount numeric not null check(amount > 0),
  principal_amount numeric not null check(principal_amount >= 0),
  paid_at timestamptz not null default now()
);
alter table public.billing_payments enable row level security;
create policy billing_payments_owner on public.billing_payments for select to authenticated
  using(user_id = (select auth.uid()));
grant select on public.billing_payments to authenticated;
revoke insert, update, delete on public.billing_payments from public, anon, authenticated;

create table private.billing_principal_items (
  statement_id uuid not null references public.billing_statements(id),
  ledger_id uuid not null references public.credit_card_ledger(id),
  scheduled numeric not null check(scheduled >= 0),
  paid numeric not null default 0 check(paid >= 0),
  primary key(statement_id,ledger_id)
);
revoke all on private.billing_principal_items from public, anon, authenticated;

create or replace function private.sync_account_balances() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.balance is null or new.balance::text in ('NaN','Infinity','-Infinity') then
    raise exception 'El saldo debe ser finito.';
  end if;
  new.current_balance := new.balance;
  return new;
end $$;
create trigger trg_sync_account_balances before insert or update of balance, current_balance
  on public.accounts for each row execute function private.sync_account_balances();

create or replace function private.guard_transaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid;
begin
  if tg_op <> 'INSERT' then
    if exists(select 1 from public.agenda_occurrence_payments where transaction_id = old.id)
      or exists(select 1 from public.billing_payments where transaction_id = old.id) then
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
create trigger trg_guard_transaction before insert or update or delete on public.transactions
  for each row execute function private.guard_transaction();

create or replace function private.transaction_effects(p_tx public.transactions, p_sign numeric)
returns table(entity text, entity_id uuid, delta numeric)
language plpgsql set search_path = '' as $$
begin
  if p_tx.id is null or coalesce(p_tx.status,'paid') <> 'paid' then return; end if;
  if p_tx.type='transfer' then
    return query select 'account'::text,coalesce(p_tx.source_account_id,p_tx.account_id),-p_sign*p_tx.amount;
    return query select 'account'::text,p_tx.destination_account_id,p_sign*p_tx.amount;
  elsif p_tx.account_id is not null then
    return query select 'account'::text,p_tx.account_id,p_sign*p_tx.amount*(case when p_tx.type='income' then 1 else -1 end);
  elsif p_tx.credit_card_id is not null then
    return query select 'card'::text,p_tx.credit_card_id,p_sign*p_tx.amount*(case when p_tx.type='income' then -1 else 1 end);
  end if;
  -- A goal is credited only on the outgoing leg, never again on its incoming transfer leg.
  if p_tx.goal_id is not null and p_tx.type in ('expense','transfer') and coalesce(p_tx.account_id,p_tx.source_account_id) is not null then
    return query select 'goal'::text,p_tx.goal_id,p_sign*p_tx.amount;
  end if;
end $$;

create or replace function public.handle_transaction_balance_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old public.transactions; v_new public.transactions; r record;
begin
  if tg_op <> 'INSERT' then v_old := old; end if;
  if tg_op <> 'DELETE' then v_new := new; end if;
  -- Net OLD/NEW effects avoid a temporary debit when an already-spent income is increased.
  for r in select entity,entity_id,sum(delta) as delta from (
    select * from private.transaction_effects(v_old,-1)
    union all select * from private.transaction_effects(v_new,1)
  ) e group by entity,entity_id having sum(delta)<>0 order by entity,entity_id loop
    if r.entity='account' then
      update public.accounts set balance=balance+r.delta
        where id=r.entity_id and user_id=coalesce(v_new.user_id,v_old.user_id) and balance+r.delta>=0;
      if not found then raise exception 'Saldo insuficiente para registrar o revertir el movimiento.'; end if;
    elsif r.entity='card' then
      update public.credit_cards set current_debt=coalesce(current_debt,0)+r.delta
        where id=r.entity_id and user_id=coalesce(v_new.user_id,v_old.user_id) and coalesce(current_debt,0)+r.delta>=0;
      if not found then raise exception 'La deuda no permite esta modificación; requiere reversión.'; end if;
    elsif r.entity='goal' then
      update public.goals set current_amount=coalesce(current_amount,0)+r.delta
        where id=r.entity_id and user_id=coalesce(v_new.user_id,v_old.user_id) and coalesce(current_amount,0)+r.delta>=0;
      if not found then raise exception 'El aporte de la meta no permite esta reversión.'; end if;
    end if;
  end loop;
  return coalesce(new,old);
end $$;
-- Reinstall under the existing name, never alongside a second balance trigger.
drop trigger if exists trg_handle_transaction_balance on public.transactions;
create trigger trg_handle_transaction_balance after insert or update or delete on public.transactions
  for each row execute function public.handle_transaction_balance_update();

create or replace function private.ledger_accounting() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old numeric:=0; v_new numeric:=0; v_card uuid; v_user uuid; v_delta numeric;
begin
  if tg_op<>'INSERT' then
    v_old:=coalesce(old.remaining_principal,case when old.status='paid' then 0 else old.amount_total end);
    v_card:=old.credit_card_id; v_user:=old.user_id;
    if tg_op='DELETE' and exists(select 1 from public.billing_payments p join public.billing_statements s on s.id=p.statement_id where s.credit_card_id=v_card) then
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
create trigger trg_ledger_accounting before insert or update or delete on public.credit_card_ledger
  for each row execute function private.ledger_accounting();

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
  select result into v_result from private.accounting_requests where user_id=v_user and request_id=p_request_id;
  if found then
    if not exists(select 1 from private.accounting_requests where user_id=v_user and request_id=p_request_id and fingerprint=v_fingerprint) then
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
      or exists(select 1 from public.billing_payments where transaction_id=v_tx.id) then
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
    if (select count(*) from public.accounts where user_id=v_user)>=5 then raise exception 'Límite Beta: 5 cuentas.'; end if;
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
        and not exists(select 1 from public.billing_payments p where p.statement_id=s.id)) then
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
    insert into private.billing_principal_items(statement_id,ledger_id,scheduled)
      select v_statement.id,l.id,least(coalesce(l.remaining_principal,l.amount_total),
        case when l.installment_total>1 and l.installment_current<l.installment_total then l.amount_per_installment else coalesce(l.remaining_principal,l.amount_total) end)
      from public.credit_card_ledger l where l.credit_card_id=v_card.id and l.user_id=v_user
        and l.status in ('active','refinanced') and l.created_at<=v_statement.created_at
        and l.purchase_date<(v_statement.billing_date+1)::timestamptz
        and (l.installment_total>1 or l.purchase_date>=((v_statement.billing_date-interval '1 month')::date+1)::timestamptz)
      on conflict do nothing;
    v_left:=v_principal;
    for r in select i.*,l.remaining_principal,l.amount_total,l.amount_per_installment,l.installment_total
      from private.billing_principal_items i join public.credit_card_ledger l on l.id=i.ledger_id
      where i.statement_id=v_statement.id order by l.purchase_date,l.id for update of l loop
      exit when v_left<=0;
      v_allocation:=least(v_left,greatest(0,r.scheduled-r.paid),coalesce(r.remaining_principal,r.amount_total));
      if v_allocation<=0 then continue; end if;
      update private.billing_principal_items set paid=paid+v_allocation where statement_id=r.statement_id and ledger_id=r.ledger_id;
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
    insert into public.billing_payments(user_id,statement_id,transaction_id,account_id,amount,principal_amount)
      values(v_user,v_statement.id,v_id,(p_payload->>'account_id')::uuid,v_amount,v_principal);
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
  insert into private.accounting_requests(user_id,request_id,fingerprint,result)
    values(v_user,p_request_id,v_fingerprint,v_result);
  return v_result;
end $$;
revoke all on function public.accounting_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.accounting_mutate(text,jsonb,uuid) to authenticated;

-- No browser-side writes may bypass grouped mutations or confirmations.
revoke insert,update,delete on public.transactions,public.credit_card_ledger from public,authenticated,anon;
revoke update,delete on public.billing_statements from public,authenticated,anon;
revoke insert,update,delete on public.agenda_occurrence_payments from public,authenticated,anon;
revoke all on function public.update_account_balance(uuid,numeric) from public,anon,authenticated;
-- Older production exports expose another independent debit RPC.
do $$ begin
  if to_regprocedure('public.decrement_account_balance(uuid,numeric)') is not null then
    revoke all on function public.decrement_account_balance(uuid,numeric) from public,anon,authenticated;
  end if;
end $$;

-- Remove the old overload: its independent debit would run in addition to the transaction trigger.
drop function if exists public.pay_agenda_occurrence(uuid,date,uuid);
CREATE OR REPLACE FUNCTION public.pay_agenda_occurrence(
  p_template_id uuid, p_occurrence_date date, p_account_id uuid, p_amount numeric DEFAULT NULL
) returns uuid language plpgsql security definer set search_path = '' as $$
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


commit;
