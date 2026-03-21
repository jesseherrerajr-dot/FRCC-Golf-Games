# GHIN Handicap Sync — Implementation Spec

## Overview

Automated system to fetch current Handicap Index values from GHIN for all golfers with a GHIN number on file. Data is stored on the golfer profile and refreshed within 24 hours of each scheduled event. The feature is designed to degrade gracefully — if the unofficial API breaks, the system auto-disables, alerts the super admin, and the rest of the app continues unaffected.

## Use Cases

1. **Reporting** — Admin reports showing handicap distribution, trends over time, and per-golfer history.
2. **Grouping Engine** — Future enhancement to factor handicap index into foursome composition (e.g., balanced groups, flight-based grouping).
3. **Pro Shop Email** — Include current handicap index alongside GHIN number in the pro shop detail email.
4. **Golfer Profile** — Display current handicap index on the golfer's profile page and admin golfer detail pages.

## Architecture

### Data Model

**`profiles` table — new columns:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `handicap_index` | `numeric(4,1)` | `NULL` | Current USGA Handicap Index (e.g., 12.3, +2.1). NULL = never synced or no GHIN number. |
| `handicap_updated_at` | `timestamptz` | `NULL` | When the handicap was last successfully fetched from GHIN. |

**`handicap_sync_log` table — new table for health monitoring:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | Primary key. |
| `event_id` | `uuid` | — | The event that triggered this sync (FK to events). |
| `started_at` | `timestamptz` | `now()` | When the sync run started. |
| `completed_at` | `timestamptz` | `NULL` | When the sync run finished. NULL = still running or crashed. |
| `total_golfers` | `int` | `0` | Number of golfers with GHIN numbers targeted for sync. |
| `success_count` | `int` | `0` | Number of successful handicap lookups. |
| `failure_count` | `int` | `0` | Number of failed lookups (API errors, timeouts, etc.). |
| `skipped_count` | `int` | `0` | Number skipped (already fresh within 24 hours). |
| `error_message` | `text` | `NULL` | If the entire sync run failed (e.g., auth failure), the error message. |
| `status` | `text` | `'running'` | `running`, `completed`, `failed`. CHECK constraint. |

**`events` table — new column:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `handicap_sync_enabled` | `boolean` | `false` | Per-event toggle. When ON, handicap sync runs before this event's games. |

### Direct HTTP Client (No External Dependency)

- **API Base:** `https://api2.ghin.com/api/v1` (unofficial GHIN mobile app API)
- **Auth endpoint:** `POST /golfer_login.json` with JSON body:
  ```json
  {
    "token": "recaptcha-disabled",
    "user": {
      "email_or_ghin": "<GHIN_EMAIL>",
      "password": "<GHIN_PASSWORD>",
      "remember_me": true
    }
  }
  ```
  Returns `golfer_user.golfer_user_token` (bearer token, cached for 1 hour).
- **Lookup endpoint:** `GET /golfers.json?golfer_id=<GHIN_NUMBER>&from_golfer=true` with `Authorization: Bearer <token>` header.
- **Lookup method:** By GHIN number (not golfer name). Returns handicap index among other data.
- **Rate limiting:** Throttle requests to 1 every 2 seconds to avoid triggering GHIN rate limits.
- **Why direct HTTP instead of npm:** The `@spicygolf/ghin` npm package was considered but rejected — it's more maintainable to call the API directly so we can patch endpoint changes immediately without waiting for a library update.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GHIN_EMAIL` | Email address for the GHIN Digital Profile used for API auth. |
| `GHIN_PASSWORD` | Password for the GHIN Digital Profile. |

**IMPORTANT:** These must be set at the **Vercel project level** (Project → Settings → Environment Variables), not the team level. Team-level env vars are not automatically available to project functions. If not set, the sync silently skips (never crashes).

---

## Sync Logic

### Trigger: Piggyback on Email Scheduler Cron

