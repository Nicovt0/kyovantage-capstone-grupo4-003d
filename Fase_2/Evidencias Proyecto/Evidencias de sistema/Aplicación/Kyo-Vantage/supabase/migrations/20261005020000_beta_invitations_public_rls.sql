-- Migration: Public RLS for beta_invitations validation on registration
-- Description: Enables RLS and grants public (anon) read policy on beta_invitations table so registration can validate beta codes.

ALTER TABLE public.beta_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de codigos beta" ON public.beta_invitations;
CREATE POLICY "Permitir lectura publica de codigos beta" ON public.beta_invitations FOR SELECT USING (true);

GRANT SELECT ON TABLE public.beta_invitations TO anon, authenticated, service_role;
