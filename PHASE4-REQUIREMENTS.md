# Phase 4: Admin Tools & Event Configuration — Requirements

## Overview

This document captures the confirmed requirements for Phase 4 of the FRCC Golf Tracker. The focus is on building the admin/super admin event configuration and management tools. Guest-related features are deferred as nice-to-haves for the MVP — the architecture supports them, but the feature flags will default to OFF.

---

## 1. Roles & Permissions

### Super Admin
- Full access to ALL events — no scoping restrictions.
- **Only super admins can create new events.**
- **Only super admins can assign/remove event admins on any event.**
- **Only super admins can toggle feature flags** (guest requests, tee time preferences, playing partner preferences, grouping algorithm). These are platform-level decisions, not per-event admin decisions — especially while features are incomplete.
- Can edit and archive/deactivate events.
- Can manage all golfers (approve, deactivate, reactivate).
- Also participates as a golfer (subscribes to events, RSVPs, appears on roster).
- There is no limit on the number of super admins.

### Event Admin
- Scoped to their assigned event(s) only.
- Can manage day-to-day settings for their assigned events: schedule (day of week, duration, capacity, email timing, alert configuration), weekly game toggles, capacity overrides, and per-week notes.
- **Cannot** create events, assign admins, or toggle feature flags — those are super admin only.
- Can manage RSVPs, waitlist, and weekly schedule for their events.
- Can approve/deny registrations for their events.
- The primary event admin's name and email are used as the "contact for questions" in automated emails and as the Reply-To address. Secondary admins are CC'd on all admin-targeted emails as a backup.
- There is no limit on the number of event admins per event.
- Also participates as a golfer.

### Golfer (Member)
- Self-service only: RSVP, profile, preferences.
- No access to admin tools or event configuration.

---

## 2. Event Configuration

An event represents a recurring game (e.g., "FRCC Saturday Morning Group"). Events can recur indefinitely or have a fixed duration.

### Event Settings

**Who can change what:**
- **Super admin only:** Event creation, admin assignments, feature flags.
- **Super admin or event admin:** All other settings below (day-to-day event configuration).

| Setting | Description | Notes |
|---------|-------------|-------|
| **Name** | Event display name | e.g., "FRCC Saturday Morning Group" |
| **Description** | Short description | Shown on dashboard and in emails |
| **Frequency** | Weekly, bi-weekly, or monthly | Determines schedule generation |
| **Day of Week** | Which day the game occurs | e.g., Saturday = 6 |
| **Duration Mode** | How the event's lifespan is defined | One of three options (see below) |
| **Default Capacity** | Standard weekly maximum player cap | e.g., 16 (4 foursomes). Can be overridden per week. |
| **Minimum Players** | Minimum registrants for the game to proceed | e.g., 8 — triggers low-response admin alert if not met. Can be overridden per week. |
| **Timezone** | Timezone for all schedule calculations | Default: America/Los_Angeles (Pacific) |

#### Duration Modes

Admin selects one of three options when creating or editing an event:

| Mode | Description | Behavior |
|------|-------------|----------|
| **Fixed Number of Weeks** | Event runs for a set number of weeks (e.g., 10) | System calculates end date from start + weeks. Stops generating schedules after that. |
| **Specific End Date** | Event runs until a defined date | Admin picks a calendar date. System stops generating schedules after that date. |
| **Ongoing (Indefinite)** | Event recurs with no end date | Runs until manually deactivated by an admin. |

In all modes, admins can manually deactivate an event at any time.

#### Per-Week Overrides

For each individual game week, admins can override:
- **Capacity** — increase or decrease from the event default (e.g., 20 one week, 12 another).
- **Minimum players** — adjust the threshold for that specific week.
- **Status** — toggle Game On / No Game (cancel a week).
- **Admin notes** — add a note that appears in invite/confirmation emails.

### Email Schedule Settings

All times use day-of-week + time-of-day format (e.g., Monday at 10:00 AM PT).

| Setting | Description | Default |
|---------|-------------|---------|
| **Invite Day/Time** | When weekly invite emails are sent | Monday 10:00 AM PT |
| **Number of Reminders** | How many reminder emails to send (0–3) | 1 |
| **Reminder 1 Day/Time** | First reminder | Thursday 10:00 AM PT |
| **Reminder 2 Day/Time** | Second reminder (if enabled) | — |
| **Reminder 3 Day/Time** | Third reminder (if enabled) | — |
| **RSVP Cutoff Day/Time** | When self-service RSVP locks | Friday 10:00 AM PT |
| **Confirmation Day/Time** | When confirmation emails are sent | Friday 1:00 PM PT |