The existing `/api/cron/email-scheduler` already runs 6 times daily and knows each event's upcoming game date. Add a handicap sync check at the end of the event processing loop:

```
For each active event:
  1. (existing) Process email schedules...
  2. (existing) Check low_response alert...
  3. (NEW) Check if handicap sync is needed (needsHandicapSync):
     a. Are GHIN_EMAIL and GHIN_PASSWORD env vars set? If no, skip silently.
     b. Is handicap_sync_enabled for this event? If no, skip.
     c. Has a successful sync already run for this event within 24 hours? If yes, skip.
     d. Trigger handicap sync for this event's subscribed golfers.
```

### Sync Algorithm

```
1. Query all active golfers subscribed to this event who have a non-null ghin_number.
2. Filter out golfers whose handicap_updated_at is within the last 24 hours (already fresh).
3. If no golfers need updating, log "all fresh" and return.
4. Authenticate with GHIN API using env vars. If auth fails → log error, send admin alert, return.
5. For each golfer needing update (batched, 1 request per 2 seconds):
   a. Call GHIN API with golfer's ghin_number.
   b. On success: update profiles.handicap_index and profiles.handicap_updated_at.
   c. On failure: increment failure count, log the error, continue to next golfer.
6. Write a row to handicap_sync_log with results.
7. If failure_count > 0 and success_count == 0 (total failure), send admin alert.
8. If auth error specifically, send admin alert with "GHIN credentials may be invalid" message.
```

### Batching for Vercel Timeout (60 seconds)

With ~30 golfers at 2-second intervals = ~60 seconds. To stay safely under the limit:

- **Batch size:** Process up to 20 golfers per cron invocation.
- **Resume on next cron:** If more than 20 golfers need updating, the remaining will be picked up by the next cron run (runs every 1-2 hours during the day). The 24-hour freshness check ensures no double-fetching.
- **Priority:** Process golfers in order of `handicap_updated_at ASC NULLS FIRST` (stalest first, never-synced first).

### Staleness & Freshness

- A handicap is considered **fresh** if `handicap_updated_at` is within the last 24 hours.
- A golfer subscribed to multiple events only gets synced once — the freshness check prevents redundant lookups across events.
- If a sync fails for a specific golfer, they'll be retried on the next cron run automatically.

---

## Admin Alert: Sync Failure

Extend the existing `admin-alerts.ts` system with a new alert type: `handicap_sync_failed`.

**Trigger conditions:**
- The GHIN API authentication fails (credentials expired or invalid).
- An entire sync run completes with 0 successes and >0 failures.
- 3 consecutive sync runs fail (tracked via `handicap_sync_log`).

**Alert email content:**
- Subject: `[Event Name] Handicap Sync Failed`
- Body: Number of golfers affected, error summary, suggestion to check GHIN credentials or disable the feature.
- Sent TO: Super admin. CC: Event admins.

**Note:** The `email_log.email_type` CHECK constraint will need to be updated to include `'handicap_sync_failed'`, OR the alert can be sent outside the email_log system (using `sendEmail` directly, like the existing admin alerts do). **Recommendation:** Use the existing `sendAdminAlert` pattern which sends directly and doesn't log to `email_log`.

---

## Admin UI

### Event Settings — Handicap Sync Toggle

Add to the Event Settings page (within a new "Handicap Sync" section, visible to super admins only):

- **Toggle:** "Enable Handicap Sync" (on/off). Default: OFF.
- **Status indicator:** Shows sync health:
  - 🟢 "Healthy — last synced [date/time]" (last run succeeded)
  - 🟡 "Partial — [X] of [Y] golfers updated on [date/time]" (some failures)
  - 🔴 "Failed — last attempt [date/time]" (total failure)
  - ⚪ "Never synced" (no sync log entries)
- **Info text:** "Fetches current USGA Handicap Index for all golfers with a GHIN number. Syncs automatically within 24 hours of each game."

### Handicap Display — All Surfaces

