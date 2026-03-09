-- ============================================================
-- Migration 014: Add scanner detection metadata to rsvp_history
-- ============================================================
-- Captures user-agent and IP address on each RSVP action so
-- admins can detect email scanner bots that inadvertently
-- click RSVP links.

ALTER TABLE public.rsvp_history
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS is_suspicious boolean NOT NULL DEFAULT false;

-- Index for fast recent-history lookups during detection
CREATE INDEX IF NOT EXISTS idx_rsvp_history_profile_schedule_time
ON public.rsvp_history(profile_id, schedule_id, created_at DESC);

-- Index for admin queries filtering suspicious responses
CREATE INDEX IF NOT EXISTS idx_rsvp_history_suspicious
ON public.rsvp_history(schedule_id, is_suspicious)
WHERE is_suspicious = true;
