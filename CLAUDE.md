# FRCC Golf Group Tracker

## Project Overview
An automated golf participation tracker for recurring games at Fairbanks Ranch Country Club (FRCC). The platform manages weekly invites, RSVP tracking, waitlists, guest requests, and automated communications — minimizing human intervention while keeping admins in control of key decisions.

- **Production Launch:** February 24, 2026 (v1.0 — first invite emails sent to the full group for the February 28 game)
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
- **Golfer pages** start with `Home` (links to `/home`): e.g., `Home > Profile`, `Home > Help`.
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
| Admin → Emails & Comms | `Admin > [Event Name] > Emails & Communications` |
| Admin → Send Email | `Admin > [Event Name] > Send Email` |
| Admin → Add Golfer (global) | `Admin > Golfers > Add Golfer` |
| Admin → Add Golfer (event) | `Admin > [Event Name] > Golfers > Add Golfer` |
| Admin → Reports | `Admin > Reports` |

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
- `home/` — Golfer home page (upcoming RSVPs, My Events, unsubscribe). Nav label: "Home"
- `dashboard/` — Redirect to `/home` (legacy URL preserved for backward compatibility)
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
- `golfers/[golferId]/page.tsx` — Global golfer detail page (status, subscriptions to all events, manual handicap entry)
- `golfers/[golferId]/manual-handicap.tsx` — Manual handicap field wrapper (global context)
- `golfers/[golferId]/actions.ts` — Global golfer detail server actions (manual handicap update)
- `golfers/add/` — Add golfer globally with multi-event subscription picker
- `events/[eventId]/page.tsx` — Event dashboard. Shows event summary metrics, action items, upcoming games, quick links.
- `events/[eventId]/golfers/page.tsx` — Event-scoped golfer directory (includes "Add New Golfer" section at top)
- `events/[eventId]/golfers/golfer-search.tsx` — Event-scoped golfer search
- `events/[eventId]/golfers/add/` — Add golfer to specific event (auto-subscribes)
- `events/[eventId]/golfers/[golferId]/page.tsx` — Event-scoped golfer detail (status, subscriptions for this event only, manual handicap entry)
- `events/[eventId]/golfers/[golferId]/event-manual-handicap.tsx` — Manual handicap field wrapper (event context)
- `events/[eventId]/golfers/[golferId]/actions.ts` — Event-scoped golfer detail server actions (manual handicap update)
- `events/[eventId]/rsvp/[scheduleId]/page.tsx` — Event-scoped RSVP management redirect
- `events/[eventId]/rsvp/[scheduleId]/rsvp-controls.tsx` — RSVP override controls (post-cutoff admin changes)
- `events/[eventId]/rsvp/[scheduleId]/guest-controls.tsx` — Guest request approve/deny controls
- `events/[eventId]/rsvp/[scheduleId]/add-golfer-to-game.tsx` — Client component for adding subscribed golfers to a game (searchable dropdown)
- `events/[eventId]/rsvp/[scheduleId]/actions.ts` — RSVP management server actions
- `events/[eventId]/rsvp/[scheduleId]/guest-actions.ts` — Guest approval server actions
- `events/new/` — Create new event page (email settings with Reminder and Pro Shop Detail toggles, matching Event Settings UI)
- `events/[eventId]/settings/` — Event settings (Event Details [including URL slug field for join link generation], Automated Email Settings with on/off toggles for Reminder and Pro Shop Detail emails, Admin Alerts, Pro Shop Contacts, Grouping Engine [super admin only — grouping method selector (harmony/flight foursomes/balanced foursomes/flight teams/balanced teams), playing partner on/off + mode, tee time on/off + mode, group variety toggle; handicap methods override partner/tee time prefs with warning banner], Event Admins [super admin only], Feature Flags [super admin only — guest requests], Danger Zone [super admin only — deactivate/reactivate + permanently delete with name confirmation])
- `events/[eventId]/schedule/` — 8-week rolling schedule (Game On/No Game toggle, capacity override)
- `events/[eventId]/emails/page.tsx` — Emails & Communications page (email status panel with send/resend, link to custom compose)
- `events/[eventId]/email/compose/` — Custom email composer with templates
- `reports/page.tsx` — Admin Reports page (super admin only). Golfer Engagement, Platform Activity, Response Timing, Profile Completeness reports.
- `reports/reports-client.tsx` — Reports client component (filters, sort, interactive UI)

