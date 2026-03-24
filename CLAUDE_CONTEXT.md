# CLAUDE_CONTEXT.md

A companion to CLAUDE.md. Where CLAUDE.md is the technical specification and implementation guide, this file captures project context, decisions, preferences, and working patterns that help Claude provide better assistance across sessions.

---

## 1. Project Overview

**What it is:** FRCC Golf Games — an automated golf participation tracker for recurring games at Fairbanks Ranch Country Club (FRCC). Manages weekly invites, RSVP tracking, waitlists, guest requests, and automated communications.

**The goal:** Minimize human intervention in weekly game coordination while keeping admins in control of key decisions (waitlist management, guest approvals, cancellations). Replace the manual email/spreadsheet workflow the group was using previously.

**Current status:** Production. 50+ active users across the first event (FRCC Saturday Morning Group). A second event is being onboarded with new users expected in the coming weeks. The platform has been running reliably through multiple weekly RSVP cycles.

**What's complete:**
- Phases 1–2 (Foundation + Weekly RSVP Cycle) — fully shipped
- Phase 4 (Admin Tools & Communication) — mostly complete, powering the production workflow
- Grouping engine — 5 methods (harmony + 4 handicap-based: flight foursomes, balanced ABCD foursomes, flight 2-person teams, balanced 2-person teams). 50+ unit tests, cron integration, pro shop email integration, repeat foursome prevention, tee time preference limits, partner preference weighting, manual handicap admin entry
- Playing partner preferences — ranked 1–10 with per-event scoping
- Tee time preferences — per-week on RSVP page
- Multi-event architecture — designed and implemented, second event being onboarded
- PWA install flow with push notification support
- Configurable email schedules per event (6 Vercel cron slots)
- Weather integration — Open-Meteo API, golfability scoring, displayed on RSVP pages, home page, and in emails
- GHIN Handicap Sync — automated fetch from GHIN API (`api2.ghin.com`), per-event toggle, displayed on home page, profile, both golfer directories, golfer detail pages, and pro shop email
- Admin Reports — super-admin-only reports page with Golfer Engagement, Platform Activity, Response Timing, and Profile Completeness reports
- Activity Tracking — login and page view logging infrastructure (activity_log table, ActivityTracker component)

**What's on the roadmap (see CLAUDE.md Roadmap for details):**
1. Email template review
3. Guest workflow (architecture exists, feature-flagged OFF)
4. Priority email batching (for when Resend free-tier limit is approached)
5. Public "Who's Playing" view
6. Golfer engagement & gamification stats
7. Waitlist end-to-end testing & refinement
8. Invite-a-friend / referral registration
9. SMS / text notifications

---

## 2. What's Been Decided

These are final decisions reflected in the codebase and not open for reconsideration:

**Architecture & Infrastructure:**
- Free-tier stack: Vercel Hobby, Supabase Free, Resend Free. No paid upgrades planned until limits are hit.
- Vercel Hobby limits are hard constraints: 6 daily crons max, no sub-daily frequency, 60-second function timeout.
- Single-endpoint cron pattern: all 6 cron entries hit `/api/cron/email-scheduler`, which checks all events for due emails within a time window. This is the workaround for Hobby's daily-only cron restriction.
- All times are Pacific Time (America/Los_Angeles). Vercel runs UTC. Use centralized timezone utilities from `src/lib/timezone.ts`.
- Supabase Auth with magic link (OTP) — no passwords. Tokenized RSVP links for one-tap responses without login.

**Naming & Navigation:**
- The golfer landing page is called "Home" (route: `/home`). Legacy `/dashboard` redirects to `/home`.
- "Admin Dashboard" is the correct name for `/admin` pages — only the golfer page was renamed.
- Breadcrumbs on every page (except landing and login). No "Back to X" links.
- Admin pages for "Dashboard" reference are correct and should stay.

**Roles & Permissions:**
- Three roles: Super Admin, Event Admin, Golfer. Admins are also golfers (dual-role).
- Only super admins can: create events, assign admins, toggle feature flags, access Danger Zone.
- Event admins are scoped to assigned events only.
- Feature flags (guest requests, tee time prefs, partner prefs, auto-grouping) default OFF and are super-admin-only toggles.

