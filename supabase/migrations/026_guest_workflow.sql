-- Migration 026: Guest Workflow Enhancements
-- Adds configurable guest limit per event, approval tokens for email-based
-- approve/decline, and makes guest email and GHIN optional.

-- ============================================================
-- 1. Add max_guests_per_week to events table
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_guests_per_week smallint NOT NULL DEFAULT 1
    CHECK (max_guests_per_week >= 1 AND max_guests_per_week <= 3);

COMMENT ON COLUMN public.events.max_guests_per_week IS
  'Maximum guests a golfer can request per week for this event. Only meaningful when allow_guest_requests = true. Range: 1–3.';

-- ============================================================
-- 2. Add approval_token to guest_requests table
-- ============================================================
ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS approval_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Ensure uniqueness for token-based lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_requests_approval_token
  ON public.guest_requests (approval_token);

COMMENT ON COLUMN public.guest_requests.approval_token IS
  'Unique token for email-based approve/decline links. Generated on insert, used once.';

-- ============================================================
-- 3. Make guest_email and guest_ghin_number optional
-- ============================================================
-- guest_email: drop NOT NULL (was required, now optional)
ALTER TABLE public.guest_requests
  ALTER COLUMN guest_email DROP NOT NULL;

-- guest_ghin_number: drop NOT NULL (was required, now optional)
ALTER TABLE public.guest_requests
  ALTER COLUMN guest_ghin_number DROP NOT NULL;

-- ============================================================
-- 4. Backfill approval_token for any existing guest requests
--    (DEFAULT gen_random_uuid() handles new rows; this covers existing)
-- ============================================================
-- The DEFAULT clause on ADD COLUMN already backfills existing rows in PostgreSQL.
-- No explicit UPDATE needed.