### API Routes (src/app/api/)
- `rsvp/route.ts` — RSVP submission endpoint (tokenized, no login required)
- `rsvp/tee-time/route.ts` — Tee time preference submission
- `activity/route.ts` — Activity logging endpoint (page views, called by client-side ActivityTracker)
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
- `grouping-engine.ts` — Core grouping algorithm (pure function, no DB calls). Supports harmony (partner prefs) + 4 handicap-based methods: flight foursomes, balanced ABCD foursomes, flight 2-person teams, balanced 2-person teams
- `grouping-engine.test.ts` — Unit tests for grouping algorithm (50+ tests including handicap methods)
- `grouping-db.ts` — DB queries: fetch confirmed golfers (with handicap resolution), partner preferences, approved guests; store groupings with guest placement and team numbers; fetch stored groupings with tee time + partner preference annotations
- `weather.ts` — Open-Meteo weather API integration, caching, golfability scoring, email HTML generation
- `handicap-sync.ts` — GHIN Handicap Index sync service: authenticates with unofficial GHIN API, fetches handicap indices by GHIN number, updates profiles, logs sync runs, health monitoring helpers

### Other Key Files
- `src/middleware.ts` — Next.js middleware (auth redirects, session refresh)
- `src/types/events.ts` — TypeScript types for events, RSVPs, profiles, groupings
- `src/components/header.tsx` — Shared header/nav component
- `src/components/event-context-bar.tsx` — Event context indicator + event switcher (shows on `/admin/events/[eventId]/*` pages)
- `src/components/collapsible-section.tsx` — Shared collapsible section component (expand/collapse with chevron, count badge, optional "View All" link)
- `src/components/weather-forecast.tsx` — Weather forecast display (full + compact variants)
- `src/components/activity-tracker.tsx` — Client-side page view tracker (fires on route changes, logs to /api/activity)
- `src/components/manual-handicap-field.tsx` — Shared admin-only manual handicap inline editor (used on global and event-scoped golfer detail pages)
- `scripts/import-golfers.ts` — Batch import golfers from Excel
- `scripts/delete-user.ts` — Delete a user script
- `supabase/migrations/` — Database schema migrations (001–022)
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
- **Super Admin**: All permissions. Manage events (create/edit/delete/deactivate/reactivate). Add/remove other admins. Add/remove golfers. Permanently delete events (with name confirmation) and golfers (with email confirmation). Access all event settings. View all data across all events. Super-admin-only settings sections: Grouping Engine (playing partner/tee time preference toggles and mode configuration, group variety), Event Admins, Feature Flags (guest requests), Danger Zone (deactivate/reactivate + permanently delete events).
- **Event Admin**: Scoped to assigned events only. Approve/deny registrations. Manage weekly RSVPs (override after cutoff). Toggle schedule on/off. Send custom emails. View full RSVP breakdown. Manage waitlist and guest approvals. Can manage Event Details, Automated Email Settings, Admin Alerts, and Pro Shop Contacts.
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
- Super admins and event admins can deactivate a golfer (stops invites, preserves account and history).
- Deactivated golfers can be reactivated by an admin.
- Super admins can permanently delete a golfer from the global golfer detail page (Admin → Golfers → [Golfer]). Requires typing the golfer's email to confirm. Deletes the golfer and all related data (RSVPs, preferences, subscriptions, grouping history). Cannot delete super admin accounts.

### Subscription Management
- Super admins can manage a golfer's subscriptions to all events via the global golfer detail page (Admin → Golfers → [Golfer]).
- Event admins can manage a golfer's subscription to their specific event via the event-scoped golfer detail page (Admin → Events → [Event] → Golfers → [Golfer]).
- Golfers can unsubscribe themselves from events via the "My Events" section on their Home page.
- Unsubscribed golfers stop receiving invites for that event but retain their account and history.

