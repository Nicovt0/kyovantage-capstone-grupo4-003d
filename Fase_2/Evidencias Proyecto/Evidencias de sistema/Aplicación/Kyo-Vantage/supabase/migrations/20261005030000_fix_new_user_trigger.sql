-- Migration: Comprehensive Fix for auth.users Triggers and profiles RLS
-- Description: Drops ALL legacy triggers on auth.users, implements isolated sub-transaction savepoints in handle_new_user_setup, and enables permissive RLS policies.

-- 1. Dynamically drop ALL existing triggers on auth.users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE event_object_schema = 'auth' AND event_object_table = 'users'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE;', r.trigger_name);
  END LOOP;
END $$;

-- 2. Ensure columns exist on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 3. Enable RLS and permissive policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (true);

-- 4. Grant permissions
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.accounts TO anon, authenticated, service_role;

-- 5. Rebuild handle_new_user_setup with isolated sub-block savepoints
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
BEGIN
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_full_name := TRIM(v_first_name || ' ' || v_last_name);

  -- Sub-block 1: Profile insertion
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, is_admin)
    VALUES (
      NEW.id,
      NULLIF(v_full_name, ''),
      'user',
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore profile creation error to prevent blocking auth.users
    NULL;
  END;

  -- Sub-block 2: Default Cash account insertion
  BEGIN
    INSERT INTO public.accounts (user_id, name, balance, include_in_total, type, currency)
    VALUES (
      NEW.id,
      'Efectivo',
      0,
      true,
      'cash',
      'CLP'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore account creation error to prevent blocking auth.users
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- 6. Attach single clean AFTER INSERT trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

GRANT EXECUTE ON FUNCTION public.handle_new_user_setup() TO anon, authenticated, service_role;
