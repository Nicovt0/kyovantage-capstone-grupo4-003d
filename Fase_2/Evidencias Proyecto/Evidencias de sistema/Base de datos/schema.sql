


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."approve_waitlist_request"("p_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.waitlist%rowtype; invitation uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then raise exception 'Administrative access required' using errcode = '42501'; end if;
  select * into r from public.waitlist where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status in ('approved','error','sent') and r.invitation_id is not null then return r.invitation_id; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be approved'; end if;
  insert into public.beta_invitations (code, recipient_email, is_used)
    values (private.next_beta_code(), lower(btrim(r.email)), false) returning id into invitation;
  update public.waitlist set status = 'approved', invitation_id = invitation, approved_by = auth.uid(), approved_at = now(), last_error = null where id = p_id;
  return invitation;
end $$;


ALTER FUNCTION "private"."approve_waitlist_request"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."beta_code_available"("p_code" "text", "p_email" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.beta_invitations b where b.code = upper(btrim(p_code)) and not coalesce(b.is_used,false)
    and (p_email is null or b.recipient_email is null or lower(btrim(b.recipient_email)) = lower(btrim(p_email))));
$$;


ALTER FUNCTION "private"."beta_code_available"("p_code" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."consume_signup_beta_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare invitation public.beta_invitations%rowtype; submitted_code text;
begin
  -- Server-side administrative user creation is allowed; public signup is gated.
  if coalesce(auth.jwt()->>'role','') = 'service_role' then return new; end if;
  submitted_code := upper(btrim(coalesce(new.raw_user_meta_data->>'beta_code','')));
  select * into invitation from public.beta_invitations where code = submitted_code for update;
  if not found or new.email is null or coalesce(invitation.is_used,false) or (invitation.recipient_email is not null and lower(btrim(invitation.recipient_email)) <> lower(btrim(new.email))) then
    raise exception 'Invalid or unavailable invitation code' using errcode = '22023';
  end if;
  update public.beta_invitations set is_used = true, used_by_user_id = new.id, used_at = now() where id = invitation.id;
  return new;
end $$;


ALTER FUNCTION "private"."consume_signup_beta_code"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric NOT NULL,
    "current_amount" numeric DEFAULT 0,
    "start_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deadline_date" timestamp with time zone,
    "priority" "text" DEFAULT 'medium'::"text",
    "color" "text" DEFAULT '#534AB7'::"text",
    "icon_name" "text" DEFAULT 'Target'::"text",
    "is_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "contribution_type" "text",
    "contribution_amount" numeric,
    "reminders" boolean DEFAULT true NOT NULL,
    "plan_start_date" "date",
    "savings_account_id" "uuid",
    CONSTRAINT "goals_current_amount_check" CHECK (("current_amount" >= (0)::numeric)),
    CONSTRAINT "goals_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "goals_target_amount_check" CHECK (("target_amount" > (0)::numeric))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."ensure_goal_template"("g" "public"."goals") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."ensure_goal_template"("g" "public"."goals") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."goal_occurrence_amount"("g" "public"."goals", "m" "date") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."goal_occurrence_amount"("g" "public"."goals", "m" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."goal_occurrence_date"("g" "public"."goals", "m" "date") RETURNS "date"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select m+(least(extract(day from coalesce(g.plan_start_date,(g.start_date at time zone 'UTC')::date))::integer,
    extract(day from (m+interval '1 month - 1 day'))::integer)-1);
$$;