---

## Events
The first event is **"FRCC Saturday Morning Group"**. The platform is designed from day one to support multiple events, each with independent configuration.

### Event Settings
- Name and description
- URL slug (e.g., `saturday-morning`) — used for event-specific join links (`/join/[slug]`). Editable in Event Settings (Basic Settings section) and auto-generated from event name on the Create Event form. Displayed on the event settings page with a copy button.
- Frequency: weekly, bi-weekly, or monthly
- Day of week
- Default weekly capacity (e.g., 16 = 4 foursomes)
- Timezone: America/Los_Angeles (Pacific Time)
- Invite send time (configurable via admin settings)
- Reminder emails (configurable via admin settings; can be toggled on/off per event)
- RSVP cutoff / golfer confirmation time (configurable via admin settings)
- Pro shop detail email (configurable via admin settings; can be toggled on/off per event, default OFF)
- Pro shop contacts (multiple email addresses)
- Primary and secondary event admins
- Game type: 9 holes or 18 holes (determines weather forecast window duration)
- First tee time: HH:MM format (used for weather forecast scoping)
- Feature flags (guest requests). Note: tee time preferences and playing partner preferences are now managed in the Grouping Engine section (super admin only), not Feature Flags.
- Grouping method: harmony (partner preferences), flight foursomes, balanced ABCD foursomes, flight 2-person teams, balanced 2-person teams. Configurable in Grouping Engine section (super admin only). Handicap methods override partner/tee time preferences.

### Schedule Management
- Schedule management page shows a rolling 8-week view.
- Each week defaults to "Game On."
- Admins can toggle any week to "No Game" (e.g., club tournament). A confirmation modal requires the admin to confirm the cancellation and optionally provide a reason.
- When a game is cancelled, the system immediately sends a cancellation email to all active golfers subscribed to the event. The email includes the cancelled date, the admin-provided reason (if any), and the next scheduled game date.
- If toggled off before the invite email is sent, the cron skips that week's invite.

---

## Weekly RSVP Flow

All email types, days, and times below are **configurable per event** via the `email_schedules` table. Each event defines its own invite day/time, reminder day/time, cutoff day/time, and confirmation day/time using `send_day_offset` (relative to game day) and `send_time`. The sequence below describes the logical flow — not fixed days of the week.

> **Note:** Each event's email schedule is fully configurable by admins. Days and times will vary across events and may change over time. Do not hardcode or assume specific days/times in documentation or code — always reference the event's configured settings.

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
- Reminder emails can be toggled on or off per event via the Automated Email Settings toggle.
- When enabled, automated reminder sent ONLY to golfers who haven't responded OR who responded "Not Sure Yet."
- Golfers who already responded "In" or "Out" do NOT receive the reminder.
- Events support 1–3 reminder emails, each independently configurable.

### Step 4 — RSVP Cutoff / Golfer Confirmation
- Self-service RSVP locks. Golfers can no longer change their response.
- Golfer confirmation email is sent at the configured cutoff time.
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

**Email 2 — Pro Shop Detail (optional, toggled on/off per event, default OFF):**
- TO: Pro shop contacts
- CC: Super admin, event admins
- Body: Golfer full names, contact info (email, phone), and GHIN numbers. Includes guest info.
- Purpose: Pro shop uses this for Golf Genius setup and contacting players if needed.
- Can be enabled/disabled via the toggle switch in Automated Email Settings on the event settings page.

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
- Admin "Add Golfer to Game" — searchable dropdown to add subscribed golfers who don't have an RSVP row (e.g., recently approved golfers who missed the invite cycle). Can add as "In" or "No Reply".

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
  - League qualification tracking (e.g., minimum rounds for prizes).
  - Admin reporting on inactive members (registered but never responds).
  - Attendance statistics per golfer.

---

## Technical Architecture

