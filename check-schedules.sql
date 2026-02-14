-- Check what game schedules exist
SELECT game_date, invite_sent, reminder_sent, golfer_confirmation_sent 
FROM event_schedules 
WHERE game_date >= CURRENT_DATE 
ORDER BY game_date 
LIMIT 5;

-- Check email schedule configuration
SELECT event_id, email_type, send_day_offset, is_enabled 
FROM email_schedules 
WHERE is_enabled = true 
ORDER BY email_type, priority_order;
