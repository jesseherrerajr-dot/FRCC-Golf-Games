-- Migration 021: Handicap History Table
-- Records every handicap index value fetched from GHIN for trend tracking.
-- One row per golfer per sync — captures the value even if unchanged,
-- so we have a complete timeline for group trending analysis.

CREATE TABLE handicap_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  handicap_index numeric(4,1) NOT NULL,
  source text NOT NULL DEFAULT 'ghin_sync' CHECK (source IN ('ghin_sync', 'manual')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Index for per-golfer trend queries (most recent first)
CREATE INDEX idx_handicap_history_profile_recorded
  ON handicap_history (profile_id, recorded_at DESC);

-- Index for group-level trending queries (date range scans)
CREATE INDEX idx_handicap_history_recorded_at
  ON handicap_history (recorded_at DESC);

-- RLS
ALTER TABLE handicap_history ENABLE ROW LEVEL SECURITY;

-- Golfers can read their own history
CREATE POLICY "Users can read own handicap history"
  ON handicap_history FOR SELECT
  USING (profile_id = auth.uid());

-- Admins can read all history (for group trending)
CREATE POLICY "Admins can read all handicap history"
  ON handicap_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE event_admins.profile_id = auth.uid()
    )
  );

-- Service role manages inserts (from cron sync)
CREATE POLICY "Service role can insert handicap history"
  ON handicap_history FOR INSERT
  WITH CHECK (true);