### Database: Supabase (PostgreSQL)
Key tables: profiles, events, event_admins, event_subscriptions, event_schedules, rsvps, guest_requests, playing_partner_preferences, pro_shop_contacts, email_templates, email_log, event_email_schedules, event_alert_settings, groupings, weather_cache, handicap_sync_log, activity_log.

Notable columns added post-initial schema:
- `events.slug` — URL-friendly identifier for join links (e.g., `saturday-morning`).
- `events.game_type` — `9_holes` or `18_holes` (default `18_holes`). Determines weather forecast window duration.
- `events.first_tee_time` — HH:MM format (default `07:30`). When the first group typically tees off. Used for weather forecast scoping.
- `profiles.registration_event_id` — tracks which event a golfer self-registered through. NULL = generic registration or batch import (subscribes to all events on approval).
- `profiles.ghin_number` — now optional (was originally required).

Weather (migration 017):
- `weather_cache` table: keyed by `(event_id, game_date)`, stores JSONB forecast data with `fetched_at` timestamp. RLS enabled — read by anyone, writes via service role only.

Handicap sync (migration 018):
- `profiles.handicap_index` — numeric(4,1), current USGA Handicap Index fetched from GHIN. NULL = never synced or no GHIN number.
- `profiles.handicap_updated_at` — timestamptz, when the handicap was last successfully fetched.
- `events.handicap_sync_enabled` — boolean, per-event toggle for automatic GHIN handicap sync. Default OFF.
- `handicap_sync_log` table: tracks sync runs with success/failure counts, error messages, and status. RLS enabled — admins read, service role manages.

Handicap-based grouping methods (migration 019):
- `events.grouping_method` — text, one of: `harmony`, `flight_foursomes`, `balanced_foursomes`, `flight_teams`, `balanced_teams`. Default `harmony`.
- `events.flight_team_pairing` — text, `similar` or `random`. Default `similar`. Only used when `grouping_method = 'flight_teams'`.
- `profiles.manual_handicap_index` — numeric(4,1), admin-entered handicap override. Takes precedence over GHIN-synced `handicap_index`.
- `groupings.team_number` — smallint, nullable. Tracks 2-person team assignments for team-based grouping methods.

Handicap history (migration 021):
- `handicap_history` table: append-only log of every handicap index value fetched from GHIN. Columns: `profile_id` (FK → profiles), `handicap_index` numeric(4,1), `source` (CHECK: `ghin_sync`, `manual`), `recorded_at` timestamptz. Records every sync fetch (even if value unchanged) for complete trend tracking. RLS enabled — golfers read own, admins read all, service role inserts. Indexed on `(profile_id, recorded_at DESC)` and `(recorded_at DESC)`.

Activity tracking (migration 020):
- `activity_log` table: append-only log of login events and page views. Columns: `profile_id`, `activity_type` (CHECK: `login`, `page_view`), `page_path`, `metadata` (JSONB), `created_at`. RLS enabled — users insert own activity, super admins read all, service role full access. Indexed on `profile_id`, `(activity_type, created_at)`, and `(profile_id, created_at)`.

Security hardening (migrations 015–016):
- `push_subscriptions` table has RLS enabled with policies scoped to `profile_id = auth.uid()`.
- All database functions have `search_path` pinned to `public` to prevent schema-shadowing attacks.
- `email_log` INSERT policy restricted to admin users only (was previously `WITH CHECK (true)`).

Registration fix (migration 022):
- Updated `handle_new_user()` trigger to extract `registration_event_id` from user metadata. Fixes a bug where golfers registering via event-specific join links (`/join/[slug]`) had NULL `registration_event_id`, causing them to be subscribed to all events on approval instead of just the registration event.

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
  - 13:00 UTC → 5:00 AM PST (fires for 4:45 AM setting)
  - 14:00 UTC → 6:00 AM PST (fires for 5:45 AM setting)
  - 19:00 UTC → 11:00 AM PST (fires for 10:45 AM setting)
  - 20:00 UTC → 12:00 PM PST (fires for 11:45 AM setting)
  - 01:00 UTC → 5:00 PM PST (fires for 4:45 PM setting)
  - 02:00 UTC → 6:00 PM PST (fires for 5:45 PM setting)
