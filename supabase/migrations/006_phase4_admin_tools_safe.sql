-- ============================================================
-- Phase 4: Admin Tools & Event Configuration (SAFE VERSION)
-- Adds duration management, multiple reminders, per-week overrides,
-- email_schedules config table, and event_alert_settings table.
--
-- This version wraps all ALTER TABLE ADD COLUMN in IF NOT EXISTS checks,
-- uses CREATE TABLE IF NOT EXISTS, and uses exception handling for RLS policies.
-- ============================================================

-- ============================================================
-- 1. Events table — new columns (safe version with DO blocks)
-- ============================================================

-- Duration management
DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN duration_mode text NOT NULL DEFAULT 'indefinite'
    CHECK (duration_mode IN ('fixed_weeks', 'end_date', 'indefinite'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN start_date date;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN duration_weeks integer
    CHECK (duration_weeks IS NULL OR duration_weeks > 0);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN end_date date;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Minimum player threshold
DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN min_players integer
    CHECK (min_players IS NULL OR min_players > 0);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Multiple reminders (0–3)
DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN num_reminders integer NOT NULL DEFAULT 1
    CHECK (num_reminders BETWEEN 0 AND 3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN reminder2_day smallint
    CHECK (reminder2_day IS NULL OR reminder2_day BETWEEN 0 AND 6);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN reminder2_time time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN reminder3_day smallint
    CHECK (reminder3_day IS NULL OR reminder3_day BETWEEN 0 AND 6);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ADD COLUMN reminder3_time time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add comments (safe — comments can be re-applied)
COMMENT ON COLUMN public.events.duration_mode IS 'How event lifespan is defined: fixed_weeks, end_date, or indefinite.';
COMMENT ON COLUMN public.events.start_date IS 'Start date for fixed_weeks duration mode. Used to calculate end date.';
COMMENT ON COLUMN public.events.duration_weeks IS 'Number of weeks for fixed_weeks duration mode.';
COMMENT ON COLUMN public.events.end_date IS 'End date — explicit for end_date mode, calculated for fixed_weeks, NULL for indefinite.';
COMMENT ON COLUMN public.events.min_players IS 'Minimum registrants for the game to proceed. Triggers low-response alert if not met.';
COMMENT ON COLUMN public.events.num_reminders IS 'Number of reminder emails to send per week (0–3).';
COMMENT ON COLUMN public.events.reminder2_day IS 'Day of week for second reminder (0=Sun, 6=Sat). NULL if num_reminders < 2.';
COMMENT ON COLUMN public.events.reminder2_time IS 'Time of day for second reminder in event timezone. NULL if num_reminders < 2.';
COMMENT ON COLUMN public.events.reminder3_day IS 'Day of week for third reminder. NULL if num_reminders < 3.';
COMMENT ON COLUMN public.events.reminder3_time IS 'Time of day for third reminder. NULL if num_reminders < 3.';

-- ============================================================
-- 2. Change feature flag defaults to FALSE for MVP
-- New events will default to FALSE. Update existing events too.
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.events
  ALTER COLUMN allow_guest_requests SET DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ALTER COLUMN allow_tee_time_preferences SET DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.events
  ALTER COLUMN allow_playing_partner_preferences SET DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Set existing events to FALSE (these features are deferred for MVP)
UPDATE public.events
SET allow_guest_requests = false,
    allow_tee_time_preferences = false,
    allow_playing_partner_preferences = false;

-- ============================================================
-- 3. Event Schedules table — new columns for multi-reminder
--    tracking and per-week overrides
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.event_schedules
  ADD COLUMN min_players_override integer
    CHECK (min_players_override IS NULL OR min_players_override > 0);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.event_schedules
  ADD COLUMN reminder_2_sent boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.event_schedules
  ADD COLUMN reminder_3_sent boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.event_schedules
  ADD COLUMN golfer_confirmation_sent boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.event_schedules
  ADD COLUMN pro_shop_sent boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add comments (safe — comments can be re-applied)
COMMENT ON COLUMN public.event_schedules.min_players_override IS 'Per-week override of event minimum player threshold. NULL = use event default.';
COMMENT ON COLUMN public.event_schedules.reminder_2_sent IS 'Whether the second reminder email has been sent for this game week.';
COMMENT ON COLUMN public.event_schedules.reminder_3_sent IS 'Whether the third reminder email has been sent for this game week.';
COMMENT ON COLUMN public.event_schedules.golfer_confirmation_sent IS 'Whether the golfer confirmation email has been sent for this game week.';
COMMENT ON COLUMN public.event_schedules.pro_shop_sent IS 'Whether the pro shop detail email has been sent for this game week.';

-- ============================================================
-- 4. New table: email_schedules (safe version)
--    Stores per-event email timing configuration.
--    Referenced by the email-scheduler cron job.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email_type text NOT NULL
    CHECK (email_type IN ('invite', 'reminder', 'golfer_confirmation', 'pro_shop_detail')),
  is_enabled boolean NOT NULL DEFAULT true,
  send_day_offset integer NOT NULL,
  send_time time NOT NULL,
  priority_order smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email_type, priority_order)
);

COMMENT ON TABLE public.email_schedules IS 'Per-event email timing configuration. Controls when automated emails are sent relative to game day.';
COMMENT ON COLUMN public.email_schedules.email_type IS 'Type of email: invite, reminder, golfer_confirmation, pro_shop_detail.';
COMMENT ON COLUMN public.email_schedules.send_day_offset IS 'Days relative to game day to send email. Negative = before game day (e.g., -5 = 5 days before).';
COMMENT ON COLUMN public.email_schedules.send_time IS 'Time of day to send in event timezone (e.g., 10:00).';
COMMENT ON COLUMN public.email_schedules.priority_order IS 'Ordering for same email_type. For reminders: 1=first, 2=second, 3=third.';

-- Add updated_at trigger (safe — drop if exists first)
DROP TRIGGER IF EXISTS handle_updated_at_email_schedules ON public.email_schedules;
CREATE TRIGGER handle_updated_at_email_schedules
  BEFORE UPDATE ON public.email_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS for email_schedules
DO $$
BEGIN
  ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop existing policies before recreating (to avoid conflicts)
DROP POLICY IF EXISTS "Email Schedules: authenticated read" ON public.email_schedules;
DROP POLICY IF EXISTS "Email Schedules: event admin manage" ON public.email_schedules;
DROP POLICY IF EXISTS "Email Schedules: super admin full access" ON public.email_schedules;

CREATE POLICY "Email Schedules: authenticated read"
  ON public.email_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Email Schedules: event admin manage"
  ON public.email_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = email_schedules.event_id
    )
  );

