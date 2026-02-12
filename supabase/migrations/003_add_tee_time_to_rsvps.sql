-- Add tee time preference to RSVPs table (per-week preference, not standing)
ALTER TABLE public.rsvps
ADD COLUMN tee_time_preference text NOT NULL DEFAULT 'no_preference'
  CHECK (tee_time_preference IN ('no_preference', 'early', 'late'));

COMMENT ON COLUMN public.rsvps.tee_time_preference IS 'Per-week tee time preference. Defaults to no_preference each week.';