- Each cron calls `/api/cron/email-scheduler` which checks all events for emails due within a 3-hour forward window.
- Note: During PDT (Mar–Nov), crons fire 1 hour later in Pacific Time.
- Free tier (Hobby plan — limited to daily cron frequency, max 6 cron entries).

---

## Infrastructure Constraints (READ BEFORE MAKING CHANGES)

This project runs entirely on free-tier services. The following constraints are **hard limits** that have caused failed deployments and rolled-back changes in the past. Any proposed changes to cron jobs, email sending, or hosting infrastructure **must** be validated against these limits first.

### Vercel Hobby Plan
- **Cron frequency: once per day only.** Vercel Hobby does not support hourly, sub-hourly, or any frequency more granular than daily. Attempting to deploy a `vercel.json` with a non-daily cron schedule (e.g., `*/15 * * * *` or `0 * * * *`) will cause a silent deployment failure — the deploy won't appear in the Vercel dashboard and GitHub receives no useful error message.
- **Max cron entries: 6.** The current `vercel.json` uses all 6 slots. Adding a 7th cron entry requires upgrading to Vercel Pro or removing an existing entry. Do NOT add new cron entries without removing one first.
- **Current cron architecture:** All 6 cron entries hit the same `/api/cron/email-scheduler` endpoint at different UTC hours (13:00, 14:00, 19:00, 20:00, 01:00, 02:00). The scheduler checks a time window and fires any emails that are due. This staggered single-endpoint design is the workaround for the daily-only frequency limit.
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
- **Home** (`/home`) — Golfer home page (upcoming RSVPs, My Events, unsubscribe)
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

## What's Been Built (Complete)

The following is fully implemented and running in production:

