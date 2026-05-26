-- Migration 033: Configurable Penalty Box Name
-- Adds per-event custom name for the Penalty Box feature.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS penalty_box_name text NOT NULL DEFAULT 'The Penalty Box';

COMMENT ON COLUMN public.events.penalty_box_name IS
  'Custom display name for the Penalty Box feature (per-event configurable).';
