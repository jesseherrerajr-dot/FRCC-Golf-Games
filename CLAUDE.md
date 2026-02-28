# FRCC Golf Group Tracker

## Project Overview
An automated golf participation tracker for recurring games at Fairbanks Ranch Country Club (FRCC). The platform manages weekly invites, RSVP tracking, waitlists, guest requests, and automated communications — minimizing human intervention while keeping admins in control of key decisions.

- Tech Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Auth/DB), Resend (Email)
- Hosting: Vercel (Free tier)
- Database: Supabase (Free tier)
- Email: Resend (Free tier — up to 100 emails/day)
- UI: Mobile-first (designed for golfers on the course)

## Tech Standards
- TypeScript for all files
- Magic Link authentication via Supabase (no passwords)
- Mobile-first responsive design with Tailwind CSS
- App Router (Next.js) with Server Actions
- Role-Based Access: Super Admin, Event Admin, Golfer

---

## File Map

### Pages (src/app/)
- `page.tsx` — Landing/home page
- `layout.tsx` — Root layout (header, global styles)
- `login/` — Magic link login page
- `join/` — Generic self-registration (subscribes to all events on approval)
- `join/[slug]/` — Event-specific self-registration (e.g., `/join/saturday-morning`)
- `auth/callback/` — Supabase auth callback handler
- `auth/confirm/` — Email OTP confirmation page
- `auth/signout/` — Sign-out route
- `auth/link-error/` — Expired/invalid magic link error page
- `dashboard/` — Golfer dashboard (upcoming RSVPs, My Events, unsubscribe)
- `profile/` — Golfer profile settings (name, email, phone, GHIN)
- `preferences/` — Playing partner preferences (ranked list with up/down reordering, searchable add)
- `rsvp/[token]/` — Tokenized RSVP page (one-tap In/Out/Not Sure, guest requests, tee time pref)

### Admin Pages (src/app/admin/)
- `page.tsx` — Admin dashboard (weekly RSVP overview, action items, collapsible sections)
- `actions.ts` — Admin dashboard server actions
- `admin-actions.tsx` — Admin action items component
- `members/page.tsx` — Member directory (search, filter, approve/deny)
- `members/member-search.tsx` — Member search component
- `members/[memberId]/page.tsx` — Member detail page (status, subscriptions)
- `members/[memberId]/subscription-toggles.tsx` — Event subscription toggle component
- `members/[memberId]/actions.ts` — Member detail server actions (approve, deactivate, delete)
- `members/add/` — Admin "Add Golfer" page (direct add, no approval needed)
- `rsvp/[scheduleId]/page.tsx` — Weekly RSVP management (In/Out/Waitlist breakdown, collapsible sections)
- `rsvp/[scheduleId]/rsvp-controls.tsx` — RSVP override controls (post-cutoff admin changes)
- `rsvp/[scheduleId]/guest-controls.tsx` — Guest request approve/deny controls
- `rsvp/[scheduleId]/actions.ts` — RSVP management server actions
- `rsvp/[scheduleId]/guest-actions.ts` — Guest approval server actions
- `events/new/` — Create new event page
- `events/[eventId]/settings/` — Event settings (name, capacity, admins, pro shop contacts, feature flags)
- `events/[eventId]/schedule/` — 8-week rolling schedule (Game On/No Game toggle, capacity override)
- `events/[eventId]/email/compose/` — Custom email composer with templates

### API Routes (src/app/api/)
- `rsvp/route.ts` — RSVP submission endpoint (tokenized, no login required)
- `rsvp/tee-time/route.ts` — Tee time preference submission
- `cron/email-scheduler/route.ts` — Master cron endpoint (checks all events for due emails)
- `cron/invite/route.ts` — Monday invite email sender
- `cron/reminder/route.ts` — Thursday reminder email sender
- `cron/confirmation/route.ts` — Friday confirmation email sender (golfer + pro shop)
- `cron/grouping/route.ts` — Grouping engine cron endpoint (runs at cutoff time, generates suggested foursomes)