- **Foundation:** Project scaffold (Next.js, Tailwind, Supabase, Resend), registration pages (global + event-specific /join/[slug]) with URL slug field on both Create Event and Event Settings forms (auto-generated from event name), magic link login, auth callbacks, golfer home page, admin dashboard, profile settings.
- **Weekly RSVP Cycle:** Tokenized RSVP links, automated invite/reminder/confirmation/pro shop emails (configurable per event), evite-style "In" list visibility, capacity and waitlist management, admin RSVP override (post-cutoff).
- **Preferences:** Playing partner preferences (ranked 1–10, per-event, searchable dropdown with reordering). Tee time preferences (per-week on RSVP page).
- **Admin Tools:** Schedule management (8-week rolling view, Game On/No Game toggle with cancellation emails), custom email composer with templates, action items/task summary, golfer directory with search/filter (global + event-scoped), golfer detail pages with subscription management, admin "Add Golfer" (direct add), admin "Add Golfer to Game" on RSVP management page (add subscribed golfers who missed the invite cycle), configurable email schedules (6 Vercel cron slots), admin notification emails (new_registration, capacity_reached, spot_opened, low_response), event-centric admin dashboard with summary cards, per-event admin scoping, help page with Golfer + Admin FAQ. Next-game display respects event `start_date` — events with a future start date don't show games before that date.
- **Grouping Engine:** Five grouping methods: (1) Harmony — greedy heuristic with weighted partner preferences, tee time constraints, shuffle randomization; (2) Flight Foursomes — sorted by handicap, grouped by skill level; (3) Balanced ABCD Foursomes — round-robin tier distribution (one from each quartile per group); (4) Flight 2-Person Teams — adjacent handicap pairs, with similar or random foursome pairing; (5) Balanced 2-Person Teams — outside-in pairing (best+worst) for equal team totals. Handicap methods override partner/tee time preferences (with admin warning banner). Manual handicap entry on admin golfer detail pages (global + event-scoped). Handicap resolution: manual_handicap_index → handicap_index → 25.0 default. Guest-host pairing, group variety with 8-week lookback, configurable partner/tee time modes. 50+ unit tests. DB layer with team_number support, cron integration, pro shop email with grouped roster. See `docs/GROUPING_ENGINE_SPEC.md`.
- **Admin Reports:** Super-admin-only reports page (`/admin/reports`) with four reports: (1) **Golfer Engagement** — per-golfer RSVP response rates, participation rates, consecutive no-replies, ghost detection (3+ weeks unresponsive) across all events over the last 12 weeks, with filter/sort controls; (2) **Platform Activity** — login counts, page view counts, most visited pages, most active users over the last 30 days, powered by a new `activity_log` table and client-side `ActivityTracker` component; (3) **Response Timing** — distribution of how quickly golfers respond after invite emails, with median/average stats and bucket bar chart (within 1 hour, 1–4 hours, etc.) over the last 8 weeks; (4) **Profile Completeness** — identifies golfers missing GHIN numbers, phone numbers, or handicap data, with filter controls. Reports linked from admin dashboard.
- **Activity Tracking Infrastructure:** `activity_log` table (migration 020) with RLS policies. Login events logged on both OTP verification and magic link callback. Page views logged via client-side `ActivityTracker` component in root layout → `/api/activity` POST endpoint. Lightweight fire-and-forget — never blocks auth or navigation.
- **GHIN Handicap Sync:** Automated system to fetch current Handicap Index from GHIN for all golfers with a GHIN number. Uses unofficial GHIN mobile app API (`api2.ghin.com`) directly via HTTP — no npm dependency, fully patchable. Auth uses `email_or_ghin` + `password` + `token` fields. Syncs within 24 hours of each scheduled event via email-scheduler cron. Features: per-event toggle (`handicap_sync_enabled`), 20-golfer batch cap per cron run (stalest-first), 24-hour freshness window (shared across events for multi-event golfers), `handicap_sync_log` table for health monitoring, auto-alert on auth/total failure, status indicator in Event Settings. Handicap displayed on: golfer home page (My Profile section), golfer profile/edit page, admin golfer detail pages (global + event-scoped), both golfer directories (global + event-scoped, as HCP line on each row), and pro shop email (HCP column). Env vars: `GHIN_EMAIL`, `GHIN_PASSWORD` (must be set at the **Vercel project level**, not team level). Handicap history: every GHIN-synced value is recorded in the `handicap_history` table for per-golfer and group-level trend analysis. See `docs/HANDICAP_SYNC_SPEC.md`.
- **Profile Completion Nudge:** RSVP token page (`/rsvp/[token]`) detects missing profile fields (phone number, GHIN number) and displays an amber banner prompting the golfer to complete their profile. Includes privacy reassurance ("only shared with event admins and the pro shop") and a direct link to `/profile`. Disappears automatically once all required fields are filled. Designed for extensibility — additional required fields can be added to the check array. Future consideration: gate RSVP submission behind profile completion.

---

## Roadmap

### 1. ~~Grouping Engine Enhancements~~ ✅ COMPLETE
All sub-items built: repeat foursome prevention, tee time preference limits, partner preference weighting, admin partner avoidance.

### 2. ~~Admin Reports~~ ✅ COMPLETE
Super-admin-only reports page with four reports: Golfer Engagement (RSVP response/participation rates, ghost detection), Platform Activity (logins, page views, most active users), Response Timing (invite-to-response distribution), Profile Completeness (missing GHIN/phone). Includes activity_log infrastructure for login and page view tracking.

### 3. Email Template Review
Review all automated email templates (invite, reminder, golfer confirmation, pro shop detail, cancellation, admin alerts, registration notifications) to ensure copy, formatting, and links are all hitting the mark. May involve tweaks to tone, layout, or information included.

### 4. Guest Workflow
Complete the guest request system. Architecture and DB schema exist (feature-flagged OFF). Remaining work: guest request UI for golfers, admin approval/denial flow, guest confirmation emails, guest visibility in RSVP management. Guest requests table and types are already in place.

### 5. Priority Email Batching
When the distribution list approaches the Resend free-tier limit (100 emails/day), implement priority-based batching — send to the most active/likely-to-respond golfers first, remainder on the following day. Not urgent now but will be needed as events and membership grow.