**Email & Communication:**
- Reply-To is always the primary event admin's email.
- All admin-targeted emails CC secondary admins and super admins.
- Resend's default sending domain for now. Custom domain deferred.
- Golfer confirmation email shows first-initial-last-name (e.g., "J. Herrera"). Pro shop email shows full details.
- Email footer links say "Go to FRCC Golf Games" (not "Go to Dashboard" or technical URLs).

**RSVP Flow:**
- Capacity is first-come-first-served. Waitlist is admin-managed (not auto-promoted).
- Guests only fill spots that members haven't claimed. Admin approval required.
- After cutoff, only admins can modify RSVP status.
- "In" list visibility is evite-style: only golfers who are "In" can see other "In" golfers.

**RSVP Status Labels (admin-facing):**
- In (not "Confirmed"), Out, Not Sure (not "Not Sure Yet"), No Reply (not "No Response"), Waitlist (not "Waitlisted"). These must be consistent across all admin surfaces.

**Grouping Engine:**
- Five methods: harmony (greedy heuristic with partner prefs), flight foursomes, balanced ABCD foursomes, flight 2-person teams, balanced 2-person teams.
- Handicap methods use GHIN-synced or manual handicap index (resolution: manual → synced → 25.0 default). Override partner/tee time preferences when active.
- Pure function design — no DB calls in the algorithm. DB layer is separate (`grouping-db.ts`).
- Runs automatically at cutoff time via existing email-scheduler cron (no separate cron entry).
- Feature-flagged per event (`allow_auto_grouping`). When disabled, pro shop gets alphabetical roster.

**Code Standards:**
- TypeScript everywhere. Centralized formatters in `src/lib/format.ts` — never define local formatting functions.
- RSVP status constants in `src/lib/rsvp-status.ts` — never define local status labels or colors.
- Supabase admin client from `src/lib/supabase/server.ts` — never define local `createAdminClient()`.
- Game dates are `YYYY-MM-DD` strings, never pass to `new Date(dateStr)` directly. Parse components.

---

## 3. What's Still Open

See the Roadmap section of CLAUDE.md for the current prioritized list. Key items:

1. **Email template review** — Audit all automated emails for copy, formatting, and links.
3. **Guest workflow** — Complete the guest request system (architecture exists, feature-flagged OFF).
4. **Priority email batching** — For when distribution approaches the 100/day Resend limit.
5. **Public "Who's Playing" view** — Unlisted shareable page showing the "In" list without login.
6. **Golfer engagement & gamification stats** — Participation streaks, response rate scores, badges.
7. **Waitlist end-to-end testing** — Verify correct ordering, admin promotion flow, edge cases.
8. **Invite-a-friend / referral registration** — Referral parameter on join link, shows referrer to admin.
9. **SMS / text notifications** — Opt-in texts for cutoff reminders (cost evaluation needed first).

**Technical debt visible in the codebase (not on the active roadmap but worth noting):**

- **The `tee_time_preferences` table** — Standing preferences table exists but is ignored by the grouping engine. Only per-week RSVP tee time preferences are used. This table may be vestigial.
- **Email scheduler complexity** — The structural audit identified `email-scheduler/route.ts` (CC ~50) as the top refactoring priority. Splitting into per-type handlers would improve maintainability.
- **Test coverage** — Only the grouping engine has unit tests (36 tests). No integration or end-to-end tests exist.
- **Push notification adoption** — Recently improved with Install page guidance, Help FAQ, and onboarding checklist item. Effectiveness is unknown — may need a contextual prompt if adoption is low.

---

## 4. My Preferences & Constraints

**Inferred from project files, commit history, and working sessions:**

**Tone & Communication:**
- Jesse prefers conversational, direct communication. No unnecessary formality.
- Asks thoughtful "should we?" questions before acting — values understanding tradeoffs before committing to changes.
- Thinks about the user experience from the golfer's perspective (not just technical correctness).
- Prefers practical recommendations over theoretical options.

**Development Style:**
- Incremental, working changes — not large rewrites. Ship often.
- Commits are descriptive and explain *why*, not just *what*.
- Documentation is kept in sync with code (CLAUDE.md is actively maintained as the source of truth).
- Mobile-first is a real priority, not a checkbox — 80%+ of users are on phones.

