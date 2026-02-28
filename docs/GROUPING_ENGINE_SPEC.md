# Grouping Engine — Final Specification

**Status:** Fully implemented — algorithm, DB layer, cron integration, pro shop email with grouped roster + preference columns.
**Date:** February 28, 2026 (updated)
**Owner:** Jesse Herrera

---

## 1. Purpose

Generate suggested foursome groupings for each weekly event after RSVP cutoff. Groupings are sent to the pro shop and event admins as a recommendation. The pro shop finalizes and publishes actual tee times through their own system (Golf Genius).

---

## 2. Trigger & Workflow

1. RSVP cutoff time arrives (configurable per event, e.g., Friday 10:00 AM PT).
2. Self-service RSVP locks. Admin can still make manual overrides.
3. **Grouping engine runs automatically at cutoff time** — generates suggested groupings for all confirmed ("in") golfers.
4. Groupings are stored in the `groupings` table.
5. At the scheduled confirmation email time (e.g., Friday 1:00 PM PT):
   - **Golfer confirmation email** — unchanged. Roster only (list of who's in). No groupings.
   - **Pro shop email** — reorganized to show players organized by suggested group in tee order. Labeled "Suggested Groupings" with a note that the pro shop may adjust.
6. Pro shop uses the suggestions to set up Golf Genius, makes final adjustments, and sends tee times to players through their own system.

**Feature Flag:** `allow_auto_grouping` on the `events` table (boolean, default false, super admin only). Engine only runs for events where this is enabled. When disabled, pro shop email sends the current alphabetical roster format.

---

## 3. Constraint Hierarchy

### Level 1 — Guest-Host Pairing (Hard Constraint)
- A guest MUST be in the same group as their sponsoring member.
- Guest+host count as a unit when filling group slots.
- Guests inherit the host's tee time preference. Guests have no independent preferences.
- **Implemented:** Guests are placed in their host's group after the engine runs. Guests appear immediately after their host in the roster, labeled "(Guest of F. Last)".

### Level 2 — Group Math (Hard Constraint)
Divide total confirmed count (N) into groups:
- **Default size:** 4
- **Minimum:** 3
- **Maximum:** 5
- **3-somes tee off first, 5-somes tee off last**

| N  | Groups         | Notes                        |
|----|----------------|------------------------------|
| 1  | (1)            | No real grouping; game likely cancelled |
| 2  | (2)            | No real grouping; game likely cancelled |
| 3  | (3)            | Single threesome              |
| 4  | (4)            | Single foursome               |
| 5  | (5)            | Single fivesome               |
| 6  | (3, 3)         | Two threesomes                |
| 7  | (3, 4)         | Threesome first               |
| 8  | (4, 4)         | Two foursomes                 |
| 9  | (3, 3, 3)      | Three threesomes              |
| 10 | (3, 3, 4)      | Threesomes first              |
| 11 | (3, 4, 4)      | Threesome first               |
| 12 | (4, 4, 4)      | Three foursomes               |
| 13 | (4, 4, 5)      | Fivesome last                 |
| 14 | (3, 4, 4, 3)   | Wait — see formula below      |
| 15 | (3, 4, 4, 4)   | Threesome first               |
| 16 | (4, 4, 4, 4)   | Four foursomes                |
| 17 | (4, 4, 4, 5)   | Fivesome last                 |
| 18 | (3, 3, 4, 4, 4)| Threesomes first              |
| 19 | (3, 4, 4, 4, 4)| Threesome first               |
| 20 | (4, 4, 4, 4, 4)| Five foursomes                |
| 21 | (4, 4, 4, 4, 5)| Fivesome last                 |

**Formula:**
```
groups_of_4 = floor(N / 4)
remainder = N % 4

if remainder == 0: all groups of 4
if remainder == 1: convert one group of 4 → fivesome (last position)
if remainder == 2: convert one group of 4 → two threesomes (first positions)
if remainder == 3: add one threesome (first position)

Special case: N == 5 → single fivesome (don't split to 3+2)
Special case: N == 6 → two threesomes (don't make a sixsome)
```

### Level 3 — Tee Time Preferences (Soft Constraint)
- Source: `rsvps.tee_time_preference` column (per-week, set during RSVP).
- Values: `'early'`, `'late'`, `'no_preference'` (default).
- The engine **tries** to place `early` golfers in lower-numbered groups and `late` golfers in higher-numbered groups.
- This is a **soft constraint** — not guaranteed. When more golfers want "early" than fit in the first group(s), **partner preference scoring** determines who gets priority placement (not RSVP response time).
- `no_preference` golfers fill remaining slots.
- Standing tee time preference table (`tee_time_preferences`) exists but is **ignored** by the engine. Only the per-week RSVP field is used.

### Partner Selection Rules (UI/Data Constraint)
- When selecting preferred playing partners, a golfer can **only choose from active golfers who are subscribed to the same event**.
- Deactivated golfers and golfers not subscribed to the event are excluded from the selection dropdown.
- Preferences are **per event** — a golfer sets separate preference lists for each event they subscribe to, since the participant pool differs.
- If a preferred partner later becomes inactive or unsubscribes from the event, their preference row **remains in the database** but becomes stale. The system does not auto-remove or notify.
- **Engine behavior for stale preferences:** The engine silently skips any preference pointing to a golfer who is not confirmed "in" for that week. No notifications to admins or golfers. It is the golfer's responsibility to maintain their preference list.
- The preferences UI dropdown query must filter: `profiles.status = 'active'` AND `event_subscriptions` exists for that event AND `profile_id != current_user`.

### Level 4 — Weighted Partner Preferences (Soft Constraint)
- Source: `playing_partner_preferences` table with `rank` column (1 = most preferred, up to 10).
- **Rank Reciprocal Scoring:**

| Rank | Points |
|------|--------|
| 1    | 100    |
| 2    | 50     |
| 3    | 33     |
| 4    | 25     |
| 5    | 20     |
| 6    | 17     |
| 7    | 14     |
| 8    | 13     |
| 9    | 11     |
| 10   | 10     |

Formula: `points = round(100 / rank)`

- **Bidirectional scoring:** If A ranks B as #1 (100 pts) and B ranks A as #1 (100 pts), the pair scores 200. If only A ranks B, the pair scores 100. Mutual preferences are naturally weighted higher.
- **Group Harmony Score:** Sum of all pairwise scores within a group. The engine maximizes total harmony across all groups.
- The engine should not violate Level 2 (group sizes) or work against Level 3 (tee time) to chase higher harmony scores. Partner preferences are used to optimize within the constraints set by levels above.

---

## 4. Algorithm Approach

**Greedy heuristic** — not simulated annealing, not brute force.

### High-Level Steps:
1. **Input:** List of confirmed ("in") golfers with their tee time preferences and partner preference rankings for the event.
2. **Calculate group sizes** using the formula in Level 2.
3. **Partition golfers into tee time pools:** `early`, `late`, `no_preference`.
4. **Assign pools to groups:**
   - `early` golfers fill groups from the front (lowest group numbers).
   - `late` golfers fill groups from the back (highest group numbers).
   - `no_preference` golfers fill remaining slots.
   - If a pool overflows its natural groups, excess golfers spill into adjacent groups. Partner scoring determines who stays vs. who spills.
5. **Within each group, optimize for partner preferences:**
   - Use a greedy "best available partner" approach.
   - For each unfilled slot in a group, pick the golfer from the eligible pool who adds the most harmony score to that group.
6. **Output:** Ordered list of groups, each with an ordered list of golfers, group number, and tee position.

### Future Enhancement (deferred):
- **Round Robin tiebreaker:** When harmony scores are equal, prioritize pairing golfers who haven't played together recently. Requires historical grouping data (which will accumulate once the `groupings` table is populated weekly). Not included in initial build.

### Guest Handling (Implemented):
- After the engine assigns members to groups, approved guests are placed into their host's group.
- Guests appear immediately after their host in the roster.
- Guest preferences are ignored; only the host's preferences and tee time apply.
- The DB layer (`grouping-db.ts`) handles guest placement via `fetchApprovedGuests()` and `storeGroupings()`.

---

## 5. Database Changes

### Migration 010: Grouping Engine Schema

#### 5a. Add `rank` column to `playing_partner_preferences`
```sql
ALTER TABLE public.playing_partner_preferences
ADD COLUMN rank smallint NOT NULL DEFAULT 1;

ALTER TABLE public.playing_partner_preferences
ADD CONSTRAINT unique_partner_rank UNIQUE (profile_id, event_id, rank);

-- Backfill existing rows with rank based on creation order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY profile_id, event_id
    ORDER BY created_at ASC
  ) AS rn
  FROM public.playing_partner_preferences
)
UPDATE public.playing_partner_preferences p
SET rank = r.rn
FROM ranked r
WHERE p.id = r.id;
```

#### 5b. Add `allow_auto_grouping` feature flag to `events`
```sql
ALTER TABLE public.events
ADD COLUMN allow_auto_grouping boolean NOT NULL DEFAULT false;
```

#### 5c. Create `groupings` table
```sql
CREATE TABLE public.groupings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.event_schedules(id) ON DELETE CASCADE,
  group_number smallint NOT NULL,
  tee_order smallint NOT NULL,  -- 1 = first off, 2 = second off, etc.
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_request_id uuid REFERENCES public.guest_requests(id) ON DELETE SET NULL,
  harmony_score numeric,  -- group's total harmony score (stored for transparency/debugging)
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_player_per_row CHECK (
    (profile_id IS NOT NULL AND guest_request_id IS NULL) OR
    (profile_id IS NULL AND guest_request_id IS NOT NULL)
  ),
  UNIQUE (schedule_id, profile_id),
  UNIQUE (schedule_id, guest_request_id)
);

-- Index for quick lookup by schedule
CREATE INDEX idx_groupings_schedule ON public.groupings(schedule_id);
```

#### 5d. RLS Policies for `groupings`
```sql
ALTER TABLE public.groupings ENABLE ROW LEVEL SECURITY;

-- Admins can read/write
CREATE POLICY "Admins can manage groupings"
ON public.groupings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.is_super_admin = true)
  )
  OR
  EXISTS (
    SELECT 1 FROM public.event_admins ea
    JOIN public.event_schedules es ON es.event_id = ea.event_id
    WHERE es.id = groupings.schedule_id
    AND ea.profile_id = auth.uid()
  )
);

-- Golfers can read their own grouping
CREATE POLICY "Golfers can view own grouping"
ON public.groupings FOR SELECT
USING (profile_id = auth.uid());
```

---

## 6. File Plan

### New Files:
- `supabase/migrations/010_grouping_engine.sql` — Schema changes (groupings table, rank column, feature flag)
- `src/lib/grouping-engine.ts` — Core algorithm (pure function, no DB calls, shuffle support)
- `src/lib/grouping-engine.test.ts` — Unit tests for the algorithm (36 tests)
- `src/lib/grouping-db.ts` — DB queries: fetch confirmed golfers, partner preferences, approved guests; store groupings; fetch stored groupings with preference annotations

### Modified Files:
- `src/lib/email.ts` — Pro shop email with grouped roster, 6-column table (Name, Email, Phone, GHIN, Tee Time, Player Pref), guest labels, preference annotations
- `src/app/api/cron/email-scheduler/route.ts` — Runs grouping engine at golfer confirmation time (when `allow_auto_grouping` is true), fetches stored groupings for pro shop email. No separate cron entry needed.
- `src/types/events.ts` — Grouping types, Event type with `allow_auto_grouping`
- `src/app/preferences/page.tsx` — Ranked partner list with up/down arrow reordering, email hidden from display (searchable only), partner search filtered to active + subscribed to same event only

### Not Changed (by design):
- Golfer confirmation email (no groupings shown — roster only)
- Standing tee time preferences table/UI (ignored by engine, not removed)
- Admin editing UI (groupings are view-only suggestions)
- No separate grouping cron endpoint — engine piggybacks on the existing email scheduler cron

---

## 7. Explicitly Deferred

These items are acknowledged and designed for but NOT included in this build:

1. **Round Robin tiebreaker** — Needs historical grouping data. Will be viable after engine runs for 4+ weeks.
2. **Random / Handicap-based grouping methods** — Future algorithm modes. Current engine uses partner-preference-based grouping with shuffle randomization.
3. **Admin drag-and-drop editing** — Groupings are read-only suggestions for now.
4. ~~**Guest integration**~~ — **Done.** Guests are placed in their host's group, labeled in the pro shop email.
5. **Standing tee time preference cleanup** — Table and UI left in place, just ignored by engine.
6. **Golfer-facing grouping visibility** — Golfers don't see groupings in email or dashboard yet.
7. **Admin RSVP page grouping display** — Groupings are not yet shown on the admin RSVP management page.

---

## 8. Testing Plan

### Unit Tests (grouping-engine.test.ts):
- Group math: verify correct group sizes for N = 1 through 21
- Tee time: early golfers land in lower groups, late in higher
- Partner scoring: bidirectional scoring works correctly
- Overflow: 6 early golfers with only 4 slots in group 1 → partner score determines placement
- Stale preferences: engine ignores preferences for golfers not "in" that week (no error, just skipped)
- Edge cases: all same preference, no preferences at all, single golfer, two golfers
- Guest-host pairing (stubbed for future)

### Integration Tests:
- Full flow: fetch RSVPs → run engine → store groupings → verify DB state
- Pro shop email includes groupings when `allow_auto_grouping` is true
- Pro shop email uses old format when flag is false
- Cron endpoint only runs for events with flag enabled

---

## 9. Open Questions (for future phases)

- Should golfers eventually see their grouping on the dashboard or in an email?
- Should admins be able to "lock" certain pairings before the engine runs (e.g., "always put these two together")?
- What's the threshold for enabling round robin? (3 weeks of data? 4?)
- Should the engine re-run if an admin makes a post-cutoff RSVP change?
