-- Migration 011: Web Push Notification Subscriptions
-- Stores browser push subscriptions for Android Chrome (and other supporting browsers).
-- Push notifications are additive to email — email continues unchanged.

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, endpoint)
);

-- Fast lookup when sending push notifications to a batch of users
CREATE INDEX push_subscriptions_profile_id_idx
  ON public.push_subscriptions(profile_id);

-- Add push opt-in flag to profiles (default off)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;
