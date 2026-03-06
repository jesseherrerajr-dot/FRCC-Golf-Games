# FRCC Golf Games — Structural Audit Report

**Date:** March 2, 2026
**Auditor:** Claude (AI-assisted analysis)
**Codebase:** FRCC Golf Group Tracker (Next.js / Supabase / Resend)

---

## 1. Estimated SLOC

| Category | Lines |
|---|---|
| **TypeScript/TSX source** (`src/`) | **18,401** |
| SQL migrations (`supabase/`) | 1,875 |
| Scripts (`scripts/`) | 510 |
| **Total** | **~20,800** |

**Breakdown by directory:**

| Directory | Lines | % of Source |
|---|---|---|
| `src/app/` (pages, API routes, admin) | 13,574 | 73.8% |
| `src/lib/` (shared logic) | 3,465 | 18.8% |
| `src/components/` (shared UI) | 1,107 | 6.0% |
| `src/types/` (TypeScript types) | 236 | 1.3% |

**Top 10 largest files:**

| File | Lines |
|---|---|
| `admin/events/[eventId]/settings/components.tsx` | 1,059 |
| `api/cron/email-scheduler/route.ts` | 1,016 |
| `admin/rsvp/[scheduleId]/page.tsx` | 802 |
| `admin/page.tsx` | 615 |
| `lib/email.ts` | 535 |
| `admin/events/[eventId]/settings/actions.ts` | 525 |
| `lib/grouping-engine.test.ts` | 494 |
| `lib/grouping-db.ts` | 484 |
| `lib/email-templates.ts` | 420 |
| `dashboard/page.tsx` | 416 |

**Observation:** Nearly 74% of your code lives in `src/app/`, which is typical for a Next.js App Router project where pages double as data-fetching and rendering layers. Your `lib/` directory at ~3,500 lines is lean — most of the business logic is co-located with the pages that use it, rather than extracted into reusable modules.

---

## 2. Cyclomatic Density

Cyclomatic complexity measures the number of independent execution paths through a function. Higher numbers mean more branching (if/else, switch, ternary) and more difficulty testing and reasoning about behavior.

| File | LOC | if/else | Ternary | Try/Catch | Switch | Est. CC | Rating |
|---|---|---|---|---|---|---|---|
| `email-scheduler/route.ts` | 1,017 | 27 | 8 | 7 | 4 | 45–55 | **Very High** |
| `admin/rsvp/[scheduleId]/page.tsx` | 802 | 24 | 12 | 0 | 0 | 26–34 | High |
| `lib/grouping-db.ts` | 484 | 16 | 8 | 0 | 0 | 24–32 | High |
| `lib/grouping-engine.ts` | 387 | 10 | 7 | 0 | 1 | 22–28 | High |
| `lib/email.ts` | 535 | 12 | 12 | 2 | 0 | 15–20 | Medium-High |

### The Hot Spots

**`email-scheduler/route.ts`** is the complexity outlier. This single file orchestrates four email types (invite, reminder, golfer confirmation, pro shop detail) through a switch statement, each with its own nested error handling, test-mode toggles, and database queries. The `GET()` handler alone has ~12 conditional paths. Key functions:

- `GET()` — 12 paths (time window checks, email type routing, test mode)
- `handleGolferConfirmation()` — 10 paths (grouping engine invocation, guest handling)
- `handleReminderEmails()` — 9 paths (multi-reminder logic, "already sent" guards)
- `checkLowResponseAlert()` — 7 paths (threshold checks, day-of-week matching)

This file is the strongest candidate for refactoring — splitting each email handler into its own module would cut per-file complexity roughly in half.

**`grouping-engine.ts`** has high density but is *well-structured* high complexity. The `calculateGroupSizes()` function handles 7+ remainder cases, but each is a clean, independent code path. The greedy assignment loop (`assignPoolToGroups` → `findBestCandidate`) is algorithmically dense but readable.

**`admin/rsvp/[scheduleId]/page.tsx`** has high complexity driven by conditional UI rendering (7 collapsible sections, each with data-dependent display logic). This is common in admin dashboards and less risky than algorithmic complexity — the branches are shallow and visual.

---

## 3. Data Depth — Supabase Schema Relationships

Your schema contains **16 tables** with **24 foreign key relationships**.

### Entity-Relationship Map

