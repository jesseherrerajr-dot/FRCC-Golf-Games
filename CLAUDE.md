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

## UI/UX Design Standards (READ BEFORE BUILDING UI)

80%+ of all interactions are from mobile phones. Every UI decision should prioritize the mobile experience first.

### Responsive Tile Pattern (Preferred for Data Summaries)
When displaying a set of related metrics or status counts (e.g., RSVP breakdown, dashboard stats), use **responsive tile grids** instead of tables or horizontal stat bars. Each tile should be a self-contained card with a label and value, using Tailwind's responsive grid:
- `grid-cols-2` — small phones (default)
- `sm:grid-cols-3` — larger phones / small tablets
- `lg:grid-cols-6` — desktop / wide screens

Tiles should have subtle colored backgrounds to differentiate categories (e.g., `bg-teal-50` for positive, `bg-amber-50` for warning, `bg-gray-50` for neutral). This pattern ensures content reflows naturally across screen sizes without horizontal scrolling or cramped layouts.

### Hierarchical Breadcrumbs (Required on All Pages)
Every page (except the landing page and login) **must** have a `<Breadcrumbs>` component from `@/components/breadcrumbs` at the top of the content area, showing the user's position in the navigation hierarchy.

**Rules:**
- The last item in the breadcrumb trail is the current page (no `href` — renders as plain text).
- All preceding items are clickable links to their respective pages.
- **Golfer pages** start with `Home` (links to `/dashboard`): e.g., `Home > Profile`, `Home > Help`.
- **Admin pages** start with `Admin` (links to `/admin`): e.g., `Admin > Create Event`.
- **Event-scoped admin pages** include the event name linking to the event dashboard (`/admin/events/[eventId]`): e.g., `Admin > FRCC Saturday Morning Group > Schedule`, `Admin > FRCC Saturday Morning Group > Settings`.
- **Do NOT** use "← Back to X" links. All backward navigation is handled by breadcrumbs.
- **Do NOT** duplicate navigation — if a page has breadcrumbs, it should not also have a separate back link.
- When creating a new page, always add breadcrumbs as the first element inside the content area, before the `<h1>` heading.

**Current breadcrumb trails:**
| Page | Breadcrumb |
|---|---|
| Profile | `Home > Profile` |
| Help | `Home > Help` |
| Install | `Home > Get the App` |
| Admin → Create Event | `Admin > Create Event` |
| Admin → Golfers | `Admin > Golfers` |
| Admin → Event Dashboard | `Admin > [Event Name]` |
| Admin → Event Settings | `Admin > [Event Name] > Settings` |
| Admin → Event Schedule | `Admin > [Event Name] > Schedule` |
| Admin → Event Golfers | `Admin > [Event Name] > Golfers` |
| Admin → Event Golfer Detail | `Admin > [Event Name] > Golfers > [Golfer Name]` |
| Admin → RSVP Management | `Admin > [Event Name] > RSVP Management` |
| Admin → Send Email | `Admin > [Event Name] > Send Email` |
| Admin → Add Golfer (global) | `Admin > Golfers > Add Golfer` |
| Admin → Add Golfer (event) | `Admin > [Event Name] > Golfers > Add Golfer` |

### Typography Standards
- **Page titles (h1)**: All page titles must use `text-2xl font-serif uppercase tracking-wide font-bold text-navy-900`. Landing and login pages use larger sizes (`text-3xl` or `text-4xl`) but always include `font-serif uppercase tracking-wide`.
- **Section headers (h2)**: Use `text-lg font-semibold text-gray-900` for content section headers within pages. These are intentionally less prominent than page titles.
- **Subtitle/description text**: Use `text-sm text-gray-500` for descriptions below headings.

