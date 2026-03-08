# FRCC Golf Games — Site Structure & Navigation

> **Last updated:** March 7, 2026
> This document describes the current page hierarchy, navigation, and URL routes.
> Keep this file in sync with any structural changes to the app.

---

## Top-Level Navigation (Header)

### Golfer View
```
[Logo] FRCC Golf Games          Home · Help · 🔔 · Sign Out
```

### Admin View (super admin or event admin)
```
[Logo] FRCC Golf Games          Home · Admin · Help · 🔔 · Sign Out
```

- **Home** → `/dashboard` (golfer dashboard)
- **Admin** → `/admin` (admin home — visible to admins only)
- **Help** → `/help`
- **🔔** → Push notification toggle
- **Sign Out** → `/auth/signout`

"Profile" is accessible from the Home page (not in the top nav).

---

## Golfer Pages

### Home (`/dashboard`)
- Welcome message + status badge
- Next Game hero card (nearest upcoming game, RSVP CTA)
- More Upcoming Games (cards for remaining games)
- My Events (subscription management with unsubscribe)
- My Profile summary card (→ link to `/profile`)

### My Profile (`/profile`)
- Personal Info: first name, last name, email, phone, GHIN
- Playing Partner Preferences (per-event):
  - Each subscribed event shown as collapsible section
  - Ranked partner list 1–10 per event
  - Search dropdown scoped to golfers in that event only

### Help (`/help`)
- Golfer FAQ (expandable/collapsible sections)
- Admin FAQ (visible to admins only, expandable/collapsible)

### RSVP (`/rsvp/[token]`)
- Tokenized, no-login-required RSVP page
- One-tap: I'm In / I'm Out / Not Sure
- Guest request form
- Tee time preference selector

---

## Admin Pages

### Admin Home (`/admin`)
- **Super admins** see: global section (All Golfers link, + Create Event) + event summary cards for all events
- **Event admins** see: event summary cards for assigned events only

Each event card shows: event name, next game date, confirmed/capacity, pending approvals count, pending guest requests count, action-needed badge, and a "Manage →" button.

### Global Golfer Directory (`/admin/golfers`) — Super Admin Only
- All golfers across all events
- Search, filter by status + event, sort
- `+ Add Golfer` with multi-event subscription picker
- Manage → `/admin/golfers/[golferId]` (global detail with all-event subscriptions)

### Event Dashboard (`/admin/events/[eventId]`)
- Breadcrumb: Admin > [Event Name]
- Event context bar with event switcher dropdown
- Summary metrics: Active Golfers, This Week (confirmed/capacity), Pending Approvals, Pending Guests
- Action Required: pending registrations (approve/deny), pending guest requests
- Upcoming Games: next 4 weeks with capacity bars, links to RSVP management
- Quick Links: Golfer Directory, Event Settings, Manage Schedule, Send Email

### Event Golfer Directory (`/admin/events/[eventId]/golfers`)
- Breadcrumb: Admin > [Event Name] > Golfer Directory
- Golfers subscribed to this event only
- Search, filter (All/Active/Pending/Deactivated), sort
- `+ Add Golfer` → auto-subscribes to this event
- Manage → event-scoped golfer detail

### Event Golfer Detail (`/admin/events/[eventId]/golfers/[golferId]`)
- Breadcrumb: Admin > [Event Name] > Golfer Directory > [Name]
- Global profile info (name, email, phone, GHIN)
- Event-specific actions: remove from event
- Approve/deny/deactivate/reactivate as appropriate

### RSVP Management (`/admin/events/[eventId]/rsvp/[scheduleId]`)
- Full RSVP breakdown: In, Out, Not Sure, No Response, Waitlisted
- Admin override controls (post-cutoff changes)
- Guest approval/denial controls

### Event Settings (`/admin/events/[eventId]/settings`)
- Event name, description, slug, capacity, frequency
- Admin assignments (primary/secondary)
- Pro shop contacts
- Email schedule configuration
- Feature flags (guests, tee time prefs, partner prefs)

### Schedule Management (`/admin/events/[eventId]/schedule`)
- 4-week rolling view
- Game On / No Game toggle per week
- Per-week capacity override

### Email Composer (`/admin/events/[eventId]/email/compose`)
- Target audience selector (all In, all not responded, everyone, etc.)
- Pre-built templates (cancelled, extra spots, weather, course update)
- Free-form custom message option

### Create Event (`/admin/events/new`) — Super Admin Only
- New event creation form

---

## URL Route Map

### Public Routes
| Route | Page |
|---|---|
| `/` | Landing page |
| `/login` | Magic link login |
| `/join` | Generic self-registration |
| `/join/[slug]` | Event-specific self-registration |
| `/rsvp/[token]` | Tokenized RSVP (no login) |
| `/install` | PWA install page |

### Golfer Routes (authenticated)
| Route | Page |
|---|---|
| `/dashboard` | Home (nav label: "Home") |
| `/profile` | My Profile + per-event playing partner preferences |
| `/preferences` | Redirects to `/profile` |
| `/help` | Help (Golfer FAQ + Admin FAQ) |

### Admin Routes
| Route | Page | Access |
|---|---|---|
| `/admin` | Admin Home (event summary cards) | All admins |
| `/admin/golfers` | Global Golfer Directory | Super admin |
| `/admin/golfers/add` | Add Golfer (multi-event picker) | Super admin |
| `/admin/golfers/[golferId]` | Golfer Detail (global context) | Super admin |
| `/admin/events/new` | Create Event | Super admin |
| `/admin/events/[eventId]` | Event Dashboard | Event access |
| `/admin/events/[eventId]/golfers` | Event Golfer Directory | Event access |
| `/admin/events/[eventId]/golfers/add` | Add Golfer to Event | Event access |
| `/admin/events/[eventId]/golfers/[golferId]` | Golfer Detail (event context) | Event access |
| `/admin/events/[eventId]/rsvp/[scheduleId]` | RSVP Management | Event access |
| `/admin/events/[eventId]/settings` | Event Settings | Event access |
| `/admin/events/[eventId]/schedule` | Schedule Management | Event access |
| `/admin/events/[eventId]/email/compose` | Email Composer | Event access |

**Access levels:**
- **Super admin** = full access to everything
- **Event access** = super admin OR assigned event admin for that specific event

### Legacy Redirects
| Old Route | Redirects To |
|---|---|
| `/admin/members` | `/admin/golfers` |
| `/admin/members/add` | `/admin/golfers/add` |
| `/admin/members/[id]` | `/admin/golfers/[id]` |
| `/preferences` | `/profile` |

---

## Navigation Components

### Breadcrumbs
All admin sub-pages display breadcrumb navigation. Examples:
- `Admin` → Admin Home
- `Admin > Saturday Morning` → Event Dashboard
- `Admin > Saturday Morning > Golfer Directory` → Event Golfer Directory
- `Admin > Saturday Morning > Golfer Directory > J. Herrera` → Golfer Detail
- `Admin > All Golfers` → Global Golfer Directory

### Event Context Bar
Appears on all `/admin/events/[eventId]/*` pages. Shows:
- Current event name
- Event switcher dropdown (lists other events the admin manages)
- Switching preserves the sub-path (e.g., golfers → golfers in other event)

---

## Permission Hierarchy

| Role | Can See | Can Manage |
|---|---|---|
| **Super Admin** | All events, global golfer directory, create event | Everything |
| **Event Admin** | Assigned events only | Golfers, RSVPs, schedule, emails for assigned events |
| **Golfer** | Home, Profile, Help, RSVP pages | Own profile, own preferences, own RSVP responses |
