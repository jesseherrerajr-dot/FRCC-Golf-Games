-- ================================================
-- Tom McCartin RSVP Timing Analysis
-- Run this in Supabase SQL Editor
-- ================================================

-- 1. Find Tom's profile and most recent RSVP
-- Compare invite email sent_at vs RSVP responded_at
-- A scanner typically clicks within 1-15 seconds
-- A human typically takes 30+ seconds minimum

WITH tom AS (
  SELECT id, first_name, last_name, email
  FROM profiles
  WHERE email ILIKE '%mccartin%'
),

-- Get the most recent invite/reminder emails sent to Tom
recent_emails AS (
  SELECT
    el.email_type,
    el.sent_at,
    el.schedule_id,
    es.game_date
  FROM email_log el
  JOIN tom t ON el.golfer_id = t.id
  LEFT JOIN event_schedules es ON el.schedule_id = es.id
  WHERE el.email_type IN ('invite', 'reminder')
  ORDER BY el.sent_at DESC
  LIMIT 5
),

-- Get Tom's most recent RSVPs
recent_rsvps AS (
  SELECT
    r.status,
    r.responded_at,
    r.updated_at,
    r.created_at,
    r.schedule_id,
    es.game_date
  FROM rsvps r
  JOIN tom t ON r.golfer_id = t.id
  LEFT JOIN event_schedules es ON r.schedule_id = es.id
  ORDER BY r.updated_at DESC
  LIMIT 5
)

-- Show everything together
SELECT '--- TOM PROFILE ---' as section, * FROM tom

UNION ALL

SELECT '--- (see below for emails and RSVPs) ---', null, null, null, null;

-- Run these as separate queries if UNION doesn't work:

-- QUERY 2: Recent emails to Tom
SELECT
  'EMAIL' as record_type,
  el.email_type,
  el.sent_at,
  el.sent_at AT TIME ZONE 'America/Los_Angeles' as sent_at_pacific,
  el.schedule_id,
  es.game_date
FROM email_log el
JOIN profiles p ON el.golfer_id = p.id
LEFT JOIN event_schedules es ON el.schedule_id = es.id
WHERE p.email ILIKE '%mccartin%'
  AND el.email_type IN ('invite', 'reminder')
ORDER BY el.sent_at DESC
LIMIT 5;

-- QUERY 3: Recent RSVPs from Tom
SELECT
  'RSVP' as record_type,
  r.status,
  r.responded_at,
  r.responded_at AT TIME ZONE 'America/Los_Angeles' as responded_at_pacific,
  r.updated_at,
  r.updated_at AT TIME ZONE 'America/Los_Angeles' as updated_at_pacific,
  r.schedule_id,
  es.game_date
FROM rsvps r
JOIN profiles p ON r.golfer_id = p.id
LEFT JOIN event_schedules es ON r.schedule_id = es.id
WHERE p.email ILIKE '%mccartin%'
ORDER BY r.updated_at DESC
LIMIT 5;

-- QUERY 4: THE KEY ANALYSIS - Time delta between invite sent and RSVP response
-- This is the critical query for human vs. scanner detection
SELECT
  es.game_date,
  el.email_type,
  el.sent_at AT TIME ZONE 'America/Los_Angeles' as email_sent_pacific,
  r.status as rsvp_status,
  r.responded_at AT TIME ZONE 'America/Los_Angeles' as rsvp_responded_pacific,
  r.responded_at - el.sent_at as time_delta,
  EXTRACT(EPOCH FROM (r.responded_at - el.sent_at)) as seconds_between,
  CASE
    WHEN EXTRACT(EPOCH FROM (r.responded_at - el.sent_at)) < 15 THEN '🚨 LIKELY SCANNER (< 15 sec)'
    WHEN EXTRACT(EPOCH FROM (r.responded_at - el.sent_at)) < 30 THEN '⚠️ SUSPICIOUS (15-30 sec)'
    WHEN EXTRACT(EPOCH FROM (r.responded_at - el.sent_at)) < 120 THEN '✅ LIKELY HUMAN (30 sec - 2 min)'
    ELSE '✅ DEFINITELY HUMAN (> 2 min)'
  END as verdict
FROM email_log el
JOIN profiles p ON el.golfer_id = p.id
JOIN rsvps r ON r.golfer_id = p.id AND r.schedule_id = el.schedule_id
LEFT JOIN event_schedules es ON el.schedule_id = es.id
WHERE p.email ILIKE '%mccartin%'
  AND el.email_type = 'invite'
ORDER BY el.sent_at DESC
LIMIT 5;
