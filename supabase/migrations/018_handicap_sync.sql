-- ============================================================
-- 018: GHIN Handicap Sync
-- Adds handicap index tracking to profiles, per-event sync toggle,
-- and a sync log table for health monitoring.
-- ============================================================

-- Add handicap columns to profiles
ALTER TABLE public.profiles ADD COLUMN handicap_index numeric(4,1);
ALTER TABLE public.profiles ADD COLUMN handicap_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.handicap_index IS 'Current USGA Handicap Index fetched from GHIN. NULL = never synced or no GHIN number.';
COMMENT ON COLUMN public.profiles.handicap_updated_at IS 'When the handicap index was last successfully fetched from GHIN.';

-- Add sync toggle to events
ALTER TABLE public.events ADD COLUMN handicap_sync_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.handicap_sync_enabled IS 'When ON, GHIN handicap sync runs automatically before this event games.';

-- Handicap sync log table for health monitoring
CREATE TABLE public.handicap_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_golfers int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  error_message text,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed'))
);

COMMENT ON TABLE public.handicap_sync_log IS 'Tracks GHIN handicap sync runs for health monitoring and admin alerts.';

-- RLS
ALTER TABLE public.handicap_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can read sync logs
CREATE POLICY "Admins can read handicap sync logs"
  ON public.handicap_sync_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR
    EXISTS (SELECT 1 FROM public.event_admins WHERE profile_id = auth.uid() AND event_id = handicap_sync_log.event_id)
  );

-- Service role can manage sync logs (for cron jobs)
CREATE POLICY "Service role can manage handicap sync logs"
  ON public.handicap_sync_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for quick lookups by event and recency
CREATE INDEX idx_handicap_sync_log_event_status
  ON public.handicap_sync_log(event_id, status, started_at DESC);
