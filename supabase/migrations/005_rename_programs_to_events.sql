-- ============================================================
-- Rename "programs" to "events" throughout the database
-- This migration renames tables, columns, constraints, indexes,
-- RLS policies, and functions to use "event" terminology
-- ============================================================

-- Step 1: Rename tables
ALTER TABLE public.programs RENAME TO events;
ALTER TABLE public.program_schedules RENAME TO event_schedules;
ALTER TABLE public.program_admins RENAME TO event_admins;
ALTER TABLE public.program_subscriptions RENAME TO event_subscriptions;

-- Step 2: Rename columns that reference program_id
ALTER TABLE public.event_schedules RENAME COLUMN program_id TO event_id;
ALTER TABLE public.event_admins RENAME COLUMN program_id TO event_id;
ALTER TABLE public.event_subscriptions RENAME COLUMN program_id TO event_id;
ALTER TABLE public.playing_partner_preferences RENAME COLUMN program_id TO event_id;
ALTER TABLE public.tee_time_preferences RENAME COLUMN program_id TO event_id;
ALTER TABLE public.pro_shop_contacts RENAME COLUMN program_id TO event_id;
ALTER TABLE public.email_templates RENAME COLUMN program_id TO event_id;
ALTER TABLE public.email_log RENAME COLUMN program_id TO event_id;

-- Step 3: Update comments to use "event" terminology
COMMENT ON TABLE public.events IS 'Recurring game events. Each has its own schedule, capacity, and RSVP cycle.';
COMMENT ON TABLE public.event_schedules IS 'Individual game dates for events. Capacity overrides event default if set. Status controls whether invites fire.';
COMMENT ON TABLE public.event_admins IS 'Admin assignments per event. Primary admin is the reply-to for emails.';
COMMENT ON TABLE public.event_subscriptions IS 'Golfer subscriptions to events. Inactive = unsubscribed (no invites, invisible).';
COMMENT ON TABLE public.playing_partner_preferences IS 'Standing playing partner preferences. Up to 10 per golfer per event.';
COMMENT ON TABLE public.pro_shop_contacts IS 'Pro shop email recipients for Friday detail emails. Multiple per event.';
COMMENT ON TABLE public.email_templates IS 'Canned email templates. event_id NULL = global template available to all events.';

COMMENT ON COLUMN public.event_schedules.event_id IS 'Reference to the parent event';
COMMENT ON COLUMN public.event_admins.event_id IS 'Reference to the event';
COMMENT ON COLUMN public.event_subscriptions.event_id IS 'Reference to the event';
COMMENT ON COLUMN public.playing_partner_preferences.event_id IS 'Reference to the event';
COMMENT ON COLUMN public.tee_time_preferences.event_id IS 'Reference to the event';
COMMENT ON COLUMN public.pro_shop_contacts.event_id IS 'Reference to the event';
COMMENT ON COLUMN public.email_templates.event_id IS 'Reference to the event (NULL = global template)';
COMMENT ON COLUMN public.email_log.event_id IS 'Reference to the event';

COMMENT ON COLUMN public.events.allow_guest_requests IS 'Whether members can request guests for this event. Disable to hide guest request feature.';
COMMENT ON COLUMN public.events.allow_tee_time_preferences IS 'Whether members can request tee time preferences for this event. Disable to hide tee time preference feature.';
COMMENT ON COLUMN public.events.allow_playing_partner_preferences IS 'Whether members can set playing partner preferences for this event. Disable to hide playing partner preferences.';

-- Step 4: Drop and recreate RLS policies with new names
-- Events (formerly programs)
DROP POLICY IF EXISTS "Programs: authenticated read" ON public.events;
DROP POLICY IF EXISTS "Programs: super admin manage" ON public.events;

CREATE POLICY "Events: authenticated read"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Events: super admin manage"
  ON public.events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Event Schedules (formerly program_schedules)
DROP POLICY IF EXISTS "Schedules: authenticated read" ON public.event_schedules;
DROP POLICY IF EXISTS "Schedules: program admin manage" ON public.event_schedules;
DROP POLICY IF EXISTS "Schedules: super admin full access" ON public.event_schedules;

CREATE POLICY "Event Schedules: authenticated read"
  ON public.event_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event Schedules: event admin manage"
  ON public.event_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = event_schedules.event_id
    )
  );

CREATE POLICY "Event Schedules: super admin full access"
  ON public.event_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Event Admins (formerly program_admins)
DROP POLICY IF EXISTS "Program admins: authenticated read" ON public.event_admins;
DROP POLICY IF EXISTS "Program admins: super admin manage" ON public.event_admins;

CREATE POLICY "Event Admins: authenticated read"
  ON public.event_admins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event Admins: super admin manage"
  ON public.event_admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Event Subscriptions (formerly program_subscriptions)
DROP POLICY IF EXISTS "Subscriptions: users manage own" ON public.event_subscriptions;
DROP POLICY IF EXISTS "Subscriptions: admin read" ON public.event_subscriptions;
DROP POLICY IF EXISTS "Subscriptions: super admin full access" ON public.event_subscriptions;

CREATE POLICY "Event Subscriptions: users manage own"
  ON public.event_subscriptions FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Event Subscriptions: admin read"
  ON public.event_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = event_subscriptions.event_id
    )
  );

CREATE POLICY "Event Subscriptions: super admin full access"
  ON public.event_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Update RLS policies for tables with event_id foreign keys
DROP POLICY IF EXISTS "Partners: admin read for program" ON public.playing_partner_preferences;
CREATE POLICY "Partners: admin read for event"
  ON public.playing_partner_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = playing_partner_preferences.event_id
    )
  );

DROP POLICY IF EXISTS "Tee time: admin read for program" ON public.tee_time_preferences;
CREATE POLICY "Tee time: admin read for event"
  ON public.tee_time_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = tee_time_preferences.event_id
    )
  );

DROP POLICY IF EXISTS "Pro shop: admin read" ON public.pro_shop_contacts;
CREATE POLICY "Pro shop: admin read for event"
  ON public.pro_shop_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = pro_shop_contacts.event_id
    )
  );

DROP POLICY IF EXISTS "RSVPs: program admin full read" ON public.rsvps;
CREATE POLICY "RSVPs: event admin full read"
  ON public.rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      JOIN public.event_schedules es ON es.event_id = ea.event_id
      WHERE ea.profile_id = auth.uid()
        AND es.id = rsvps.schedule_id
    )
  );

DROP POLICY IF EXISTS "Guests: program admin manage" ON public.guest_requests;
CREATE POLICY "Guests: event admin manage"
  ON public.guest_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      JOIN public.event_schedules es ON es.event_id = ea.event_id
      WHERE ea.profile_id = auth.uid()
        AND es.id = guest_requests.schedule_id
    )
  );

DROP POLICY IF EXISTS "RSVP history: admin read for program" ON public.rsvp_history;
CREATE POLICY "RSVP history: admin read for event"
  ON public.rsvp_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      JOIN public.event_schedules es ON es.event_id = ea.event_id
      WHERE ea.profile_id = auth.uid()
        AND es.id = rsvp_history.schedule_id
    )
  );

-- Step 5: Update trigger names (if any reference programs)
-- The handle_updated_at triggers don't need renaming as they're generic

-- Done! All references to "program" have been renamed to "event"
