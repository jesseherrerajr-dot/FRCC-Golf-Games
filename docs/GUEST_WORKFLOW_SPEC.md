# Guest Workflow — Implementation Spec

**Status:** In progress — building on existing foundation (DB schema, golfer UI, admin approval UI)
**Date:** May 7, 2026
**Owner:** Jesse Herrera

---

## 1. Purpose

Allow golfers to request guests for specific weekly events. Admins review and approve or deny requests via one-click email links or the app. The system ensures the pro shop and admins stay informed throughout the process.

---

## 2. User Roles & Interactions

| Role | What They Do |
|------|-------------|
| **Golfer (Member)** | Requests a guest via the RSVP page. Provides guest name (required), email, phone, GHIN (optional). Receives approval/denial notification. |
| **Event Admin** | Receives immediate email alert on new guest request. Approves or denies via one-click email link or in-app. Gets "reply-all" style notification when any admin acts. Receives pending request reminder before cutoff. |
| **Super Admin** | Same as event admin for events they manage. Can configure guest settings (toggle, limits) for any event. |
| **Guest** | Not a platform user. Receives confirmation email only if their email was provided and request was approved. Never receives denial emails. |
| **Pro Shop** | Not involved in approval (for now). Sees approved guests in the weekly suggested groupings email as already implemented. |

---

## 3. Configuration (Admin Setup)

### 3.1 Feature Toggle

- **Setting:** `allow_guest_requests` (boolean) on the `events` table.
- **Location:** Event Settings → Feature Flags (super admin only).
- **Behavior:**
  - **ON:** Guest request form visible to golfers on the RSVP page (when "In" and before cutoff). Admin must select max guests per week (1, 2, or 3) as part of enabling.
  - **OFF:** Guest request form hidden. No new guest requests accepted. Existing pending requests remain in the system for admin action.

### 3.2 Guest Limit Per Week

- **Setting:** `max_guests_per_week` (smallint) on the `events` table.
- **Values:** 1, 2, or 3. Default: 1.
- **Scope:** Per golfer, per week, per event.
- **Enforcement:** Server-side validation counts pending + approved requests for the golfer for that week. Denied requests do not count against the limit.
- **UI:** Presented as a required selector (radio buttons or dropdown) when the guest requests toggle is turned ON. Not shown when toggle is OFF.

---

## 4. Guest Request Flow

### 4.1 Golfer Submits Request

**Preconditions:**
- Golfer has RSVP'd "In" for the week.
- Event has `allow_guest_requests = true`.
- RSVP cutoff has not passed (OR golfer is viewing before cutoff — existing behavior).
- Golfer has not exceeded `max_guests_per_week` for this week.

**Form Fields:**

| Field | Required | Notes |
|-------|----------|-------|
| Guest First Name | Yes | |
| Guest Last Name | Yes | |
| Guest Email | No | If provided, guest receives approval confirmation email. |
| Guest Phone | No | Displayed in admin views and suggested groupings email if provided. |
| Guest GHIN | No | If missing on approval, triggers GHIN follow-up (see §5.3). |

**Past Guest Auto-Fill:**
- "Select a Previous Guest" dropdown (already built).
- Auto-fills ALL known fields (name, email, phone, GHIN) from the most recent request for that guest.
- Golfer can edit any pre-filled values before submitting.
- Deduplication by guest email (most recent request wins).

**On Submit:**
- Guest request inserted into `guest_requests` table with `status = 'pending'`.
- Unique `approval_token` generated and stored (UUID, used for email-based approve/decline).
- Admin notification email sent immediately (see §5.1).

### 4.2 Golfer View

After submission, the golfer sees their guest requests with status badges:
- ⏳ **Pending** — awaiting admin decision.
- ✓ **Approved** — guest is confirmed for the week.
- ✗ **Denied** — request was not approved.

Remaining guest slots displayed (e.g., "1 of 2 guest slots remaining").

---

## 5. Email Flows

### 5.1 Admin Alert — New Guest Request (Immediate)

**Trigger:** Golfer submits a guest request.
**Timing:** Immediate (sent as part of the guest request server action).
**Recipients:**
- **TO:** Primary event admin.
- **CC:** Secondary event admin(s), super admin(s).

**Content:**
- Event name and game date.
- Requesting golfer's name.
- Guest details (name, email if provided, phone if provided, GHIN if provided).
- Two tokenized action links: **[Approve Guest]** and **[Decline Guest]**.
- Link to RSVP management page in the app (as fallback).

**Email Type (for `email_log`):** `guest_request_pending`

### 5.2 Admin Action — Approve via Email Link

**Endpoint:** `GET /api/guest-approve/[token]?action=approve` or `?action=deny`

**Flow:**
1. Admin clicks "Approve Guest" or "Decline Guest" link in email.
2. API route validates the token, checks the guest request still exists and is pending.
3. **If already actioned:** Renders a friendly page — "This guest request has already been [approved/denied] by [Admin Name]."
4. **If still pending:**
   - Updates `guest_requests.status` to `approved` or `denied`.
   - Sets `approved_by` to the acting admin's profile (looked up via token or session).
   - Triggers the appropriate notification emails (§5.3 or §5.4).
   - Renders a confirmation page — "Guest [approved/denied] successfully."

