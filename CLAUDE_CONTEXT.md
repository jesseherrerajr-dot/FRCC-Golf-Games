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
- Grouping engine — fully implemented with 36 unit tests, cron integration, and pro shop email integration
- Playing partner preferences — ranked 1–10 with per-event scoping
- Tee time preferences — per-week on RSVP page
- Multi-event architecture — designed and implemented, second event being onboarded
- PWA install flow with push notification support
- Configurable email schedules per event (6 Vercel cron slots)

**What's in progress or upcoming:**
- Guest request workflow (Phase 3 — architecture exists, feature flagged OFF)
- Golf Genius CSV export
- UI/UX branding alignment with Fairbanks Ranch website
- Participation history and reporting (Phase 5)
- Additional events beyond the second one

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
- Greedy heuristic with weighted partner preferences, tee time constraints, shuffle randomization.
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

**Unresolved or deferred items visible in the codebase:**

- **Guest system** — Architecture and DB schema exist, feature-flagged OFF. Guest request workflow, approval flow, and guest confirmation emails are not yet built. The `guest_requests` table and related types exist but the UI/flow is incomplete.
- **Golf Genius CSV export** — Mentioned in CLAUDE.md as a Phase 3 item, not yet implemented. Format may need refinement based on Golf Genius import requirements.
- **UI/UX branding** — No Fairbanks Ranch logo, colors, or imagery have been integrated yet. The current design uses a generic teal/navy palette. User needs to provide brand assets.
- **Participation history / reporting** — Data is being collected (RSVP history, email log) but there's no reporting UI yet. This is Phase 5.
- **Admin RSVP page grouping display** — The grouping engine stores results, but the admin RSVP management page doesn't yet display suggested groupings (read-only view). Noted as incomplete in CLAUDE.md.
- **The `tee_time_preferences` table** — Standing preferences table exists but is ignored by the grouping engine. Only per-week RSVP tee time preferences are used. This table may be vestigial.
- **Email scheduler complexity** — The structural audit identified `email-scheduler/route.ts` (CC ~50) as the top refactoring priority. Splitting into per-type handlers would improve maintainability.
- **Test coverage** — Only the grouping engine has unit tests (36 tests). No integration or end-to-end tests exist.
- **Install page domain reference** — Previously referenced `frccgolfgames.vercel.app`, now updated to `frccgolfgames.com`. Verify custom domain is properly configured in Vercel.
- **Push notification adoption** — Bell icon is the only discovery mechanism. Recently improved with Install page guidance, Help FAQ, and onboarding checklist item. Effectiveness is unknown — may need a contextual prompt (e.g., banner after first RSVP) if adoption is low.

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

---

## 7. Lessons Learned

**Model choice matters:** Early work with Sonnet involved significant rework. Opus produces more reliable results and is the preferred model for this project going forward.

**The stack has been smooth:** No major gotchas with Vercel, Supabase, or Resend beyond the well-documented timezone bugs (see CLAUDE.md Timezone Rules). Free-tier limitations exist but haven't been blockers yet. Keep costs low as long as possible.

**No regrets on architecture:** The project has been enjoyable to build. The stack made it easy to get started with a functional app quickly, then iterate. Nothing feels over-engineered or unnecessary so far.

**Usage patterns are still emerging:** With 50+ users and the app in production, Jesse is planning to build out analytics and reporting (via Cowork) to better understand how golfers actually use the app — what behaviors to monitor, where engagement is strong or weak. This is an upcoming priority.

**The app is a passion project:** Jesse genuinely enjoys working on it and wants to expand capabilities beyond what's strictly necessary. Future work is driven by interest and ambition as much as user demand.

---

## 8. Session Log

### Session: March 13, 2026

**Context:** Routine maintenance and discoverability improvements.

**Changes made:**
1. **Renamed `/dashboard` route to `/home`** — Updated 27 files including all internal redirects, email templates (now say "Go to FRCC Golf Games"), help page FAQ copy, breadcrumbs, nav links, PWA manifest, and CLAUDE.md. Added backward-compatible redirect from `/dashboard` → `/home`.

2. **Improved push notification discoverability** — Fixed service worker fallback URLs from `/dashboard` to `/home`. Added step 5 to Install page instructions (both iOS and Android) explaining the bell icon. Added "Push notifications" to Install page benefits section. Added new "How do I turn on push notifications?" FAQ to Help page with platform-specific guidance. Added "Turn on push notifications" to the onboarding checklist (client-side detection, only shows when browser supports push and user hasn't enabled it).

3. **Updated Install page URLs** — Changed `frccgolfgames.vercel.app` references to `frccgolfgames.com`.

**Discussion points:**
- Confirmed the app is in production (not beta) with 50+ users and a second event onboarding.
- Analyzed that tokenized RSVP links are safe from the route rename (they use `/rsvp/[token]`, not `/dashboard`).
- Discussed Supabase session handling — confirmed that linking to `/home` vs `/dashboard` vs `/` has identical auth behavior for returning users (middleware refreshes session on all routes). Landing page (`/`) is the only one that doesn't check auth, so email links should point to `/home` for the smoothest logged-in experience.
- Identified that push notifications were essentially invisible to users — no mention in Help, Install page, onboarding, or welcome banner. Bell icon has no label and is hidden on unsupported browsers (most iOS Safari users).

**Created:** CLAUDE_CONTEXT.md (this file).
