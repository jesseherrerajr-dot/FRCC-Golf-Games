-- Migration 018: Grouping Algorithm Preference Controls
--
-- Adds three independent admin settings for controlling the grouping engine:
-- 1. Partner preference mode: how much partner preferences influence groupings
-- 2. Tee time preference mode: how much tee time preferences influence placement
-- 3. Promote variety: whether to penalize repeat pairings using historical data

-- Partner preference mode: off | light | moderate | full
ALTER TABLE public.events
ADD COLUMN grouping_partner_pref_mode text NOT NULL DEFAULT 'full'
CONSTRAINT chk_grouping_partner_pref_mode CHECK (
  grouping_partner_pref_mode IN ('off', 'light', 'moderate', 'full')
);

-- Tee time preference mode: off | light | moderate | full
ALTER TABLE public.events
ADD COLUMN grouping_tee_time_pref_mode text NOT NULL DEFAULT 'full'
CONSTRAINT chk_grouping_tee_time_pref_mode CHECK (
  grouping_tee_time_pref_mode IN ('off', 'light', 'moderate', 'full')
);

-- Promote group variety (penalize repeat pairings over last 8 weeks)
ALTER TABLE public.events
ADD COLUMN grouping_promote_variety boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.grouping_partner_pref_mode IS
  'Controls how much playing partner preferences influence grouping: off=ignore, light=max 1 per group, moderate=max 2 per group, full=maximize harmony';

COMMENT ON COLUMN public.events.grouping_tee_time_pref_mode IS
  'Controls how much tee time preferences influence group placement: off=ignore, light=priority to infrequent requesters, moderate=balanced priority, full=honor all equally';

COMMENT ON COLUMN public.events.grouping_promote_variety IS
  'When true, the grouping engine penalizes repeat pairings using the last 8 weeks of grouping history';
