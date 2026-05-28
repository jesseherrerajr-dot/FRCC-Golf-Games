-- Migration 034: Restricted Pairings (Do-Not-Pair)
-- Admin-only feature: designate pairs of golfers who should never be grouped together.
-- Golfers have no visibility into this feature.

CREATE TABLE IF NOT EXISTS public.event_do_not_pair (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id_1 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id_2 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_pair CHECK (profile_id_1 <> profile_id_2),
  CONSTRAINT ordered_pair CHECK (profile_id_1 < profile_id_2),
  UNIQUE (event_id, profile_id_1, profile_id_2)
);

COMMENT ON TABLE public.event_do_not_pair IS
  'Pairs of golfers who must never be placed in the same group. Admin-only. UUIDs are order-normalized: profile_id_1 < profile_id_2 to enforce uniqueness regardless of selection order.';

CREATE INDEX IF NOT EXISTS idx_do_not_pair_event
  ON public.event_do_not_pair(event_id);

-- ============================================================
-- RLS: event admins and super admins only — no golfer access
-- ============================================================
ALTER TABLE public.event_do_not_pair ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage do_not_pair restrictions"
ON public.event_do_not_pair FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE ea.event_id = event_do_not_pair.event_id
    AND ea.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE ea.event_id = event_do_not_pair.event_id
    AND ea.profile_id = auth.uid()
  )
);