### Feature Flags (per event, **super admin only**)

These features are architecturally supported but **all default to OFF for MVP**. They should remain off until each feature is fully built, tested, and deployed to production. Only super admins can toggle these — event admins cannot change feature flags.

| Flag | Description | Default |
|------|-------------|---------|
| **Allow Guest Requests** | Members can request to bring guests | OFF |
| **Allow Tee Time Preferences** | Golfers can indicate early/late preference | OFF |
| **Allow Playing Partner Preferences** | Golfers can select preferred partners | OFF |
| **Allow Grouping Algorithm** | Admin can select automated grouping method | OFF (future feature — no UI needed yet) |

### Pro Shop Contacts
- Multiple email addresses per event.
- Receive the detailed Friday confirmation email with full player info.
- Configurable by event admin.

### Event Admin Assignments (super admin only)
- **Only super admins** can assign or remove event admins.
- At least one primary admin per event (used as Reply-To and contact for questions).
- Optional secondary admins — CC'd on all admin-targeted communications as a default, providing coverage when the primary admin is unavailable.
- An admin can be assigned to multiple events.

---

## 3. Admin Alerts

Each alert type is individually toggleable per event. New events get sensible defaults.

| Alert Type | Description | Default |
|------------|-------------|---------|
| **New Registration** | Email admins when a new golfer registers and needs approval | ON |
| **RSVP Capacity Reached** | Email when game hits capacity (waitlist forming) | ON |
| **Spot Opened** | Email when a confirmed player drops out, creating an opening | OFF |
| **Low Response Warning** | Email admins when confirmed count is below the minimum player threshold | ON |

### Alert Delivery
- Alerts are sent via email to the primary event admin, with secondary admins and super admins CC'd.
- **All admin-targeted emails default to CC: secondary admins** so there is coverage when the primary admin is traveling or otherwise unavailable.

### Low Response Alert Configuration
The low response alert is configurable per event (by super admin or event admin):
- **On/Off toggle** (default: ON)
- **Trigger day and time** — specific day-of-week + time-of-day when the system checks if the minimum player threshold has been met (default: Thursday 5:00 PM PT — giving admins time to act before Friday cutoff)
- The alert fires if confirmed ("In") count is below the event's minimum player threshold at the configured check time.

---

## 4. Schedule Management

### Pre-Generated Schedules
- System pre-generates schedules up to 8 weeks ahead of the current date (fixed maximum).
- Schedule generation runs automatically (via cron or on admin dashboard load).
- Each schedule row represents a single game date with:
  - Game date
  - Status: "scheduled" or "cancelled" (Game On / No Game toggle)
  - Capacity override (NULL = use event default)
  - Admin notes (optional per-week note that appears in invite/confirmation emails)
  - Tracking flags: invite_sent, reminder_sent, confirmation_sent

### Admin Schedule View
- Rolling view showing all pre-generated weeks.
- For each week, admin can:
  - Toggle Game On / No Game (cancel a week).
  - Override capacity for that specific week.
  - Add a per-week note (e.g., "Cart path only this week", "Shotgun start at 8 AM").
- Cancelled weeks: If toggled off before the invite send time, system sends a "No Game" notification instead of the regular invite.

---

## 5. Admin Dashboard Improvements

### Current State (already built)
- Action items banner (pending registrations, pending guest requests)
- Stats cards (active members, pending, events, upcoming games)
- Pending registrations with approve/deny
- Active/deactivated members lists
- Upcoming games with RSVP counts and drill-down

### Additions for Phase 4

#### Member Directory Enhancement
- Add search functionality (search by name, email, GHIN).
- Add filter by status (active, pending, deactivated).
- Sortable columns.

#### Event Settings Page (`/admin/events/[eventId]/settings`)
- Form-based UI for all event settings from Section 2 above.
- Alert configuration toggles (per-event).
- Pro shop contact management (add/remove emails).
- "Deactivate Event" option (stops all automated emails, hides from golfer subscriptions).
- **Super admin only sections** (hidden for event admins):
  - Feature flag toggles.
  - Event admin assignment (add/remove from golfer list).

