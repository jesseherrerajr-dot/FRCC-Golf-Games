-- Migration 032: The Penalty Box
-- Adds per-event gamified penalty system with character witness mechanic.
-- New tables: penalty_box, penalty_witnesses
-- New column: events.penalty_box_enabled (feature flag)

-- ============================================================
-- 1. Add penalty_box_enabled feature flag to events table
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS penalty_box_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.penalty_box_enabled IS
  'Feature flag to enable/disable the Penalty Box for this event.';

-- ============================================================
-- 2. Create penalty_box table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.penalty_box (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charged_by uuid NOT NULL REFERENCES public.profiles(id),
  charge text NOT NULL,
  status text NOT NULL DEFAULT 'incarcerated'
    CHECK (status IN ('incarcerated', 'awaiting_witnesses', 'apology_required', 'released')),
  escape_completed_at timestamptz,
  released_at timestamptz,
  released_by uuid REFERENCES public.profiles(id),
  apology_text text,
  apology_submitted_at timestamptz,
  witnesses_required smallint NOT NULL DEFAULT 3,
  offense_number smallint NOT NULL DEFAULT 1,
  total_no_votes smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.penalty_box IS
  'Gamified penalty records for the Penalty Box feature. Each row is one penalty instance.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_penalty_box_event_status
  ON public.penalty_box (event_id, status);
CREATE INDEX IF NOT EXISTS idx_penalty_box_profile
  ON public.penalty_box (profile_id);

-- ============================================================
-- 3. Create penalty_witnesses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.penalty_witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  penalty_id uuid NOT NULL REFERENCES public.penalty_box(id) ON DELETE CASCADE,
  witness_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired')),
  vote text CHECK (vote IN ('yes', 'no')),
  testimony text,
  game_completed_at timestamptz,
  voted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.penalty_witnesses IS
  'Character witness records for the Penalty Box. Each row is one witness request.';

-- Unique token for tokenized witness links
CREATE UNIQUE INDEX IF NOT EXISTS idx_penalty_witnesses_token
  ON public.penalty_witnesses (token);

-- Prevent asking the same witness twice for the same penalty
CREATE UNIQUE INDEX IF NOT EXISTS idx_penalty_witnesses_unique_per_penalty
  ON public.penalty_witnesses (penalty_id, witness_profile_id);

-- Index for looking up witnesses by penalty
CREATE INDEX IF NOT EXISTS idx_penalty_witnesses_penalty
  ON public.penalty_witnesses (penalty_id);

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE public.penalty_box ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_witnesses ENABLE ROW LEVEL SECURITY;

-- penalty_box: Authenticated users can read all penalties (public visibility)
CREATE POLICY "Authenticated users can read penalties"
  ON public.penalty_box FOR SELECT
  TO authenticated
  USING (true);

-- penalty_box: Admins can insert (create penalties)
CREATE POLICY "Admins can create penalties"
  ON public.penalty_box FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_super_admin = true OR EXISTS (SELECT 1 FROM public.event_admins ea WHERE ea.profile_id = auth.uid()))
    )
  );

-- penalty_box: Admins can update penalties (release, status changes)
CREATE POLICY "Admins can update penalties"
  ON public.penalty_box FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_super_admin = true OR EXISTS (SELECT 1 FROM public.event_admins ea WHERE ea.profile_id = auth.uid()))
    )
  );

-- penalty_box: Penalized golfer can update their own penalty (apology, escape)
CREATE POLICY "Penalized golfer can update own penalty"
  ON public.penalty_box FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid());

-- penalty_box: Service role has full access (for API routes)
CREATE POLICY "Service role full access to penalties"
  ON public.penalty_box FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- penalty_witnesses: Authenticated users can read all witnesses (public visibility)
CREATE POLICY "Authenticated users can read witnesses"
  ON public.penalty_witnesses FOR SELECT
  TO authenticated
  USING (true);

-- penalty_witnesses: Service role has full access
CREATE POLICY "Service role full access to witnesses"
  ON public.penalty_witnesses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- penalty_witnesses: Admins can insert witnesses
CREATE POLICY "Admins can insert witnesses"
  ON public.penalty_witnesses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_super_admin = true OR EXISTS (SELECT 1 FROM public.event_admins ea WHERE ea.profile_id = auth.uid()))
    )
  );

-- penalty_witnesses: Penalized golfer can insert witnesses (selecting their own witnesses)
CREATE POLICY "Penalized golfer can insert witnesses for own penalty"
  ON public.penalty_witnesses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.penalty_box
      WHERE id = penalty_id
      AND profile_id = auth.uid()
    )
  );

-- penalty_witnesses: Witnesses can update their own record (vote, testimony)
CREATE POLICY "Witnesses can update own record"
  ON public.penalty_witnesses FOR UPDATE
  TO authenticated
  USING (witness_profile_id = auth.uid());

-- penalty_witnesses: Admins can update witness records (expire, etc.)
CREATE POLICY "Admins can update witnesses"
  ON public.penalty_witnesses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_super_admin = true OR EXISTS (SELECT 1 FROM public.event_admins ea WHERE ea.profile_id = auth.uid()))
    )
  );

-- ============================================================
-- 5. Update email_log CHECK constraint for new email types
-- ============================================================
-- Drop and recreate the CHECK constraint to include penalty email types
ALTER TABLE public.email_log
  DROP CONSTRAINT IF EXISTS email_log_email_type_check;

ALTER TABLE public.email_log
  ADD CONSTRAINT email_log_email_type_check
  CHECK (email_type IN (
    'invite', 'reminder', 'confirmation_golfer', 'confirmation_proshop',
    'no_game', 'guest_approved', 'guest_denied', 'guest_request_pending',
    'registration_pending', 'custom',
    'penalty_issued', 'penalty_witness_request', 'penalty_witness_no',
    'penalty_witness_timeout', 'penalty_apology', 'penalty_released'
  ));
