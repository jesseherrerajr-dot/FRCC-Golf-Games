# Navigation & Page Structure Restructure (Archived)

> **Status:** ✅ Implemented — March 7, 2026
> **Current reference:** See `docs/SITE_STRUCTURE.md` for the live site structure.
> This document is retained as a historical record of the restructure planning.

## Summary of Changes

This document defined the new top-level menu, page hierarchy, and navigation flow for the FRCC Golf Games platform. The restructure was driven by two goals:

1. **Multi-event readiness** — The admin experience shifts from a single flat dashboard to an event-centric model where each event has its own golfer directory, RSVP management, schedule, and settings.
2. **Nomenclature simplification** — All references to "Member" are replaced with "Golfer" across the entire platform (UI, code, documentation, email templates).

---

## Global Nomenclature Change: "Member" → "Golfer"

All user-facing and code-level references to "Member" will be replaced with "Golfer." This includes:

- UI labels and copy (e.g., "Member Directory" → "Golfer Directory", "Active Members" → "Active Golfers")
- Navigation items and page titles
- Email templates (invite, reminder, confirmation, admin alerts)
- Code: variable names, function names, comments, type definitions
- Documentation (CLAUDE.md, help content, inline docs)
- URL paths (e.g., `/admin/members` → `/admin/golfers`)

**Not changing:** Database table and column names remain as-is (`profiles`, `event_subscriptions`, etc.) since they don't reference "member" in the schema. If any DB comments reference "member," those will be updated.

---

## Top-Level Navigation (Header)

### Golfer View (non-admin users)
```
[Logo] FRCC Golf Games          Home · Help · 🔔 · Sign Out
```

### Admin View (super admin or event admin)
```
[Logo] FRCC Golf Games          Home · Admin · Help · 🔔 · Sign Out
```

### Changes from Current
| Current Nav Item | New Nav Item | Notes |
|---|---|---|
| Dashboard | Home | Renamed to "Home" (less corporate, more friendly) |
| Profile | *(removed from nav)* | Accessed from within Home page |
| Admin | Admin | Unchanged |
| Help | Help | Unchanged |
| 🔔 Push Toggle | 🔔 Push Toggle | Unchanged |
| Sign Out | Sign Out | Unchanged |

---

## Page Structure — Golfer Pages

### 1. Home (`/dashboard`)

*URL stays `/dashboard` internally but nav label changes to "Home."*

```
Home
├── Welcome [First Name]
│
├── Next Game (hero card)
│   └── Nearest upcoming game across all subscribed events
│       ├── Event name, date, day of week
│       ├── Current RSVP status badge
│       └── "Tap to Respond" CTA button
│
├── More Upcoming Games
│   └── Cards for remaining upcoming games (all subscribed events)
│       └── Each shows: event name, date, RSVP status, respond link
│
├── My Events
│   ├── [Event 1] — Subscribed ✓  [Unsubscribe]
│   └── [Event 2] — Subscribed ✓  [Unsubscribe]
│
└── My Profile (card with summary + "Edit" link)
    ├── Name, email, phone, GHIN displayed
    └── Edit → navigates to /profile (personal info + playing partner preferences)
```

### 2. My Profile (`/profile`)

*Accessed from the Home page "Edit" link. No longer in top-level nav.*

```
My Profile
├── Personal Info
│   ├── First name (editable)
│   ├── Last name (editable)
│   ├── Email (display only — verified)
│   ├── Phone (editable)
│   └── GHIN number (editable)
│
└── Playing Partner Preferences
    ├── [Event 1] tab/section
    │   └── Ranked partner list 1–10
    │       └── Search dropdown shows only golfers subscribed to Event 1
    └── [Event 2] tab/section
        └── Ranked partner list 1–10
            └── Search dropdown shows only golfers subscribed to Event 2
```

**Key change:** Playing partner preferences move from the standalone `/preferences` page into the `/profile` page as a single, unified location. There is no separate preferences page — everything lives on one profile page. Preferences are scoped per-event: a golfer sees separate preference lists for each event they're subscribed to (organized by event tabs/sections), and the partner search only shows golfers from that same event. The old `/preferences` route will redirect to `/profile`.

