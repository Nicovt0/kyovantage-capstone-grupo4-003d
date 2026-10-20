-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.beta_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  is_used boolean DEFAULT false,
  used_by_user_id uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  recipient_email text,
  CONSTRAINT beta_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT beta_invitations_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  currency text DEFAULT 'CLP'::text,
  financial_cycle_start_day integer DEFAULT 1 CHECK (financial_cycle_start_day >= 1 AND financial_cycle_start_day <= 31),
  monthly_estimated_income numeric DEFAULT 0 CHECK (monthly_estimated_income >= 0::numeric),
  monthly_savings_target numeric DEFAULT 0 CHECK (monthly_savings_target >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  role text DEFAULT 'user'::text,
  is_admin boolean DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.banks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  logo_url text,
  primary_color text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT banks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bank_account_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['checking'::text, 'sight'::text, 'savings'::text, 'cash'::text, 'investment'::text])),
  currency text DEFAULT 'CLP'::text,
  maintenance_cost numeric DEFAULT 0 CHECK (maintenance_cost >= 0::numeric),
  maintenance_currency text DEFAULT 'CLP'::text CHECK (maintenance_currency = ANY (ARRAY['CLP'::text, 'UF'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bank_account_templates_pkey PRIMARY KEY (id),
  CONSTRAINT bank_account_templates_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id)
);
CREATE TABLE public.bank_credit_card_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL,
  name text NOT NULL,
  card_network text NOT NULL CHECK (card_network = ANY (ARRAY['visa'::text, 'mastercard'::text, 'amex'::text, 'other'::text])),
  default_maintenance_cost numeric DEFAULT 0 CHECK (default_maintenance_cost >= 0::numeric),
  maintenance_currency text DEFAULT 'CLP'::text CHECK (maintenance_currency = ANY (ARRAY['CLP'::text, 'UF'::text])),
  default_monthly_interest_rate numeric DEFAULT 0 CHECK (default_monthly_interest_rate >= 0::numeric),
  default_penalty_interest_rate numeric DEFAULT 0 CHECK (default_penalty_interest_rate >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bank_credit_card_templates_pkey PRIMARY KEY (id),
  CONSTRAINT bank_credit_card_templates_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id)
);
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['checking'::text, 'sight'::text, 'savings'::text, 'cash'::text, 'investment'::text])),
  balance numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'CLP'::text,
  last_digits text,
  include_in_total boolean DEFAULT true,
  is_salary_account boolean DEFAULT false,
  maintenance_cost numeric DEFAULT 0,
  maintenance_currency text DEFAULT 'CLP'::text CHECK (maintenance_currency = ANY (ARRAY['CLP'::text, 'UF'::text])),
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT accounts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.bank_account_templates(id)
);
CREATE TABLE public.credit_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid,
  name text NOT NULL,
  card_network text NOT NULL CHECK (card_network = ANY (ARRAY['visa'::text, 'mastercard'::text, 'amex'::text, 'other'::text])),
  total_limit numeric NOT NULL CHECK (total_limit > 0::numeric),
  current_debt numeric DEFAULT 0 CHECK (current_debt >= 0::numeric),
  billing_date integer NOT NULL CHECK (billing_date >= 1 AND billing_date <= 31),
  payment_date integer NOT NULL CHECK (payment_date >= 1 AND payment_date <= 31),
  maintenance_cost numeric DEFAULT 0,
  maintenance_currency text DEFAULT 'CLP'::text CHECK (maintenance_currency = ANY (ARRAY['CLP'::text, 'UF'::text])),
  monthly_interest_rate numeric DEFAULT 0,
  penalty_interest_rate numeric DEFAULT 0,
  last_4_digits text,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT credit_cards_pkey PRIMARY KEY (id),
  CONSTRAINT credit_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT credit_cards_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.bank_credit_card_templates(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  icon_name text DEFAULT 'Tag'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  limit_amount numeric NOT NULL CHECK (limit_amount > 0::numeric),
  periodicity text DEFAULT 'monthly'::text CHECK (periodicity = ANY (ARRAY['weekly'::text, 'monthly'::text, 'yearly'::text])),
  alert_threshold numeric DEFAULT 80,
  is_essential boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0::numeric),
  current_amount numeric DEFAULT 0 CHECK (current_amount >= 0::numeric),
  start_date timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deadline_date timestamp with time zone,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  color text DEFAULT '#534AB7'::text,
  icon_name text DEFAULT 'Target'::text,
  is_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT goals_pkey PRIMARY KEY (id),
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  credit_card_id uuid,
  category_id uuid,
  goal_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  date timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  name text NOT NULL,
  note text,
  installment_current integer DEFAULT 1,
  installment_total integer DEFAULT 1,
  transfer_group_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id)
);
CREATE TABLE public.credit_card_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_card_id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  amount_total numeric NOT NULL CHECK (amount_total > 0::numeric),
  installment_total integer NOT NULL DEFAULT 1 CHECK (installment_total >= 1),
  installment_current integer NOT NULL DEFAULT 1 CHECK (installment_current >= 1),
  amount_per_installment numeric NOT NULL CHECK (amount_per_installment >= 0::numeric),
  purchase_date timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paid'::text, 'refinanced'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT credit_card_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT credit_card_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT credit_card_ledger_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id),
  CONSTRAINT credit_card_ledger_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.billing_statements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_card_id uuid NOT NULL,
  billing_period text NOT NULL,
  billing_date date NOT NULL,
  payment_due_date date NOT NULL,
  consumed_amount numeric DEFAULT 0,
  installment_amount numeric DEFAULT 0,
  maintenance_cost numeric DEFAULT 0,
  maintenance_in_uf boolean DEFAULT false,
  uf_value_used numeric,
  total_due numeric DEFAULT 0,
  minimum_payment numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'late'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_statements_pkey PRIMARY KEY (id),
  CONSTRAINT billing_statements_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id),
  CONSTRAINT billing_statements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.recurring_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid,
  account_id uuid,
  credit_card_id uuid,
  name text NOT NULL,
  expected_amount numeric NOT NULL CHECK (expected_amount > 0::numeric),
  is_variable_amount boolean DEFAULT false,
  frequency text DEFAULT 'monthly'::text CHECK (frequency = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])),
  day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 31),
  next_due_date date NOT NULL,
  reminder_days_before integer DEFAULT 3,
  is_essential boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text])),
  last_generated_month text,
  CONSTRAINT recurring_templates_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recurring_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT recurring_templates_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT recurring_templates_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['bill_reminder'::text, 'budget_alert'::text, 'credit_card_due'::text, 'system'::text])),
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.uf_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  valor numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uf_values_pkey PRIMARY KEY (id)
);
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'sent'::text, 'error'::text])),
  approved_at timestamp with time zone,
  approved_by uuid,
  invitation_id uuid,
  sent_at timestamp with time zone,
  last_error text,
  dispatch_token uuid,
  dispatch_started_at timestamp with time zone,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT waitlist_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.beta_invitations(id)
);
CREATE TABLE public.agenda_occurrence_payments (
  template_id uuid NOT NULL,
  occurrence_date date NOT NULL,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL UNIQUE,
  account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agenda_occurrence_payments_pkey PRIMARY KEY (template_id, occurrence_date),
  CONSTRAINT agenda_occurrence_payments_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recurring_templates(id),
  CONSTRAINT agenda_occurrence_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT agenda_occurrence_payments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT agenda_occurrence_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);