```
                    ┌─────────────────┐
                    │   auth.users    │
                    └────────┬────────┘
                             │ 1:1
                    ┌────────▼────────┐
              ┌─────┤    profiles     ├─────────┬──────────┬──────────┐
              │     └────────┬────────┘         │          │          │
              │              │                  │          │          │
         [is_super_admin]    │ 1:N              │ 1:N      │ 1:N     │ 1:N
              │     ┌────────▼────────┐   ┌─────▼──────┐  │  ┌──────▼───────┐
              │     │  rsvp_history   │   │   rsvps     │  │  │  groupings   │
              │     │  (audit log)    │   │  (weekly)   │  │  │  (foursomes) │
              │     └─────────────────┘   └─────┬───────┘  │  └──────────────┘
              │                                 │          │
              │                                 │          │
     ┌────────▼────────┐              ┌─────────▼──────┐   │
     │     events      │◄─────────────┤event_schedules │   │
     └───┬──┬──┬──┬────┘   1:N       └───────┬────────┘   │
         │  │  │  │                           │            │
    1:N  │  │  │  │ 1:N                  1:N  │            │
  ┌──────┘  │  │  └──────────┐      ┌────────┘            │
  │         │  │             │      │                      │
  ▼         │  ▼             ▼      ▼                      │
event_    │  event_      email_   guest_     playing_partner_ │
admins    │  subscriptions schedules requests  preferences ◄──┘
          │                                  (ranked 1-10)
          ▼
   pro_shop_contacts
   email_templates
   email_log
   event_alert_settings
   tee_time_preferences
   push_subscriptions
```

### All 16 Tables

| Table | Primary FK Dependencies | Role |
|---|---|---|
| `profiles` | `auth.users` | Core identity (golfers, admins, guests) |
| `events` | — | Recurring game definitions |
| `event_admins` | `events`, `profiles` | Admin assignments (primary/secondary) |
| `event_subscriptions` | `events`, `profiles` | Who receives invites for which event |
| `event_schedules` | `events` | Individual game dates + status flags |
| `rsvps` | `event_schedules`, `profiles` | Weekly RSVP responses + tokens |
| `rsvp_history` | `rsvps`, `event_schedules`, `profiles` | Immutable audit trail |
| `guest_requests` | `event_schedules`, `profiles` (x3) | Guest invitation requests |
| `playing_partner_preferences` | `profiles` (x2), `events` | Ranked partner preferences |
| `tee_time_preferences` | `profiles`, `events` | Standing tee time preferences |
| `groupings` | `event_schedules`, `profiles`, `guest_requests` | Foursome assignments |
| `pro_shop_contacts` | `events` | Pro shop email recipients |
| `email_templates` | `events` (nullable) | Canned message templates |
| `email_log` | `events`, `event_schedules`, `profiles` | Email audit trail |
| `email_schedules` | `events` | Per-event email timing config |
| `event_alert_settings` | `events` | Per-event alert toggles + config |

### Relationship Characteristics

- **Hub entity:** `profiles` is referenced by 10 other tables. It's the gravitational center of the schema.
- **Second hub:** `events` is referenced by 8 tables. Together, `profiles` and `events` form the two-axis foundation (who × what).
- **Junction tables:** `event_admins`, `event_subscriptions`, `playing_partner_preferences`, and `tee_time_preferences` are all many-to-many join tables between profiles and events.
- **Temporal chain:** `events` → `event_schedules` → `rsvps` → `rsvp_history` forms a four-level deep temporal hierarchy (recurring event → specific date → weekly response → change log).
- **RLS policy count:** 25+ Row Level Security policies across all tables, with three tiers (super admin, event admin, golfer). This is a meaningful security surface.

---

## 4. Complexity Comparison

### Where FRCC Sits on the Spectrum

| Dimension | Simple MVP | **FRCC Golf Games** | Enterprise-Grade |
|---|---|---|---|
| SLOC | <5K | **~20K** | 100K+ |
| DB Tables | 3–6 | **16** | 50+ |
| FK Relationships | 2–5 | **24** | 100+ |
| Auth Model | Single role | **3 roles + tokenized RSVP** | SSO/SAML + RBAC |
| Scheduled Jobs | 0–1 | **6 cron entries** | Queue-based workers |
| Email System | Transactional only | **4 automated types + custom** | ESP integration |
| Test Coverage | Minimal | **36 unit tests** (algorithm) | Full suite (unit/integration/e2e) |
| Feature Flags | None | **4 per-event flags** | Feature flag service |
| Audit Trail | None | **2 tables** (RSVP + email log) | Full event sourcing |

### Verdict: Mid-Complexity Web App