Handicap Index is displayed on the following pages (all read-only, system-managed):

| Surface | Location | Format | Visibility |
|---------|----------|--------|------------|
| Golfer Home Page (`/home`) | My Profile section, below GHIN row | `Handicap Index: 10.3 (updated Mar 20)` | All golfers (own data) |
| Profile Edit Page (`/profile`) | Teal box below GHIN Number input | `Current Handicap Index: 10.3 (updated Mar 20)` | All golfers (own data) |
| Admin Golfer Detail — Global (`/admin/golfers/[id]`) | Definition list row after GHIN | `Handicap Index: 10.3 (updated Mar 20)` or `N/A` | Super admin |
| Admin Golfer Detail — Event (`/admin/events/[id]/golfers/[id]`) | Same as global | Same | Super admin + event admin |
| Global Golfer Directory (`/admin/golfers`) | Third line on each golfer row | `HCP: 10.3 (updated Mar 20)` in teal | Super admin |
| Event Golfer Directory (`/admin/events/[id]/golfers`) | Third line on each golfer row | `HCP: 10.3 (updated Mar 20)` in teal | Super admin + event admin |
| Pro Shop Email | HCP column in player table | `10.3` or blank | Pro shop contacts, admins |

- Golfers without a synced handicap show a dash (home page) or no HCP line (directories) or "N/A" (admin detail).
- Sortable by handicap index is a future enhancement for reporting.

---

## Pro Shop Email Enhancement

When `handicap_sync_enabled` is ON and a golfer has a non-null `handicap_index`:
- Include "HCP: 12.3" alongside the existing GHIN number in the pro shop detail email.
- If `handicap_index` is NULL but `ghin_number` exists, show "HCP: N/A" to signal the sync didn't capture it.

---

## Graceful Degradation

The handicap sync is explicitly designed as a non-critical feature:

1. **Missing env vars:** If `GHIN_EMAIL` or `GHIN_PASSWORD` are not set, the sync silently skips. No errors, no alerts.
2. **API down:** Individual lookup failures are logged but don't block other golfers. The sync continues.
3. **Auth failure:** Logged, admin alerted, sync aborted for this run. Retried on next cron.
4. **API changes:** If USGA changes the `api2.ghin.com` endpoints or auth flow, the sync fails, admin is alerted, and the feature can be toggled off via Event Settings. Since we use direct HTTP (no npm dependency), endpoint fixes can be patched immediately.
5. **No impact on core flows:** RSVP, invites, confirmations, grouping — none of these depend on handicap data. A complete handicap sync failure has zero effect on the weekly RSVP cycle.

---

## Migration Plan

### Database Migration (018_handicap_sync.sql)

```sql
-- Add handicap columns to profiles
ALTER TABLE public.profiles ADD COLUMN handicap_index numeric(4,1);
ALTER TABLE public.profiles ADD COLUMN handicap_updated_at timestamptz;

-- Add sync toggle to events
ALTER TABLE public.events ADD COLUMN handicap_sync_enabled boolean NOT NULL DEFAULT false;

-- Handicap sync log table
CREATE TABLE public.handicap_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_golfers int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  error_message text,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed'))
);

-- RLS
ALTER TABLE public.handicap_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read sync logs
CREATE POLICY "Admins can read handicap sync logs"
  ON public.handicap_sync_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR
    EXISTS (SELECT 1 FROM public.event_admins WHERE profile_id = auth.uid() AND event_id = handicap_sync_log.event_id)
  );

-- Service role can insert/update (for cron jobs)
CREATE POLICY "Service role can manage handicap sync logs"
  ON public.handicap_sync_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_handicap_sync_log_event_status
  ON public.handicap_sync_log(event_id, status, started_at DESC);

-- Comment
COMMENT ON TABLE public.handicap_sync_log IS 'Tracks GHIN handicap sync runs for health monitoring and admin alerts.';
```

### New Files

