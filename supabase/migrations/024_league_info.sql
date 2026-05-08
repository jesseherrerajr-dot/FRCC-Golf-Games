-- ============================================================
-- Migration 024: League Info Feature
-- ============================================================
-- Changes:
-- 1. Create event_league_config (master league toggle + season settings)
-- 2. Create event_league_tabs (flexible per-event tab configuration)
-- 3. Create league_scores (weekly Stableford scores per golfer)
-- 4. RLS policies for all three tables
-- 5. Seed Thursday League config and tabs

-- ============================================================
-- 1. EVENT LEAGUE CONFIG
-- Master configuration for the league feature per event.
-- One row per event (optional — no row means league is disabled).
-- ============================================================
CREATE TABLE public.event_league_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  league_enabled boolean NOT NULL DEFAULT false,
  season_name text,
  season_start date,
  season_end date,
  best_n integer,
  total_m integer,
  min_rounds_to_qualify integer,
  prize_pool_total numeric(10,2),
  payout_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_league_config IS 'Per-event league configuration: season name, scoring parameters, prize structure. One row per event.';
COMMENT ON COLUMN public.event_league_config.best_n IS 'Number of best rounds that count toward season standings.';
COMMENT ON COLUMN public.event_league_config.total_m IS 'Total rounds in the season (informational).';
COMMENT ON COLUMN public.event_league_config.min_rounds_to_qualify IS 'Minimum rounds played to qualify for season prizes.';
COMMENT ON COLUMN public.event_league_config.payout_config IS 'Ordered JSON array of payout percentages by place, e.g. [20.5, 17, 14.5, ...].';

-- ============================================================
-- 2. EVENT LEAGUE TABS
-- Flexible tab configuration per event. Each row = one tab on
-- the league info page.
-- ============================================================
CREATE TABLE public.event_league_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  label text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('html', 'leaderboard', 'weekly_results')),
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, tab_key)
);

COMMENT ON TABLE public.event_league_tabs IS 'Per-event tab configuration for the league info page. Each row defines one tab with its content type and display order.';

-- ============================================================
-- 3. LEAGUE SCORES
-- Weekly Stableford scores per golfer per game date.
-- ============================================================
CREATE TABLE public.league_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_date date NOT NULL,
  stableford_points integer NOT NULL,
  metadata jsonb,
  entered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id, game_date)
);

COMMENT ON TABLE public.league_scores IS 'Weekly Stableford scores per golfer. One row per golfer per game date.';
COMMENT ON COLUMN public.league_scores.metadata IS 'Flexible JSONB for additional data (gross score, net score, handicap used, etc.).';

-- Indexes for common queries
CREATE INDEX idx_league_scores_event_date ON public.league_scores(event_id, game_date);
CREATE INDEX idx_league_scores_event_profile ON public.league_scores(event_id, profile_id);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

ALTER TABLE public.event_league_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_league_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_scores ENABLE ROW LEVEL SECURITY;

-- event_league_config: any authenticated user can read (needed for home page check)
CREATE POLICY "League config: authenticated read"
  ON public.event_league_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- event_league_config: super admin can manage
CREATE POLICY "League config: super admin manage"
  ON public.event_league_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- event_league_tabs: any authenticated user can read
CREATE POLICY "League tabs: authenticated read"
  ON public.event_league_tabs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- event_league_tabs: super admin can manage
CREATE POLICY "League tabs: super admin manage"
  ON public.event_league_tabs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- league_scores: any authenticated user can read
CREATE POLICY "League scores: authenticated read"
  ON public.league_scores FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- league_scores: admins can manage (super admin or event admin for this event)
CREATE POLICY "League scores: admin manage"
  ON public.league_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.event_admins ea
      WHERE ea.profile_id = auth.uid() AND ea.event_id = league_scores.event_id
    )
  );

