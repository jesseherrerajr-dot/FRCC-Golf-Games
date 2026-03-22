-- ============================================================
-- 019: Handicap-Based Grouping Methods
-- Adds grouping method selection, flight team pairing option,
-- manual handicap override for profiles, and team_number
-- tracking in groupings table.
-- ============================================================

-- Grouping method: harmony (existing default), flight_foursomes, balanced_foursomes,
-- flight_teams, balanced_teams
ALTER TABLE public.events
ADD COLUMN grouping_method text NOT NULL DEFAULT 'harmony'
CONSTRAINT chk_grouping_method CHECK (
  grouping_method IN ('harmony', 'flight_foursomes', 'balanced_foursomes', 'flight_teams', 'balanced_teams')
);

COMMENT ON COLUMN public.events.grouping_method IS
  'Which grouping algorithm to use: harmony=partner preference based (default), flight_foursomes=skill-sorted groups, balanced_foursomes=ABCD quartile distribution, flight_teams=2-person teams by skill tier, balanced_teams=2-person teams with balanced handicaps';

-- Flight team pairing mode: only relevant when grouping_method = 'flight_teams'
ALTER TABLE public.events
ADD COLUMN flight_team_pairing text NOT NULL DEFAULT 'similar'
CONSTRAINT chk_flight_team_pairing CHECK (
  flight_team_pairing IN ('similar', 'random')
);

COMMENT ON COLUMN public.events.flight_team_pairing IS
  'For flight_teams method: similar=pair similar-skill teams into foursomes (AA+AA), random=pair teams randomly regardless of tier';

-- Manual handicap override on profiles (admin-only editable)
ALTER TABLE public.profiles
ADD COLUMN manual_handicap_index numeric(4,1);

COMMENT ON COLUMN public.profiles.manual_handicap_index IS
  'Admin-entered manual handicap index override. Takes precedence over GHIN-synced handicap_index. NULL = use synced value.';

-- Team number in groupings table (for 2-person team methods)
ALTER TABLE public.groupings
ADD COLUMN team_number smallint;

COMMENT ON COLUMN public.groupings.team_number IS
  'Team assignment within a group (1 or 2). Only populated for 2-person team grouping methods (flight_teams, balanced_teams). NULL for foursome methods.';