#### Create Event Page (`/admin/events/new`) — Super Admin Only
- Form to create a new event with all required settings.
- Select duration mode, set schedule, assign initial admins.

#### Schedule Management Page (`/admin/events/[eventId]/schedule`)
- Rolling schedule view per event.
- Game On/Off toggles, capacity overrides, admin notes per week.
- Visual indicators for capacity fill rate.

---

## 6. Custom Email Composer

### Ad-Hoc Emails (admin-triggered)
- Compose and send targeted emails to specific RSVP categories for a given week:
  - All "In" golfers
  - All "Not Sure" + "No Response"
  - All "Out"
  - Waitlisted
  - Everyone (full distribution list)
- Pre-built templates:
  - **Game Cancelled**: "[Event] for [Date] has been cancelled due to [reason]. Next game: [Date]."
  - **Extra Spots Available**: "We still have [X] spots open for [Date]!"
  - **Weather Advisory**: "Weather update for [Date]: [details]. Game is still on."
  - **Course Update**: "Update for [Date]: [details]."
- Free-form "Compose Custom Message" option.
- Template infrastructure supports adding more templates over time.

### Automated Email Templates
- The standard automated emails (invite, reminder, confirmation, pro shop) use built-in templates.
- No admin customization of automated email templates is needed for MVP — the templates as-built cover 90%+ of needs.
- The per-week admin note (from schedule management) is the mechanism for adding weekly context to automated emails.

---

## 7. Schema Changes Required

Based on these requirements, the following database changes are needed:

### Events Table — New/Modified Columns
- `duration_mode` (text, default 'indefinite') — one of: 'fixed_weeks', 'end_date', 'indefinite'
- `duration_weeks` (integer, nullable) — number of weeks if duration_mode = 'fixed_weeks'
- `start_date` (date, nullable) — used with fixed_weeks to calculate end date
- `end_date` (date, nullable) — explicit end date if duration_mode = 'end_date', or calculated if 'fixed_weeks'
- `min_players` (integer, nullable) — minimum player threshold for low-response alerts
- `num_reminders` (integer, default 1) — number of reminder emails (0–3)
- `reminder2_day` / `reminder2_time` — second reminder schedule
- `reminder3_day` / `reminder3_time` — third reminder schedule

### Event Schedules Table — New/Modified Columns
- `admin_notes` (text, nullable) — already exists, will be used for per-week notes displayed in emails
- `min_players_override` (integer, nullable) — per-week override of event minimum player threshold

### New Table: `event_alert_settings`
- `event_id` (FK to events)
- `alert_type` (text: 'new_registration', 'capacity_reached', 'spot_opened', 'low_response')
- `is_enabled` (boolean)
- `config` (jsonb, nullable) — for alert-specific config (e.g., low_response: { day: 4, time: '17:00' })

### Removed
- `schedule_lookahead_weeks` — no longer needed; fixed at 8 weeks maximum

---

## 8. What's Deferred (Not in Phase 4)

- **Grouping algorithm** — future feature flag, no UI needed yet.
- **Event cloning** — manual setup is fine for the small number of events.
- **SMS/text notifications** — future paid service.
- **GHIN API integration** — future enhancement.
- **Custom email sending domain** — using Resend default for now.
- **Priority-based invite batching** — not needed until distribution exceeds 100/day.
- **Participation history/reporting** — data is being collected; reporting UI is Phase 5.
- **UI/UX branding** — separate pass (user to provide Fairbanks Ranch assets later).

---

## 9. Implementation Approach

### Build Order (suggested)
1. **Schema migration** — add new columns and alert settings table.
2. **Event Settings page** — the core configuration UI.
3. **Schedule management** — pre-generation logic + admin schedule view.
4. **Multiple reminders** — update cron job to support 0–3 reminders per event.
5. **Per-week admin notes** — integrate into invite/confirmation email templates.
6. **Admin alerts** — alert triggers + email delivery.
7. **Member directory** — search and filter enhancements.
8. **Custom email composer** — templates + free-form targeting.
9. **Minimum player threshold** — low-response warning logic.
10. **Testing & verification** — end-to-end testing of the full weekly cycle with new features.
