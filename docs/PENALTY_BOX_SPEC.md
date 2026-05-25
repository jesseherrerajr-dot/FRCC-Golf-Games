# The Penalty Box — Feature Spec

> **Status:** Concept — Ready for technical planning
> **Working title:** The Penalty Box
> **Purpose:** A lighthearted, gamified penalty system for event admins to playfully call out golfers who are being obnoxious (excessive pairing requests, late-night admin texts, etc.). Pure comedy — no real impact on RSVP or gameplay. 99% humor, 1% behavior modification.

---

## Table of Contents

1. [Overview](#overview)
2. [How to Get Penalized](#how-to-get-penalized)
3. [The Escape: 3-Hole Mini Golf](#the-escape-3-hole-mini-golf)
4. [Character Witnesses](#character-witnesses)
5. [The 3-No-Votes Apology Flow](#the-3-no-votes-apology-flow)
6. [Notifications & Emails](#notifications--emails)
7. [Public Visibility](#public-visibility)
8. [Penalty Box Page](#penalty-box-page)
9. [Repeat Offenders](#repeat-offenders)
10. [What It Doesn't Do](#what-it-doesnt-do)
11. [V2 Roadmap (Deferred)](#v2-roadmap-deferred)
12. [Technical Considerations (V1)](#technical-considerations-v1)

---

## Overview

The Penalty Box is a per-event feature that lets event admins "penalize" golfers who are pestering them — a playful public callout with a mini-game escape mechanic. The penalized golfer must complete a 3-hole mini golf putting challenge, then recruit 3 character witnesses who each play the same game and vote on whether to release them.

**Core flow:**
1. Admin sends a golfer to the Penalty Box with a written charge
2. All event golfers are notified via email (message attributed to the event admin)
3. The penalized golfer plays a 3-hole mini golf power meter game (increasing difficulty)
4. Hole 3 is a clown (named after the event admin) that always rejects the putt — the golfer learns they need 3 character witnesses
5. The golfer selects 3 witnesses from the subscriber list (cannot pick admins or other inmates)
6. Each witness plays the same 3-hole game, then votes yes/no on release with a required comment
7. If a witness votes no (named rejection), the golfer must find a replacement
8. If the golfer accumulates 3 total "no" votes, they must send an apology to the event admin requesting release
9. When 3 witnesses vote yes, the golfer is released with a group-wide email announcement including time served and witness testimonies

**Design philosophy:** Pure comedy, zero real consequences. Golfers can still RSVP and play normally while in the Penalty Box. The punishment IS the social experience — being publicly called out, having to recruit witnesses, and the group watching the escape unfold.

**Admin attribution:** All Penalty Box communications are attributed to the event admin (primary), even when a super admin triggers the action behind the scenes. The clown on hole 3 is named after the event admin. This keeps the comedy personal and grounded in the golfer-admin relationship.

---

## How to Get Penalized

### Admin-Initiated Penalty

Any event admin or super admin can send a golfer to the Penalty Box. The action is always attributed to the event's primary admin in all communications.

**Required inputs:**
- **The golfer** — selected from the event's subscriber list
- **The charge** — a brief, funny write-up explaining the offense (free-text, required). Examples: "Texted me at 11:47pm about pairings," "Asked to switch groups 4 times in one week," "Unsolicited swing advice on every hole."

**Preset charge templates** (admin can pick one and customize, or write from scratch):
- "Excessive pairing requests"
- "Late-night admin harassment"
- "Unsolicited swing advice"
- "Slow play advocacy"
- "Complained about the weather forecast"
- "Asked 'what time do we tee off?' for the 5th time"

### Admin Unilateral Release

The event admin (or super admin) can release a golfer from the Penalty Box at any time, bypassing the entire escape flow. This is the safety valve — if the joke has run its course or the golfer is genuinely frustrated, the admin just clicks "Release" and it's done.

### Citizen Complaints (V1 — Lightweight)

For v1, there is no in-app complaint UI. Golfers who want to suggest someone for the Penalty Box contact the event admin directly (text, email, in person). Complaints must be non-anonymous — a golfer needs to identify themselves when calling out another golfer. The admin decides whether to act on it. All identities are known and transparent.

---

## The Escape: 3-Hole Mini Golf

When a penalized golfer taps "Begin Escape" from their home page or the Penalty Box page, they enter a 3-hole mini golf putting game. The game uses a **power meter** mechanic for maximum cross-device compatibility (works identically on touchscreen and desktop — tap/click to stop the meter in the sweet spot).

### Hole 1 — "The Gimme"

- **Difficulty:** Easy. Wide sweet spot on the power meter.
- **Label:** "Even you can make this one."
- **Purpose:** Builds false confidence. The golfer thinks escape will be quick.
- **On miss:** Retry the hole (not the whole course).
- **Visual:** Short, straight green with a clear target cup.

### Hole 2 — "The Snake"

- **Difficulty:** Medium. Narrower sweet spot.
- **Label:** References the golfer's specific charge. Example: "Difficulty adjusted for excessive admin harassment."
- **Purpose:** Makes the golfer work for it. 2-3 attempts typical.
- **On miss:** Retry the hole.
- **Visual:** Longer green with a visible curve or obstacle.

### Hole 3 — "The Clown"

- **Difficulty:** The putt itself is makeable — but it's a **scripted fake-out.**
- **Visual:** A clown face at the end of the green. The clown is named after the event admin (e.g., "Gary the Gatekeeper").
- **What happens:** The golfer sinks the putt into the clown's mouth. The clown chews for a moment... then spits the ball back out. A message appears with a random taunt from a pool of ~15 options:

  > **[Event Admin Name] says:** "[Random taunt]"
  >
  > "Good try! But putting alone won't save you. To escape the Penalty Box, you need to find **3 character witnesses** who'll vouch for your behavior."

- **The twist is scripted:** No matter how well the golfer putts, the clown always rejects it. This is the comedic climax.
- **After the reveal:** The golfer's status changes from "Incarcerated" to "Awaiting Witnesses" and they proceed to the character witness selection screen.

### Random Clown Taunts (V1)

The hole 3 clown selects randomly from a pool of taunts:

- "[Admin Name] says: 'Did you really think it would be that easy?'"
- "The clown chews thoughtfully, then spits. 'Nah.'"
- "'Nice stroke. Terrible behavior. Find witnesses.'"
- "[Admin Name] says: 'I've seen better putts from the beverage cart driver.'"
- "'You've been found guilty in the court of golf. Appeal denied.'"
- "'That putt was perfect. Your behavior? Not so much.'"
- "[Admin Name] says: 'Come back with 3 friends who'll lie for you.'"
- "'The Penalty Box doesn't accept putts as currency. Try character witnesses.'"
- "[Admin Name] says: 'Maybe try texting me LESS and putting MORE.'"
- "'Putt: A+. Character: Under review. Find 3 witnesses.'"
- "[Admin Name] says: 'I admire the confidence. Now find witnesses.'"
- "'That ball had more roll than your excuses. Find 3 witnesses.'"

### Power Meter Mechanics

- **How it works:** A meter bar fills up and cycles. The golfer taps/clicks to stop it. A highlighted "sweet spot" zone on the meter represents a successful putt.
- **Hole 1:** Sweet spot is ~40% of the meter (hard to miss).
- **Hole 2:** Sweet spot is ~20% of the meter (requires timing).
- **Hole 3:** Sweet spot is ~25% of the meter (makeable, but irrelevant — the clown always rejects).
- **On success:** Ball animation rolls toward the hole and drops in (or into the clown's mouth for hole 3).
- **On miss:** Ball animation veers off. Brief "miss" feedback. Retry the same hole.
- **Cross-device:** Tap (mobile) or click (desktop) — identical interaction.

---

## Character Witnesses

After completing the 3-hole game and the clown reveal, the penalized golfer must recruit 3 character witnesses.

### Witness Selection Rules

- The golfer sees a searchable dropdown of active, subscribed golfers for the event
- **Cannot select:** Event admins (the admin is the judge, not a witness)
- **Cannot select:** Golfers currently in the Penalty Box (only free golfers can vouch)
- **Can select:** Any other active, subscribed golfer — including golfers who have been witnesses before (witnesses can be reused across different penalty instances, just not within the same one)
- **Must select 3 unique witnesses** per penalty
- The golfer selects all 3 at once and submits

### The Witness Experience

Each selected witness receives an email with a tokenized link (no login required, consistent with RSVP token pattern). When they click it:

1. **The Game.** The witness plays the same 3-hole mini golf course (same power meter, same difficulty).

2. **The Vote.** After the clown on hole 3, instead of the witness needing their own witnesses, the clown asks:
   > "[Golfer Name] was penalized for: '[charge].' Do you believe they deserve release from the Penalty Box?"
   
   Two buttons: **"Release Them"** and **"Keep Them Locked Up"**

3. **Required Comment.** Regardless of yes or no, the witness **must** write a comment explaining their vote. These testimonies are public, attributed, and permanent. Examples:
   - Yes: "I vouch for Jesse because he swore on his 7-iron to never text Gary after 9pm."
   - No: "I voted to keep Jesse locked up because he still hasn't apologized for that 6-hour round."

### Vote Outcomes

**If the witness votes YES:**
- Their vote, name, and testimony are recorded publicly
- The release progress counter increments (e.g., "2 of 3 witnesses have voted for release")
- The penalized golfer is notified: "[Witness Name] voted for your release!"

**If the witness votes NO:**
- The penalized golfer is notified by name: "[Witness Name] voted to keep you in the Penalty Box. Their reason: '[comment]'"
- The "no" is recorded publicly (name + comment visible on Penalty Box page)
- The penalized golfer must select a **replacement witness** (just replacing the one "no" vote, not starting over with all 3)
- The rejected witness cannot be re-asked for the same penalty
- The running "no" vote count increments (tracks toward the 3-no-vote threshold)

### Witness Timeout

- If a witness hasn't responded within **24 hours**, the request auto-expires
- The penalized golfer receives a notification: "[Witness Name] didn't respond in time. Select a new character witness."
- The golfer picks a replacement from the dropdown
- A golfer who timed out **can** be re-asked for a future penalty, just not this one
- Timeout enforcement: checked on page load (no cron needed). When anyone views the Penalty Box page or the penalized golfer's home page, expired witness requests are detected and status is updated.

---

## The 3-No-Votes Apology Flow

If a penalized golfer accumulates **3 total "no" votes** across all witness requests for a single penalty (not 3 from the same person — 3 different witnesses who all voted no), the escape-by-witnesses path is closed. The golfer is instead prompted to take a different path:

**What the golfer sees:**
> "Three character witnesses have voted to keep you in the Penalty Box. It seems the group has spoken. Your only remaining option is to appeal directly to [Event Admin Name]."
>
> **"Send an Apology & Request for Release"**

**The apology flow:**
1. The golfer writes an apology message (free-text, required) addressed to the event admin
2. The apology is sent to the event admin via email (and visible in the Penalty Box page)
3. The event admin can then choose to release the golfer (using the standard admin release button) or leave them in the box

**Design notes:**
- The apology is public — other golfers can see it on the Penalty Box page
- The admin has no obligation to release after receiving the apology
- This creates a natural escalation: first you try witnesses, then if the group won't vouch for you, you have to actually apologize to the person you annoyed
- The admin can always release unilaterally at any time, regardless of the apology flow

---

## Notifications & Emails

All penalty communications are attributed to the event admin (primary), even when triggered by a super admin.

### Email Types (V1)

| Trigger | Recipients | From/Reply-To | Content |
|---------|-----------|---------------|---------|
| **Penalty Issued** | All event subscribers | Event admin | "⚠️ [Event Admin] has sent [Golfer] to the Penalty Box! Charge: '[reason]'. Visit the Penalty Box to follow the escape." |
| **Witness Request** | Each selected witness | Event admin | "[Golfer] has identified you as a character witness. Play a quick mini golf challenge and cast your vote → [tokenized link]" |
| **Witness Voted No** | Penalized golfer only | System | "[Witness Name] voted to keep you in the Penalty Box. Reason: '[comment]'. Select a new character witness." |
| **Witness Timed Out** | Penalized golfer only | System | "[Witness Name] didn't respond within 24 hours. Select a new character witness." |
| **Apology Submitted** | Event admin | System | "[Golfer] has submitted an apology from the Penalty Box: '[apology text]'. Release them from the Penalty Box? [link to admin page]" |
| **Released** | All event subscribers | Event admin | "🎉 [Golfer] has been released from the Penalty Box! Time served: [X days, Y hours, Z minutes, W seconds]. Character witnesses: [names + testimonies]." |

### In-App Visibility

- **Penalized golfer's home page:** Penalty Box banner with live ticking time-served counter and current escape progress
- **All golfers' event cards:** Current Penalty Box status showing who's in and witness progress
- **Penalty Box page:** Full details for all current and past penalties

### Email Quota Impact

At an estimated frequency of ~1 penalty per month for a 30-person event:
- Penalty issued blast: ~30 emails
- Witness requests: 3-6 emails
- Release blast: ~30 emails
- **Total per cycle: ~65-70 emails**

This fits comfortably within the 100/day Resend limit as long as the penalty and release blasts don't land on the same day as invite or confirmation emails. At once-a-month frequency, overlap is unlikely.

---

## Public Visibility

### Penalty Box Badge

While a golfer is in the Penalty Box, a small visual indicator appears next to their name on:
- The "In" list (RSVP visibility / evite-style list)
- The RSVP management page (admin view)
- The event card on the golfer home page

Tapping/hovering the badge reveals the charge. All identities and charges are fully public — no hidden or anonymous elements.

### Home Page Integration

When a golfer views their home page for an event that has active Penalty Box inmates:
- A "Penalty Box" section shows current inmates with charges and escape progress
- Each inmate entry shows: name, charge, time served, witness progress (e.g., "1 of 3 witnesses")
- Link to the full Penalty Box page

### Live Time-Served Counter

On the penalized golfer's own home page, a ticking JavaScript counter displays: "Time Served: 2 days, 14 hours, 37 minutes, 12 seconds." Updates every second. The final time served is frozen at release and included in the release email.

---

## Penalty Box Page

A dedicated page accessible from the event card, similar to League Info. URL pattern: `/penalty-box/[slug]`.

### Current Inmates (V1)

- List of all golfers currently in the Penalty Box
- Each entry shows: name, charge, time served (live counter), witness progress, who has voted and how (yes/no + testimonies)
- Witness testimonies appear as they come in
- "No" votes are visible with the rejecting witness's name and comment

### Penalty History Log (V1)

- Chronological history of all completed penalties for the event
- Each entry: golfer name, date penalized, charge, date released, total time served, character witnesses (names + testimonies), "no" votes received
- Most recent first

### Hall of Shame Leaderboard — DEFERRED TO V2

See [V2 Roadmap](#v2-roadmap-deferred).

---

## Repeat Offenders

Penalties escalate for repeat offenders within the same event. The escalation is in the number of character witnesses required — the game difficulty stays the same.

| Offense | Witnesses Required |
|---------|-------------------|
| 1st | 3 witnesses |
| 2nd | 5 witnesses |
| 3rd+ | 7 witnesses |

The 3-no-votes apology threshold remains at 3 regardless of offense number — if 3 witnesses refuse at any point, the apology flow triggers.

The golfer's offense count is permanent for the event and tracked in the penalty history.

---

## What It Doesn't Do

- **No RSVP blocking.** Golfers in the Penalty Box can still RSVP "In" and play normally.
- **No immunity.** Nobody can earn protection from the Penalty Box.
- **No golfer-to-admin penalties.** Golfers cannot put admins in the Penalty Box. Admins can only be penalized by other admins.
- **No in-app complaint system (V1).** Golfers contact the admin directly to suggest penalties.
- **No anonymous anything.** All identities — who penalized, who complained, who witnessed, who voted, who rejected — are fully visible to everyone.

---

## V2 Roadmap (Deferred)

These items were discussed during concept design and deferred to reduce v1 scope:

### Hall of Shame Leaderboard
Statistical rankings across all penalties: Most Penalties, Longest Time Served, Fastest Escape, Most Witnesses Needed, Most Reliable Witness, Most Ruthless Witness, Total Time Served. Deferred because meaningful stats require multiple penalties' worth of data.

### Title Badges
Post-release permanent badges visible on golfer profiles: 1st offense = "Parolee", 2nd = "Repeat Offender", 3rd+ = "Hardened Criminal." Deferred as pure polish — easy to add later with no schema changes (conditional rendering based on offense count).

### Witness Oath
Mock courtroom oath before the witness plays: "I, [Witness Name], do solemnly swear to provide honest testimony regarding [Golfer Name]'s character, so help me bogey." Tap "I Swear" to proceed. Deferred as comedic polish.

### Custom Clown Dialogue
Admin-provided custom text for the hole 3 clown instead of random taunts. Deferred to simplify the admin form — random taunts are sufficient and funnier than most admins would write on the spot.

### Escalating Game Difficulty
Harder power meter (smaller sweet spot) for repeat offenders. Deferred because the escalation already exists in witness count, and tuning difficulty adds complexity without much comedy payoff.

### In-App Citizen Complaint System
Structured UI for golfers to file complaints with admin review workflow. Deferred to keep v1 simple — direct admin contact works fine for now.

### "Postcard from the Penalty Box"
Shareable pre-formatted message the penalized golfer can send to the group chat to campaign for witnesses. Deferred as optional social feature.

---

## Technical Considerations (V1)

### New Database Tables

**`penalty_box`** — Core penalty records
- `id` (uuid, PK, default gen_random_uuid())
- `event_id` (FK → events, NOT NULL)
- `profile_id` (FK → profiles, the penalized golfer, NOT NULL)
- `charged_by` (FK → profiles, the admin who triggered it, NOT NULL)
- `charge` (text, NOT NULL)
- `status` (text, NOT NULL, CHECK: `incarcerated`, `awaiting_witnesses`, `apology_required`, `released`)
- `escape_completed_at` (timestamptz, when the golfer finished the putting game, nullable)
- `released_at` (timestamptz, nullable)
- `released_by` (FK → profiles, nullable — set if admin does unilateral release)
- `apology_text` (text, nullable — golfer's apology message if 3 "no" votes)
- `apology_submitted_at` (timestamptz, nullable)
- `witnesses_required` (smallint, NOT NULL, default 3)
- `offense_number` (smallint, NOT NULL — auto-calculated based on prior penalties for this golfer+event)
- `total_no_votes` (smallint, NOT NULL, default 0 — running count of "no" votes)
- `created_at` (timestamptz, NOT NULL, default now())

**`penalty_witnesses`** — Character witness records
- `id` (uuid, PK, default gen_random_uuid())
- `penalty_id` (FK → penalty_box, NOT NULL)
- `witness_profile_id` (FK → profiles, NOT NULL)
- `token` (uuid, NOT NULL, default gen_random_uuid(), UNIQUE — for tokenized witness links)
- `status` (text, NOT NULL, CHECK: `pending`, `completed`, `expired`)
- `vote` (text, nullable, CHECK: `yes`, `no`)
- `testimony` (text, nullable)
- `game_completed_at` (timestamptz, nullable)
- `voted_at` (timestamptz, nullable)
- `expires_at` (timestamptz, NOT NULL — 24 hours from creation)
- `created_at` (timestamptz, NOT NULL, default now())
- UNIQUE constraint on `(penalty_id, witness_profile_id)` — same witness can't be asked twice for the same penalty

### New Pages

| Route | Description |
|-------|-------------|
| `/penalty-box/[slug]` | Penalty Box page (current inmates, history log) |
| `/penalty-box/[slug]/escape/[penaltyId]` | The 3-hole mini golf escape game (for the penalized golfer) |
| `/penalty-box/[slug]/witness/[token]` | Character witness flow (game → vote + comment). Tokenized, no login required. |
| Admin: event dashboard section | "Send to Penalty Box" button, active penalty management, release button |

### New Components

- `PuttingGame` — Power meter mini golf component (3 holes, tap-to-stop meter, ball animation, clown reveal)
- `PenaltyBoxBadge` — Small indicator shown next to penalized golfer names on RSVP lists
- `PenaltyBoxStatus` — Home page section showing current inmates for an event
- `PenaltyHistory` — History log component for the Penalty Box page
- `TimerCounter` — Live ticking time-served display (JS interval)
- `WitnessVote` — The yes/no vote with required comment form
- `WitnessSelector` — Dropdown for selecting character witnesses (filtered: no admins, no inmates)
- `ApologyForm` — The apology submission form (triggered after 3 "no" votes)

### Email Integration

New email types to add to the `email_log` CHECK constraint:
- `penalty_issued`
- `penalty_witness_request`
- `penalty_witness_no`
- `penalty_witness_timeout`
- `penalty_apology`
- `penalty_released`

### Feature Flag

Per-event feature flag: `penalty_box_enabled` (boolean, default false) on the `events` table. Controlled in Event Settings under Feature Flags (similar to guest requests). When disabled, all Penalty Box UI and functionality is hidden.

### Witness Timeout Enforcement

Checked on page load — no cron job needed. When anyone views the Penalty Box page, the penalized golfer's home page, or the witness link page, the system checks for expired witness requests (where `expires_at < now()` and `status = 'pending'`) and updates their status to `expired`. This is consistent with the existing 6-cron-slot constraint.

### Open Technical Questions

1. **Power meter animation:** CSS animation with JS tap handler vs. requestAnimationFrame loop? CSS is simpler; rAF gives more control over the meter speed.
2. **Ball animation after putt:** Simple CSS translate/transition to the hole, or a more elaborate Canvas animation with rolling? CSS transition is faster to build.
3. **Clown animation:** Static image that "chews" (CSS scale/rotate keyframes) then spits? Or a multi-frame sprite? CSS keyframes on a single image is the simplest approach.
4. **Tokenized witness links:** Reuse the existing token pattern from RSVP (`/penalty-box/[slug]/witness/[token]`). The token maps to a `penalty_witnesses` row. No login required, consistent with existing UX.