### 3. Help (`/help`)

```
Help
├── Golfer FAQ (expandable/collapsible sections with up/down arrows)
│   ├── How do I RSVP for a game?
│   ├── How do I change my response?
│   ├── How do I update my profile?
│   ├── How do I set playing partner preferences?
│   ├── How do I bring a guest?
│   ├── How do I unsubscribe from an event?
│   └── ... (more questions)
│
└── Admin FAQ (only visible to super admin and event admins)
    ├── How do I approve a new golfer?
    ├── How do I cancel a game?
    ├── How do I manage the schedule?
    ├── How do I send a custom email?
    ├── How do I add a golfer directly?
    └── ... (more questions)
```

### 4. RSVP Page (`/rsvp/[token]`) — Unchanged

The tokenized RSVP page is accessed via email links (no login required). No structural changes needed.

---

## Page Structure — Admin Pages

### Admin Home (`/admin`)

The admin home is a **summary card layout** — each event the admin manages appears as a compact card with key metrics. The admin clicks into an event to access its full management tools.

```
Admin Home
│
├── Global Section (super admin only)
│   ├── All Golfers → link to /admin/golfers (global directory)
│   └── + Create New Event → link to /admin/events/new
│
├── [Event 1 Card]
│   ├── Event name + next game date
│   ├── Key metrics:
│   │   ├── Confirmed: 12/16
│   │   ├── Pending Approvals: 2
│   │   └── Pending Guest Requests: 1
│   ├── Action needed badge (if pending items exist)
│   └── [Manage →] button → navigates to /admin/events/[eventId]
│
├── [Event 2 Card]
│   └── (same structure)
│
└── ...
```

**Visibility rules:**
- Super admins see ALL events + the Global Section
- Event admins see ONLY events they are assigned to (no Global Section)
- "+" Create Event is super admin only

### Event Dashboard (`/admin/events/[eventId]`)

*This is a NEW page — the main management hub for a single event.*

```
Event Dashboard: [Event Name]
│
├── Breadcrumb: Admin > [Event Name]
├── Event Context Banner: "[Event Name]" with event color/icon
│
├── Summary Metrics (stat cards across the top)
│   ├── Active Golfers: 28
│   ├── This Week: 14/16 confirmed
│   ├── Pending Approvals: 2
│   └── Pending Guests: 1
│
├── Action Required (alert banner, shown only if items exist)
│   ├── Pending Registrations
│   │   └── Inline approve/deny (same as current admin dashboard)
│   └── Pending Guest Requests
│       └── Inline approve/deny or "Review" link
│
├── Upcoming Games (next 4 weeks)
│   ├── [Week 1] — date, confirmed/capacity bar → link to RSVP management
│   ├── [Week 2] — date, confirmed/capacity bar
│   ├── [Week 3] — date, confirmed/capacity bar
│   └── [Week 4] — date, confirmed/capacity bar
│
├── Quick Links
│   ├── Golfer Directory → /admin/events/[eventId]/golfers
│   ├── Event Settings → /admin/events/[eventId]/settings
│   ├── Manage Schedule → /admin/events/[eventId]/schedule
│   └── Send Email → /admin/events/[eventId]/email/compose
│
└── Event switcher (dropdown or links to other assigned events)
```

### Event Golfer Directory (`/admin/events/[eventId]/golfers`)

*Replaces current `/admin/members`. Scoped to golfers subscribed to this event.*

```
Golfer Directory: [Event Name]
│
├── Breadcrumb: Admin > [Event Name] > Golfer Directory
│
├── + Add Golfer (button → /admin/events/[eventId]/golfers/add)
│   └── Auto-subscribes new golfer to this event
│
├── Search (wildcard search across name, email, phone, GHIN)
│
├── Filters
│   ├── All
│   ├── Active
│   ├── Pending
│   └── Deactivated
│
├── Sort By (name, date joined, status)
│
└── Golfer List (table/cards)
    └── Each row: name, email, phone, GHIN, status, [Manage] link
        └── Manage → /admin/events/[eventId]/golfers/[golferId]
```

### Golfer Detail (`/admin/events/[eventId]/golfers/[golferId]`)

