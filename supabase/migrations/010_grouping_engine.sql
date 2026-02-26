-- Migration 010: Grouping Engine Schema
-- Adds support for automated foursome grouping suggestions

-- ============================================================
-- 5a. Add rank column to playing_partner_preferences
-- ============================================================
ALTER TABLE public.playing_partner_preferences
ADD COLUMN rank smallint NOT NULL DEFAULT 1;

ALTER TABLE public.playing_partner_preferences
ADD CONSTRAINT unique_partner_rank UNIQUE (profile_id, event_id, rank);

-- Backfill existing rows with rank based on creation order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY profile_id, event_id
    ORDER BY created_at ASC
  ) AS rn
  FROM public.playing_partner_preferences
)
UPDATE public.playing_partner_preferences p
SET rank = r.rn
FROM ranked r
WHERE p.id = r.id;

-- ============================================================
-- 5b. Add allow_auto_grouping feature flag to events
-- ============================================================
ALTER TABLE public.events
ADD COLUMN allow_auto_grouping boolean NOT NULL DEFAULT false;

-- ============================================================
-- 5c. Create groupings table
-- ============================================================
CREATE TABLE public.groupings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.event_schedules(id) ON DELETE CASCADE,
  group_number smallint NOT NULL,
  tee_order smallint NOT NULL,  -- 1 = first off, 2 = second off, etc.
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_request_id uuid REFERENCES public.guest_requests(id) ON DELETE SET NULL,
  harmony_score numeric,  -- group's total harmony score (stored for transparency/debugging)
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_player_per_row CHECK (
    (profile_id IS NOT NULL AND guest_request_id IS NULL) OR
    (profile_id IS NULL AND guest_request_id IS NOT NULL)
  ),
  UNIQUE (schedule_id, profile_id),
  UNIQUE (schedule_id, guest_request_id)
);

-- Index for quick lookup by schedule
CREATE INDEX idx_groupings_schedule ON public.groupings(schedule_id);

-- ============================================================
-- 5d. RLS Policies for groupings
-- ============================================================
ALTER TABLE public.groupings ENABLE ROW LEVEL SECURITY;

-- Admins can read/write
CREATE POLICY "Admins can manage groupings"
ON public.groupings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.is_super_admin = true)
  )
  OR
  EXISTS (
    SELECT 1 FROM public.event_admins ea
    JOIN public.event_schedules es ON es.event_id = ea.event_id
    WHERE es.id = groupings.schedule_id
    AND ea.profile_id = auth.uid()
  )
);

-- Golfers can read their own grouping
CREATE POLICY "Golfers can view own grouping"
ON public.groupings FOR SELECT
USING (profile_id = auth.uid());