FRCC Golf Games sits squarely in the **Mid-Complexity Web App** category. Here's why it's beyond a simple MVP but not enterprise-grade:

**Beyond MVP because:**
- Multi-role authorization with RLS (not just "logged in / not logged in")
- Automated scheduling system with 6 cron jobs and configurable timing
- A non-trivial algorithm (grouping engine) with its own test suite
- 16-table relational schema with 24 foreign keys
- Tokenized authentication (RSVP links work without login)
- Per-event configuration (email timing, capacity, feature flags, alert settings)
- Audit trails for RSVPs and emails

**Not enterprise because:**
- Single-tenant (one club, not multi-org)
- No CI/CD pipeline or automated test runs beyond the grouping tests
- No integration or end-to-end tests
- Free-tier infrastructure (Vercel hobby, Supabase free, Resend free)
- No observability stack (logging, monitoring, alerting)
- No API versioning or backwards compatibility concerns
- Cron-based scheduling (not queue/worker architecture)

**Comparable applications by scale:** Think of FRCC as roughly equivalent to a Meetup group management tool, a league scheduling app like TeamSnap (single-league version), or a small HOA management portal. It's a focused vertical SaaS with real workflow automation — more sophisticated than a CRUD app, less complex than a platform.

---

## 5. The Bus Factor — Grouping Algorithm Readability

The "bus factor" question: if you disappeared tomorrow, how hard would it be for another competent developer to understand and maintain the grouping engine?

### Score: 7.5 / 10 (Good — A New Dev Could Be Productive in 1–2 Hours)

**What makes it accessible:**

1. **Pure function design.** `grouping-engine.ts` has zero external dependencies — no Supabase, no Next.js, no side effects. The entire module takes structured input and returns structured output. A new developer can understand it by reading the file alone, without needing to understand the rest of the application.

2. **Clear constraint hierarchy.** The file header documents the four-level constraint system (Guest-Host → Group Math → Tee Time → Partner Preferences) and the code follows this exact order. The algorithm reads top-to-bottom in the same sequence it executes.

3. **Well-named functions.** `calculateGroupSizes()`, `buildPairScores()`, `partitionByTeeTime()`, `assignPoolToGroups()`, `findBestCandidate()` — each function name describes exactly what it does.

4. **36 unit tests.** `grouping-engine.test.ts` (494 lines) provides executable documentation. A new developer can read the test names to understand the expected behavior without reading the implementation.

5. **Separation of concerns.** The algorithm (`grouping-engine.ts`) is fully separated from the database layer (`grouping-db.ts`). A developer can modify the scoring logic without touching any SQL or API code.

**What could trip someone up:**

1. **The `calculateGroupSizes()` branching.** Seven explicit cases for N=0 through N=6, then three remainder cases, plus a special case for N=9. The logic is correct but requires careful reading — there's no lookup table or formula, just sequential if-statements. A brief comment explaining *why* N=9 is special would help.

2. **The greedy heuristic isn't obvious.** The engine uses a greedy approach (assign the highest-harmony candidate to each slot one at a time) rather than an optimal solver. This is a reasonable trade-off for 16 golfers, but a new developer might wonder why it doesn't try all permutations. A one-line comment noting that brute-force is O(n!) and impractical would clarify the design decision.

3. **Shuffle semantics.** The `shuffle` parameter controls both pool randomization *and* group order randomization. These are two different concerns bundled into one boolean. A developer might expect shuffle to only affect one or the other.

4. **The DB layer (`grouping-db.ts`) is the harder half.** At 484 lines with 5 sequential Supabase queries and complex nested assembly logic, `fetchStoredGroupings()` is where a new developer would spend most of their time. The algorithm is clean; the data plumbing is not.

### Bottom Line

The grouping engine is one of the best-documented and most testable parts of your codebase. A mid-level developer familiar with TypeScript could understand the algorithm in under an hour and make confident changes with the test suite as a safety net. The DB integration layer would take longer — probably half a day to fully trace the data flow from Supabase queries to the final grouped output.

---

## Summary

| Metric | Value |
|---|---|
| Total SLOC | ~20,800 |
| Highest complexity file | `email-scheduler/route.ts` (CC ~50) |
| DB tables / FK relationships | 16 / 24 |
| Complexity category | **Mid-Complexity Web App** |
| Bus factor (grouping algo) | **7.5/10** — good isolation, tests, naming |
| Top refactoring priority | Split email scheduler into per-type handlers |