### General Mobile-First Principles
- **Avoid wide tables on mobile.** If a table has more than 3-4 columns, hide less critical columns on mobile with `hidden sm:table-cell` or switch to a card/tile layout.
- **Tap targets should be at least 44px.** Buttons, links, and interactive elements need generous padding for thumb-friendly interaction.
- **Use cards with full-width tap areas** for navigation items (e.g., the Manage Golfers section uses full-row tappable links, not small text links).
- **Question-based UX copy** for admin workflows — guide admins with intuitive prompts like "Already know the golfer's info?" rather than feature-labeled buttons.
- **Minimize redundancy** — avoid showing the same information in multiple places (e.g., don't repeat event names in breadcrumbs, headings, and context bars).
- **Keep sections visually grouped** — use white cards with borders (`rounded-lg border border-gray-200 bg-white shadow-sm`) to clearly associate related content under section headers.

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
- `dashboard/` — Golfer dashboard (upcoming RSVPs, My Events, unsubscribe). Nav label: "Home"
- `profile/` — Golfer profile settings (name, email, phone, GHIN) with per-event playing partner preferences
- `preferences/` — Redirects to `/profile` (playing partner preferences now scoped per-event on profile page)
- `help/` — Help documentation with expandable Golfer FAQ + Admin FAQ sections
- `rsvp/[token]/` — Tokenized RSVP page (one-tap In/Out/Not Sure, guest requests, tee time pref)

### Admin Pages (src/app/admin/)
- `page.tsx` — Admin dashboard. Super admins see event summary cards for all events + global section. Event admins see only assigned events.
- `actions.ts` — Admin dashboard server actions
- `admin-actions.tsx` — Admin action items component
- `golfers/page.tsx` — Global golfer directory (super admin only). Shows all golfers across all events with event filter.
- `golfers/golfer-search.tsx` — Golfer search component with event filter
- `golfers/[golferId]/page.tsx` — Global golfer detail page (status, subscriptions to all events)
- `golfers/add/` — Add golfer globally with multi-event subscription picker
- `events/[eventId]/page.tsx` — Event dashboard. Shows event summary metrics, action items, upcoming games, quick links.
- `events/[eventId]/golfers/page.tsx` — Event-scoped golfer directory
- `events/[eventId]/golfers/golfer-search.tsx` — Event-scoped golfer search
- `events/[eventId]/golfers/add/` — Add golfer to specific event (auto-subscribes)
- `events/[eventId]/golfers/[golferId]/page.tsx` — Event-scoped golfer detail (status, subscriptions for this event only)
- `events/[eventId]/rsvp/[scheduleId]/page.tsx` — Event-scoped RSVP management redirect
- `events/[eventId]/rsvp/[scheduleId]/rsvp-controls.tsx` — RSVP override controls (post-cutoff admin changes)
- `events/[eventId]/rsvp/[scheduleId]/guest-controls.tsx` — Guest request approve/deny controls
- `events/[eventId]/rsvp/[scheduleId]/actions.ts` — RSVP management server actions
- `events/[eventId]/rsvp/[scheduleId]/guest-actions.ts` — Guest approval server actions
- `events/new/` — Create new event page
- `events/[eventId]/settings/` — Event settings (Event Details, Automated Email Settings, Admin Alerts, Pro Shop Contacts, Event Admins, Feature Flags, Danger Zone)
- `events/[eventId]/schedule/` — 8-week rolling schedule (Game On/No Game toggle, capacity override)
- `events/[eventId]/email/compose/` — Custom email composer with templates

### API Routes (src/app/api/)
- `rsvp/route.ts` — RSVP submission endpoint (tokenized, no login required)
- `rsvp/tee-time/route.ts` — Tee time preference submission
- `cron/email-scheduler/route.ts` — Master cron endpoint (checks all events for due emails)
- `cron/invite/route.ts` — Invite email sender (legacy, now handled by email-scheduler)
- `cron/reminder/route.ts` — Reminder email sender (legacy, now handled by email-scheduler)
- `cron/confirmation/route.ts` — Confirmation email sender (legacy, now handled by email-scheduler)
- `cron/grouping/route.ts` — Grouping engine cron endpoint (runs at cutoff time, generates suggested foursomes)

### Shared Libraries (src/lib/)
- `auth.ts` — Auth helpers (get current user, check admin role)
- `email.ts` — Resend email sending wrapper
- `email-templates.ts` — HTML email templates (invite, reminder, confirmation, pro shop, notifications)
- `admin-alerts.ts` — Admin notification email logic (new_registration, capacity_reached, spot_opened with golfer name, low_response)
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
- `src/components/event-context-bar.tsx` — Event context indicator + event switcher (shows on `/admin/events/[eventId]/*` pages)
- `src/components/collapsible-section.tsx` — Shared collapsible section component (expand/collapse with chevron, count badge, optional "View All" link)
- `scripts/import-golfers.ts` — Batch import golfers from Excel
- `scripts/delete-user.ts` — Delete a user script
- `supabase/migrations/` — Database schema migrations (001–010)
- `vercel.json` — Vercel config (cron schedules)

---

## Terminology
- **Event**: A recurring game (e.g., "FRCC Saturday Morning Group"). Each event has its own schedule, capacity, RSVP cycle, admin assignments, and golfer subscriptions. Events can be weekly, bi-weekly, or monthly.
- **Super Admin**: Full platform access. Can manage all events, add/remove admins, manage all settings. Also a golfer on the distribution list.
- **Event Admin (Primary)**: Manages a specific event. The "reply-to" address on automated emails for that event. Can approve registrations, manage RSVPs, toggle schedule, send custom emails.
- **Event Admin (Secondary)**: Same permissions as primary for the event, CC'd on all communications. Exists for redundancy.
- **Golfer**: A confirmed club member on the distribution list. Receives weekly invites, can RSVP, manage profile, set preferences.
- **Guest**: A non-golfer registered in the system (name, email, phone, GHIN) but NOT on any distribution list. Can only play when invited by a golfer for a specific week.
- **GHIN**: USGA Golf Handicap & Information Network number. Optional for golfers and guests (can be added later via profile settings). Future: GHIN API integration.

---

## User Roles & Dual-Role Design
Super admins and event admins are also golfers. They register, subscribe to events, RSVP weekly, and appear on the distribution list just like any other golfer. Admin capabilities are layered on top of their golfer account.

When an admin logs in, they see their golfer dashboard (upcoming RSVPs, profile, preferences) PLUS admin tools (golfer management, schedule, RSVP overview, action items).

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
4. Golfer enters the code → email is confirmed → account status becomes "Pending Approval." An admin alert email is sent immediately to event admins (via both OTP code and magic link verification paths).
5. Admin sees the pending registration in the Golfer Directory and approves or denies.
6. Once approved, status becomes "Active" and the golfer is subscribed to that specific event only.

### Path 2 — Admin Adds Golfer Directly
1. Super admin goes to Admin → Golfers → "+ Add Golfer" (global) or event admin goes to Admin → Events → [Event] → Golfers → "+ Add Golfer" (event-scoped).
2. Fills in name, email, optional phone/GHIN, and selects which event(s) to subscribe them to.
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

### Golfer Management
- Super admins and event admins can deactivate a golfer (stops invites, preserves account and history) or remove/delete them entirely.
- Deactivated golfers can be reactivated by an admin.

### Subscription Management
- Super admins can manage a golfer's subscriptions to all events via the global golfer detail page (Admin → Golfers → [Golfer]).
- Event admins can manage a golfer's subscription to their specific event via the event-scoped golfer detail page (Admin → Events → [Event] → Golfers → [Golfer]).
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
- Schedule management page shows a rolling 8-week view.
- Each week defaults to "Game On."
- Admins can toggle any week to "No Game" (e.g., club tournament). A confirmation modal requires the admin to confirm the cancellation and optionally provide a reason.
- When a game is cancelled, the system immediately sends a cancellation email to all active golfers subscribed to the event. The email includes the cancelled date, the admin-provided reason (if any), and the next scheduled game date.
- If toggled off before the invite email is sent, the cron skips that week's invite.

---

## Weekly RSVP Flow

All email types, days, and times below are **configurable per event** via the `email_schedules` table. Each event defines its own invite day/time, reminder day/time, cutoff day/time, and confirmation day/time using `send_day_offset` (relative to game day) and `send_time`. The sequence below describes the logical flow — not fixed days of the week.

> **Example (FRCC Saturday Morning Group's current config):** Invite on Monday, reminder on Thursday, cutoff Friday 10 AM, confirmations Friday 1 PM. Other events may use entirely different schedules.

### Step 1 — Invite Email
- Automated email sent to all active, subscribed golfers.
- Each golfer gets a unique tokenized link (no login required for RSVP).
- Three one-tap response options: **"I'm In"** | **"I'm Out"** | **"Not Sure Yet (remind me later)"**
- Confirmation shown immediately after responding, with a "Change My Response" link.
- Tokens are unique per golfer per week — cannot be guessed.

### Step 2 — Open RSVP Period (between invite and cutoff)
- Golfers can change their response at any time via the link in their confirmation email or by logging in.
- Capacity is first-come-first-served. Once the weekly cap is reached, subsequent "I'm In" responses go to the waitlist (ranked by response time).
- Golfers who are "In" can request to bring guests (provide guest name, email, GHIN). Guest requests go to a pending state.

### Step 3 — Reminder Email(s)
- Automated reminder sent ONLY to golfers who haven't responded OR who responded "Not Sure Yet."
- Golfers who already responded "In" or "Out" do NOT receive the reminder.
- Events support 0–3 reminder emails, each independently configurable.

### Step 4 — RSVP Cutoff
- Self-service RSVP locks. Golfers can no longer change their response.
- After cutoff, only event admins and super admins can modify RSVP status.
- Admins review the waitlist and guest requests. Admins manually select who to pull from the waitlist (not auto-promoted — admin discretion for factors beyond arrival order).
- Guest requests are approved or denied by admins. Guests only fill spots that members haven't claimed.

### Step 5 — Confirmation Emails
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
- Super admins and event admins can see ALL categories at all times: In, Out, Not Sure, No Reply, Waitlist.

---

## Capacity & Waitlist
- Admin sets a weekly capacity per event (default: 16 for Saturday Morning Group).
- Capacity can be overridden per week (e.g., 20 one week, 12 another).
- RSVPs are first-come-first-served. After capacity is met, additional "I'm In" responses go to a waitlist ranked by response time.
- Admin manually selects who to pull from the waitlist when spots open (not auto-promoted).
- Waitlisted golfers are notified of their waitlist position.

---

## Guest System
- Only golfers can request guests. Guests only fill spots when golfer capacity isn't full.
- To request a guest, the golfer provides: guest name, guest email, guest GHIN number.
- Guest request goes to pending/waitlisted state.
- After the RSVP cutoff, admins review and approve/deny guest requests.
- Once approved, an automated confirmation email is sent showing the golfer name and guest name.
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
- Selected via searchable golfer dropdown (search by name or email; email is not displayed to users).
- Partners can be reordered via up/down arrows on the profile page.
- Standing preference (not per-week). Golfers can update anytime via the profile page. Preferences are scoped per-event — each event has its own list.
- Ranking drives the grouping engine's weighted harmony scoring: rank 1 = 100 pts, rank 2 = 50 pts, etc. Mutual preferences are naturally weighted higher (bidirectional scoring).
- Only active golfers subscribed to the same event appear in the partner search dropdown.

### Tee Time Preferences
- Golfers can indicate preference for earlier or later tee times (early, late, or no preference).
- Set per-week during RSVP (not a standing preference). The standing tee time preferences table exists but is ignored by the grouping engine.
- The grouping engine uses the per-week RSVP tee time preference to place early golfers in lower-numbered groups and late golfers in higher-numbered groups.

---

## Golfer Dashboard (logged in)
- Upcoming RSVP status for each subscribed event (with quick-action to change response before cutoff).
- Link to profile settings (includes playing partner preferences per-event).
- View the "In" list (evite-style) for events where they've opted in.
- "My Events" section to manage event subscriptions and unsubscribe.

---

## Admin Dashboard

### Admin Dashboard Structure (Global)
The main `/admin` dashboard displays event summary cards. This allows admins to quickly see all events and navigate to event-specific pages.
- **Super Admin view**: Shows event summary cards for all events (name, next game date, capacity/RSVPs, action item count). Includes a global "Golfers" section to manage all golfers across the platform.
- **Event Admin view**: Shows only the event summary cards for events they administer. Includes a "Golfers" section to manage golfers for their specific event.
- Each event card includes quick links to event settings, schedule, RSVP management, and golfers.

### Event Dashboard (per event)
Admin → Events → [Event] shows event-specific dashboard with:
- Event summary metrics (next game date, capacity/RSVPs, action item count)
- Quick action items needing attention (pending registrations, open spots, guest requests)
- Upcoming game overview with RSVP summary tiles
- Quick links to golfers, schedule, RSVP management, settings, email composer

### RSVP Management (per event)
Admin → Events → [Event] → RSVP → [Week] shows:
- Full RSVP breakdown: In, Out, Not Sure, No Reply, Waitlist.
- Count of confirmed vs. capacity.
- Waitlist with ranked order.
- Pending guest requests.
- Admin override controls (post-cutoff changes).
- Guest approval/denial controls.

### Golfer Directory (Global and Event-Scoped)
Golfer directories use a **card-based list layout** (not a table). Each golfer is displayed as a full-width tappable row showing name, email (subtitle), and status badge. Tapping the row navigates to the golfer detail page. Inline action buttons (Approve/Deny, Deactivate, Reactivate) appear alongside the row for quick actions. Sort options: Name and Status.

- **Global** (Super Admin only): Admin → Golfers shows all registered golfers across all events with event filter.
  - Search and filter by name, email, event, or status.
  - Approve/deny pending registrations inline.
  - Deactivate, reactivate, or remove golfers.
  - Manage subscriptions to all events via the golfer detail page.
- **Event-Scoped**: Admin → Events → [Event] → Golfers shows golfers for that specific event only.
  - Manage subscriptions to just that event via the golfer detail page.
  - Event admins can only see and manage golfers for their assigned event(s).

### Schedule Management (per event)
Admin → Events → [Event] → Schedule shows:
- Rolling 8-week calendar.
- Toggle Game On / No Game per week.
- Override capacity per week.
- Confirmation modal on "No Game" toggle with optional reason entry.

### Custom Emails (per event)
Admin → Events → [Event] → Emails → Compose allows:
- Compose and send targeted emails to specific RSVP categories (all "In," all "Not Sure" + no response, everyone, etc.).
- Pre-built templates for common scenarios (can be added over time):
  - **Game Cancelled**: "[Event] for [Date] has been cancelled due to [reason]. Next game: [Date]." (Note: This template is also sent automatically when an admin toggles a game to "No Game" on the schedule page. The admin is prompted for an optional reason via confirmation modal.)
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
- Future consideration: If distribution grows beyond 100, batch invites by golfer priority (top 100 on invite day, remainder on the following day). Not needed now.
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
- Automated scheduled emails (invite, reminder, golfer confirmation, pro shop detail) — timing is configurable per event.
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

## Infrastructure Constraints (READ BEFORE MAKING CHANGES)

This project runs entirely on free-tier services. The following constraints are **hard limits** that have caused failed deployments and rolled-back changes in the past. Any proposed changes to cron jobs, email sending, or hosting infrastructure **must** be validated against these limits first.

### Vercel Hobby Plan
- **Cron frequency: once per day only.** Vercel Hobby does not support hourly, sub-hourly, or any frequency more granular than daily. Attempting to deploy a `vercel.json` with a non-daily cron schedule (e.g., `*/15 * * * *` or `0 * * * *`) will cause a silent deployment failure — the deploy won't appear in the Vercel dashboard and GitHub receives no useful error message.
- **Max cron entries: 6.** The current `vercel.json` uses all 6 slots. Adding a 7th cron entry requires upgrading to Vercel Pro or removing an existing entry. Do NOT add new cron entries without removing one first.
- **Current cron architecture:** All 6 cron entries hit the same `/api/cron/email-scheduler` endpoint at different UTC hours (16:00, 17:00, 18:00, 19:00, 20:00, 01:00). The scheduler checks a time window and fires any emails that are due. This staggered single-endpoint design is the workaround for the daily-only frequency limit.
- **Function duration: max 60 seconds.** All email batches and processing must complete within this window. Long-running operations need to be broken up or optimized to fit.
- **No overages.** When you hit a Hobby limit, it's a hard wall — there is no pay-as-you-go overflow. The only path past a limit is upgrading to Pro.

### Resend Free Tier
- **100 emails/day.** This is sufficient for a single event with <100 members (one invite cycle + one reminder cycle fits within 100). Adding a second event or growing the member list significantly will approach or exceed this limit.
- **3,000 emails/month.** At current usage (~1 event, ~30 members, 4 email types/week), this is well within budget. But each new event multiplies the weekly email volume.
- **1 sending domain.** Currently using Resend's default domain. Custom domain support exists but only 1 domain is available on the free tier.
- **Upgrade path:** Resend Pro ($20/month) removes the daily limit, increases to 50,000/month, and allows 10 domains.

### Supabase Free Tier
- **500 MB database storage.** Current usage is well within limits.
- **50,000 monthly active users.** Not a concern for this use case.
- **1 GB file storage.** Not currently using Supabase Storage.
- **Shared compute (2 connections pooled).** Can cause slow queries under load but adequate for current traffic.

### What This Means in Practice
- **Do NOT** add new cron entries to `vercel.json` without removing an existing one.
- **Do NOT** attempt sub-daily cron schedules — they will silently fail on Hobby.
- **Do NOT** propose architectural changes that require more than 6 time-triggered jobs per day.
- **DO** keep the single-endpoint cron pattern (`email-scheduler` checks all events and all email types on each invocation).
- **DO** monitor email volume when adding new events — the 100/day Resend limit is the first constraint that will be hit as the platform grows.

---

## Navigation Structure

The main navigation includes:
- **Home** — Golfer dashboard (upcoming RSVPs, My Events, unsubscribe)
- **Admin** (for admins only) — Main admin dashboard showing event summary cards
  - **Events** (submenu) — Links to each event's dashboard
    - **[Event Name]** — Event-specific dashboard, schedule, golfers, RSVP management, settings, emails
  - **Golfers** (super admin only) — Global golfer directory across all events
- **Profile** (accessible from Home page, not in top-level nav) — Profile settings with per-event playing partner preferences
- **Help** — Help documentation with expandable Golfer FAQ + Admin FAQ sections
- **Sign Out**

When on event-scoped admin pages (e.g., `/admin/events/saturday-morning/golfers`), an event context bar displays at the top showing the current event with an event switcher dropdown.

---

## Timezone Rules (READ BEFORE WRITING ANY DATE/TIME CODE)

This project has had **multiple production bugs** caused by UTC/Pacific timezone mismatches. Vercel serverless functions run in UTC, but all user-facing times must display in Pacific Time (America/Los_Angeles). Follow these rules strictly.

### The Two Types of Date Values

1. **Game dates** (`game_date` column) — stored as `YYYY-MM-DD` strings with no time component. These are calendar dates, not timestamps. Format them by parsing components directly: `new Date(year, month-1, day)`. NEVER pass a `YYYY-MM-DD` string directly to `new Date(dateStr)` — that interprets it as UTC midnight and can shift the date.

2. **Timestamps** (`sent_at`, `created_at`, `responded_at`, `updated_at`) — stored as `timestamptz` in Supabase (UTC internally). ALWAYS format these with `timeZone: "America/Los_Angeles"` or use the centralized formatters.

### Required: Use Centralized Formatters

All display formatting MUST use functions from `src/lib/format.ts`:

- `formatGameDate(dateStr)` — "Saturday, March 7, 2026" (for game dates)
- `formatGameDateShort(dateStr)` — "Sat, Mar 7" (for compact game date display)
- `formatGameDateForEmail(dateStr)` — "March 7, 2026" (for email subjects)
- `formatGameDateMonthDay(dateStr)` — "March 7" (for email subjects without year)
- `formatDateTime(dateStr)` — "Mar 6, 9:29 AM" (for timestamps, Pacific Time)
- `formatDateTimeDateOnly(dateStr)` — "Mar 6, 2026" (for timestamp dates only, Pacific Time)
- `formatDateTimeFull(dateStr)` — "Fri, Mar 6, 9:29 AM PST" (for admin audit displays)
- `formatPhoneDisplay(phone)` — "(XXX) XXX-XXXX" (for all phone number display)

### Forbidden Patterns (These WILL Cause Bugs on Vercel)

- **NEVER** use `.toLocaleDateString()` or `.toLocaleString()` without an explicit `timeZone: "America/Los_Angeles"` option. On Vercel (UTC), omitting `timeZone` produces UTC output.
- **NEVER** use `.setHours()` on a Date object for cutoff/schedule comparisons. The hours are set in the Date's internal timezone (UTC on Vercel), not Pacific. Use `isPastCutoffPacific()` from `timezone.ts` instead.
- **NEVER** use `new Date(dateStr)` with a YYYY-MM-DD string — it interprets as UTC midnight. Parse components: `const [y,m,d] = dateStr.split("-").map(Number); new Date(y, m-1, d);`
- **NEVER** define local `formatDate()`, `formatTime()`, or `formatGameDate()` functions in page files. Import from `@/lib/format`.
- **NEVER** use `new Date()` comparisons for time-of-day checks that should be in Pacific. Use `getNowPacific()` from `timezone.ts`.

### Required: Use Pacific Time Utilities for Logic

All schedule/cutoff logic MUST use functions from `src/lib/timezone.ts`:

- `getNowPacific()` — current time components in Pacific (year, month, day, hour, minute, dayOfWeek, dateString)
- `isPastCutoffPacific(gameDateString, cutoffDay, cutoffTime)` — RSVP cutoff check
- `isWithinSendWindow(sendDateString, sendTime, windowHours)` — email scheduler window check
- `getTodayPacific()` — today's date as YYYY-MM-DD in Pacific
- `getDateOffsetPacific(daysOffset)` — date N days from today in Pacific

### Database Constraints

The `email_log.email_type` column has a CHECK constraint allowing only: `'invite'`, `'reminder'`, `'confirmation_golfer'`, `'confirmation_proshop'`, `'no_game'`, `'guest_approved'`, `'guest_denied'`, `'guest_request_pending'`, `'registration_pending'`, `'custom'`. Do NOT use suffixed types like `'reminder_1'` or `'reminder_manual'` — they will silently fail the constraint and the log entry won't be written.

---

## Centralized Utilities (READ BEFORE ADDING CODE)

This project enforces centralized utility functions for common patterns. **Do NOT define local formatting functions, status constants, or client creation helpers in page files.** Import from the shared libraries below.

### Name Formatting (`src/lib/format.ts`)

- `formatInitialLastName(firstName, lastName)` — "J. Herrera" (golfer-facing displays, RSVP lists, confirmation emails)
- `formatFullName(firstName, lastName)` — "Jesse Herrera" (admin displays, pro shop emails)
- `formatSponsorName(firstName, lastName)` — "Jesse H." (guest labels like "Guest of Jesse H.")

**NEVER** use inline patterns like `` `${firstName[0]}. ${lastName}` `` or `` `${firstName} ${lastName.charAt(0)}.` ``. Import the appropriate function from `@/lib/format`.

### RSVP Status Constants (`src/lib/rsvp-status.ts`)

- `RsvpStatus` — type: `"in" | "out" | "not_sure" | "no_response" | "waitlisted"`
- `RSVP_GOLFER_LABELS` — golfer-facing labels ("I'm In", "I'm Out", "Not Sure Yet", etc.)
- `RSVP_ADMIN_LABELS` — admin-facing labels ("In", "Out", "Not Sure", etc.)
- `RSVP_GOLFER_COLORS` — golfer badge CSS classes (with border)
- `RSVP_ADMIN_COLORS` — admin badge CSS classes
- `RSVP_ADMIN_OPTIONS` — dropdown options for admin RSVP override

**NEVER** define local `statusLabels`, `statusColors`, or `type RsvpStatus` in page files. Import from `@/lib/rsvp-status`.

### RSVP Status Display Labels (Consistency Rule)

Admin-facing RSVP status labels **must** be consistent across all surfaces — summary tiles, collapsible section headers, badges, and documentation. The canonical admin display labels are:

| DB Status | Admin Display Label | Tile Label (uppercase) |
|---|---|---|
| `in` | In | IN |
| `out` | Out | OUT |
| `not_sure` | Not Sure | NOT SURE |
| `no_response` | No Reply | NO REPLY |
| `waitlisted` | Waitlist | WAITLIST |

**Rules:**
- **Do NOT** use "Confirmed" — use "In".
- **Do NOT** use "No Response" — use "No Reply".
- **Do NOT** use "Waitlisted" — use "Waitlist".
- Summary tiles and their corresponding detail sections below must use identical labels.
- When adding new admin views that display RSVP status, use these exact labels.

### Supabase Admin Client (`src/lib/supabase/server.ts`)

- `createAdminClient()` — Supabase client that bypasses RLS (uses service role key). For cron jobs, API routes, and server-side operations without a user session.
- `createClient()` — Session-based Supabase client (uses cookies). For authenticated pages and server actions.

**NEVER** define local `createAdminClient()` functions. Import from `@/lib/supabase/server`. The re-export from `@/lib/schedule` also works for existing imports.

### Site URL (`src/lib/format.ts`)

- `getSiteUrl()` — returns `process.env.NEXT_PUBLIC_SITE_URL` with consistent fallback.

**NEVER** use inline `process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"`. Import `getSiteUrl()` from `@/lib/format`.

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
- [x] Automated invite email (configurable day/time per event)
- [x] Automated reminder email (configurable day/time per event)
- [x] Automated confirmation emails — golfer + pro shop (configurable day/time per event)
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
- [x] Automatic game cancellation emails (triggered on "No Game" toggle, with confirmation modal and optional reason)
- [x] Action items / task summary (displayed on event dashboard)
- [x] Golfer directory with search/filter (global + event-scoped)
- [x] Golfer detail page with subscription management (global + event-scoped)
- [x] Admin "Add Golfer" page (direct add, no approval needed; global + event-scoped)
- [x] Event-specific join links (/join/[slug]) with admin copy button
- [x] Golfer dashboard "My Events" with self-service unsubscribe
- [x] Configurable email schedule (6 time slots synced with Vercel crons)
- [x] Admin notification emails (new_registration from all auth paths, capacity_reached, spot_opened with golfer name, low_response)
- [x] Event-centric admin dashboard with summary cards and quick links
- [x] Per-event admin pages scoped to assigned events only
- [x] Help and support features
  - Help page with expandable Golfer FAQ + Admin FAQ sections
- [ ] UI/UX improvements and branding
  - Align visual design with Fairbanks Ranch website (colors, fonts, imagery)
  - Add Fairbanks Ranch logo
  - Polish copy and messaging
  - Ensure consistent look and feel across all pages
  - Mobile-first responsive design refinements

### Phase 5 — Multi-Event & Future (Post-MVP Enhancements)
- [ ] Add additional events (Thursday league, Friday afternoon, etc.)
- [x] Per-event admin scoping
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
