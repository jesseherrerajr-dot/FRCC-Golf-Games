-- ============================================================
-- Scanner Detection Investigation Query
-- Run in Supabase SQL Editor after deploying migration 014
-- ============================================================
-- Shows every RSVP action for a given week with:
--   - User-agent and IP captured at click time
--   - Time between consecutive actions (to spot rapid flips)
--   - Suspicious flag
--   - Human-readable verdict

-- Replace the game_date filter as needed
SELECT
  p.first_name,
  p.last_name,
  p.email,
  h.old_status,
  h.new_status,
  h.created_at AT TIME ZONE 'America/Los_Angeles' as action_time_pacific,
  h.user_agent,
  h.ip_address,
  h.is_suspicious,
  -- Time since this golfer's previous action (NULL = first action)
  h.created_at - LAG(h.created_at) OVER (
    PARTITION BY h.profile_id, h.schedule_id
    ORDER BY h.created_at
  ) as time_since_prev_action,
  CASE
    WHEN h.is_suspicious THEN 'SUSPICIOUS'
    WHEN h.user_agent IS NULL THEN 'NO DATA (pre-migration)'
    ELSE 'OK'
  END as verdict
FROM rsvp_history h
JOIN profiles p ON h.profile_id = p.id
JOIN event_schedules es ON h.schedule_id = es.id
WHERE es.game_date = '2026-03-14'  -- <-- change this date
ORDER BY p.last_name, p.first_name, h.created_at;
