-- ============================================================
-- Cleanup: Rename "member" references to "golfer" in
-- SQL comments and RLS policy names
-- ============================================================

-- Update column comments
COMMENT ON COLUMN public.profiles.status IS 'pending_email: awaiting email verification. pending_approval: email verified, awaiting admin approval. active: approved golfer. deactivated: removed from distribution.';

COMMENT ON COLUMN public.events.allow_guest_requests IS 'Whether golfers can request guests for this event. Disable to hide guest request feature.';

COMMENT ON COLUMN public.events.allow_tee_time_preferences IS 'Whether golfers can request tee time preferences for this event. Disable to hide tee time preference feature.';

COMMENT ON COLUMN public.events.allow_playing_partner_preferences IS 'Whether golfers can set playing partner preferences for this event. Disable to hide playing partner preferences.';

-- Update table comments
COMMENT ON TABLE public.guest_requests IS 'Golfers requesting to bring guests for a specific week. Pending until admin approves after Friday cutoff.';

-- Rename RLS policies using ALTER POLICY
ALTER POLICY "RSVPs: in members see other in members" ON public.rsvps RENAME TO "RSVPs: in golfers see other in golfers";

ALTER POLICY "Guests: members manage own requests" ON public.guest_requests RENAME TO "Guests: golfers manage own requests";