**Technical Preferences:**
- TypeScript strict-ish (not full strict mode, but typed where it matters).
- Server Actions over API routes where possible (Next.js App Router pattern).
- Centralized utilities over duplicated logic — strong preference for single-source-of-truth patterns.
- Tailwind CSS for all styling. No CSS modules or styled-components.
- No external UI component libraries (custom components built with Tailwind).

**Constraints:**
- Free tier everything. Budget sensitivity is real — upgrades happen only when limits are hit.
- Single developer (Jesse) plus Claude. No team, no code review process, no CI/CD pipeline.
- Users are non-technical golfers. UI must be self-explanatory — no training or documentation should be needed for basic flows.
- All changes must work on Vercel Hobby. Never propose solutions requiring Pro features without flagging the constraint.

---

## 5. Key Terms & Definitions

| Term | Definition |
|---|---|
| **Event** | A recurring game (e.g., "FRCC Saturday Morning Group"). Independent config, schedule, capacity, admin assignments. |
| **Super Admin** | Full platform access. Can manage all events, create events, assign admins, toggle feature flags. Also a golfer. |
| **Event Admin (Primary)** | Manages a specific event. Reply-to address on automated emails. Can approve registrations, manage RSVPs, send custom emails. |
| **Event Admin (Secondary)** | Same permissions as primary for the event. CC'd on all communications. Backup coverage. |
| **Golfer** | A confirmed club member on the distribution list. Receives invites, RSVPs, manages profile. |
| **Guest** | A non-golfer in the system (name, email, phone, GHIN) but NOT on any distribution list. Can only play when invited by a golfer for a specific week. |
| **GHIN** | Golf Handicap & Information Network number. USGA handicap ID. Optional field. |
| **Tokenized RSVP** | Each golfer gets a unique URL per week for one-tap RSVP without login. Tokens are unguessable. |
| **Magic Link** | Passwordless login via email. Supabase sends a one-time code. No passwords stored. |
| **Cutoff** | The deadline after which golfers can no longer self-service their RSVP. Only admins can make changes post-cutoff. |
| **Waitlist** | Golfers who RSVP "In" after capacity is reached. Admin-managed — not auto-promoted. |
| **Playing Partner Preferences** | Ranked list of up to 10 preferred partners per event. Drives the grouping engine's harmony scoring. |
| **Grouping Engine** | Algorithm that generates suggested foursomes after RSVP cutoff. Considers partner preferences, tee time preferences, and guest-host pairing. |
| **Golf Genius** | Third-party software the pro shop uses for tee time management. FRCC Golf Games generates suggestions; Golf Genius is the final authority. |
| **PWA** | Progressive Web App. Users can install FRCC Golf Games to their home screen for app-like experience and push notifications. |
| **Game On / No Game** | Admin toggle on the schedule. "No Game" cancels a week and triggers cancellation emails. |
| **Email Cycle** | The weekly automated sequence: Invite → Reminder(s) → Cutoff/Confirmation → Pro Shop Detail. |
| **Feature Flag** | Per-event boolean toggle (super admin only) controlling whether a feature is active. Currently: guest requests, tee time prefs, partner prefs, auto-grouping. |

---

## 6. How I Like to Work With Claude

**Problem-focused sessions:** Jesse prefers to set the stage with a question or request, then focus on that problem from beginning to end. Larger chunks of work are fine when efficient, but guide through clarifying questions one at a time and walk through each step sequentially. Don't present long action plans that are hard to track — keep it step-by-step.

**Answers + recommendations:** When Jesse asks a question, respond with an answer plus thoughtful clarifying questions, ideas, and recommendations. Don't just answer and wait passively.

**No restricted areas, but be risk-aware:** No areas of the codebase are off-limits. Claude should know which areas are higher risk or more vulnerable and proactively flag risks and recommend prudent action plans. That said, this project is generally low-risk — even mistakes don't cause major real-life consequences.

**Deploy anytime:** No preferred deploy schedule. Work happens when there's time for it.