ALTER FUNCTION "private"."goal_occurrence_date"("g" "public"."goals", "m" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."goal_plan_anchor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."goal_plan_anchor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_goal_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists(select 1 from public.agenda_occurrence_payments p where p.transaction_id=old.id or p.destination_transaction_id=old.id) then
    raise exception 'Aporte confirmado protegido: requiere una reversión contable.';
  end if;
  if tg_op='UPDATE' then return new; end if;
  return old;
end $$;


ALTER FUNCTION "private"."guard_goal_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_goal_template"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user in ('authenticated','anon') and ((tg_op<>'INSERT' and old.goal_id is not null) or (tg_op<>'DELETE' and new.goal_id is not null)) then
    raise exception 'Edita el plan desde la meta para modificar sus compromisos.';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;


ALTER FUNCTION "private"."guard_goal_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_statement_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user in ('authenticated','anon') and
    ((tg_op='INSERT' and new.principal_items<>'[]'::jsonb) or (tg_op='UPDATE' and new.principal_items is distinct from old.principal_items)) then
    raise exception 'El detalle de capital se calcula al confirmar pagos; no admite escritura directa.';
  end if;
  return new;
end $$;


ALTER FUNCTION "private"."guard_statement_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."guard_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."ledger_accounting"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."ledger_accounting"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."next_beta_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare n bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('kyo.beta.invitation.number',0));
  select coalesce(max(substring(code from '^KYO-TEST-([0-9]{1,12})$')::bigint),0)+1 into n from public.beta_invitations;
  return 'KYO-TEST-' || case when length(n::text)<4 then lpad(n::text,4,'0') else n::text end;
end $_$;


ALTER FUNCTION "private"."next_beta_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reject_waitlist_request"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then raise exception 'Administrative access required' using errcode = '42501'; end if;
  update public.waitlist set status = 'rejected' where id = p_id and status = 'pending';
  if not found then raise exception 'Only pending requests can be rejected'; end if;
end $$;


ALTER FUNCTION "private"."reject_waitlist_request"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_account_balances"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.balance is null or new.balance::text in ('NaN','Infinity','-Infinity') then
    raise exception 'El saldo debe ser finito.';
  end if;
  new.current_balance := new.balance;
  return new;
end $$;


ALTER FUNCTION "private"."sync_account_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_goal_template"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin perform private.ensure_goal_template(new); return new; end $$;


ALTER FUNCTION "private"."sync_goal_template"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "credit_card_id" "uuid",
    "category_id" "uuid",
    "goal_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "note" "text",
    "installment_current" integer DEFAULT 1,
    "installment_total" integer DEFAULT 1,
    "transfer_group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destination_account_id" "uuid",
    "source_account_id" "uuid",
    "status" "text",
    "validated_at" timestamp with time zone,
    "due_date" timestamp with time zone,
    "is_recurring" boolean DEFAULT false,
    CONSTRAINT "chk_source_account" CHECK ((("account_id" IS NOT NULL) OR ("credit_card_id" IS NOT NULL))),
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."transaction_effects"("p_tx" "public"."transactions", "p_sign" numeric) RETURNS TABLE("entity" "text", "entity_id" "uuid", "delta" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."transaction_effects"("p_tx" "public"."transactions", "p_sign" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accounting_mutate"("p_operation" "text", "p_payload" "jsonb", "p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."accounting_mutate"("p_operation" "text", "p_payload" "jsonb", "p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_waitlist_request"("p_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$ select private.approve_waitlist_request(p_id); $$;


ALTER FUNCTION "public"."approve_waitlist_request"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$ select private.beta_code_available(p_code,p_email); $$;


ALTER FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_installment_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.installment_total IS NULL OR NEW.installment_total <= 0 THEN
    NEW.installment_total := 1;
  END IF;
  NEW.amount_per_installment := ROUND(NEW.amount_total / NEW.installment_total);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_installment_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_beta_dispatch"("p_id" "uuid", "p_token" "uuid") RETURNS TABLE("email" "text", "code" "text", "invitation_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.waitlist w set dispatch_token = p_token, dispatch_started_at = now(), last_error = null
    where w.id = p_id and w.status in ('approved','error') and w.invitation_id is not null
    and (w.dispatch_token is null or w.dispatch_started_at < now() - interval '2 minutes');
  if not found then raise exception 'Request unavailable, already sent, or dispatch in progress'; end if;
  return query select w.email, b.code, b.id from public.waitlist w join public.beta_invitations b on b.id = w.invitation_id where w.id = p_id;
end $$;


ALTER FUNCTION "public"."claim_beta_dispatch"("p_id" "uuid", "p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'user');
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE accounts
  SET balance = balance - amount
  WHERE id = account_id;
END;
$$;


ALTER FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_beta_dispatch"("p_id" "uuid", "p_token" "uuid", "p_error" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.waitlist set status = case when p_error is null then 'sent' else 'error' end,
    sent_at = case when p_error is null then now() else sent_at end, last_error = left(p_error,500), dispatch_token = null, dispatch_started_at = null
    where id = p_id and dispatch_token = p_token;
  return found;
end $$;


ALTER FUNCTION "public"."finish_beta_dispatch"("p_id" "uuid", "p_token" "uuid", "p_error" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "is_used" boolean DEFAULT false,
    "used_by_user_id" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "recipient_email" "text"
);


ALTER TABLE "public"."beta_invitations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_beta_invitation"("p_request_id" "uuid") RETURNS SETOF "public"."beta_invitations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then
    raise exception 'Administrative access required' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Identificador requerido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kyo.beta.invitation.number',0));
  if not exists(select 1 from public.beta_invitations where id=p_request_id) then
    insert into public.beta_invitations(id,code,is_used) values(p_request_id,private.next_beta_code(),false);
  end if;
  return query select * from public.beta_invitations where id=p_request_id;
end $$;


ALTER FUNCTION "public"."generate_beta_invitation"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_goal_agenda_occurrences"("p_start" "date", "p_end" "date") RETURNS TABLE("goal_id" "uuid", "title" "text", "contribution_type" "text", "occurrence_date" "date", "amount" numeric, "status" "text", "transaction_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_goal_agenda_occurrences"("p_start" "date", "p_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_setup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
BEGIN
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_full_name := TRIM(v_first_name || ' ' || v_last_name);

  -- Sub-bloque 1: Perfil
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, is_admin)
    VALUES (NEW.id, NULLIF(v_full_name, ''), 'user', false)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Sub-bloque 2: Cuenta de Efectivo por defecto
  BEGIN
    INSERT INTO public.accounts (user_id, name, balance, include_in_total, type, currency)
    VALUES (NEW.id, 'Efectivo', 0, true, 'cash', 'CLP');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_setup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_transaction_balance_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."handle_transaction_balance_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'superadmin')),
    FALSE
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role IN ('admin', 'superadmin') OR is_admin = TRUE)
  );
$$;


ALTER FUNCTION "public"."is_admin_or_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.current_app_role() = 'superadmin';
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_waitlist"("p_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare email_value text:=lower(btrim(p_email));
begin
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Introduce un correo válido.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kyo.waitlist.'||email_value,0));
  if not exists(select 1 from public.waitlist where lower(btrim(email))=email_value) then
    insert into public.waitlist(email) values(email_value);
  end if;
end $_$;


ALTER FUNCTION "public"."join_waitlist"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_cleanup_expired_budgets"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  now_date date := current_date;
BEGIN
  DELETE FROM public.budgets
  WHERE is_recurring = false 
    AND (
      (periodicity = 'weekly'  AND (start_date + interval '7 days')  <= now_date) OR
      (periodicity = 'monthly' AND (start_date + interval '1 month') <= now_date) OR
      (periodicity = 'yearly'  AND (start_date + interval '1 year')  <= now_date)
    );
END;
$$;


ALTER FUNCTION "public"."kyo_cleanup_expired_budgets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_daily_engine"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Sincronizar UF diaria
  PERFORM public.kyo_fetch_uf_daily();
  
  -- 2. Limpieza de presupuestos vencidos no recurrentes
  PERFORM public.kyo_cleanup_expired_budgets();
  
  -- 3. Notificaciones de compromisos recurrentes
  PERFORM public.kyo_generate_recurring();
  
  -- 4. Facturación de tarjetas de crédito
  PERFORM public.kyo_generate_billing_statements();
END;
$$;


ALTER FUNCTION "public"."kyo_daily_engine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_fetch_uf_daily"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  response json;
  uf_val numeric;
  today_date date := CURRENT_DATE;
BEGIN
  BEGIN
    SELECT content::json INTO response FROM extensions.http_get('https://mindicador.cl/api/uf');
    uf_val := (response->'serie'->0->>'valor')::numeric;
    
    IF uf_val > 0 THEN
      INSERT INTO public.uf_values (fecha, valor) 
      VALUES (today_date, uf_val)
      ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo sincronizar la UF: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."kyo_fetch_uf_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_billing_statements"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  card RECORD;
  now_date timestamp := NOW();
  billing_year int := EXTRACT(YEAR FROM now_date);
  billing_month int := EXTRACT(MONTH FROM now_date);
  current_period text := to_char(now_date, 'YYYY-MM');
  
  period_start timestamp;
  period_end timestamp;
  payment_due_date timestamp;
  payment_due_month int;
  payment_due_year int;
  last_day_payment_month int;
  
  consumed_amt numeric := 0;
  installments_amt numeric := 0;
  total_due numeric := 0;
  min_payment numeric := 0;
  uf_val numeric := 0;
  maint_cost numeric := 0;
BEGIN
  SELECT valor INTO uf_val FROM public.uf_values ORDER BY fecha DESC LIMIT 1;
  IF uf_val IS NULL THEN uf_val := 0; END IF;

  FOR card IN SELECT * FROM public.credit_cards WHERE is_archived = false LOOP
    IF EXTRACT(DAY FROM now_date) >= card.billing_date THEN
      
      IF NOT EXISTS (
        SELECT 1 FROM public.billing_statements 
        WHERE credit_card_id = card.id AND billing_period = current_period
      ) THEN
      
        period_start := date_trunc('month', now_date - interval '1 month') + (card.billing_date) * interval '1 day'; 
        period_end   := date_trunc('month', now_date) + (card.billing_date - 1) * interval '1 day' + interval '23:59:59';
        
        payment_due_month := billing_month + 1;
        payment_due_year := billing_year;
        IF payment_due_month > 12 THEN
          payment_due_month := 1;
          payment_due_year := payment_due_year + 1;
        END IF;
        
        last_day_payment_month := EXTRACT(DAY FROM (make_date(payment_due_year, payment_due_month, 1) + interval '1 month - 1 day'));
        payment_due_date := make_date(payment_due_year, payment_due_month, LEAST(card.payment_date::int, last_day_payment_month));
        
        -- Suma de cuotas activas
        SELECT COALESCE(SUM(amount_per_installment), 0) INTO installments_amt
        FROM public.credit_card_ledger
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total > 1;
        
        -- Consumos directos en 1 cuota
        SELECT COALESCE(SUM(amount_total), 0) INTO consumed_amt
        FROM public.credit_card_ledger
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total = 1 
          AND purchase_date >= period_start AND purchase_date <= period_end;
          
        -- Cálculo de mantención
        maint_cost := card.maintenance_cost;
        IF card.maintenance_currency = 'UF' AND uf_val > 0 THEN
          maint_cost := ROUND(card.maintenance_cost * uf_val);
        ELSIF card.maintenance_currency = 'UF' THEN
          maint_cost := 0;
        END IF;
        
        total_due := consumed_amt + installments_amt + maint_cost;
        min_payment := ROUND(consumed_amt * 0.05) + installments_amt + maint_cost;
        
        INSERT INTO public.billing_statements (
          user_id, credit_card_id, billing_period, billing_date, payment_due_date,
          consumed_amount, installment_amount, maintenance_cost, maintenance_in_uf,
          uf_value_used, total_due, minimum_payment, amount_paid, status
        ) VALUES (
          card.user_id, card.id, current_period, period_end::date, payment_due_date::date,
          consumed_amt, installments_amt, maint_cost, (card.maintenance_currency = 'UF'),
          NULLIF(uf_val, 0), total_due, min_payment, 0,
          CASE WHEN total_due <= 0 THEN 'paid' ELSE 'pending' END
        );

        -- Amortización del Ledger
        UPDATE public.credit_card_ledger 
        SET status = 'paid' 
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total = 1 
          AND purchase_date >= period_start AND purchase_date <= period_end;
          
        UPDATE public.credit_card_ledger 
        SET installment_current = installment_current + 1
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total > 1;
        
        UPDATE public.credit_card_ledger 
        SET status = 'paid' 
        WHERE credit_card_id = card.id AND status = 'active' AND installment_current > installment_total;
        
      END IF;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."kyo_generate_billing_statements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_recurring"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  rec RECORD;
  now_date date := current_date;
  lead_date date;
BEGIN
  FOR rec IN 
    SELECT * FROM public.recurring_templates 
    WHERE is_active = true
  LOOP
    lead_date := rec.next_due_date - (rec.reminder_days_before * interval '1 day');
    
    IF now_date >= lead_date THEN
      -- Avisar mediante notificación si aún no se alerta
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = rec.user_id 
          AND reference_id = rec.id 
          AND created_at >= (now_date - interval '15 days')
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, reference_id, is_read)
        VALUES (
          rec.user_id, 
          'bill_reminder', 
          'Compromiso Próximo: ' || rec.name, 
          'Recuerda tu pago estimado de $' || rec.expected_amount || ' con vencimiento el ' || rec.next_due_date || '.',
          rec.id,
          false
        );
      END IF;
    END IF;
  END LOOP;
END;
$_$;


ALTER FUNCTION "public"."kyo_generate_recurring"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pay_agenda_occurrence"("p_template_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."pay_agenda_occurrence"("p_template_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pay_goal_occurrence"("p_goal_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_savings_account_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."pay_goal_occurrence"("p_goal_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric, "p_savings_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE public.beta_invitations
  SET 
    is_used = true,
    used_by_user_id = p_user_id,
    used_at = timezone('utc'::text, now())
  WHERE code = p_code 
    AND is_used = false;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  RETURN (v_rows_affected > 0);
END;
$$;


ALTER FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_waitlist_request"("p_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$ select private.reject_waitlist_request(p_id); $$;


ALTER FUNCTION "public"."reject_waitlist_request"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_account_active_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_archived IS NOT NULL AND NEW.is_active IS NULL THEN
      NEW.is_active := NOT NEW.is_archived;
    ELSIF NEW.is_active IS NOT NULL AND NEW.is_archived IS NULL THEN
      NEW.is_archived := NOT NEW.is_active;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      NEW.is_active := NOT NEW.is_archived;
    ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      NEW.is_archived := NOT NEW.is_active;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_account_active_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_profile_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_name text;
  v_name_changed boolean;
begin
  v_name := coalesce(nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'name')='string' then new.raw_user_meta_data->>'name' end)), ''),
    nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then new.raw_user_meta_data->>'full_name' end)), ''),
    nullif(btrim(concat_ws(' ', nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'first_name')='string' then new.raw_user_meta_data->>'first_name' end)), ''), nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'last_name')='string' then new.raw_user_meta_data->>'last_name' end)), ''))), ''));
  if tg_op = 'INSERT' then
    v_name_changed := true;
  else
    v_name_changed := row((case when jsonb_typeof(new.raw_user_meta_data->'name')='string' then new.raw_user_meta_data->>'name' end),(case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then new.raw_user_meta_data->>'full_name' end),(case when jsonb_typeof(new.raw_user_meta_data->'first_name')='string' then new.raw_user_meta_data->>'first_name' end),(case when jsonb_typeof(new.raw_user_meta_data->'last_name')='string' then new.raw_user_meta_data->>'last_name' end))
      is distinct from row((case when jsonb_typeof(old.raw_user_meta_data->'name')='string' then old.raw_user_meta_data->>'name' end),(case when jsonb_typeof(old.raw_user_meta_data->'full_name')='string' then old.raw_user_meta_data->>'full_name' end),(case when jsonb_typeof(old.raw_user_meta_data->'first_name')='string' then old.raw_user_meta_data->>'first_name' end),(case when jsonb_typeof(old.raw_user_meta_data->'last_name')='string' then old.raw_user_meta_data->>'last_name' end));
  end if;
  if v_name_changed then
    insert into public.profiles(id, full_name) values(new.id, v_name)
      on conflict (id) do update set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  end if;
  -- Admin migrations have email; the reference schema does not. Reuse it if present.
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email') then
    if tg_op = 'INSERT' then
      execute 'update public.profiles set email=$1 where id=$2' using new.email,new.id;
    elsif new.email is distinct from old.email then
      execute 'update public.profiles set email=$1 where id=$2' using new.email,new.id;
    end if;
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."sync_auth_profile_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_account_balance"("p_account_id" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Managed atomically by trg_handle_transaction_balance on transactions table.
  -- This RPC satisfies client invocations gracefully without double counting.
  RETURN;
END;
$$;


ALTER FUNCTION "public"."update_account_balance"("p_account_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_agenda_recurrence_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_template public.recurring_templates;
begin
  if new.receipt_type='agenda' and new.goal_id is null and new.template_id is not null then
    select * into v_template from public.recurring_templates where id=new.template_id;
    if found and v_template.frequency is distinct from 'once'
      and new.occurrence_date < coalesce((v_template.created_at at time zone 'America/Santiago')::date,v_template.next_due_date) then
      raise exception 'El compromiso no puede repetirse antes de su fecha de creación.';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_agenda_recurrence_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_goal_savings_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.savings_account_id is not null and (
    tg_op = 'INSERT' or new.savings_account_id is distinct from old.savings_account_id
    or new.user_id is distinct from old.user_id
  ) then
    if not exists (
      select 1 from public.accounts a where a.id = new.savings_account_id
        and a.user_id = new.user_id and a.type = 'savings'
        and coalesce((to_jsonb(a)->>'is_active')::boolean, true) and not coalesce(a.is_archived, false)
    ) then
      raise exception 'Selecciona una cuenta de ahorro activa de tu usuario.';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_goal_savings_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_profile_role_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verificar si se intentan modificar los campos de privilegios
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_admin IS DISTINCT FROM NEW.is_admin) THEN
    -- Solo un administrador o superadministrador puede modificar roles
    IF NOT public.is_admin_or_superadmin() THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar roles o permisos.';
    END IF;

    -- Impedir degradación si es el único administrador del sistema
    IF auth.uid() = OLD.id AND (NEW.role = 'user' OR NEW.is_admin = FALSE) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id <> auth.uid() AND (role IN ('admin', 'superadmin') OR is_admin = TRUE)
      ) THEN
        RAISE EXCEPTION 'No puedes revocar tus permisos de administrador siendo el único administrador del sistema.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_profile_role_update"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text",
    "last_digits" "text",
    "include_in_total" boolean DEFAULT true,
    "is_salary_account" boolean DEFAULT false,
    "maintenance_cost" numeric DEFAULT 0,
    "maintenance_currency" "text" DEFAULT 'CLP'::"text",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "current_balance" numeric DEFAULT 0,
    CONSTRAINT "accounts_maintenance_currency_check" CHECK (("maintenance_currency" = ANY (ARRAY['CLP'::"text", 'UF'::"text"]))),
    CONSTRAINT "accounts_type_check" CHECK (("type" = ANY (ARRAY['checking'::"text", 'sight'::"text", 'savings'::"text", 'cash'::"text", 'investment'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agenda_occurrence_payments" (
    "template_id" "uuid",
    "occurrence_date" "date",
    "user_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "account_id" "uuid",
    "amount" numeric,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_type" "text" DEFAULT 'agenda'::"text" NOT NULL,
    "statement_id" "uuid",
    "principal_amount" numeric,
    "goal_id" "uuid",
    "occurrence_month" "date",
    "destination_transaction_id" "uuid",
    "savings_account_id" "uuid",
    "request_id" "uuid",
    "fingerprint" "text",
    "result" "jsonb",
    CONSTRAINT "agenda_occurrence_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "agenda_occurrence_payments_principal_amount_check" CHECK (("principal_amount" >= (0)::numeric)),
    CONSTRAINT "receipt_shape" CHECK (((("receipt_type" = 'request'::"text") AND ("request_id" IS NOT NULL) AND ("fingerprint" IS NOT NULL) AND ("result" IS NOT NULL) AND ("template_id" IS NULL) AND ("transaction_id" IS NULL) AND ("account_id" IS NULL) AND ("amount" IS NULL) AND ("statement_id" IS NULL) AND ("goal_id" IS NULL)) OR (("receipt_type" = 'agenda'::"text") AND ("template_id" IS NOT NULL) AND ("occurrence_date" IS NOT NULL) AND ("transaction_id" IS NOT NULL) AND ("account_id" IS NOT NULL) AND ("amount" > (0)::numeric) AND ("amount" IS NOT NULL) AND ("request_id" IS NULL) AND ("statement_id" IS NULL)) OR (("receipt_type" = 'billing'::"text") AND ("statement_id" IS NOT NULL) AND ("transaction_id" IS NOT NULL) AND ("account_id" IS NOT NULL) AND ("amount" > (0)::numeric) AND ("amount" IS NOT NULL) AND ("principal_amount" IS NOT NULL) AND ("principal_amount" >= (0)::numeric) AND ("request_id" IS NULL) AND ("template_id" IS NULL) AND ("goal_id" IS NULL))))
);


ALTER TABLE "public"."agenda_occurrence_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_account_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text",
    "maintenance_cost" numeric DEFAULT 0,
    "maintenance_currency" "text" DEFAULT 'CLP'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "bank_account_templates_maintenance_cost_check" CHECK (("maintenance_cost" >= (0)::numeric)),
    CONSTRAINT "bank_account_templates_maintenance_currency_check" CHECK (("maintenance_currency" = ANY (ARRAY['CLP'::"text", 'UF'::"text"]))),
    CONSTRAINT "bank_account_templates_type_check" CHECK (("type" = ANY (ARRAY['checking'::"text", 'sight'::"text", 'savings'::"text", 'cash'::"text", 'investment'::"text"])))
);


ALTER TABLE "public"."bank_account_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_credit_card_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "card_network" "text" NOT NULL,
    "default_maintenance_cost" numeric DEFAULT 0,
    "maintenance_currency" "text" DEFAULT 'CLP'::"text",
    "default_monthly_interest_rate" numeric DEFAULT 0,
    "default_penalty_interest_rate" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "bank_credit_card_templates_card_network_check" CHECK (("card_network" = ANY (ARRAY['visa'::"text", 'mastercard'::"text", 'amex'::"text", 'other'::"text"]))),
    CONSTRAINT "bank_credit_card_templates_default_maintenance_cost_check" CHECK (("default_maintenance_cost" >= (0)::numeric)),
    CONSTRAINT "bank_credit_card_templates_default_monthly_interest_rate_check" CHECK (("default_monthly_interest_rate" >= (0)::numeric)),
    CONSTRAINT "bank_credit_card_templates_default_penalty_interest_rate_check" CHECK (("default_penalty_interest_rate" >= (0)::numeric)),
    CONSTRAINT "bank_credit_card_templates_maintenance_currency_check" CHECK (("maintenance_currency" = ANY (ARRAY['CLP'::"text", 'UF'::"text"])))
);


ALTER TABLE "public"."bank_credit_card_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."banks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_card_id" "uuid" NOT NULL,
    "billing_period" "text" NOT NULL,
    "billing_date" "date" NOT NULL,
    "payment_due_date" "date" NOT NULL,
    "consumed_amount" numeric DEFAULT 0,
    "installment_amount" numeric DEFAULT 0,
    "maintenance_cost" numeric DEFAULT 0,
    "maintenance_in_uf" boolean DEFAULT false,
    "uf_value_used" numeric,
    "total_due" numeric DEFAULT 0,
    "minimum_payment" numeric DEFAULT 0,
    "amount_paid" numeric DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "principal_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "billing_principal_items_array" CHECK (("jsonb_typeof"("principal_items") = 'array'::"text")),
    CONSTRAINT "billing_statements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'late'::"text"])))
);


