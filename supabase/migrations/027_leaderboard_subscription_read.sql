-- ============================================================
-- Migration 027: Allow authenticated users to read event subscriptions
-- ============================================================
-- Problem: The leaderboard page queries event_subscriptions to build the
-- full golfer roster, but the existing RLS policy only lets users see
-- their own subscriptions (profile_id = auth.uid()). This means regular
-- golfers only see themselves on the leaderboard.
--
-- Fix: Add a SELECT policy that allows any authenticated user to read
-- all event_subscriptions rows. This is safe because:
--   1. Subscriptions only contain profile_id and event_id — no sensitive data.
--   2. Golfer names are already visible on the RSVP "In" list and leaderboard.
--   3. The existing "users manage own" policy still restricts writes to own rows.
-- ============================================================

CREATE POLICY "Event Subscriptions: authenticated read"
  ON public.event_subscriptions FOR SELECT
  USING (auth.uid() IS NOT NULL);