### Shared Libraries (src/lib/)
- `auth.ts` — Auth helpers (get current user, check admin role)
- `email.ts` — Resend email sending wrapper
- `email-templates.ts` — HTML email templates (invite, reminder, confirmation, pro shop, notifications)
- `admin-alerts.ts` — Admin notification email logic
- `subscriptions.ts` — Subscribe/unsubscribe helpers
- `schedule.ts` — Schedule lookup helpers (get current week, next game date)
- `schedule-gen.ts` — Auto-generate weekly schedule rows for an event
- `format.ts` — Formatting utilities (names, phone numbers, dates)
- `timezone.ts` — Pacific Time timezone helpers
- `supabase/client.ts` — Supabase browser client
- `supabase/server.ts` — Supabase server client (for Server Actions/API routes)
- `supabase/middleware.ts` — Supabase session middleware
- `grouping-engine.ts` — Core foursome grouping algorithm (pure function, no DB calls, shuffle/randomization support)
- `grouping-engine.test.ts` — Unit tests for grouping algorithm (36 tests)
- `grouping-db.ts` — DB queries: fetch confirmed golfers, partner preferences, approved guests; store groupings with guest placement; fetch stored groupings with tee time + partner preference annotations

### Other Key Files
- `src/middleware.ts` — Next.js middleware (auth redirects, session refresh)
- `src/types/events.ts` — TypeScript types for events, RSVPs, profiles, groupings
- `src/components/header.tsx` — Shared header/nav component
- `src/components/collapsible-section.tsx` — Shared collapsible section component (expand/collapse with chevron, count badge, optional "View All" link)
- `scripts/import-golfers.ts` — Batch import golfers from Excel
- `scripts/delete-user.ts` — Delete a user script
- `supabase/migrations/` — Database schema migrations (001–010)
- `vercel.json` — Vercel config (cron schedules)

---

## Terminology
- **Event**: A recurring game (e.g., "FRCC Saturday Morning Group"). Each event has its own schedule, capacity, RSVP cycle, admin assignments, and member subscriptions. Events can be weekly, bi-weekly, or monthly.
- **Super Admin**: Full platform access. Can manage all events, add/remove admins, manage all settings. Also a golfer on the distribution list.
- **Event Admin (Primary)**: Manages a specific event. The "reply-to" address on automated emails for that event. Can approve registrations, manage RSVPs, toggle schedule, send custom emails.
- **Event Admin (Secondary)**: Same permissions as primary for the event, CC'd on all communications. Exists for redundancy.
- **Golfer (Member)**: A confirmed club member on the distribution list. Receives weekly invites, can RSVP, manage profile, set preferences.
- **Guest**: A non-member registered in the system (name, email, phone, GHIN) but NOT on any distribution list. Can only play when invited by a member for a specific week.
- **GHIN**: USGA Golf Handicap & Information Network number. Optional for members and guests (can be added later via profile settings). Future: GHIN API integration.

---

## User Roles & Dual-Role Design
Super admins and event admins are also golfers. They register, subscribe to events, RSVP weekly, and appear on the distribution list just like any other golfer. Admin capabilities are layered on top of their golfer account.

When an admin logs in, they see their golfer dashboard (upcoming RSVPs, profile, preferences) PLUS admin tools (member management, schedule, RSVP overview, action items).

### Permission Hierarchy
- **Super Admin**: All permissions. Manage events (create/edit/delete). Add/remove other admins. Add/remove golfers. Access all event settings. View all data across all events.
- **Event Admin**: Scoped to assigned events only. Approve/deny registrations. Manage weekly RSVPs (override after cutoff). Toggle schedule on/off. Send custom emails. View full RSVP breakdown. Manage waitlist and guest approvals.
- **Golfer**: Self-service only. RSVP for subscribed events. Edit own profile. Set playing partner preferences. View "In" list (only when opted in). Request guests. Subscribe/unsubscribe from events.

---

## Registration Flow
There are three ways to add golfers to the system:

### Path 1 — Self-Registration via Event Join Link (most common for new golfers)
1. Admin shares the event-specific join link (e.g., `frccgolfgames.com/join/saturday-morning`). The link is available on each event's settings page with a copy button.
2. Golfer visits the link and fills in: first name, last name, email (required), phone and GHIN (optional).
3. System sends a verification code to the golfer's email.
4. Golfer enters the code → email is confirmed → account status becomes "Pending Approval."
5. Admin sees the pending registration in the Member Directory and approves or denies.
6. Once approved, status becomes "Active" and the golfer is subscribed to that specific event only.