**When to execute vs. wait:** If Jesse asks for a plan or recommendation, don't execute yet — present the plan and wait for a go-ahead. If it's ambiguous, ask. Otherwise, assume Jesse wants the changes made and proceed without waiting for explicit instruction — especially if the work is easily reversible.

**Copy-paste ready instructions:** When Jesse needs to perform steps manually (terminal commands, SQL queries, Vercel/Supabase console actions, etc.), always provide exact copy-paste commands and step-by-step instructions. Don't assume he'll know how to translate a general description into the right CLI syntax or UI clicks. Be explicit and sequential.

**Not a software engineer:** Jesse is a capable builder but not a professional developer. He doesn't work in SQL, terminal/CLI, or code editors on a daily basis. When steps involve these tools, provide extra context — explain what a command does, what the expected output looks like, and what to do if something looks wrong. Don't assume familiarity with git flags, SQL syntax, or terminal conventions.

**Know the stack and its limits:** The tech stack and free-tier constraints are fully documented in CLAUDE.md (see "Infrastructure Constraints" section). Claude should internalize these limits and never propose solutions that violate them without flagging the constraint first. Don't ask Jesse to re-confirm what tier he's on or what the limits are — that information is in the docs.

---

## 7. Lessons Learned

**Model choice matters:** Early work with Sonnet involved significant rework. Opus produces more reliable results and is the preferred model for this project going forward.

**The stack has been smooth:** No major gotchas with Vercel, Supabase, or Resend beyond the well-documented timezone bugs (see CLAUDE.md Timezone Rules). Free-tier limitations exist but haven't been blockers yet. Keep costs low as long as possible.

**No regrets on architecture:** The project has been enjoyable to build. The stack made it easy to get started with a functional app quickly, then iterate. Nothing feels over-engineered or unnecessary so far.

**Usage tracking is now in place:** Activity logging (login events + page views) is live via the `activity_log` table. Admin Reports page shows golfer engagement, platform activity, response timing, and profile completeness. Data will accumulate over time to reveal usage patterns and identify disengaged golfers.

**The app is a passion project:** Jesse genuinely enjoys working on it and wants to expand capabilities beyond what's strictly necessary. Future work is driven by interest and ambition as much as user demand.

---

## 8. Session Log

### Session: March 13, 2026

**Context:** Routine maintenance and discoverability improvements.

**Changes made:**
1. **Renamed `/dashboard` route to `/home`** — Updated 27 files including all internal redirects, email templates (now say "Go to FRCC Golf Games"), help page FAQ copy, breadcrumbs, nav links, PWA manifest, and CLAUDE.md. Added backward-compatible redirect from `/dashboard` → `/home`.

