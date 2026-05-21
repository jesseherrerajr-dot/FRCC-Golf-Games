-- Migration 031: Profiles PII Protection
--
-- Problem: The "Profiles: read own or active" RLS policy grants all authenticated
-- users SELECT * on every active profile, exposing email, phone, and GHIN to any
-- golfer who queries the table directly (e.g., via browser console).
--
-- Fix:
-- 1. Replace the broad SELECT policy with own-profile-only for regular golfers.
-- 2. Create a profiles_directory view (SECURITY DEFINER) that exposes only safe
--    columns (id, first_name, last_name, status) for golfer-facing lookups like
--    the partner search dropdown and leaderboard.
-- 3. Admin policies remain unchanged — admins can still read all profiles.
-- ============================================================

-- Step 1: Drop the overly permissive golfer SELECT policy
DROP POLICY IF EXISTS "Profiles: read own or active" ON public.profiles;

-- Step 2: Create a restrictive policy — golfers can only read their own profile
-- (Admin policies "Profiles: super admin full access" and "Profiles: program admin read all"
-- still grant full access to admins)
CREATE POLICY "Profiles: read own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Step 3: Create a directory view for safe golfer-facing lookups
-- Uses SECURITY DEFINER (security_invoker = false) so it can read all profiles
-- regardless of the caller's RLS restrictions, but only exposes safe columns.
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = false)
AS SELECT
  id,
  first_name,
  last_name,
  status,
  is_guest,
  low_hi_value
FROM public.profiles;

-- Step 4: Grant authenticated users access to the directory view
GRANT SELECT ON public.profiles_directory TO authenticated;

-- Step 5: Add a comment explaining the security model
COMMENT ON VIEW public.profiles_directory IS
  'Safe read-only view of profiles exposing only non-PII columns. '
  'Used by golfer-facing features (partner search, leaderboard) that need to list '
  'other golfers without exposing email, phone, or GHIN. Uses SECURITY DEFINER to '
  'bypass the profiles table RLS restriction (own-profile-only for regular golfers).';