### Path 2 — Admin Adds Golfer Directly
1. Admin goes to Member Directory → "+ Add Golfer."
2. Fills in name, email, optional phone/GHIN, and selects which event to subscribe them to (or "All Active Events").
3. Golfer is created as Active immediately — no approval step needed.
4. Golfer can log in anytime using a magic link sent to their email.

### Path 3 — Batch Import via Script
1. Admin runs the `scripts/import-golfers.ts` script with an Excel file (columns: First Name, Last Name, Email).
2. All golfers are created as Active and subscribed to all active events.
3. Phone and GHIN are left blank (golfers can add later via profile settings).

### Generic Self-Registration (/join)
The original `/join` page still exists for golfers who aren't referred to a specific event. On approval, they're subscribed to all active events.

### Registration Validation
- Email: Smart format validation + OTP code confirmation (real email required).
- Phone: US 10-digit format validation. Stored in consistent format. Optional.
- GHIN: Optional field stored as-is. Future: API validation.
- All fields can be modified later by the golfer through their profile settings.

### Member Management
- Super admins and event admins can deactivate a golfer (stops invites, preserves account and history) or remove/delete them entirely.
- Deactivated golfers can be reactivated by an admin.

### Subscription Management
- Admins can subscribe/unsubscribe any golfer to/from specific events via the member detail page (Member Directory → Manage).
- Golfers can unsubscribe themselves from events via the "My Events" section on their dashboard.
- Unsubscribed golfers stop receiving invites for that event but retain their account and history.

---

## Events
The first event is **"FRCC Saturday Morning Group"**. The platform is designed from day one to support multiple events, each with independent configuration.

### Event Settings
- Name and description
- URL slug (e.g., `saturday-morning`) — used for event-specific join links (`/join/[slug]`). Displayed on the event settings page with a copy button.
- Frequency: weekly, bi-weekly, or monthly
- Day of week
- Default weekly capacity (e.g., 16 = 4 foursomes)
- Timezone: America/Los_Angeles (Pacific Time)
- Invite send time (configurable via admin settings)
- Reminder send time (configurable via admin settings)
- RSVP cutoff time (configurable via admin settings)
- Confirmation email time (configurable via admin settings)
- Pro shop contacts (multiple email addresses)
- Primary and secondary event admins
- Feature flags (guest requests, tee time preferences, playing partner preferences)

### Schedule Management
- Admin dashboard has a rolling 8-week schedule view.
- Each week defaults to "Game On."
- Admins can toggle any week to "No Game" (e.g., club tournament).
- If toggled off before Monday invite time, system sends a notification instead: "No game scheduled for Saturday [Month] [Date]. Next scheduled game: Saturday [Month] [Date]."

---

## Weekly RSVP Flow

### Monday — Invite (10:00 AM PT)
- Automated email sent to all active, subscribed members.
- Each golfer gets a unique tokenized link (no login required for RSVP).
- Three one-tap response options: **"I'm In"** | **"I'm Out"** | **"Not Sure Yet (ask me again Thursday)"**
- Confirmation shown immediately after responding, with a "Change My Response" link.
- Tokens are unique per golfer per week — cannot be guessed.

### Monday–Thursday — Open RSVP Period
- Golfers can change their response at any time via the link in their confirmation email or by logging in.
- Capacity is first-come-first-served. Once the weekly cap is reached, subsequent "I'm In" responses go to the waitlist (ranked by response time).
- Members who are "In" can request to bring guests (provide guest name, email, GHIN). Guest requests go to a pending state.

### Thursday — Reminder (10:00 AM PT)
- Automated reminder sent ONLY to golfers who haven't responded OR who responded "Not Sure Yet."
- Golfers who already responded "In" or "Out" do NOT receive the reminder.

