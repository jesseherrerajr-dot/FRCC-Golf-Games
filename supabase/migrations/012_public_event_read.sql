-- Allow unauthenticated (anon) users to read active events.
-- This is required for the /join/[slug] page to work without login,
-- since it queries the events table by slug to render the registration form.
-- Without this policy, RLS blocks the query and the page returns a 404.

CREATE POLICY "Events: public read active"
  ON public.events FOR SELECT
  TO anon
  USING (is_active = true);
