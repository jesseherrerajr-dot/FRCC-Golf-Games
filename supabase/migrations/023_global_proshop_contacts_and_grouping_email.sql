-- ============================================================
-- Migration 023: Global Pro Shop Contact Directory +
-- Suggested Groupings Email Recipient Settings
-- ============================================================
-- Changes:
-- 1. Create pro_shop_contacts_directory (global contact list)
-- 2. Create event_pro_shop_contact_links (junction: events ↔ global contacts)
-- 3. Add grouping email recipient booleans to events table
-- 4. Migrate existing per-event pro_shop_contacts into global directory + junction
-- 5. RLS policies for new tables

-- ============================================================
-- 1. GLOBAL PRO SHOP CONTACT DIRECTORY
-- Platform-level directory of pro shop contacts, not event-scoped.
-- ============================================================
CREATE TABLE public.pro_shop_contacts_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pro_shop_contacts_directory IS 'Global directory of pro shop contacts. Contacts are linked to events via event_pro_shop_contact_links.';

-- ============================================================
-- 2. EVENT ↔ CONTACT JUNCTION TABLE
-- Links global contacts to specific events.
-- ============================================================
CREATE TABLE public.event_pro_shop_contact_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.pro_shop_contacts_directory(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, contact_id)
);

COMMENT ON TABLE public.event_pro_shop_contact_links IS 'Links events to global pro shop contacts. Each event selects which contacts receive the suggested groupings email.';

-- ============================================================
-- 3. RECIPIENT SETTINGS ON EVENTS TABLE
-- Three booleans controlling who gets the suggested groupings email.
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN grouping_email_send_to_proshop boolean NOT NULL DEFAULT true,
  ADD COLUMN grouping_email_send_to_admins boolean NOT NULL DEFAULT true,
  ADD COLUMN grouping_email_send_to_golfers boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.grouping_email_send_to_proshop IS 'Whether the suggested groupings email is sent to pro shop contacts.';
COMMENT ON COLUMN public.events.grouping_email_send_to_admins IS 'Whether the suggested groupings email is sent to event admins.';
COMMENT ON COLUMN public.events.grouping_email_send_to_golfers IS 'Whether the suggested groupings email is sent to confirmed golfers for that week.';

-- ============================================================
-- 4. MIGRATE EXISTING DATA
-- Move per-event pro_shop_contacts into global directory + junction.
-- Dedup by email (global directory has unique email constraint).
-- ============================================================

-- Insert unique contacts into global directory
INSERT INTO public.pro_shop_contacts_directory (id, name, email, created_at)
SELECT DISTINCT ON (lower(email))
  gen_random_uuid(),
  COALESCE(name, split_part(email, '@', 1)),
  lower(email),
  MIN(created_at)
FROM public.pro_shop_contacts
GROUP BY lower(email), name
ON CONFLICT (email) DO NOTHING;

-- Create junction links for each event's contacts
INSERT INTO public.event_pro_shop_contact_links (event_id, contact_id)
SELECT DISTINCT
  psc.event_id,
  pcd.id
FROM public.pro_shop_contacts psc
JOIN public.pro_shop_contacts_directory pcd ON lower(psc.email) = pcd.email
ON CONFLICT (event_id, contact_id) DO NOTHING;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

ALTER TABLE public.pro_shop_contacts_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pro_shop_contact_links ENABLE ROW LEVEL SECURITY;

-- Global directory: admins can read, super admins can manage
CREATE POLICY "Pro shop directory: admin read"
  ON public.pro_shop_contacts_directory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (
        p.is_super_admin = true
        OR EXISTS (SELECT 1 FROM public.event_admins ea WHERE ea.profile_id = p.id)
      )
    )
  );

CREATE POLICY "Pro shop directory: super admin manage"
  ON public.pro_shop_contacts_directory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Junction: event admins can read their event's links, super admins can manage all
CREATE POLICY "Pro shop links: admin read for event"
  ON public.event_pro_shop_contact_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = event_pro_shop_contact_links.event_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

CREATE POLICY "Pro shop links: super admin manage"
  ON public.event_pro_shop_contact_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Note: We keep the old pro_shop_contacts table for now (backward compatibility).
-- It can be dropped in a future migration after confirming all code references
-- have been updated to use the new tables.