### Friday — Cutoff (10:00 AM PT)
- Self-service RSVP locks. Golfers can no longer change their response.
- After cutoff, only event admins and super admins can modify RSVP status.
- Admins review the waitlist and guest requests. Admins manually select who to pull from the waitlist (not auto-promoted — admin discretion for factors beyond arrival order).
- Guest requests are approved or denied by admins. Guests only fill spots that members haven't claimed.

### Friday — Confirmation Emails (1:00 PM PT, automated)
**Email 1 — Golfer Confirmation:**
- TO: All confirmed golfers and approved guests for that week
- CC: Super admin, event admins, pro shop contacts
- Subject: "[Event Name]: [Month] [Date]: Registration Confirmation"
- Body: Event name, date, list of confirmed player names (first initial + last name). Guests shown with their sponsoring member.
- Purpose: Anyone can "Reply All" to share game details, tee times, course conditions, etc. "Reply" goes to primary event admin.

**Email 2 — Pro Shop Detail:**
- TO: Pro shop contacts
- CC: Super admin, event admins
- Body: Golfer full names, contact info (email, phone), and GHIN numbers. Includes guest info.
- Purpose: Pro shop uses this for Golf Genius setup and contacting players if needed.

### RSVP Visibility (Evite-Style)
- Golfers who are "In" can see the list of other "In" golfers (first initial + last name only, e.g., "J. Herrera"). No email addresses, phone numbers, or full distribution list visible.
- Golfers who are "Out," "Not Sure," or haven't responded cannot see the "In" list until they opt in.
- Super admins and event admins can see ALL categories at all times: In, Out, Not Sure, No Response, Waitlisted.

---

## Capacity & Waitlist
- Admin sets a weekly capacity per event (default: 16 for Saturday Morning Group).
- Capacity can be overridden per week (e.g., 20 one week, 12 another).
- RSVPs are first-come-first-served. After capacity is met, additional "I'm In" responses go to a waitlist ranked by response time.
- Admin manually selects who to pull from the waitlist when spots open (not auto-promoted).
- Waitlisted golfers are notified of their waitlist position.

---

## Guest System
- Only members can request guests. Guests only fill spots when member capacity isn't full.
- To request a guest, the member provides: guest name, guest email, guest GHIN number.
- Guest request goes to pending/waitlisted state.
- After Friday 10:00 AM cutoff, admins review and approve/deny guest requests.
- Once approved, an automated confirmation email is sent showing the member name and guest name.
- Guests are registered in the system (name, email, phone, GHIN on file) but are NEVER on distribution lists and never receive automated weekly invites.

---

## Golfer Profile & Preferences
### Profile Fields
- First name (required)
- Last name (required)
- Email (required, validated, confirmed)
- Phone (required, US 10-digit format)
- GHIN number (required)
- All fields editable by the golfer at any time.

### Event Subscriptions
- Golfers choose which events to subscribe to (one, multiple, or none).
- Can subscribe/unsubscribe at any time.
- Unsubscribed golfers are completely invisible from that event's weekly flow — no invites, no listing, no clutter. To rejoin, log in and re-subscribe.

### Playing Partner Preferences (per event)
- Optional. Up to 10 preferred playing partners per event, ranked 1–10 (1 = most preferred).
- Selected via searchable member dropdown (search by name or email; email is not displayed to users).
- Partners can be reordered via up/down arrows on the preferences page.
- Standing preference (not per-week). Golfers can update anytime via the Playing Partner Preferences page.
- Ranking drives the grouping engine's weighted harmony scoring: rank 1 = 100 pts, rank 2 = 50 pts, etc. Mutual preferences are naturally weighted higher (bidirectional scoring).
- Only active golfers subscribed to the same event appear in the partner search dropdown.

### Tee Time Preferences
- Golfers can indicate preference for earlier or later tee times (early, late, or no preference).
- Set per-week during RSVP (not a standing preference). The standing tee time preferences table exists but is ignored by the grouping engine.
- The grouping engine uses the per-week RSVP tee time preference to place early golfers in lower-numbered groups and late golfers in higher-numbered groups.

---

## Golfer Dashboard (logged in)
- Upcoming RSVP status for each subscribed event (with quick-action to change response before cutoff).
- Link to profile settings and playing partner preferences.
- View the "In" list (evite-style) for events where they've opted in.

