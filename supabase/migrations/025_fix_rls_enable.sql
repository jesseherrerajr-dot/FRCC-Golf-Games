-- Migration 025: Fix RLS enablement for three tables
-- Migrations 021 and 023 created RLS policies but the ENABLE ROW LEVEL SECURITY
-- statements did not take effect, leaving these tables publicly accessible.
-- This was flagged by Supabase Security Advisor (rls_disabled_in_public).
-- The fix has already been applied manually; this migration ensures it persists
-- across database resets.

ALTER TABLE public.handicap_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_shop_contacts_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pro_shop_contact_links ENABLE ROW LEVEL SECURITY;
