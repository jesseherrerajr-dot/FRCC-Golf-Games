# League Info Feature — Design Specification

**Status:** Phase 1 COMPLETE (page, tabs, leaderboard, home page link deployed). Score entry (Phase 2) TBD pending first Golf Genius report.
**Date:** May 5, 2026 (Phase 1 built and deployed)
**Owner:** Jesse Herrera

---

## 1. Purpose

Provide golfers with a dedicated page to view league-specific information for events that run a seasonal competition format. For the initial implementation, this applies to the **Thursday 9-Hole League** only, but the design supports any event enabling the feature independently.

The page serves three core needs:
1. **Conditions of Play** — The season's rules (static content, updated rarely).
2. **Scoring Methodology** — How Stableford points are awarded (static content).
3. **Leaderboard** — Data-driven cumulative season standings + weekly results.

Additional content tabs can be added per event without code changes.

---

## 1b. League Parameters (Thursday 9-Hole League — 2026 Summer Season)

These are the confirmed parameters for the initial league implementation.

### Season Structure
- **Duration:** 10 weeks
- **Start date:** May 7, 2026 (Week 1)
- **Game day:** Every Thursday
- **Week dates:** 5/7, 5/14, 5/21, 5/28, 6/4, 6/11, 6/18, 6/25, 7/2, 7/9
- **Tee times:** Starting at 3:30 PM, simultaneous tee-off on two nines

### Scoring — Stableford (Net)
| Result | Points |
|--------|--------|
| Double Eagle (Albatross) | 5 |
| Eagle | 3 |
| Birdie | 2 |
| Par | 1 |
| Bogey | 0 |
| Double Bogey or worse | -1 |

### Season Standings
- **Best 6 of 10** weeks count toward season total
- **Minimum 6 rounds** required to qualify for season prizes
- Scores that count toward the total are visually highlighted; dropped scores are dimmed
- Ties share the same rank (v1 — configurable tie-break logic can be added later)

### Prize Payout Structure
Season Long Pot — Top 9 Players Paid (total pot TBD, currently placeholder $11,000):

| Place | Payout % |
|-------|----------|
| 1st | 20.5% |
| 2nd | 17% |
| 3rd | 14.5% |
| 4th | 12% |
| 5th | 10% |
| 6th | 8% |
| 7th | 7% |
| 8th | 6% |
| 9th | 5% |

### Weekly Side Games (informational only — not tracked in app)
- $25 per player per week
- Games include: Closest to the Pin, Low Net, Low Gross
- Results managed outside the app

---

## 2. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visibility | Hidden for events without league info enabled | Saturday Morning golfers never see it. Clean, no confusion. |
| Link placement | Inside each event's RSVP card on golfer home page | Contextual, scales to multiple events, no extra UI sections. |
| Page structure | Single page with horizontal tabs per event | One URL per event, tabs for each content section. Flexible. |
| Tab configuration | Database-driven (managed by super admin via DB or Claude) | Full flexibility without building an admin UI. Admin UI can be added later if needed. |
| Content format | Rich text (HTML) for rules/scoring tabs | Conditions of Play docs have structure (numbered rules, headings). Plain text would flatten it. |
| Leaderboard | Data-driven table from day one | Sortable, aggregatable, supports best-N-of-M logic. |
| Score entry | TBD — deferred until first Golf Genius PDF report is available | Schema is ready with flexible JSONB metadata column. Input method decided after seeing actual report format. |
| Scoring parameters | Configurable per event (best N of M, min rounds) | Confirmed: best 6 of 10, min 6 rounds to qualify. Stored in event_league_config. |
| Access | All golfers subscribed to the event | Even golfers who haven't played yet can read rules and scoring info. |

---

## 3. Data Model

### 3.1 `event_league_config` (new table)

Master configuration for the league feature per event. One row per event (optional — no row means league is disabled).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `event_id` | uuid (FK → events, unique) | One config per event |
| `league_enabled` | boolean, default false | Master toggle — controls visibility on home page |
| `season_name` | text, nullable | Display name (e.g., "2026 Summer Season") |
| `season_start` | date, nullable | First game date of the season |
| `season_end` | date, nullable | Last game date of the season |
| `best_n` | integer, nullable | Number of best rounds that count toward standings |
| `total_m` | integer, nullable | Total rounds in the season (informational) |
| `min_rounds_to_qualify` | integer, nullable | Minimum rounds played to appear on leaderboard |
| `prize_pool_total` | numeric(10,2), nullable | Total prize pot in dollars (e.g., 11000.00) |
| `payout_config` | jsonb, nullable | Ordered array of payout percentages, e.g. `[20.5, 17, 14.5, 12, 10, 8, 7, 6, 5]`. Position in array = place (index 0 = 1st). |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** Read by any authenticated user subscribed to the event. Write by super admin only.

