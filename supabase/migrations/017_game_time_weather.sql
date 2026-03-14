-- Migration 017: Add game time settings and weather cache
-- Adds first_tee_time and game_type to events table for weather forecast scoping
-- Creates weather_cache table for storing Open-Meteo API responses

-- ============================================================
-- 1. Add game time fields to events
-- ============================================================

-- game_type: '9_holes' or '18_holes' — determines forecast window duration
-- first_tee_time: HH:MM format — when the first group tees off
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT '18_holes'
    CHECK (game_type IN ('9_holes', '18_holes')),
  ADD COLUMN IF NOT EXISTS first_tee_time text NOT NULL DEFAULT '07:30';

-- ============================================================
-- 2. Create weather cache table
-- ============================================================

CREATE TABLE IF NOT EXISTS weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_date text NOT NULL, -- YYYY-MM-DD
  forecast_data jsonb NOT NULL, -- Full hourly forecast for the game window
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One cache entry per event per game date
  UNIQUE (event_id, game_date)
);

-- Index for quick lookups by event + date
CREATE INDEX IF NOT EXISTS idx_weather_cache_event_date
  ON weather_cache(event_id, game_date);

-- RLS: weather cache is read by anyone (public forecasts), written by service role only
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read weather data
CREATE POLICY "Anyone can read weather cache"
  ON weather_cache FOR SELECT
  USING (true);

-- Only service role (admin client) can insert/update weather cache
-- (No INSERT/UPDATE policies for anon — cron jobs use service role which bypasses RLS)

-- ============================================================
-- 3. Set FRCC Saturday Morning Group defaults
-- ============================================================

-- Update the existing Saturday Morning event with correct tee time
-- (This is safe to run — it only affects events matching the name pattern)
UPDATE events
  SET game_type = '18_holes',
      first_tee_time = '07:30'
  WHERE name ILIKE '%saturday morning%';