**Token Design:**
- Stored in `guest_requests.approval_token` (UUID).
- One token per guest request (token encodes the request; action is a query param).
- No expiry (admin can act anytime, including post-cutoff).
- No authentication required (token-based, same pattern as RSVP tokens).

### 5.3 Notification — Guest Approved

**Trigger:** Admin approves a guest request (via email link or in-app).
**Recipients:**
- **TO:** Requesting golfer.
- **CC:** All event admins (primary + secondary), super admin(s), guest (if email provided).

**Content — GHIN Provided:**
- "[Event Name]: Guest Approved for [Date]"
- Guest name, GHIN number.
- "Your guest has been confirmed. They'll be included in the weekly confirmation and groupings."

**Content — GHIN Not Provided:**
- Same subject line.
- Same confirmation message.
- Additional prompt: "One thing needed — please reply-all with [Guest Name]'s GHIN number so the pro shop can get them set up."
- **CC additions for this variant:** Pro shop contacts (from event's linked contacts in `event_pro_shop_contact_links`), so they receive the reply-all.

**Rationale:** The reply-all pattern leverages email threads. Whoever has the GHIN (member, guest, or admin) can reply, and the pro shop gets it without needing to use the app.

**Email Type (for `email_log`):** `guest_approved`

### 5.4 Notification — Guest Denied

**Trigger:** Admin denies a guest request (via email link or in-app).
**Recipients:**
- **TO:** Requesting golfer.
- **CC:** All event admins (primary + secondary), super admin(s).
- **NOT sent to:** Guest (regardless of whether email was provided).

**Content:**
- "[Event Name]: Guest Request Update"
- "Unfortunately, we were unable to accommodate your guest request for [Guest Name] for [Date]."
- No reason field required (admin discretion).

**Email Type (for `email_log`):** `guest_denied`

### 5.5 Admin Alert — Pending Guest Requests Before Cutoff

**Trigger:** Cron check (via existing `email-scheduler`) detects pending guest requests for an upcoming game.
**Timing:** Configurable hours before RSVP cutoff (uses `event_alert_settings` for `pending_guest_requests` alert type).
**Fires:** Once per event per week (deduplicated via `email_log`).

**Recipients:**
- **TO:** Primary event admin.
- **CC:** Secondary event admin(s), super admin(s).

**Content:**
- "You have [X] pending guest request(s) for [Date]."
- List of pending guests with requesting golfer names.
- Tokenized approve/decline links for each pending request.
- Link to RSVP management page.

**Email Type (for `email_log`):** `guest_request_pending` (deduplicated — only sends if no `guest_request_pending` log entry exists for this schedule_id with `sent_at` in the alert window).

**Integration with existing admin alerts:**
- New `AlertType`: `pending_guest_requests`.
- Added to `admin-alerts.ts` with a new template.
- Default: enabled (if guest requests are enabled for the event).

---

## 6. Post-Cutoff Behavior

- **Pending requests remain open.** Admins can approve or deny at any time after cutoff, consistent with existing post-cutoff RSVP override powers.
- **No auto-expiry.** If an admin never acts on a request, it stays pending indefinitely (admin can deny to clean up).
- **Approved guests post-cutoff** are included in the next confirmation/groupings email send (or manually triggered send).

---

## 7. Data Model Changes

### 7.1 `events` Table — New Column

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `max_guests_per_week` | `smallint` | `1` | Max guests a golfer can request per week. CHECK (1–3). Only meaningful when `allow_guest_requests = true`. |

### 7.2 `guest_requests` Table — Changes

| Change | Column | Details |
|--------|--------|---------|
| **Add** | `approval_token` | `uuid DEFAULT gen_random_uuid()`. Unique, not null. Used for email-based approve/decline links. |
| **Alter** | `guest_email` | Drop `NOT NULL` constraint. Make optional. |
| **Alter** | `guest_ghin_number` | Drop `NOT NULL` constraint. Make optional. |

### 7.3 `email_log.email_type` — CHECK Constraint Update

Add `'guest_request_pending'` to the allowed values in the `email_log.email_type` CHECK constraint. Existing types `'guest_approved'` and `'guest_denied'` are already included.

### 7.4 `event_alert_settings` — New Alert Type

Insert default row for `pending_guest_requests` alert type (enabled by default) for events with `allow_guest_requests = true`. Or handle via the existing default logic in `admin-alerts.ts` (no row = check defaults).

---

## 8. Modified Files

| File | Changes |
|------|---------|
| `supabase/migrations/025_guest_workflow.sql` | New migration: `max_guests_per_week` column, `approval_token` column, drop NOT NULL on `guest_email` and `guest_ghin_number`, update `email_log` CHECK constraint. |
| `src/types/events.ts` | Add `max_guests_per_week` to `Event` interface. Add `approval_token` to guest request types. |
| `src/app/admin/events/[eventId]/settings/components.tsx` | Update `FeatureFlagsForm`: when guest toggle is ON, show required max guests selector (1/2/3). |
| `src/app/admin/events/[eventId]/settings/actions.ts` | Update `updateFeatureFlags()` to save `max_guests_per_week`. |
| `src/app/rsvp/[token]/guest-actions.ts` | Make email/GHIN optional in validation. Replace hardcoded `MAX_GUESTS_PER_MEMBER = 3` with event's `max_guests_per_week`. Generate `approval_token`. Send admin alert email on submit. |
| `src/app/rsvp/[token]/guest-request-form.tsx` | Update form to mark email, phone, GHIN as optional. Update remaining slots display to use event's `max_guests_per_week`. |
| `src/app/rsvp/[token]/page.tsx` | Pass `max_guests_per_week` from event data to guest form component. |
| `src/app/api/guest-approve/[token]/route.ts` | **New file.** GET endpoint for tokenized approve/decline. Validates token, updates status, triggers notification emails, renders confirmation/already-actioned page. |
| `src/app/admin/rsvp/[scheduleId]/guest-actions.ts` | Update `approveGuestRequest()` and `denyGuestRequest()` to send to all admins (reply-all style). Add GHIN follow-up logic to approval. Add guest CC on approval if email provided. |
| `src/lib/admin-alerts.ts` | Add `pending_guest_requests` alert type and email template. |
| `src/lib/email-templates.ts` | Add guest request admin alert template, update approval/denial templates for new recipient logic. |
| `src/app/api/cron/email-scheduler/route.ts` | Add pending guest request alert check in cron sweep. |
| `src/app/help/page.tsx` | Add FAQ entries for golfers (how to request a guest) and admins (how to approve/deny, email links). |

---

## 9. API Route: Guest Approval via Token

**Path:** `/api/guest-approve/[token]`

**Method:** GET (so email links work as simple clicks — no form submission needed).

**Query Params:**
- `action`: `approve` or `deny` (required).

**Response:** HTML page (not JSON — this is opened in a browser from an email link).

**Flow:**
1. Look up `guest_requests` row by `approval_token`.
2. If not found → render "Invalid or expired link" page.
3. If `status !== 'pending'` → render "Already handled" page with outcome and acting admin name.
4. If valid and pending:
   a. Determine the acting admin (token is unauthenticated — the approval is attributed to the token itself, not a logged-in user). Note: `approved_by` is set to NULL for email-based approvals since we can't verify identity without a session. The admin's action is recorded via the email log and notification emails.
   b. Update `status` to `approved` or `denied`.
   c. Send notification emails (§5.3 or §5.4).
   d. Render "Success" page with guest name and outcome.

**Security Considerations:**
- Token is a UUID — not guessable.
- One token per request — no reuse.
- GET with side effects is acceptable here (same pattern as RSVP tokens, unsubscribe links, email verification). Idempotent after first use.
- No authentication required — matches the established tokenized link pattern.

---

## 10. Out of Scope (Deferred)

| Item | Reason |
|------|--------|
| **Pro shop approval gate** | Two-tier approval adds significant complexity. Need to confirm with pro shop whether they want approval authority vs. just being informed. Currently, approved guests appear in the suggested groupings email. |
| **Auto-expiry of pending requests** | Admins prefer flexibility to act at any time. No auto-cleanup needed. |
| **GHIN auto-populate from email replies** | Reply-all is a human workflow. GHIN values from replies don't flow back into the app. Admin can manually update if needed. |
| **Guest self-registration** | Guests are not platform users. They don't create accounts or log in. |
| **Guest capacity counting** | Guests do not count against the event's weekly player capacity (they fill spots beyond member capacity). This matches the existing design in CLAUDE.md. |
| **Pro shop notification on approval** | Deferred pending pro shop conversation. Can be added as a simple FYI email later without architectural changes. |

---

## 11. Existing Code Inventory (What's Already Built)

### Fully Built & Working
- `guest_requests` DB table with RLS policies and triggers.
- `allow_guest_requests` feature flag on events table with settings UI toggle.
- Golfer-facing guest request form with validation, past guest dropdown, status badges.
- Server actions for creating guest requests (with limit enforcement).
- Server actions for admin approval/denial (with golfer email notification).
- Admin RSVP management page with pending/approved/denied guest sections and action buttons.
- Guest info included in confirmation and suggested groupings emails.
- Guest-host pairing in grouping engine (post-engine placement in host's group).

### Needs Modification
- Guest request form: make email/phone/GHIN optional (currently email and GHIN are required).
- Guest limit: replace hardcoded `3` with event's `max_guests_per_week`.
- Admin approval: add reply-all style notifications to all admins.
- Admin approval: add guest CC on approval if email provided.
- Admin approval: add GHIN follow-up prompt when GHIN missing.
- Settings UI: add max guests selector when toggle is enabled.

### New (To Build)
- `approval_token` column and token generation.
- API route for token-based approve/decline from email links.
- Admin alert email on new guest request submission.
- Pending guest request alert before cutoff.
- Updated email templates for all notification scenarios.
