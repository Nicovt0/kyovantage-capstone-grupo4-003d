-- Migration: [SP2-11] Admin Profiles Management & Moderation RLS
-- Description:
-- 1. Defensively ensures all columns exist on public.profiles: email, is_active, role, is_admin, full_name, updated_at, created_at.
-- 2. Ensures security helper function public.is_admin_or_superadmin() exists.
-- 3. Backfills email on profiles from auth.users where available.
-- 4. Configures secure RLS policies for profiles: restricted to self OR public.is_admin_or_superadmin().
-- 5. Restricts role/permission updates to admins and prevents dangerous self-demotion of the sole admin.
-- 6. Creates performance indexes on profiles for instant filtering and search.

-- =====================================================================
-- 1. Ensure Columns Exist on public.profiles (Defensive DDL)
-- =====================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

-- =====================================================================
-- 2. Ensure Security Helper Function exists
-- =====================================================================
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

-- =====================================================================
-- 3. Backfill profiles.email from auth.users if available
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    BEGIN
      UPDATE public.profiles p
      SET email = u.email
      FROM auth.users u
      WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
    EXCEPTION WHEN OTHERS THEN
      -- Silently proceed if environment permissions restrict cross-schema read
      NULL;
    END;
  END IF;
END $$;

-- =====================================================================
-- 4. Trigger Function to Validate Profile Role Updates
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_profile_role_update()
RETURNS trigger AS $$
BEGIN
  -- Check if role or is_admin fields are being changed
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_admin IS DISTINCT FROM NEW.is_admin) THEN
    -- Only admin or superadmin can modify roles
    IF NOT public.is_admin_or_superadmin() THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar roles o permisos.';
    END IF;

    -- Prevent self-demotion if caller is the only admin
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_profile_role_update ON public.profiles;
CREATE TRIGGER trg_validate_profile_role_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_role_update();

-- =====================================================================
-- 5. Enable RLS and Configure Strict Policies on public.profiles
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin_or_superadmin());

-- Ensure grants for authenticated users
GRANT SELECT, UPDATE, INSERT ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- =====================================================================
-- 6. Performance Indexes for accelerated admin search & filtering
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