### 3.2 `event_league_tabs` (new table)

Flexible tab configuration per event. Each row defines one tab on the league info page.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `event_id` | uuid (FK → events) | |
| `tab_key` | text | Unique key within event (e.g., `rules`, `scoring`, `leaderboard`, `weekly_results`) |
| `label` | text | Display label (e.g., "Conditions of Play", "Scoring", "Leaderboard") |
| `content_type` | text | `html` (rich text content) or `leaderboard` (renders score table) or `weekly_results` (renders weekly score view) |
| `content` | text, nullable | Rich text/HTML body. NULL for leaderboard/weekly_results types (rendered from league_scores data). |
| `sort_order` | integer, default 0 | Tab display order (lower = first) |
| `is_active` | boolean, default true | Toggle tab visibility without deleting |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Unique constraint:** `(event_id, tab_key)`
**RLS:** Read by any authenticated user subscribed to the event. Write by super admin only.

### 3.3 `league_scores` (new table)

Weekly score entries per golfer. One row per golfer per game date.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `event_id` | uuid (FK → events) | |
| `profile_id` | uuid (FK → profiles) | |
| `game_date` | date | The game date these scores are for |
| `stableford_points` | integer | Total Stableford points for the round |
| `metadata` | jsonb, nullable | Flexible field for additional data (gross score, net score, handicap used, etc.) — schema TBD after seeing Golf Genius report |
| `entered_by` | uuid (FK → profiles), nullable | Admin who entered the score |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Unique constraint:** `(event_id, profile_id, game_date)` — one score per golfer per game
**RLS:** Read by any authenticated user subscribed to the event. Insert/update by admin only.

---

## 4. Page Structure

### 4.1 Route

`/league/[slug]` — where `[slug]` is the event's URL slug (e.g., `/league/thursday-league`).

### 4.2 Breadcrumbs

`Home > [Event Name] > League Info`

### 4.3 Layout

