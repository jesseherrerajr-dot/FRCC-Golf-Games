-- Migration 022: Fix handle_new_user trigger to include registration_event_id
--
-- The original trigger (migration 001) did not extract registration_event_id
-- from user metadata. This was added as a column in migration 009 but the
-- trigger was never updated. As a result, golfers registering via event-specific
-- join links (/join/[slug]) had NULL registration_event_id, causing them to be
-- subscribed to ALL events on approval instead of just the registration event.
--
-- This migration replaces the handle_new_user() function to properly extract
-- and set registration_event_id from user metadata during profile creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, phone, ghin_number, registration_event_id, status)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'ghin_number', ''),
    CASE
      WHEN new.raw_user_meta_data->>'registration_event_id' IS NOT NULL
        AND new.raw_user_meta_data->>'registration_event_id' != ''
      THEN (new.raw_user_meta_data->>'registration_event_id')::uuid
      ELSE NULL
    END,
    CASE
      WHEN new.email_confirmed_at IS NOT NULL THEN 'pending_approval'
      ELSE 'pending_email'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
