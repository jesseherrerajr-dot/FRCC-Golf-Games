-- Migration 016: Fix function search_path warnings + tighten email_log INSERT policy
--
-- Fixes 7 "function_search_path_mutable" warnings by pinning search_path
-- to prevent schema-shadowing attacks.
--
-- Also tightens the email_log INSERT policy from "WITH CHECK (true)" (any
-- authenticated user can insert) to admin-only, since email logging is
-- only done server-side.

-- ============================================================
-- 1. Pin search_path on all flagged functions
-- ============================================================

-- handle_updated_at (trigger function)
ALTER FUNCTION public.handle_updated_at()
  SET search_path = public;

-- handle_new_user (auth trigger)
ALTER FUNCTION public.handle_new_user()
  SET search_path = public;

-- handle_email_confirmed (auth trigger)
ALTER FUNCTION public.handle_email_confirmed()
  SET search_path = public;

-- is_super_admin (RLS helper)
ALTER FUNCTION public.is_super_admin()
  SET search_path = public;

-- is_program_admin (RLS helper)
ALTER FUNCTION public.is_program_admin()
  SET search_path = public;

-- is_program_admin_for (RLS helper)
ALTER FUNCTION public.is_program_admin_for(uuid)
  SET search_path = public;

-- calculate_email_send_time (if it exists — created outside migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'calculate_email_send_time'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.calculate_email_send_time SET search_path = public';
  END IF;
END $$;

-- ============================================================
-- 2. Tighten email_log INSERT policy
-- ============================================================
-- Replace the open "WITH CHECK (true)" policy with admin-only insert.
-- Server-side code uses the service_role key (bypasses RLS), so this
-- won't affect cron jobs or email sending.

DROP POLICY IF EXISTS "Email log: system insert" ON public.email_log;

CREATE POLICY "Email log: admin insert"
  ON public.email_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_program_admin());