---

## Admin Dashboard
### Default View — Current Week Status
- Full RSVP breakdown: In, Out, Not Sure, No Response, Waitlisted.
- Count of confirmed vs. capacity.
- Waitlist with ranked order.
- Pending guest requests.

### Action Items / Task Summary
- Pending registration approvals.
- Open spots that could be filled from waitlist or guests.
- Any other items needing attention.
- Action items also sent via email to admins.

### Schedule View
- Rolling 8-week calendar.
- Toggle Game On / No Game per week.
- Override capacity per week.

### Member Directory
- All registered members with status (active, pending, deactivated).
- Search and filter.
- Approve/deny pending registrations.
- Deactivate or remove members.

### Custom Emails
- Compose and send targeted emails to specific RSVP categories (all "In," all "Not Sure" + no response, everyone, etc.).
- Pre-built templates for common scenarios (can be added over time):
  - **Game Cancelled**: "[Event] for [Date] has been cancelled due to [reason]. Next game: [Date]."
  - **Extra Spots Available**: "We still have [X] spots open for [Date]! Update your RSVP."
  - **Weather Advisory**: "Weather update for [Date]: [details]. Game is still on."
  - **Course Update**: "Update for [Date]: [details]."
- Plus a free-form "Compose Custom Message" option.
- Template infrastructure built to allow adding more templates over time.

---

## Email Configuration
- Sender: Resend default domain for now (customizable later).
- Reply-To: Primary event admin's email address.
- All automated emails CC super admin and relevant event admins.
- Free tier: 100 emails/day. Current list is well under 100.
- Future consideration: If distribution grows beyond 100, batch invites by golfer priority (top 100 on Monday, remainder on Tuesday). Not needed now.
- Future consideration: SMS/text notifications via a paid service. Not enabled now.

---

## Golf Genius Export
- CSV download button on admin dashboard.
- Columns: First Name, Last Name, GHIN Number, Email.
- Exported for the current week's confirmed players (members + approved guests).
- Format may be refined later based on Golf Genius import requirements.

---

## Participation History
- Every RSVP response is timestamped and stored permanently.
- Queryable by golfer, event, and date range.
- Future use cases:
  - League qualification tracking (e.g., minimum rounds for prizes in Thursday league).
  - Admin reporting on inactive members (registered but never responds).
  - Attendance statistics per golfer.

---

## Technical Architecture

### Database: Supabase (PostgreSQL)
Key tables: profiles, events, event_admins, event_subscriptions, event_schedules, rsvps, guest_requests, playing_partner_preferences, pro_shop_contacts, email_templates, email_log, event_email_schedules, event_alert_settings, groupings.

Notable columns added post-initial schema:
- `events.slug` — URL-friendly identifier for join links (e.g., `saturday-morning`).
- `profiles.registration_event_id` — tracks which event a golfer self-registered through. NULL = generic registration or batch import (subscribes to all events on approval).
- `profiles.ghin_number` — now optional (was originally required).

### Authentication: Supabase Auth
- Magic link (OTP) for passwordless login.
- Tokenized RSVP links for one-tap weekly responses (no login required).
- Session management via Supabase SSR middleware.

### Email: Resend
- Automated scheduled emails (Monday invite, Thursday reminder, Friday confirmation).
- Custom admin-triggered emails.
- Default sending domain for now; custom domain possible later.

### Hosting: Vercel
- Next.js App Router with Server Actions.
- Cron jobs: 6 daily crons synced 1:1 with admin-configurable email time slots:
  - 16:00 UTC → 8:00 AM PST (fires for 7:45 AM setting)
  - 17:00 UTC → 9:00 AM PST (fires for 8:45 AM setting)
  - 18:00 UTC → 10:00 AM PST (fires for 9:45 AM setting)
  - 19:00 UTC → 11:00 AM PST (fires for 10:45 AM setting)
  - 20:00 UTC → 12:00 PM PST (fires for 11:45 AM setting)
  - 01:00 UTC → 5:00 PM PST (fires for 4:45 PM setting)