*Replaces current `/admin/members/[memberId]`. Shown within event context.*

```
Golfer Detail: [Golfer Name]
│
├── Breadcrumb: Admin > [Event Name] > Golfer Directory > [Golfer Name]
│
├── Profile Info (name, email, phone, GHIN, status, registration date)
│
├── Actions
│   ├── Approve (if pending)
│   ├── Deactivate / Reactivate
│   └── Remove from event / Delete entirely (super admin only)
│
├── Event Subscriptions (toggles for all events — super admin only)
│
└── RSVP History (for this event)
```

### Global Golfer Directory (`/admin/golfers`) — Super Admin Only

*NEW page. Shows ALL golfers across all events.*

```
All Golfers
│
├── Breadcrumb: Admin > All Golfers
│
├── + Add Golfer (button → /admin/golfers/add)
│   └── Shows subscription picker: choose which event(s) to subscribe to
│
├── Search (wildcard across name, email, phone, GHIN)
│
├── Filters
│   ├── All / Active / Pending / Deactivated
│   └── By Event: [Event 1] [Event 2] [All]
│
├── Sort By (name, date joined, status, event)
│
└── Golfer List
    └── Each row: name, email, status, subscribed events, [Manage] link
        └── Manage → /admin/golfers/[golferId] (global context)
```

### RSVP Management (`/admin/events/[eventId]/rsvp/[scheduleId]`)

*Same as current `/admin/rsvp/[scheduleId]` but now under event-scoped URL.*

No structural changes to the page content — this already works well. Just moves under the event-scoped URL.

### Event Settings (`/admin/events/[eventId]/settings`) — Already exists

No structural changes needed.

### Schedule Management (`/admin/events/[eventId]/schedule`) — Already exists

No structural changes needed.

### Email Composer (`/admin/events/[eventId]/email/compose`) — Already exists

No structural changes needed.

### Create Event (`/admin/events/new`) — Already exists, super admin only

No structural changes needed. Access restricted to super admins.

---

## URL Route Map

### Golfer Routes
| Route | Page | Change |
|---|---|---|
| `/dashboard` | Home (Golfer Home) | Label change only |
| `/profile` | My Profile + Preferences | Now includes per-event preferences |
| `/preferences` | *(redirect to /profile)* | Merged into profile page |
| `/help` | Help (Golfer + Admin FAQ) | Restructured with expandable sections |
| `/rsvp/[token]` | RSVP Page | No change |

### Admin Routes
| Route | Page | Change |
|---|---|---|
| `/admin` | Admin Home (event summary cards) | **Redesigned** — event cards, not flat dashboard |
| `/admin/golfers` | All Golfers (super admin) | **New** — global golfer directory |
| `/admin/golfers/add` | Add Golfer (global) | **New** — add with subscription picker |
| `/admin/golfers/[golferId]` | Golfer Detail (global) | **New** — global context golfer detail |
| `/admin/events/new` | Create Event | No change (restrict to super admin) |
| `/admin/events/[eventId]` | Event Dashboard | **New** — per-event management hub |
| `/admin/events/[eventId]/golfers` | Event Golfer Directory | **New** — replaces `/admin/members` |
| `/admin/events/[eventId]/golfers/add` | Add Golfer to Event | **New** — auto-subscribes to event |
| `/admin/events/[eventId]/golfers/[golferId]` | Golfer Detail (event context) | **New** — replaces `/admin/members/[memberId]` |
| `/admin/events/[eventId]/rsvp/[scheduleId]` | RSVP Management | **Moved** from `/admin/rsvp/[scheduleId]` |
| `/admin/events/[eventId]/settings` | Event Settings | No change |
| `/admin/events/[eventId]/schedule` | Schedule Management | No change |
| `/admin/events/[eventId]/email/compose` | Email Composer | No change |

### Deprecated Routes (redirect to new locations)
| Old Route | Redirects To |
|---|---|
| `/admin/members` | `/admin/golfers` |
| `/admin/members/add` | `/admin/golfers/add` |
| `/admin/members/[id]` | `/admin/golfers/[id]` |
| `/admin/rsvp/[scheduleId]` | `/admin/events/[eventId]/rsvp/[scheduleId]` (requires lookup) |
| `/preferences` | `/profile` |