| File | Purpose |
|------|---------|
| `src/lib/handicap-sync.ts` | Core sync logic: authenticate, fetch handicaps, update profiles, log results. |
| `supabase/migrations/018_handicap_sync.sql` | Database migration. |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/cron/email-scheduler/route.ts` | Add handicap sync check at end of event loop. Pro shop email includes `handicap_index`. |
| `src/lib/admin-alerts.ts` | Add `handicap_sync_failed` alert type and email template. |
| `src/lib/email.ts` | Add HCP column to pro shop email (grouped and flat formats). |
| `src/lib/grouping-db.ts` | Include `handicap_index` in stored grouping golfer data. |
| `src/types/events.ts` | Add `handicap_sync_enabled` to Event interface. |
| `src/app/admin/events/[eventId]/settings/` | Add Handicap Sync section with toggle + health status (super admin only). |
| `src/app/home/page.tsx` | Display handicap index in My Profile section on home page. |
| `src/app/profile/page.tsx` | Display handicap index (read-only teal box below GHIN input). |
| `src/app/admin/golfers/page.tsx` | Show HCP on each golfer row in global directory. |
| `src/app/admin/events/[eventId]/golfers/page.tsx` | Show HCP on each golfer row in event directory. |
| `src/app/admin/golfers/[golferId]/page.tsx` | Show handicap index on global golfer detail page. |
| `src/app/admin/events/[eventId]/golfers/[golferId]/page.tsx` | Show handicap index on event golfer detail page. |

---

## Implementation Order

1. **Database migration** — Add columns and table.
2. **Core sync library** (`handicap-sync.ts`) — Auth, fetch, update, logging.
3. **Cron integration** — Hook into email-scheduler.
4. **Admin alert** — Extend admin-alerts for sync failures.
5. **Event Settings UI** — Toggle + status indicator.
6. **Profile & admin display** — Show handicap index on relevant pages.
7. **Pro shop email** — Include handicap in detail email.
8. **Testing** — Manual end-to-end test with real GHIN credentials.

---

## Open Decisions / Future Enhancements

1. **Handicap history table?** — Not in v1. If we want to track handicap changes over time (for reporting/trends), we'd add a `handicap_history` table later. For now, we just store the latest value.
2. **Grouping engine integration** — Deferred. The data is available on profiles for when we're ready to add handicap-based grouping modes.
3. **Guest handicaps** — Guests have `guest_ghin_number` on the `guest_requests` table. We could sync guest handicaps too, but guests are infrequent and their GHIN numbers are less likely to be on file. Defer to v2.
4. **Manual sync trigger** — Admins can currently trigger a sync manually via the cron endpoint (`curl -H "Authorization: Bearer <CRON_SECRET>" "https://frccgolfgames.com/api/cron/email-scheduler"`). A dedicated "Sync Now" button in Event Settings could be added for convenience.
5. **Sortable by handicap** — The golfer directories show handicap but don't yet support sorting by it. Could be useful for admin reporting.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| USGA changes API endpoints or auth flow | Medium (annually) | Sync stops | Auto-detect via failure alerts. Toggle off. Direct HTTP client means we can patch immediately — no waiting for npm updates. |
| GHIN credentials expire | Low | Sync stops | Auth failure triggers immediate admin alert with clear message. |
| GHIN adds real reCAPTCHA enforcement | Low-Medium | Sync stops | Currently using `"token": "recaptcha-disabled"` placeholder. If GHIN enforces real CAPTCHA, the feature would need to be disabled or a CAPTCHA-solving service integrated. |
| Rate limiting by GHIN | Low (at 30 golfers) | Partial sync | 2-second throttle between requests. Batch cap of 20 per cron run. |
| Vercel function timeout | Low | Partial sync | 20-golfer batch limit. Remaining picked up on next cron run. |
| Vercel env var misconfiguration | Low | Sync skips silently | Env vars must be at project level (not team level). Debug endpoint available for troubleshooting. |