2. **Improved push notification discoverability** — Fixed service worker fallback URLs from `/dashboard` to `/home`. Added step 5 to Install page instructions (both iOS and Android) explaining the bell icon. Added "Push notifications" to Install page benefits section. Added new "How do I turn on push notifications?" FAQ to Help page with platform-specific guidance. Added "Turn on push notifications" to the onboarding checklist (client-side detection, only shows when browser supports push and user hasn't enabled it).

3. **Updated Install page URLs** — Changed `frccgolfgames.vercel.app` references to `frccgolfgames.com`.

4. **Streamlined roadmap** — Replaced the old five-phase build checklist (mostly completed items) with a clean two-section structure: "What's Been Built" (summary of everything in production) and "Roadmap" (5 prioritized items). Removed completed phase checklists, Golf Genius CSV export, UI/UX branding, SMS notifications, GHIN API integration, and custom email domain from the active roadmap.

5. **Created CLAUDE_CONTEXT.md** — This file. Companion to CLAUDE.md capturing project context, decisions, preferences, and working patterns.

**Key discussion points and decisions:**
- Confirmed the app is in production (not beta) with 50+ users and a second event onboarding.
- **Route rename analysis:** Tokenized RSVP links are safe from the `/dashboard` → `/home` rename because they use `/rsvp/[token]`. Supabase session handling means all routes behave identically for auth — middleware refreshes the session on every request. The landing page (`/`) is the only route that doesn't check auth, so email links should always point to `/home` for the smoothest logged-in experience.
- **Push notification gap:** Identified that push notifications were essentially invisible to users — no mention in Help, Install page, onboarding, or welcome banner. The bell icon has no label and is hidden on unsupported browsers (most iOS Safari users without PWA installed). Addressed with Install page step 5, Help FAQ entry, onboarding checklist item, and benefits section bullet.
- **Notification bell deep-dive:** The bell uses Web Push APIs (service worker + PushManager). Works on Android Chrome and desktop browsers. On iOS, only works if user has installed the PWA to their home screen first (iOS 16.4+ requirement). Component gracefully hides when unsupported (`state === "unsupported"` returns null).
- **Email link best practice:** For email footer links, `/home` is the right destination (not `/` which shows the landing page even for logged-in users). Display text should say "Go to FRCC Golf Games" rather than exposing the URL path.
- **Roadmap consolidation:** Removed items Jesse doesn't currently care about. The five active roadmap items are: (1) grouping engine enhancements (repeat prevention, tee time limits, admin avoidance), (2) admin reports (TBD), (3) email template review, (4) guest workflow, (5) priority email batching. Design details for grouping items are intentionally left TBD — to be addressed when each is tackled.
- **Working preferences captured:** Jesse is not a software engineer — needs copy-paste ready commands and extra context for terminal/SQL/CLI work. Prefers step-by-step guidance over long action plans. Opus is the preferred model (Sonnet caused rework). Claude should internalize the stack constraints from CLAUDE.md rather than re-asking.

### Session: March 19–20, 2026

**Context:** GHIN Handicap Sync deployment, debugging, and UI expansion.

**Changes made:**
1. **Deployed GHIN Handicap Sync to production** — Committed all 15 files (handicap-sync.ts, migration 018, event settings UI, cron integration, types, spec doc). Walked through Supabase migration, Vercel env vars, and redeploy.

2. **Debugged GHIN API authentication** — Multiple iterations to get the auth request body correct. Key findings: `token: "recaptcha-disabled"` required at root level, credential field is `email_or_ghin` (not `email`), endpoint is `api2.ghin.com/api/v1/golfer_login.json`. Used temporary debug arrays in cron JSON responses to troubleshoot serverless functions without log access.

3. **Fixed Vercel env var issues** — Discovered `GHIN_EMAIL` and `GHIN_PASSWORD` were set at the **team level** (not available to project functions). Also found a typo (`GHIN_EMIAL` instead of `GHIN_EMAIL`). Both fixed by Jesse in Vercel project settings.

4. **Added Handicap Index to golfer home page** — New row in My Profile section showing current index and last-updated date below the GHIN number.

5. **Added Handicap Index to both golfer directories** — Global (Admin → Golfers) and event-scoped (Admin → Events → [Event] → Golfers) directories now show an HCP line on each golfer card with value and last-updated date.

6. **Updated all documentation** — CLAUDE.md "What's Been Built" section, HANDICAP_SYNC_SPEC.md (direct HTTP client details, all display surfaces, corrected risks and modified files), and CLAUDE_CONTEXT.md.

7. **Established Documentation Update Standard** — Added a new section to CLAUDE.md defining a tiered checklist for "update all product documentation" so future sessions don't require enumerating individual files. Four tiers: Always Update (CLAUDE.md, CLAUDE_CONTEXT.md, types), Feature Spec, User Help, and Situational.

**Key decisions:**
- **No npm dependency for GHIN:** The `@spicygolf/ghin` npm package was intentionally NOT used. Direct HTTP calls to `api2.ghin.com` are more maintainable and fully patchable if the API changes.
- **Vercel env vars must be at project level:** Team-level env vars are NOT automatically available to project functions. This is now documented as a risk in the spec.
- **Handicap sync piggybacks on email-scheduler cron:** No new cron slot needed (all 6 are already used). Sync runs within 24 hours of each scheduled event, 20 golfers per batch, stalest-first.
- **All 11 golfer handicaps verified accurate** by Jesse after first successful sync.

### Session: March 21, 2026

**Context:** Handicap-based grouping methods — designed with Gemini, implemented with Claude.

**Changes made:**
1. **Added 4 handicap-based grouping methods** to the grouping engine alongside the existing harmony (partner preference) method: Flight Foursomes, Balanced ABCD Foursomes, Flight 2-Person Teams (similar/random foursome pairing sub-option), and Balanced 2-Person Teams.

2. **Created migration 019** — Added `events.grouping_method`, `events.flight_team_pairing`, `profiles.manual_handicap_index`, and `groupings.team_number` columns.

3. **Updated admin Event Settings UI** — New grouping method radio selector (5 options) at the top of the Grouping Engine section. Flight team pairing sub-selector shown only for flight_teams. Amber warning banner when handicap method is active. Partner prefs, tee time prefs, and variety toggle are greyed out when overridden.

4. **Added manual handicap entry** — Shared `ManualHandicapField` component used on both global and event-scoped admin golfer detail pages. Inline edit with save/cancel/clear. Validates range -10 to 54.

5. **Updated cron/email integration** — When a handicap method is active, cron forces partner/tee time prefs off. Pro shop email description reflects the active method.

6. **Updated DB layer** — `fetchConfirmedGolfers` resolves handicap (manual → synced → 25.0 default). `storeGroupings` writes `team_number` for team methods.

7. **Added 15 unit tests** for all new methods (type-checked clean, test runner unavailable in sandbox).

**Key decisions:**
- **Handicap resolution hierarchy:** `manual_handicap_index ?? handicap_index ?? 25.0`. Manual always wins — allows admins to override GHIN-synced values for fairness.
- **Handicap methods override partner/tee time prefs** in the engine (forced off) but UI shows them greyed out with a warning banner rather than hiding them — so admins understand what's happening.
- **2-person team methods output complete foursomes** — the engine pairs teams into foursomes (not just teams), producing a full tee sheet.
- **Balanced teams use outside-in pairing** at both levels: team (A+D, B+C) and foursome (lowest combined team + highest combined team).
- **Default handicap (25.0)** used for golfers with no synced or manual handicap. High enough to land them in lower flights, reasonable for casual golfers.

### Session: March 23, 2026

**Context:** Grouping engine UX refinement, roadmap cleanup, and admin reports implementation.

**Changes made:**
1. **Grouping Engine on/off toggle** — Added master toggle (`allow_auto_grouping`) to the Grouping Engine section in Event Settings. When off, all sub-settings are greyed out and a message explains groups will follow RSVP order. When on, the full configuration UI (method selector, partner prefs, tee time prefs, variety) is available.

2. **Roadmap cleanup** — Reviewed and updated the CLAUDE.md roadmap to reflect current priorities and mark completed items.

3. **Admin Reports page** — Built a super-admin-only reports page (`/admin/reports`) with four interactive reports:
   - **Golfer Engagement** — Per-golfer RSVP response rates, participation rates, consecutive no-replies, "ghost" detection (3+ weeks unresponsive). Filters: All, Ghosts, Low, Active. Sort by response rate, participation rate, or consecutive no-replies. Color-coded progress bars.
   - **Platform Activity** — Login counts, unique users, page views, most visited pages, most active users. Based on the new `activity_log` table (last 30 days).
   - **Response Timing** — Distribution of invite-to-response times across all events (last 8 weeks). Buckets: within 1 hour through 4+ days. Median/average stats. Insight callout about send-time optimization.
   - **Profile Completeness** — Identifies golfers missing GHIN, phone, or handicap data. Filter by missing field type.

4. **Activity tracking infrastructure** — Created `activity_log` table (migration 020), `/api/activity` POST endpoint, `ActivityTracker` client component (added to root layout). Login events logged in both OTP and magic link auth flows. Page views logged on every route change via client-side tracker.

5. **Fixed TS error** — Removed invalid `.catch()` on Supabase PostgrestFilterBuilder in auth callback route.

**Key decisions:**
- **Reports are super-admin-only** for now. Can be expanded to event admins later if useful.
- **Activity tracking is lightweight and non-blocking** — fire-and-forget pattern. Failures never block auth or navigation.
- **Page paths are normalized** in the activity report — UUIDs and tokens are replaced with `[id]`/`[token]` for meaningful aggregation.
- **Golfer engagement report uses 12-week lookback** — long enough for meaningful trends, short enough to reflect current behavior.
- **Reports linked from admin dashboard** via a card in the global section.
