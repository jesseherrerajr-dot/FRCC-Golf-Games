-- Migration 009: Add event slugs and registration event tracking
--
-- 1. Add slug column to events for URL-friendly event identifiers (e.g., /join/saturday-morning)
-- 2. Add registration_event_id to profiles to track which event a golfer self-registered through
--    NULL = generic registration or import (subscribe to all events on approval)

-- Add slug column to events
ALTER TABLE public.events ADD COLUMN slug text;

-- Create unique index for slug lookups
CREATE UNIQUE INDEX idx_events_slug ON public.events(slug) WHERE slug IS NOT NULL;

-- Backfill existing event
UPDATE public.events
SET slug = 'saturday-morning'
WHERE name = 'FRCC Saturday Morning Group';

COMMENT ON COLUMN public.events.slug IS 'URL-friendly event identifier for event-specific join links (e.g., saturday-morning). Used in /join/[slug] routes.';

-- Add registration_event_id to profiles
ALTER TABLE public.profiles
ADD COLUMN registration_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.registration_event_id IS 'Event the golfer self-registered through via /join/[slug]. NULL if batch-imported or registered via generic /join. Used for event-specific approval.';