### 6. Public "Who's Playing" View
Create a publicly accessible (but unlisted) page showing the current week's "In" list for an event. Unlike the existing evite-style visibility (which requires opting "In" to see the list), this would let any golfer — even before responding or after responding "Out" — see who's already committed. Uses the same first-initial-last-name format (e.g., "J. Herrera") with no sensitive data exposed. Could be a shareable link golfers text to each other when coordinating. No login required.

### 7. Weather Integration ✅ BUILT
Hyper-localized weather forecasts for game time windows, displayed on RSVP pages, Home page, and in automated emails.

**Implementation Details:**
- **API:** Open-Meteo (free, no API key, no rate limits). Endpoint: `https://api.open-meteo.com/v1/forecast`
- **Location:** FRCC exact coordinates — latitude 32.9881, longitude -117.1935 (15150 San Dieguito Rd, Rancho Santa Fe, CA 92067)
- **Game Window:** Derived from event settings: `first_tee_time` minus 30 min buffer through `first_tee_time` + game duration + 30 min buffer. 18 holes = 4.5 hours, 9 holes = 2.5 hours.
- **Event Settings Added:** `game_type` (enum: `9_holes` | `18_holes`, default `18_holes`) and `first_tee_time` (text, default `07:30`) on the events table.
- **Golfability Score:** 1–5 scale based on temperature, wind speed, precipitation probability, and severe weather codes. Labels: "Perfect Golf Weather" (5), "Great Conditions" (4), "Fair — Playable" (3), "Challenging Conditions" (2), "Severe Weather" (1).
- **Confidence Labels:** "Early Look" (5+ days out), "Updated Forecast" (3–4 days), "Game Day Forecast" (1–2 days), "Current Conditions" (game day).
- **Caching:** `weather_cache` table keyed by (event_id, game_date). Stale after 3 hours → re-fetched from API. Cache checked first on every call.
- **UI Variants:** "full" on RSVP page (golfability badge, summary stats, hourly timeline for ≤3 days out). "compact" on Home page event cards (single-row badge with temp/wind).
- **Email Integration:** Weather HTML included in invite, reminder, and golfer confirmation emails. NOT included in pro shop detail email. Non-fatal — if Open-Meteo is down, emails send without weather.
- **Key Files:** `src/lib/weather.ts` (service), `src/components/weather-forecast.tsx` (UI), `supabase/migrations/017_game_time_weather.sql` (schema), plus updates to RSVP page, Home page, email templates, cron scheduler, event settings, and create event form.

### 8. Golfer Engagement & Gamification Stats
Build a golfer-facing engagement system that incentivizes consistent RSVP responses and app usage. Ideas include: participation streaks ("You've played 8 of the last 12 weeks"), response rate scores (similar to an Uber-style rating — e.g., "Your response rate: 95%"), and badges or milestones. This data also serves an admin purpose: identifying disengaged golfers who haven't responded in X weeks so admins can reach out or eventually remove them from the distribution list. The engagement score could factor into future waitlist priority decisions.

### 9. Waitlist End-to-End Testing & Refinement
The waitlist system (capacity overflow, ranked by response time, admin manual promotion) has been built but has not been exercised in production yet. Before it sees real use, conduct a thorough end-to-end review: verify correct ordering, test admin pull-from-waitlist flow, confirm notification emails fire correctly, test edge cases (golfer switches from "In" to "Out" freeing a spot, capacity override changes mid-week, etc.). Address any gaps found.

### 10. Invite-a-Friend / Referral Registration
Allow golfers to share an event registration link that pre-identifies them as the referring golfer. When the referred person registers through this link, the admin approval screen shows who recommended them (e.g., "Referred by J. Herrera"), giving admins useful context for their approval decision. The referred golfer still goes through the standard registration and approval flow — this just adds a social trust signal. Could be as simple as appending a referral parameter to the existing `/join/[slug]` URL.

