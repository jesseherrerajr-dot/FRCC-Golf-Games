-- Migration 030: League Money Scores
-- Tracks weekly dollar winnings per golfer for the money leaderboard.
-- Mirrors league_scores structure but stores dollar amounts instead of Stableford points.

-- Create league_money_scores table
CREATE TABLE IF NOT EXISTS league_money_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_date date NOT NULL,
  amount numeric(8,2) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT NULL,
  entered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, profile_id, game_date)
);

-- Enable RLS
ALTER TABLE league_money_scores ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all money scores (leaderboard is public to logged-in users)
CREATE POLICY "Authenticated users can read money scores"
  ON league_money_scores FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can manage money scores
CREATE POLICY "Super admins can manage money scores"
  ON league_money_scores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Service role has full access (for cron/API operations)
CREATE POLICY "Service role full access to money scores"
  ON league_money_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_league_money_scores_event_date
  ON league_money_scores(event_id, game_date);

CREATE INDEX idx_league_money_scores_profile
  ON league_money_scores(profile_id);
