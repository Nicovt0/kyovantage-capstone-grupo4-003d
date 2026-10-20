-- Migration: 20261008000000_transaction_accounting_trigger.sql
-- Accounting Consistency & Balance Trigger for Kyo Vantage

-- 1. Ensure current_balance column exists on public.accounts and is synchronized with balance
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS current_balance numeric;
UPDATE public.accounts SET current_balance = balance WHERE current_balance IS NULL;
ALTER TABLE public.accounts ALTER COLUMN current_balance SET DEFAULT 0;

-- 2. Ensure transfer relation columns exist on public.transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS destination_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
-- Ensure status column exists (used by trigger to skip pending transactions)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status text;

-- 3. Accounting consistency trigger function
CREATE OR REPLACE FUNCTION public.handle_transaction_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_dest_id uuid;
BEGIN
  -- Reversion on UPDATE or DELETE
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    IF (OLD.status IS NULL OR OLD.status = 'paid') THEN
      IF (OLD.type = 'expense' AND OLD.account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance + OLD.amount,
            current_balance = COALESCE(current_balance, balance) + OLD.amount
        WHERE id = OLD.account_id;
      ELSIF (OLD.type = 'income' AND OLD.account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance - OLD.amount,
            current_balance = COALESCE(current_balance, balance) - OLD.amount
        WHERE id = OLD.account_id;
      ELSIF (OLD.type = 'transfer') THEN
        v_source_id := COALESCE(OLD.source_account_id, OLD.account_id);
        v_dest_id := OLD.destination_account_id;

        IF (v_source_id IS NOT NULL) THEN
          UPDATE public.accounts
          SET balance = balance + OLD.amount,
              current_balance = COALESCE(current_balance, balance) + OLD.amount
          WHERE id = v_source_id;
        END IF;

        IF (v_dest_id IS NOT NULL) THEN
          UPDATE public.accounts
          SET balance = balance - OLD.amount,
              current_balance = COALESCE(current_balance, balance) - OLD.amount
          WHERE id = v_dest_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Application on INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF (NEW.status IS NULL OR NEW.status = 'paid') THEN
      IF (NEW.type = 'expense' AND NEW.account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance - NEW.amount,
            current_balance = COALESCE(current_balance, balance) - NEW.amount
        WHERE id = NEW.account_id;
      ELSIF (NEW.type = 'income' AND NEW.account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance + NEW.amount,
            current_balance = COALESCE(current_balance, balance) + NEW.amount
        WHERE id = NEW.account_id;
      ELSIF (NEW.type = 'transfer') THEN
        v_source_id := COALESCE(NEW.source_account_id, NEW.account_id);
        v_dest_id := NEW.destination_account_id;

        IF (v_source_id IS NOT NULL) THEN
          UPDATE public.accounts
          SET balance = balance - NEW.amount,
              current_balance = COALESCE(current_balance, balance) - NEW.amount
          WHERE id = v_source_id;
        END IF;

        IF (v_dest_id IS NOT NULL) THEN
          UPDATE public.accounts
          SET balance = balance + NEW.amount,
              current_balance = COALESCE(current_balance, balance) + NEW.amount
          WHERE id = v_dest_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Attach trigger to transactions table
DROP TRIGGER IF EXISTS trg_handle_transaction_balance ON public.transactions;

CREATE TRIGGER trg_handle_transaction_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_balance_update();

-- 5. Safe RPC update_account_balance to prevent double-counting when client invokes RPC
CREATE OR REPLACE FUNCTION public.update_account_balance(
  p_account_id uuid,
  p_amount numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Managed atomically by trg_handle_transaction_balance on transactions table.
  -- This RPC satisfies client invocations gracefully without double counting.
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_account_balance(uuid, numeric) TO authenticated, service_role;

-- 6. Atomic Agenda payment function: relies on trg_handle_transaction_balance for single debit
CREATE OR REPLACE FUNCTION public.pay_agenda_occurrence(
  p_template_id uuid, p_occurrence_date date, p_account_id uuid, p_amount numeric DEFAULT NULL
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

-- 7. Realtime publications for accounts and transactions
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