-- ============================================================
-- 5. SEED DATA — Thursday League
-- Look up the Thursday League event by slug and populate config + tabs.
-- ============================================================
DO $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Find the Thursday League event
  SELECT id INTO v_event_id FROM public.events WHERE slug = 'thursday-league' LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    -- Insert league config
    INSERT INTO public.event_league_config (
      event_id, league_enabled, season_name,
      season_start, season_end,
      best_n, total_m, min_rounds_to_qualify,
      prize_pool_total, payout_config
    ) VALUES (
      v_event_id, true, '2026 Summer Season',
      '2026-05-07', '2026-07-09',
      6, 10, 6,
      11000.00, '[20.5, 17, 14.5, 12, 10, 8, 7, 6, 5]'::jsonb
    ) ON CONFLICT (event_id) DO NOTHING;

    -- Insert league tabs
    INSERT INTO public.event_league_tabs (event_id, tab_key, label, content_type, content, sort_order) VALUES
    (v_event_id, 'leaderboard', 'Leaderboard', 'leaderboard', NULL, 1),
    (v_event_id, 'scoring', 'Scoring & Prizes', 'html', '
<h2>Stableford Scoring (Net)</h2>
<p>Each hole is scored relative to your net par using the Modified Stableford point system:</p>
<table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 1em 0;">
  <thead>
    <tr style="border-bottom: 2px solid #d1d5db;">
      <th style="text-align: left; padding: 8px 12px; font-weight: 600;">Result</th>
      <th style="text-align: center; padding: 8px 12px; font-weight: 600;">Points</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">Double Eagle (Albatross)</td><td style="text-align: center; padding: 8px 12px; font-weight: 600;">5</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">Eagle</td><td style="text-align: center; padding: 8px 12px; font-weight: 600;">3</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">Birdie</td><td style="text-align: center; padding: 8px 12px; font-weight: 600;">2</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">Par</td><td style="text-align: center; padding: 8px 12px; font-weight: 600;">1</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">Bogey</td><td style="text-align: center; padding: 8px 12px;">0</td></tr>
    <tr><td style="padding: 8px 12px;">Double Bogey or worse</td><td style="text-align: center; padding: 8px 12px;">-1</td></tr>
  </tbody>
</table>

<h2>Season Long Scoring</h2>
<p>Your <strong>best 6 out of 10</strong> weekly scores count toward the season total. You must play at least <strong>6 of the 10 weeks</strong> to qualify for season-long prizes.</p>

<br/>

<h2>Prize Payout Structure</h2>
<p>Season Long Pot — Top 9 Players Paid:</p>
<table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 1em 0;">
  <thead>
    <tr style="border-bottom: 2px solid #d1d5db;">
      <th style="text-align: left; padding: 8px 12px; font-weight: 600;">Place</th>
      <th style="text-align: center; padding: 8px 12px; font-weight: 600;">Payout</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">1st</td><td style="text-align: center; padding: 8px 12px;">20.5%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">2nd</td><td style="text-align: center; padding: 8px 12px;">17%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">3rd</td><td style="text-align: center; padding: 8px 12px;">14.5%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">4th</td><td style="text-align: center; padding: 8px 12px;">12%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">5th</td><td style="text-align: center; padding: 8px 12px;">10%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">6th</td><td style="text-align: center; padding: 8px 12px;">8%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">7th</td><td style="text-align: center; padding: 8px 12px;">7%</td></tr>
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 12px;">8th</td><td style="text-align: center; padding: 8px 12px;">6%</td></tr>
    <tr><td style="padding: 8px 12px;">9th</td><td style="text-align: center; padding: 8px 12px;">5%</td></tr>
  </tbody>
</table>
', 2),
    (v_event_id, 'rules', 'Conditions of Play', 'html', '
<h2>League Details</h2>
<ul>
  <li><strong>Duration:</strong> 10 weeks (May 7 – July 9, 2026)</li>
  <li><strong>Day:</strong> Every Thursday</li>
  <li><strong>Tee Times:</strong> Starting at 3:30 PM with simultaneous tee-offs on two different nines so everyone finishes around the same time</li>
  <li><strong>Format:</strong> 9 holes, Modified Stableford (Net Scoring)</li>
  <li><strong>Post-Round:</strong> Food and drinks on the patio are highly encouraged</li>
</ul>

<h2>Eligibility & Qualification</h2>
<ul>
  <li>You must play at least <strong>6 of the 10 weeks</strong> to qualify for season-long prizes</li>
  <li>Your <strong>top 6 weekly scores</strong> will be used to determine the winners</li>
  <li>Top 9 season finishers are paid from the season-long pot</li>
</ul>

<h2>Weekly Games</h2>
<p>In addition to the season-long competition, there is a $25 per player weekly game pot each week. Weekly games include:</p>
<ul>
  <li>Closest to the Pin</li>
  <li>Low Net</li>
  <li>Low Gross</li>
</ul>
<p>Weekly game results are managed separately and are not tracked in the season standings.</p>
', 3)
    ON CONFLICT (event_id, tab_key) DO NOTHING;
  END IF;
END $$;
