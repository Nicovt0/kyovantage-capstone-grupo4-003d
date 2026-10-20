-- Migration: SP2-03 Roles and Security for Admin Access & Financial Entities RLS
-- Description:
-- 1. Adds 'role' and 'is_admin' columns to public.profiles if missing.
-- 2. Updates public.is_admin_or_superadmin() SQL security function.
-- 3. Enables Row Level Security on master financial tables: banks, bank_account_templates, bank_credit_card_templates.
-- 4. Allows public/authenticated READ access and strictly restricts INSERT, UPDATE, DELETE to admins.
-- 5. Configures Storage bucket 'bank-logos' with admin write policies.

-- 1. Ensure columns exist on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Allow users to read their own profile row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin_or_superadmin());

-- 2. Security helper function checking app_metadata and profiles
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- 3. Enable RLS on Master Financial Tables
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_credit_card_templates ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "banks_read_all" ON public.banks;
DROP POLICY IF EXISTS "banks_admin_insert" ON public.banks;
DROP POLICY IF EXISTS "banks_admin_update" ON public.banks;
DROP POLICY IF EXISTS "banks_admin_delete" ON public.banks;

DROP POLICY IF EXISTS "bank_account_templates_read_all" ON public.bank_account_templates;
DROP POLICY IF EXISTS "bank_account_templates_admin_insert" ON public.bank_account_templates;
DROP POLICY IF EXISTS "bank_account_templates_admin_update" ON public.bank_account_templates;
DROP POLICY IF EXISTS "bank_account_templates_admin_delete" ON public.bank_account_templates;

DROP POLICY IF EXISTS "bank_credit_card_templates_read_all" ON public.bank_credit_card_templates;
DROP POLICY IF EXISTS "bank_credit_card_templates_admin_insert" ON public.bank_credit_card_templates;
DROP POLICY IF EXISTS "bank_credit_card_templates_admin_update" ON public.bank_credit_card_templates;
DROP POLICY IF EXISTS "bank_credit_card_templates_admin_delete" ON public.bank_credit_card_templates;

-- 4. Policies for banks
CREATE POLICY "banks_read_all" ON public.banks
  FOR SELECT USING (true);

CREATE POLICY "banks_admin_insert" ON public.banks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "banks_admin_update" ON public.banks
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "banks_admin_delete" ON public.banks
  FOR DELETE TO authenticated
  USING (public.is_admin_or_superadmin());

-- Policies for bank_account_templates
CREATE POLICY "bank_account_templates_read_all" ON public.bank_account_templates
  FOR SELECT USING (true);

CREATE POLICY "bank_account_templates_admin_insert" ON public.bank_account_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "bank_account_templates_admin_update" ON public.bank_account_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "bank_account_templates_admin_delete" ON public.bank_account_templates
  FOR DELETE TO authenticated
  USING (public.is_admin_or_superadmin());

-- Policies for bank_credit_card_templates
CREATE POLICY "bank_credit_card_templates_read_all" ON public.bank_credit_card_templates
  FOR SELECT USING (true);

CREATE POLICY "bank_credit_card_templates_admin_insert" ON public.bank_credit_card_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "bank_credit_card_templates_admin_update" ON public.bank_credit_card_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "bank_credit_card_templates_admin_delete" ON public.bank_credit_card_templates
  FOR DELETE TO authenticated
  USING (public.is_admin_or_superadmin());

-- Grants
GRANT SELECT ON TABLE public.banks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.banks TO authenticated;

GRANT SELECT ON TABLE public.bank_account_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.bank_account_templates TO authenticated;

GRANT SELECT ON TABLE public.bank_credit_card_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.bank_credit_card_templates TO authenticated;

-- 5. Supabase Storage Bucket setup for Bank Logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "bank_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "bank_logos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "bank_logos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "bank_logos_admin_delete" ON storage.objects;

CREATE POLICY "bank_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'bank-logos');

CREATE POLICY "bank_logos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-logos' AND public.is_admin_or_superadmin());

CREATE POLICY "bank_logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.is_admin_or_superadmin())
  WITH CHECK (bucket_id = 'bank-logos' AND public.is_admin_or_superadmin());

CREATE POLICY "bank_logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.is_admin_or_superadmin());
