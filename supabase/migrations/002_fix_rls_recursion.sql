-- ============================================================
-- FIX: Infinite recursion in RLS policies
-- The "super admin" and "program admin" policies on profiles
-- were querying the profiles table itself, causing recursion.
-- Fix: use SECURITY DEFINER functions that bypass RLS.
-- ============================================================

-- Helper: check if current user is a super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is a program admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_program_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_admins WHERE profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin for a specific program
CREATE OR REPLACE FUNCTION public.is_program_admin_for(p_program_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_admins
    WHERE profile_id = auth.uid() AND program_id = p_program_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Drop old policies that caused recursion
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "Profiles: super admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: program admin read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: public read for active members" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users update own" ON public.profiles;

-- Programs
DROP POLICY IF EXISTS "Programs: super admin manage" ON public.programs;

-- RSVPs
DROP POLICY IF EXISTS "RSVPs: super admin full access" ON public.rsvps;
DROP POLICY IF EXISTS "RSVPs: program admin full read" ON public.rsvps;

-- Subscriptions
DROP POLICY IF EXISTS "Subscriptions: super admin full access" ON public.program_subscriptions;
DROP POLICY IF EXISTS "Subscriptions: admin read" ON public.program_subscriptions;

-- Schedules
DROP POLICY IF EXISTS "Schedules: super admin full access" ON public.program_schedules;
DROP POLICY IF EXISTS "Schedules: program admin manage" ON public.program_schedules;

-- Guest requests
DROP POLICY IF EXISTS "Guests: super admin full access" ON public.guest_requests;
DROP POLICY IF EXISTS "Guests: program admin manage" ON public.guest_requests;

-- Playing partner preferences
DROP POLICY IF EXISTS "Partners: admin read for program" ON public.playing_partner_preferences;

-- Tee time preferences
DROP POLICY IF EXISTS "Tee time: admin read for program" ON public.tee_time_preferences;

-- Pro shop contacts
DROP POLICY IF EXISTS "Pro shop: super admin manage" ON public.pro_shop_contacts;
DROP POLICY IF EXISTS "Pro shop: admin read" ON public.pro_shop_contacts;

-- Templates
DROP POLICY IF EXISTS "Templates: super admin manage" ON public.email_templates;

-- Email log
DROP POLICY IF EXISTS "Email log: admin read" ON public.email_log;

-- Program admins
DROP POLICY IF EXISTS "Program admins: super admin manage" ON public.program_admins;

-- RSVP history
DROP POLICY IF EXISTS "RSVP history: super admin read" ON public.rsvp_history;
DROP POLICY IF EXISTS "RSVP history: admin read for program" ON public.rsvp_history;

-- ============================================================
-- Recreate policies using the helper functions
-- ============================================================

-- PROFILES
CREATE POLICY "Profiles: read own or active"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR status = 'active');

CREATE POLICY "Profiles: update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: super admin full access"
  ON public.profiles FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Profiles: program admin read all"
  ON public.profiles FOR SELECT
  USING (public.is_program_admin());

-- PROGRAMS
CREATE POLICY "Programs: super admin manage"
  ON public.programs FOR ALL
  USING (public.is_super_admin());

-- RSVPS
CREATE POLICY "RSVPs: super admin full access"
  ON public.rsvps FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "RSVPs: program admin read"
  ON public.rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_schedules ps
      WHERE ps.id = rsvps.schedule_id
        AND public.is_program_admin_for(ps.program_id)
    )
  );

-- SUBSCRIPTIONS
CREATE POLICY "Subscriptions: super admin full access"
  ON public.program_subscriptions FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Subscriptions: program admin read"
  ON public.program_subscriptions FOR SELECT
  USING (public.is_program_admin_for(program_subscriptions.program_id));

-- SCHEDULES
CREATE POLICY "Schedules: super admin full access"
  ON public.program_schedules FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Schedules: program admin manage"
  ON public.program_schedules FOR ALL
  USING (public.is_program_admin_for(program_schedules.program_id));

-- GUEST REQUESTS
CREATE POLICY "Guests: super admin full access"
  ON public.guest_requests FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Guests: program admin manage"
  ON public.guest_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.program_schedules ps
      WHERE ps.id = guest_requests.schedule_id
        AND public.is_program_admin_for(ps.program_id)
    )
  );

-- PLAYING PARTNER PREFERENCES
CREATE POLICY "Partners: admin read"
  ON public.playing_partner_preferences FOR SELECT
  USING (public.is_program_admin_for(playing_partner_preferences.program_id));

-- TEE TIME PREFERENCES
CREATE POLICY "Tee time: admin read"
  ON public.tee_time_preferences FOR SELECT
  USING (public.is_program_admin_for(tee_time_preferences.program_id));

-- PRO SHOP CONTACTS
CREATE POLICY "Pro shop: super admin manage"
  ON public.pro_shop_contacts FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Pro shop: program admin read"
  ON public.pro_shop_contacts FOR SELECT
  USING (public.is_program_admin_for(pro_shop_contacts.program_id));

-- TEMPLATES
CREATE POLICY "Templates: super admin manage"
  ON public.email_templates FOR ALL
  USING (public.is_super_admin());

-- EMAIL LOG
CREATE POLICY "Email log: admin read"
  ON public.email_log FOR SELECT
  USING (public.is_super_admin() OR public.is_program_admin());

-- PROGRAM ADMINS
CREATE POLICY "Program admins: super admin manage"
  ON public.program_admins FOR ALL
  USING (public.is_super_admin());

-- RSVP HISTORY
CREATE POLICY "RSVP history: super admin read"
  ON public.rsvp_history FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "RSVP history: program admin read"
  ON public.rsvp_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_schedules ps
      WHERE ps.id = rsvp_history.schedule_id
        AND public.is_program_admin_for(ps.program_id)
    )
  );
