# League Info Feature — Design Specification

**Status:** Design complete, awaiting build. Score entry format TBD (pending first Golf Genius report).
**Date:** May 3, 2026
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
| Scoring parameters | Configurable per event (best N of M, min rounds) | Exact values TBD. Stored in event_league_config so they can be set without code changes. |
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

**`leaderboard` tab**:
- Queries `league_scores` and aggregates across the season.
- Applies best-N-of-M logic from `event_league_config`.
- Displays a sortable table:

| Rank | Golfer | Rounds Played | Total Points | Qualifying? |
|------|--------|---------------|--------------|-------------|
| 1 | J. Herrera | 8 / 12 | 276 | ✓ |
| 2 | M. Smith | 7 / 12 | 261 | ✓ |
| ... | ... | ... | ... | ... |

- "Total Points" = sum of best N rounds (or all rounds if fewer than N played).
- "Qualifying?" = rounds played ≥ min_rounds_to_qualify.
- Golfer names displayed as first initial + last name (using `formatInitialLastName()`).

**`weekly_results` tab**:
- Shows a dropdown/selector to pick a game date.
- Displays that week's scores for all golfers who played:

| Rank | Golfer | Stableford Points |
|------|--------|-------------------|
| 1 | M. Smith | 38 |
| 2 | J. Herrera | 35 |
| ... | ... | ... |

- Defaults to the most recent week with scores.

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

### Scoring Parameters
- `best_n`, `total_m`, `min_rounds_to_qualify` — values TBD. Columns exist and are nullable so the leaderboard can handle partial config gracefully (e.g., show all rounds if best_n is NULL).

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
2. **Scoring parameters** — What are the final best-N-of-M values? (Owner will provide before league start)
3. **Tie-breaking** — How to handle golfers with identical point totals? (Can defer to v2)
4. **Email integration** — Should league info links appear in invite/reminder/confirmation emails for the Thursday League? (Mentioned in CLAUDE.md roadmap — decide during build)
5. **Additional metadata** — What extra fields from Golf Genius should we capture in the JSONB `metadata` column? (Blocked on first report)