CREATE POLICY "Email Schedules: super admin full access"
  ON public.email_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- ============================================================
-- 5. New table: event_alert_settings (safe version)
--    Per-event alert configuration and toggles.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  alert_type text NOT NULL
    CHECK (alert_type IN ('new_registration', 'capacity_reached', 'spot_opened', 'low_response')),
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, alert_type)
);

COMMENT ON TABLE public.event_alert_settings IS 'Per-event alert configuration. Each alert type can be independently toggled.';
COMMENT ON COLUMN public.event_alert_settings.alert_type IS 'Alert type: new_registration, capacity_reached, spot_opened, low_response.';
COMMENT ON COLUMN public.event_alert_settings.config IS 'Alert-specific config as JSON. E.g., low_response: {"day": 4, "time": "17:00"}.';

-- Add updated_at trigger (safe — drop if exists first)
DROP TRIGGER IF EXISTS handle_updated_at_event_alert_settings ON public.event_alert_settings;
CREATE TRIGGER handle_updated_at_event_alert_settings
  BEFORE UPDATE ON public.event_alert_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS for event_alert_settings
DO $$
BEGIN
  ALTER TABLE public.event_alert_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop existing policies before recreating (to avoid conflicts)
DROP POLICY IF EXISTS "Event Alerts: authenticated read" ON public.event_alert_settings;
DROP POLICY IF EXISTS "Event Alerts: event admin manage" ON public.event_alert_settings;
DROP POLICY IF EXISTS "Event Alerts: super admin full access" ON public.event_alert_settings;

CREATE POLICY "Event Alerts: authenticated read"
  ON public.event_alert_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event Alerts: event admin manage"
  ON public.event_alert_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = event_alert_settings.event_id
    )
  );

CREATE POLICY "Event Alerts: super admin full access"
  ON public.event_alert_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- ============================================================
-- 6. Seed default data for existing events (safe with ON CONFLICT)
-- ============================================================

-- Seed email_schedules for all existing active events
-- Saturday game: invite Mon(-5), reminder Thu(-2), confirmation Fri(-1), pro shop Fri(-1)
INSERT INTO public.email_schedules (event_id, email_type, send_day_offset, send_time, priority_order)
SELECT id, 'invite', -5, '10:00', 1 FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.email_schedules (event_id, email_type, send_day_offset, send_time, priority_order)
SELECT id, 'reminder', -2, '10:00', 1 FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.email_schedules (event_id, email_type, send_day_offset, send_time, priority_order)
SELECT id, 'golfer_confirmation', -1, '13:00', 1 FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.email_schedules (event_id, email_type, send_day_offset, send_time, priority_order)
SELECT id, 'pro_shop_detail', -1, '13:00', 1 FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Seed event_alert_settings for all existing active events
INSERT INTO public.event_alert_settings (event_id, alert_type, is_enabled, config)
SELECT id, 'new_registration', true, NULL FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.event_alert_settings (event_id, alert_type, is_enabled, config)
SELECT id, 'capacity_reached', true, NULL FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.event_alert_settings (event_id, alert_type, is_enabled, config)
SELECT id, 'spot_opened', false, NULL FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.event_alert_settings (event_id, alert_type, is_enabled, config)
SELECT id, 'low_response', true, '{"day": 4, "time": "17:00"}'::jsonb FROM public.events WHERE is_active = true
ON CONFLICT DO NOTHING;