- Each cron calls `/api/cron/email-scheduler` which checks all events for emails due within a 3-hour forward window.
- Note: During PDT (Mar–Nov), crons fire 1 hour later in Pacific Time.
- Free tier (Hobby plan — limited to daily cron frequency, max 6 cron entries).

---

## Build Phases
### Phase 1 — Foundation (Complete)
- [x] Project scaffold (Next.js, Tailwind, Supabase, Resend)
- [x] Join the Group registration page
- [x] Supabase database schema
- [x] Login page (magic link)
- [x] Golfer dashboard (basic)
- [x] Profile settings page
- [x] Admin dashboard (basic)
- [x] Registration approval workflow

### Phase 2 — Weekly RSVP Cycle (Complete)
- [x] RSVP page with tokenized links
- [x] Monday automated invite email
- [x] Thursday automated reminder email
- [x] Friday automated confirmation emails (golfer + pro shop)
- [x] RSVP visibility (evite-style "In" list)
- [x] Capacity and waitlist management
- [x] Admin RSVP override (post-cutoff)

### Phase 3 — Guest System & Preferences
- [ ] Guest request workflow
- [ ] Guest registration and approval
- [x] Playing partner preferences (searchable dropdown, ranked 1–10 with up/down reordering)
- [x] Tee time preferences (per-week on RSVP page; standing preferences table exists but ignored by engine)
- [ ] Golf Genius CSV export

### Phase 4 — Admin Tools & Communication (MVP for Beta Launch)
- [x] Schedule management (8-week rolling view)
- [x] Custom email composer with templates
- [ ] Action items / task summary
- [x] Member directory with search/filter
- [x] Member detail page with subscription management
- [x] Admin "Add Golfer" page (direct add, no approval needed)
- [x] Event-specific join links (/join/[slug]) with admin copy button
- [x] Golfer dashboard "My Events" with self-service unsubscribe
- [x] Configurable email schedule (6 time slots synced with Vercel crons)
- [x] Admin notification emails
- [ ] UI/UX improvements and branding
  - Align visual design with Fairbanks Ranch website (colors, fonts, imagery)
  - Add Fairbanks Ranch logo
  - Polish copy and messaging
  - Ensure consistent look and feel across all pages
- [ ] Help and support features
  - Self-service help documentation for common questions
  - Contextual help/tooltips where needed
  - Support contact guidance (who to reach out to for assistance)

### Phase 5 — Multi-Event & Future (Post-MVP Enhancements)
- [ ] Add additional events (Thursday league, Friday afternoon, etc.)
- [ ] Per-event admin scoping
- [ ] Participation history / reporting
- [x] Recommended Foursome Algorithm — fully implemented (greedy heuristic with weighted partner preferences, tee time constraints, shuffle randomization, guest-host pairing). See `docs/GROUPING_ENGINE_SPEC.md`.
  - [x] Grouping engine algorithm (`grouping-engine.ts`) with 36 unit tests, shuffle support, group order randomization within tee-time tiers
  - [x] Database schema: `groupings` table, `rank` column on partner preferences, `allow_auto_grouping` feature flag
  - [x] DB layer (`grouping-db.ts`) — fetch confirmed golfers, partner preferences, approved guests; store groupings; fetch stored groupings with tee time + partner preference annotations
  - [x] Cron integration — engine runs via existing email-scheduler cron at golfer confirmation time (no separate cron entry needed)
  - [x] Pro shop email integration — 6-column grouped roster (Name, Email, Phone, GHIN, Tee Time, Player Pref) with guest labels and preference checkmarks when `allow_auto_grouping` is enabled; flat alphabetical fallback when disabled
  - [ ] Admin RSVP page — display suggested groupings (read-only)
- [ ] Additional grouping methods (future):
  - Random groupings
  - Like-skill / like-handicap based groupings (using GHIN)
  - Balanced skill / equitable groupings (mix skill levels)
  - Playing partner preference based groupings
  - Tee time preference based groupings
  - Hybrid / combination approaches (e.g., honor preferences + balance skill)
- [ ] Priority-based invite batching (100+/day)
- [ ] SMS/text notifications
- [ ] GHIN API integration
- [ ] Custom email sending domain
