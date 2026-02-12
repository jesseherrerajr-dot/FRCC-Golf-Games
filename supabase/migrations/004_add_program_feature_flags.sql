-- Add program-level feature flags to control optional RSVP features
ALTER TABLE public.programs
ADD COLUMN allow_guest_requests boolean NOT NULL DEFAULT true,
ADD COLUMN allow_tee_time_preferences boolean NOT NULL DEFAULT true,
ADD COLUMN allow_playing_partner_preferences boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.programs.allow_guest_requests IS 'Whether members can request guests for this program. Disable to hide guest request feature.';
COMMENT ON COLUMN public.programs.allow_tee_time_preferences IS 'Whether members can request tee time preferences for this program. Disable to hide tee time preference feature.';
COMMENT ON COLUMN public.programs.allow_playing_partner_preferences IS 'Whether members can set playing partner preferences for this program. Disable to hide playing partner preferences.';
