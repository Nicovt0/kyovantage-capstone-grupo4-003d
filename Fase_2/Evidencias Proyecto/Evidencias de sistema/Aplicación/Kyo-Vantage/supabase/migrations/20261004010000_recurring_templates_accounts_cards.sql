-- Migration: SP2-01 Adaptation of recurring_templates to normalized accounts/cards & agenda services
-- Description:
-- 1. Adds/adjusts optional foreign keys to accounts and credit_cards with ON DELETE SET NULL.
-- 2. Enforces typed constraints for frequency ('once', 'monthly', 'yearly') and status ('pending', 'paid', 'overdue').
-- 3. Ensures strict Row Level Security (RLS) isolating all operations to auth.uid() = user_id.
-- 4. Provides bidirectional synchronization triggers between legacy and new column names.

DO $$
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.recurring_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text,
    name text,
    amount numeric,
    expected_amount numeric,
    frequency text DEFAULT 'monthly',
    status text DEFAULT 'pending',
    due_date date,
    next_due_date date,
    payment_day integer,
    day_of_month integer,
    account_id uuid,
    credit_card_id uuid,
    category_id uuid,
    type text DEFAULT 'expense',
    is_essential boolean DEFAULT false,
    is_active boolean DEFAULT true,
    lead_days integer DEFAULT 5,
    last_generated_month text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
  );
END $$;

-- Add any missing columns to existing table
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS expected_amount numeric;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'monthly';
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS next_due_date date;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS payment_day integer;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS day_of_month integer;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS credit_card_id uuid;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS is_essential boolean DEFAULT false;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS lead_days integer DEFAULT 5;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS last_generated_month text;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

-- Backfill and normalize column values
UPDATE public.recurring_templates SET title = name WHERE title IS NULL AND name IS NOT NULL;
UPDATE public.recurring_templates SET name = title WHERE name IS NULL AND title IS NOT NULL;
UPDATE public.recurring_templates SET amount = expected_amount WHERE amount IS NULL AND expected_amount IS NOT NULL;
UPDATE public.recurring_templates SET expected_amount = amount WHERE expected_amount IS NULL AND amount IS NOT NULL;
UPDATE public.recurring_templates SET payment_day = day_of_month WHERE payment_day IS NULL AND day_of_month IS NOT NULL;
UPDATE public.recurring_templates SET day_of_month = payment_day WHERE day_of_month IS NULL AND payment_day IS NOT NULL;
UPDATE public.recurring_templates SET due_date = next_due_date WHERE due_date IS NULL AND next_due_date IS NOT NULL;
UPDATE public.recurring_templates SET next_due_date = due_date WHERE next_due_date IS NULL AND due_date IS NOT NULL;
UPDATE public.recurring_templates SET status = 'pending' WHERE status IS NULL;
UPDATE public.recurring_templates SET frequency = 'monthly' WHERE frequency IS NULL OR frequency NOT IN ('once', 'monthly', 'yearly');
UPDATE public.recurring_templates SET type = 'expense' WHERE type IS NULL;

-- 1. Foreign Keys with ON DELETE SET NULL
ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_account_id_fkey;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id)
  ON DELETE SET NULL;

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_credit_card_id_fkey;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_credit_card_id_fkey
  FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id)
  ON DELETE SET NULL;

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_category_id_fkey;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id)
  ON DELETE SET NULL;

-- 2. CHECK Constraints
ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_status_check;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_status_check
  CHECK (status IN ('pending', 'paid', 'overdue'));

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_frequency_check;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_frequency_check
  CHECK (frequency IN ('once', 'monthly', 'yearly'));

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_type_check;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_type_check
  CHECK (type IN ('income', 'expense'));

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_day_of_month_check;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_day_of_month_check
  CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31));

ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_payment_day_check;
ALTER TABLE public.recurring_templates
  ADD CONSTRAINT recurring_templates_payment_day_check
  CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 31));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_id ON public.recurring_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_account_id ON public.recurring_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_credit_card_id ON public.recurring_templates(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_status ON public.recurring_templates(status);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_due_date ON public.recurring_templates(due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON public.recurring_templates(is_active);

-- 3. Trigger for synchronization between column aliases (title/name, amount/expected_amount, payment_day/day_of_month, due_date/next_due_date)
CREATE OR REPLACE FUNCTION public.sync_recurring_templates_columns()
RETURNS trigger AS $$
BEGIN
  -- Synchronize title & name
  IF NEW.title IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.title;
  ELSIF NEW.name IS NOT NULL AND NEW.title IS NULL THEN
    NEW.title := NEW.name;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      NEW.name := NEW.title;
    ELSIF OLD.name IS DISTINCT FROM NEW.name THEN
      NEW.title := NEW.name;
    END IF;
  END IF;

  -- Synchronize amount & expected_amount
  IF NEW.amount IS NOT NULL AND NEW.expected_amount IS NULL THEN
    NEW.expected_amount := NEW.amount;
  ELSIF NEW.expected_amount IS NOT NULL AND NEW.amount IS NULL THEN
    NEW.amount := NEW.expected_amount;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      NEW.expected_amount := NEW.amount;
    ELSIF OLD.expected_amount IS DISTINCT FROM NEW.expected_amount THEN
      NEW.amount := NEW.expected_amount;
    END IF;
  END IF;

  -- Synchronize payment_day & day_of_month
  IF NEW.payment_day IS NOT NULL AND NEW.day_of_month IS NULL THEN
    NEW.day_of_month := NEW.payment_day;
  ELSIF NEW.day_of_month IS NOT NULL AND NEW.payment_day IS NULL THEN
    NEW.payment_day := NEW.day_of_month;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_day IS DISTINCT FROM NEW.payment_day THEN
      NEW.day_of_month := NEW.payment_day;
    ELSIF OLD.day_of_month IS DISTINCT FROM NEW.day_of_month THEN
      NEW.payment_day := NEW.day_of_month;
    END IF;
  END IF;

  -- Synchronize due_date & next_due_date
  IF NEW.due_date IS NOT NULL AND NEW.next_due_date IS NULL THEN
    NEW.next_due_date := NEW.due_date;
  ELSIF NEW.next_due_date IS NOT NULL AND NEW.due_date IS NULL THEN
    NEW.due_date := NEW.next_due_date;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      NEW.next_due_date := NEW.due_date;
    ELSIF OLD.next_due_date IS DISTINCT FROM NEW.next_due_date THEN
      NEW.due_date := NEW.next_due_date;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_recurring_templates ON public.recurring_templates;
CREATE TRIGGER trg_sync_recurring_templates
BEFORE INSERT OR UPDATE ON public.recurring_templates
FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_templates_columns();

-- 4. Row Level Security (RLS) - Strict Isolation to auth.uid() = user_id
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_templates_owner_select" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_owner_insert" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_owner_update" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_owner_delete" ON public.recurring_templates;
DROP POLICY IF EXISTS "Privacidad total de plantillas" ON public.recurring_templates;

CREATE POLICY "recurring_templates_owner_select" ON public.recurring_templates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "recurring_templates_owner_insert" ON public.recurring_templates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_templates_owner_update" ON public.recurring_templates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_templates_owner_delete" ON public.recurring_templates
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recurring_templates TO authenticated;