```
┌─────────────────────────────────────┐
│ Home > Thursday 9-Hole League > ... │  ← Breadcrumbs
│                                     │
│ THURSDAY 9-HOLE LEAGUE              │  ← Page title (h1, font-serif uppercase)
│ 2026 Summer Season                  │  ← Subtitle from season_name
│                                     │
│ [Leaderboard] [Scoring] [Rules]     │  ← Horizontal tabs from event_league_tabs
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │   Tab content renders here      │ │  ← Rich text OR data table
│ │                                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4.4 Tab Content Types

**`html` tabs** (Rules, Scoring, etc.):
- Render the `content` column as HTML within a styled prose container.
- Content is static — set once per season, updated rarely.
- The **Scoring** tab should include the Stableford point values table and the prize payout structure so golfers can reference them anytime.
- The **Rules / Conditions of Play** tab should include league details (duration, tee times, eligibility requirements, weekly side games info).

**`leaderboard` tab** — Season Standings Grid:

The leaderboard is a comprehensive grid showing every golfer's weekly scores across the full season.

#### Column Layout
Two-row header structure:
- **Row 1:** `Rank` | `Golfer` | `Week 1` | `Week 2` | ... | `Week 10` | `Total`
- **Row 2:** (empty) | (empty) | `5/7` | `5/14` | ... | `7/9` | (empty)

Week dates are always Thursdays, derived from the season schedule.

#### Row Layout
- One row per golfer subscribed to the Thursday League event (pulled from event subscriptions).
- Default sort: by Total descending (highest score = rank 1).

#### Cell Values
- **Score cells:** Display the golfer's total Stableford points for that week.
- **DNP cells:** If a golfer has no score for a given week, display "DNP" (Did Not Play).
- **Total column:** Sum of the golfer's best (highest) 6 weekly scores. If fewer than 6 scores exist, show the cumulative total of all scores recorded so far.

#### Visual Treatment — Counting vs. Dropped Scores
When a golfer has more than 6 scores, only the 6 highest count toward the total. The visual treatment must make this clear:
- **Counting scores** (top 6): Normal styling — full opacity, standard text color.
- **Dropped scores** (7th+ highest, not counting toward total): Dimmed/muted styling — reduced opacity or lighter text color (e.g., `text-gray-400` or `opacity-50`).
- **DNP cells:** Neutral styling — gray text, no highlight.
- When a golfer has 6 or fewer scores, all scores are counting scores (no dimming).

#### Sorting
All columns are sortable by clicking the column header:
- **Golfer:** A-Z / Z-A alphabetical toggle.
- **Weekly score columns:** Highest-first / lowest-first toggle.
- **Total:** Highest-first / lowest-first toggle (default sort: highest-first).
- **Rank:** Recalculates based on current sort order of Total column.

#### Rank Column
- Rank is determined by Total descending.
- Ties share the same rank (e.g., two golfers tied at 142 points both show rank 3; next golfer shows rank 5).
- Golfers who haven't played any rounds appear at the bottom with no rank (or rank "—").

#### Footnotes
Below the table, display:
- "DNP = Did Not Play"
- "Total = Best 6 of 10 weekly scores. Dimmed scores are not counted toward the total."
- Qualification note: "Must play at least 6 weeks to qualify for season prizes."

#### Mobile Considerations
This table has 13+ columns, which won't fit on a phone screen. Handling:
- Horizontal scroll with sticky first two columns (Rank + Golfer) and sticky last column (Total).
- The weekly score columns scroll freely between the sticky edges.
- Touch-friendly column headers for sorting (44px+ tap targets).

**`weekly_results` tab** (if needed as a separate tab):
- May not be needed given the leaderboard grid already shows per-week scores.
- If included, shows a dropdown/selector to pick a game date and displays that week's scores ranked highest to lowest.
- Defaults to the most recent week with scores.
- Could serve as a simpler mobile-friendly view of a single week's results.

---

## 5. Home Page Integration

On the golfer home page (`/home`), within each event's RSVP card:

1. Query `event_league_config` for the event.
2. If `league_enabled = true`, render a link: **"League Info →"** below the RSVP status area.
3. If no config row exists or `league_enabled = false`, render nothing.

This keeps the feature completely invisible for events like Saturday Morning Group.

---

## 6. Deferred / TBD Items

### Score Entry Method
**Blocked on:** First Golf Genius PDF report (expected after week 1 of the Thursday League).

Options to evaluate once we have the report:
1. **Manual form** — Admin selects golfers from a dropdown, enters points. Simple, reliable.
2. **CSV upload** — Admin exports from Golf Genius, uploads CSV. Semi-automated.
3. **PDF parser** — Admin uploads the Golf Genius PDF, system extracts scores. Most automated but depends on consistent PDF format.

The `league_scores` table and `metadata` JSONB column are designed to accommodate any of these approaches.

### Scoring Parameters — RESOLVED
- `best_n` = 6, `total_m` = 10, `min_rounds_to_qualify` = 6.
- Columns remain nullable in the schema for flexibility with future events, but the Thursday League values are confirmed.

### Tie-Breaking Rules
- TBD. For v1, ties share the same rank. Can add configurable tie-break logic later.

### Admin UI for Tab Management
- Not in v1. Super admin manages tabs via direct DB edits or Claude sessions.
- Can be added as a settings section under Event Settings if multiple admins need to manage tabs.

---

## 7. Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/024_league_info.sql` | Create | New tables: event_league_config, event_league_tabs, league_scores. RLS policies. |
| `src/types/events.ts` | Modify | Add TypeScript types for league config, tabs, scores. |
| `src/app/league/[slug]/page.tsx` | Create | League info page (server component, fetches config + tabs + scores). |
| `src/app/league/[slug]/league-tabs.tsx` | Create | Client component for tab switching and content rendering. |
| `src/app/league/[slug]/leaderboard.tsx` | Create | Leaderboard table component with best-N-of-M aggregation. |
| `src/app/league/[slug]/weekly-results.tsx` | Create | Weekly results table with date picker. |
| `src/app/home/page.tsx` | Modify | Add "League Info" link inside event RSVP cards (conditional on league_enabled). |
| `src/lib/league.ts` | Create | League data helpers (fetch config, aggregate scores, compute standings). |
| `CLAUDE.md` | Modify | Add to File Map, What's Been Built, update Roadmap. |

---

## 8. Open Questions (to resolve before or during build)

1. **Score entry format** — What does the Golf Genius output look like? (Blocked on first report)
2. ~~**Scoring parameters**~~ — **RESOLVED:** Best 6 of 10, minimum 6 rounds to qualify.
3. **Tie-breaking** — How to handle golfers with identical point totals? (v1: ties share rank. Configurable tie-break logic can be added later.)
4. **Email integration** — Should league info links appear in invite/reminder/confirmation emails for the Thursday League? (Mentioned in CLAUDE.md roadmap — decide during build)
5. **Additional metadata** — What extra fields from Golf Genius should we capture in the JSONB `metadata` column? (Blocked on first report)
6. **Weekly results tab** — May not be needed as a separate tab since the leaderboard grid already shows per-week scores. Could serve as a mobile-friendly single-week view. Decide during build.
7. **Prize pot total** — Currently placeholder ($11,000). Owner will update when final participant count is known.