---

## Navigation Patterns

### Breadcrumbs
All admin sub-pages display breadcrumb navigation:
- `Admin` → Admin Home
- `Admin > Saturday Morning` → Event Dashboard
- `Admin > Saturday Morning > Golfer Directory` → Event Golfer Directory
- `Admin > Saturday Morning > Golfer Directory > J. Herrera` → Golfer Detail
- `Admin > All Golfers` → Global Golfer Directory

### Event Context Indicator
When inside an event's pages, a persistent banner or badge shows the event name so admins always know which event context they're in.

### Event Switcher
Within event sub-pages, a dropdown or link set allows quick navigation to the same view in another event (e.g., jump from Saturday Morning's Golfer Directory to Thursday League's Golfer Directory).

### Mobile Considerations
The header nav items (Home, Admin, Help, 🔔, Sign Out) fit comfortably in a horizontal layout. If future additions make it tight, secondary items (Help, Sign Out) can move into a hamburger/overflow menu.

---

## Implementation Phases

### Phase A — Nomenclature Change
1. Replace all "Member" → "Golfer" references across UI, code, docs, email templates
2. Update URL paths (`/admin/members` → `/admin/golfers`)
3. Add redirects from old URLs
4. Update CLAUDE.md and all documentation

### Phase B — Golfer Page Restructure
1. Rename "Dashboard" nav label to "Home"
2. Remove "Profile" from top-level nav
3. Merge playing partner preferences into the profile page (per-event scoping)
4. Redirect `/preferences` to `/profile`
5. Restructure Help page with expandable Golfer FAQ + Admin FAQ sections

### Phase C — Admin Restructure
1. Create new Event Dashboard page (`/admin/events/[eventId]`)
2. Create event-scoped Golfer Directory (`/admin/events/[eventId]/golfers`)
3. Create event-scoped Add Golfer (`/admin/events/[eventId]/golfers/add`)
4. Build shared Golfer Detail component (global profile + context-specific sections)
5. Create event-scoped Golfer Detail (`/admin/events/[eventId]/golfers/[golferId]`)
6. Create global Golfer Directory (`/admin/golfers`) — super admin only
7. Create global Golfer Detail (`/admin/golfers/[golferId]`) — super admin only
8. Move RSVP management under event-scoped URL
9. Redesign Admin Home as event summary cards
10. Add breadcrumb navigation component
11. Add event context indicator
12. Add event switcher widget
13. Add redirects from all deprecated routes
14. Restrict "+ Create Event" to super admin only

### Phase D — Link & Template Audit
1. Audit all email templates in `src/lib/email-templates.ts` for hardcoded URLs and update to new routes
2. Audit admin alert emails in `src/lib/admin-alerts.ts` for member/golfer references and URLs
3. Update all documentation (CLAUDE.md, help content, inline code comments)
4. Verify all in-app navigation links (buttons, cards, quick links) point to new routes
5. Test all deprecated route redirects work correctly
6. Verify email links resolve properly end-to-end

---

## Design Decisions (Resolved)

1. **Playing partner preferences are per-event.** Preferences are a child relationship to the event. Each event has different golfers, so the golfer customizes their ranked partner list per-event, selecting only from golfers subscribed to that specific event. The preferences section lives within the profile page, organized by event tabs/sections.

2. **Golfer Detail is a shared component with context.** Profile data (name, email, phone, GHIN) is global — it doesn't change per event. We build ONE shared Golfer Detail component used in both contexts:
   - **Event context** (`/admin/events/[eventId]/golfers/[golferId]`): Shows global profile info + event-specific details (RSVP history for that event, subscription status, event-scoped actions like "remove from this event").
   - **Global context** (`/admin/golfers/[golferId]`): Shows global profile info + all event subscriptions with toggles, cross-event actions (deactivate entirely, delete account).

3. **All links updated across the platform.** As part of implementation, all email templates, documentation, hardcoded links, and communication templates will be audited and updated to use the new URL structure. Deprecated URLs will have redirects as a safety net, but no template or doc should reference old paths after the migration.