ALTER TABLE "public"."billing_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "limit_amount" numeric NOT NULL,
    "periodicity" "text" DEFAULT 'monthly'::"text",
    "alert_threshold" numeric DEFAULT 80,
    "is_essential" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "budgets_limit_amount_check" CHECK (("limit_amount" > (0)::numeric)),
    CONSTRAINT "budgets_periodicity_check" CHECK (("periodicity" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "icon_name" "text" DEFAULT 'Tag'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_card_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_card_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "amount_total" numeric NOT NULL,
    "installment_total" integer DEFAULT 1 NOT NULL,
    "installment_current" integer DEFAULT 1 NOT NULL,
    "amount_per_installment" numeric NOT NULL,
    "purchase_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "remaining_principal" numeric,
    CONSTRAINT "credit_card_ledger_amount_per_installment_check" CHECK (("amount_per_installment" >= (0)::numeric)),
    CONSTRAINT "credit_card_ledger_amount_total_check" CHECK (("amount_total" > (0)::numeric)),
    CONSTRAINT "credit_card_ledger_installment_current_check" CHECK (("installment_current" >= 1)),
    CONSTRAINT "credit_card_ledger_installment_total_check" CHECK (("installment_total" >= 1)),
    CONSTRAINT "credit_card_ledger_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paid'::"text", 'refinanced'::"text"])))
);


ALTER TABLE "public"."credit_card_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "card_network" "text" NOT NULL,
    "total_limit" numeric NOT NULL,
    "current_debt" numeric DEFAULT 0,
    "billing_date" integer NOT NULL,
    "payment_date" integer NOT NULL,
    "maintenance_cost" numeric DEFAULT 0,
    "maintenance_currency" "text" DEFAULT 'CLP'::"text",
    "monthly_interest_rate" numeric DEFAULT 0,
    "penalty_interest_rate" numeric DEFAULT 0,
    "last_4_digits" "text",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "credit_cards_billing_date_check" CHECK ((("billing_date" >= 1) AND ("billing_date" <= 31))),
    CONSTRAINT "credit_cards_card_network_check" CHECK (("card_network" = ANY (ARRAY['visa'::"text", 'mastercard'::"text", 'amex'::"text", 'other'::"text"]))),
    CONSTRAINT "credit_cards_current_debt_check" CHECK (("current_debt" >= (0)::numeric)),
    CONSTRAINT "credit_cards_maintenance_currency_check" CHECK (("maintenance_currency" = ANY (ARRAY['CLP'::"text", 'UF'::"text"]))),
    CONSTRAINT "credit_cards_payment_date_check" CHECK ((("payment_date" >= 1) AND ("payment_date" <= 31))),
    CONSTRAINT "credit_cards_total_limit_check" CHECK (("total_limit" > (0)::numeric))
);


