-- ============================================================
-- Migration 020: Activity Log for usage tracking
-- ============================================================
-- Tracks login events and page views for admin reporting.
-- Lightweight append-only table — no updates, no deletes.

CREATE TABLE public.activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('login', 'page_view')),
  page_path text,  -- e.g., '/home', '/rsvp/abc123', '/admin/events/...'
  metadata jsonb DEFAULT '{}'::jsonb,  -- flexible extra data (login method, referrer, etc.)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for efficient queries by user and type
CREATE INDEX idx_activity_log_profile_id ON public.activity_log(profile_id);
CREATE INDEX idx_activity_log_type_created ON public.activity_log(activity_type, created_at DESC);
CREATE INDEX idx_activity_log_profile_created ON public.activity_log(profile_id, created_at DESC);

-- RLS: users can insert their own activity, admins can read all
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own activity
CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Super admins can read all activity (for reports)
CREATE POLICY "Super admins can read all activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Service role can do anything (for server-side logging)
CREATE POLICY "Service role full access"
  ON public.activity_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