### 11. SMS / Text Notifications
Add opt-in SMS notifications alongside email for key moments in the RSVP cycle — particularly a cutoff-day text to non-responders ("RSVP closes in 2 hours — tap here to respond"). SMS has significantly higher open rates than email and could meaningfully improve response rates. Primary concern is cost. **Before building:** evaluate SMS provider pricing (Twilio, AWS SNS, etc.) for the expected volume (~30 golfers × 1-2 texts/week per event) to confirm it's manageable. If cost-effective, start with a single high-value SMS touchpoint (cutoff reminder) before expanding to other notifications.

---

## Documentation Update Standard

When the user asks to "update all product documentation" (or similar), update the following documents. This is the canonical checklist — no need to enumerate individual files each time.

### Always Update (Tier 1 — Every Enhancement)

| Document | What to Update |
|----------|---------------|
| `CLAUDE.md` | **File Map** — add/remove/rename any new or changed files. **"What's Been Built"** — add a bullet for the new feature or update existing bullets. **Roadmap** — mark completed items with ✅, add new roadmap items if applicable. **Centralized Utilities** — document any new shared functions, constants, or patterns. **Terminology** — add new terms introduced by the feature. |
| `CLAUDE_CONTEXT.md` | **"What's complete"** list — add the new feature. **"What's on the roadmap"** list — update to match CLAUDE.md roadmap. Any new **project decisions, patterns, or preferences** established during the session. |
| `src/types/events.ts` | Add/update TypeScript interfaces and types for any new database columns, API responses, or shared data structures. |
| `repomix-output.xml` | **Regenerate** by running `npx repomix --ignore "node_modules,.next,.git,public/assets,package-lock.json"` from the project root. This is a full codebase snapshot used for Gemini context — must be refreshed after any code or documentation changes. |

### Update If Feature Has a Spec (Tier 2 — Feature-Specific)

| Document | When to Update |
|----------|---------------|
| `docs/<FEATURE>_SPEC.md` | If the enhancement modifies or completes a feature that has its own spec doc (e.g., `GROUPING_ENGINE_SPEC.md`, `HANDICAP_SYNC_SPEC.md`). Update architecture, data model, modified files table, open decisions, and risks. |
| New `docs/<FEATURE>_SPEC.md` | If a **new major feature** is built (comparable in scope to the grouping engine or handicap sync), create a new spec doc following the same structure as existing specs. |

### Update If User-Facing Behavior Changed (Tier 3 — User Help)

| Document | When to Update |
|----------|---------------|
| `src/app/help/page.tsx` | If the enhancement adds new user-visible functionality, changes existing workflows, or introduces new admin capabilities that golfers or admins would have questions about. Add/update FAQ entries in the appropriate section (Golfer FAQ or Admin FAQ). |

### Update If Applicable (Tier 4 — Situational)

| Document | When to Update |
|----------|---------------|
| `CLAUDE.md` — **Database Constraints** | If new CHECK constraints, RLS policies, or notable column types are added. |
| `CLAUDE.md` — **Timezone Rules** | If new date/time handling is introduced that future developers need to be aware of. |
| `CLAUDE.md` — **Infrastructure Constraints** | If changes affect Vercel cron slots, Resend email limits, or Supabase storage. |
| `CLAUDE.md` — **Navigation Structure / Breadcrumbs** | If new pages are added or navigation hierarchy changes. |
| `supabase/migrations/` | Not documentation per se, but ensure the migration file exists and is referenced in CLAUDE.md's database section. |

### Do NOT Update (Historical / One-Time Docs)

These files are historical artifacts and should **not** be routinely updated:

- `PHASE4-REQUIREMENTS.md` — Original phase 4 requirements (completed).
- `FRCC-Structural-Audit.md` — One-time structural audit.
- `TESTING-PREFERENCES.md` — Testing session notes.
- `REFACTOR-PROGRESS.md` — Refactor tracking (completed).
- `docs/SITE_STRUCTURE.md` — Superseded by CLAUDE.md's File Map and Navigation sections.
- `docs/NAVIGATION_RESTRUCTURE.md` — One-time navigation restructure plan (completed).