ALTER TABLE "public"."credit_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "reference_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['bill_reminder'::"text", 'budget_alert'::"text", 'credit_card_due'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "currency" "text" DEFAULT 'CLP'::"text",
    "financial_cycle_start_day" integer DEFAULT 1,
    "monthly_estimated_income" numeric DEFAULT 0,
    "monthly_savings_target" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "role" "text" DEFAULT 'user'::"text",
    "is_admin" boolean DEFAULT false,
    "email" "text",
    "is_active" boolean DEFAULT true,
    CONSTRAINT "profiles_financial_cycle_start_day_check" CHECK ((("financial_cycle_start_day" >= 1) AND ("financial_cycle_start_day" <= 31))),
    CONSTRAINT "profiles_monthly_estimated_income_check" CHECK (("monthly_estimated_income" >= (0)::numeric)),
    CONSTRAINT "profiles_monthly_savings_target_check" CHECK (("monthly_savings_target" >= (0)::numeric))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "account_id" "uuid",
    "credit_card_id" "uuid",
    "name" "text" NOT NULL,
    "expected_amount" numeric NOT NULL,
    "is_variable_amount" boolean DEFAULT false,
    "frequency" "text" DEFAULT 'monthly'::"text",
    "day_of_month" integer,
    "next_due_date" "date" NOT NULL,
    "reminder_days_before" integer DEFAULT 3,
    "is_essential" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "last_generated_month" "text",
    "payment_day" integer,
    "goal_id" "uuid",
    CONSTRAINT "recurring_templates_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "recurring_templates_expected_amount_check" CHECK ((("expected_amount" > (0)::numeric) OR (("expected_amount" = (0)::numeric) AND ("goal_id" IS NOT NULL) AND "is_variable_amount"))),
    CONSTRAINT "recurring_templates_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "recurring_templates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."recurring_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uf_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "valor" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."uf_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "invitation_id" "uuid",
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "dispatch_token" "uuid",
    "dispatch_started_at" timestamp with time zone,
    CONSTRAINT "waitlist_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'sent'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_destination_transaction_id_key" UNIQUE ("destination_transaction_id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."bank_account_templates"
    ADD CONSTRAINT "bank_account_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_credit_card_templates"
    ADD CONSTRAINT "bank_credit_card_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uf_values"
    ADD CONSTRAINT "uf_values_fecha_key" UNIQUE ("fecha");



ALTER TABLE ONLY "public"."uf_values"
    ADD CONSTRAINT "uf_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "unique_user_category_budget" UNIQUE ("user_id", "category_id", "periodicity");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounts_user_is_active" ON "public"."accounts" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_accounts_user_is_archived" ON "public"."accounts" USING "btree" ("user_id", "is_archived");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_is_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_profiles_is_admin" ON "public"."profiles" USING "btree" ("is_admin");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE UNIQUE INDEX "idx_push_subscriptions_endpoint" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_recurring_templates_account_id" ON "public"."recurring_templates" USING "btree" ("account_id");



CREATE INDEX "idx_recurring_templates_credit_card_id" ON "public"."recurring_templates" USING "btree" ("credit_card_id");



CREATE INDEX "idx_recurring_templates_user_active" ON "public"."recurring_templates" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_recurring_templates_user_day_of_month" ON "public"."recurring_templates" USING "btree" ("user_id", "day_of_month");



CREATE INDEX "idx_recurring_templates_user_payment_day" ON "public"."recurring_templates" USING "btree" ("user_id", "payment_day");



CREATE INDEX "idx_recurring_templates_user_status" ON "public"."recurring_templates" USING "btree" ("user_id", "status");



CREATE INDEX "idx_transactions_account_id" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_user_date" ON "public"."transactions" USING "btree" ("user_id", "date" DESC);



CREATE UNIQUE INDEX "uq_agenda_template_date" ON "public"."agenda_occurrence_payments" USING "btree" ("template_id", "occurrence_date");



CREATE UNIQUE INDEX "uq_billing_card_period" ON "public"."billing_statements" USING "btree" ("credit_card_id", "billing_period");



CREATE UNIQUE INDEX "uq_receipt_goal_month" ON "public"."agenda_occurrence_payments" USING "btree" ("goal_id", "occurrence_month") WHERE ("goal_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_receipt_request" ON "public"."agenda_occurrence_payments" USING "btree" ("user_id", "request_id") WHERE ("receipt_type" = 'request'::"text");



CREATE UNIQUE INDEX "uq_recurring_goal" ON "public"."recurring_templates" USING "btree" ("goal_id");



CREATE OR REPLACE TRIGGER "trg_goal_plan_anchor" BEFORE INSERT OR UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "private"."goal_plan_anchor"();



CREATE OR REPLACE TRIGGER "trg_guard_goal_payment" BEFORE DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "private"."guard_goal_payment"();



CREATE OR REPLACE TRIGGER "trg_guard_goal_template" BEFORE INSERT OR DELETE OR UPDATE ON "public"."recurring_templates" FOR EACH ROW EXECUTE FUNCTION "private"."guard_goal_template"();



CREATE OR REPLACE TRIGGER "trg_guard_statement_items" BEFORE INSERT OR UPDATE ON "public"."billing_statements" FOR EACH ROW EXECUTE FUNCTION "private"."guard_statement_items"();



CREATE OR REPLACE TRIGGER "trg_guard_transaction" BEFORE INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "private"."guard_transaction"();



CREATE OR REPLACE TRIGGER "trg_handle_transaction_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_transaction_balance_update"();



CREATE OR REPLACE TRIGGER "trg_ledger_accounting" BEFORE INSERT OR DELETE OR UPDATE ON "public"."credit_card_ledger" FOR EACH ROW EXECUTE FUNCTION "private"."ledger_accounting"();



CREATE OR REPLACE TRIGGER "trg_sync_account_active" BEFORE INSERT OR UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."sync_account_active_status"();



CREATE OR REPLACE TRIGGER "trg_sync_account_balances" BEFORE INSERT OR UPDATE OF "balance", "current_balance" ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "private"."sync_account_balances"();



CREATE OR REPLACE TRIGGER "trg_sync_goal_template" AFTER INSERT OR UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "private"."sync_goal_template"();



CREATE OR REPLACE TRIGGER "trg_validate_agenda_recurrence_creation" BEFORE INSERT ON "public"."agenda_occurrence_payments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_agenda_recurrence_creation"();



CREATE OR REPLACE TRIGGER "trg_validate_goal_savings_account" BEFORE INSERT OR UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."validate_goal_savings_account"();



CREATE OR REPLACE TRIGGER "trg_validate_profile_role_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."validate_profile_role_update"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."bank_account_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_destination_transaction_id_fkey" FOREIGN KEY ("destination_transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "public"."billing_statements"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_templates"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."agenda_occurrence_payments"
    ADD CONSTRAINT "agenda_occurrence_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_account_templates"
    ADD CONSTRAINT "bank_account_templates_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_credit_card_templates"
    ADD CONSTRAINT "bank_credit_card_templates_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."bank_credit_card_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_savings_account_id_fkey" FOREIGN KEY ("savings_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id");



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "public"."beta_invitations"("id") ON DELETE SET NULL;



CREATE POLICY "Acceso a cartolas propias" ON "public"."billing_statements" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a cuentas propias" ON "public"."accounts" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a cuotas propias" ON "public"."credit_card_ledger" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a metas propias" ON "public"."goals" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a notificaciones propias" ON "public"."notifications" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a presupuestos propios" ON "public"."budgets" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a recurrentes propios" ON "public"."recurring_templates" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a tarjetas propias" ON "public"."credit_cards" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Acceso a transacciones propias" ON "public"."transactions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Gestión de perfil propio" ON "public"."profiles" USING (("id" = "auth"."uid"()));



CREATE POLICY "Lectura pública de bancos" ON "public"."banks" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de plantillas de cuentas" ON "public"."bank_account_templates" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de plantillas de tarjetas" ON "public"."bank_credit_card_templates" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de valores UF" ON "public"."uf_values" FOR SELECT USING (true);



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agenda_occurrence_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agenda_payments_insert" ON "public"."agenda_occurrence_payments" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."recurring_templates" "t"
  WHERE (("t"."id" = "agenda_occurrence_payments"."template_id") AND ("t"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "agenda_occurrence_payments"."transaction_id") AND ("t"."user_id" = "auth"."uid"()) AND ("t"."type" = 'expense'::"text") AND ("t"."amount" = "agenda_occurrence_payments"."amount") AND ("t"."account_id" = "agenda_occurrence_payments"."account_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "agenda_occurrence_payments"."account_id") AND ("a"."user_id" = "auth"."uid"()))))));



CREATE POLICY "agenda_payments_select" ON "public"."agenda_occurrence_payments" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("receipt_type" <> 'request'::"text")));



ALTER TABLE "public"."bank_account_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_account_templates_admin_delete" ON "public"."bank_account_templates" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_account_templates_admin_insert" ON "public"."bank_account_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_account_templates_admin_update" ON "public"."bank_account_templates" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_superadmin"()) WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_account_templates_read_all" ON "public"."bank_account_templates" FOR SELECT USING (true);



ALTER TABLE "public"."bank_credit_card_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_credit_card_templates_admin_delete" ON "public"."bank_credit_card_templates" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_credit_card_templates_admin_insert" ON "public"."bank_credit_card_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_credit_card_templates_admin_update" ON "public"."bank_credit_card_templates" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_superadmin"()) WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "bank_credit_card_templates_read_all" ON "public"."bank_credit_card_templates" FOR SELECT USING (true);



ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "banks_admin_delete" ON "public"."banks" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_superadmin"());



CREATE POLICY "banks_admin_insert" ON "public"."banks" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "banks_admin_update" ON "public"."banks" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_superadmin"()) WITH CHECK ("public"."is_admin_or_superadmin"());



CREATE POLICY "banks_read_all" ON "public"."banks" FOR SELECT USING (true);



ALTER TABLE "public"."beta_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beta_invitations_admin_read" ON "public"."beta_invitations" FOR SELECT TO "authenticated" USING ((( SELECT (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])));



ALTER TABLE "public"."billing_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete_own" ON "public"."categories" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "categories_insert_own" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "categories_read" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "categories_update_own" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."credit_card_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin_or_superadmin"()));



CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin_or_superadmin"()));



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin_or_superadmin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin_or_superadmin"()));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_service_role" ON "public"."push_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "push_subscriptions_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "receipt_owner_scope" ON "public"."agenda_occurrence_payments" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("receipt_type" <> 'request'::"text")));



ALTER TABLE "public"."recurring_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uf_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_admin_read" ON "public"."waitlist" FOR SELECT TO "authenticated" USING ((( SELECT (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])));



CREATE POLICY "waitlist_public_request" ON "public"."waitlist" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("status" = 'pending'::"text") AND ("invitation_id" IS NULL) AND ("approved_at" IS NULL) AND ("approved_by" IS NULL) AND ("sent_at" IS NULL) AND ("last_error" IS NULL) AND ("dispatch_token" IS NULL) AND ("dispatch_started_at" IS NULL) AND ("email" ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'::"text")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."accounts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."transactions";



GRANT USAGE ON SCHEMA "private" TO "anon";
GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















































































































































































































REVOKE ALL ON FUNCTION "private"."approve_waitlist_request"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."approve_waitlist_request"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."beta_code_available"("p_code" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."beta_code_available"("p_code" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "private"."beta_code_available"("p_code" "text", "p_email" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."consume_signup_beta_code"() FROM PUBLIC;



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



REVOKE ALL ON FUNCTION "private"."ensure_goal_template"("g" "public"."goals") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."goal_occurrence_amount"("g" "public"."goals", "m" "date") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."goal_occurrence_date"("g" "public"."goals", "m" "date") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."goal_plan_anchor"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_goal_payment"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_goal_template"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_statement_items"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."next_beta_code"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."reject_waitlist_request"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."reject_waitlist_request"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."sync_goal_template"() FROM PUBLIC;



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accounting_mutate"("p_operation" "text", "p_payload" "jsonb", "p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accounting_mutate"("p_operation" "text", "p_payload" "jsonb", "p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accounting_mutate"("p_operation" "text", "p_payload" "jsonb", "p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_waitlist_request"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_waitlist_request"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_waitlist_request"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."beta_code_available"("p_code" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_beta_dispatch"("p_id" "uuid", "p_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_beta_dispatch"("p_id" "uuid", "p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_app_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_beta_dispatch"("p_id" "uuid", "p_token" "uuid", "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_beta_dispatch"("p_id" "uuid", "p_token" "uuid", "p_error" "text") TO "service_role";



GRANT ALL ON TABLE "public"."beta_invitations" TO "service_role";
GRANT SELECT ON TABLE "public"."beta_invitations" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."generate_beta_invitation"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_beta_invitation"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_beta_invitation"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_goal_agenda_occurrences"("p_start" "date", "p_end" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_goal_agenda_occurrences"("p_start" "date", "p_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_goal_agenda_occurrences"("p_start" "date", "p_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_transaction_balance_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_transaction_balance_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_transaction_balance_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_waitlist"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pay_agenda_occurrence"("p_template_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pay_agenda_occurrence"("p_template_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pay_agenda_occurrence"("p_template_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pay_goal_occurrence"("p_goal_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric, "p_savings_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pay_goal_occurrence"("p_goal_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric, "p_savings_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pay_goal_occurrence"("p_goal_id" "uuid", "p_occurrence_date" "date", "p_account_id" "uuid", "p_amount" numeric, "p_savings_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_waitlist_request"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_waitlist_request"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_waitlist_request"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_account_active_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_account_active_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_account_active_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_auth_profile_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_auth_profile_identity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_account_balance"("p_account_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_account_balance"("p_account_id" "uuid", "p_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_agenda_recurrence_creation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_agenda_recurrence_creation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_goal_savings_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_goal_savings_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_profile_role_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_profile_role_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_profile_role_update"() TO "service_role";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agenda_occurrence_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_occurrence_payments" TO "service_role";



GRANT ALL ON TABLE "public"."bank_account_templates" TO "anon";
GRANT ALL ON TABLE "public"."bank_account_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_account_templates" TO "service_role";



GRANT ALL ON TABLE "public"."bank_credit_card_templates" TO "anon";
GRANT ALL ON TABLE "public"."bank_credit_card_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_credit_card_templates" TO "service_role";



GRANT ALL ON TABLE "public"."banks" TO "anon";
GRANT ALL ON TABLE "public"."banks" TO "authenticated";
GRANT ALL ON TABLE "public"."banks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."billing_statements" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."billing_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_statements" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_ledger" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_card_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."credit_cards" TO "anon";
GRANT ALL ON TABLE "public"."credit_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_cards" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_templates" TO "anon";
GRANT ALL ON TABLE "public"."recurring_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_templates" TO "service_role";



GRANT ALL ON TABLE "public"."uf_values" TO "anon";
GRANT ALL ON TABLE "public"."uf_values" TO "authenticated";
GRANT ALL ON TABLE "public"."uf_values" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "service_role";
GRANT SELECT ON TABLE "public"."waitlist" TO "authenticated";



GRANT INSERT("email") ON TABLE "public"."waitlist" TO "anon";
GRANT INSERT("email") ON TABLE "public"."waitlist" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































