-- Migration: [SP2-09] High Performance Indexes for recurring_templates and accounts
-- Description:
-- 1. Defensively ensures all indexed columns exist across recurring_templates and accounts.
-- 2. Synchronizes payment_day / day_of_month and is_active / is_archived.
-- 3. Composite indexes on recurring_templates for frequent queries: (user_id, status) and (user_id, payment_day).
-- 4. Foreign key indexes on recurring_templates for (account_id) and (credit_card_id) to accelerate relational joins.
-- 5. Dedicated composite index on accounts for active user account queries: (user_id, is_active).

-- =====================================================================
-- 1. Ensure Columns Exist on recurring_templates (Defensive DDL)
-- =====================================================================
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS payment_day integer;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS day_of_month integer;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.recurring_templates ADD COLUMN IF NOT EXISTS credit_card_id uuid;

-- Backfill payment_day <-> day_of_month if one was populated and not the other
UPDATE public.recurring_templates 
SET payment_day = day_of_month 
WHERE payment_day IS NULL AND day_of_month IS NOT NULL;

UPDATE public.recurring_templates 
SET day_of_month = payment_day 
WHERE day_of_month IS NULL AND payment_day IS NOT NULL;

-- =====================================================================
-- 2. Ensure Columns Exist on accounts & Setup Sync
-- =====================================================================
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Backfill is_active based on is_archived if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'is_archived'
  ) THEN
    UPDATE public.accounts SET is_active = NOT COALESCE(is_archived, false) WHERE is_active IS NULL;
  ELSE
    UPDATE public.accounts SET is_active = true WHERE is_active IS NULL;
  END IF;
END $$;

-- Bidirectional sync between is_archived and is_active on accounts
CREATE OR REPLACE FUNCTION public.sync_account_active_status()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_account_active ON public.accounts;
CREATE TRIGGER trg_sync_account_active
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_account_active_status();

-- =====================================================================
-- 3. Composite & FK Indexes on recurring_templates
-- =====================================================================
-- Frequent Query: Filters by user and payment status (e.g. pending vs paid)
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_status 
  ON public.recurring_templates(user_id, status);

-- Frequent Query: Filters by user and payment day of month
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_payment_day 
  ON public.recurring_templates(user_id, payment_day);

CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_day_of_month 
  ON public.recurring_templates(user_id, day_of_month);

-- Frequent Query: Filters by user and active flag
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_active 
  ON public.recurring_templates(user_id, is_active);

-- Relational Joins: Relational hydration with accounts table
CREATE INDEX IF NOT EXISTS idx_recurring_templates_account_id 
  ON public.recurring_templates(account_id);

-- Relational Joins: Relational hydration with credit_cards table
CREATE INDEX IF NOT EXISTS idx_recurring_templates_credit_card_id 
  ON public.recurring_templates(credit_card_id);

-- =====================================================================
-- 4. Index on accounts for active user queries
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_is_active 
  ON public.accounts(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_accounts_user_is_archived 
  ON public.accounts(user_id, is_archived);

-- =====================================================================
-- 5. Foreign Key & Query Indexes on transactions table
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_account_id 
  ON public.transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
  ON public.transactions(user_id, date DESC);
