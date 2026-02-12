# Programs → Events Refactor Progress

## ✅ Completed
1. Database migration created (`005_rename_programs_to_events.sql`)
2. `/src/app/preferences/actions.ts` - Updated
3. `/src/app/preferences/page.tsx` - Updated

## 🔄 In Progress - Remaining Files

### High Priority (User-Facing)
- `/src/app/rsvp/[token]/page.tsx` - RSVP page
- `/src/app/dashboard/page.tsx` - Dashboard
- `/src/app/admin/page.tsx` - Admin dashboard
- `/src/app/admin/rsvp/[scheduleId]/page.tsx` - Admin RSVP management

### API Routes
- `/src/app/api/rsvp/route.ts`
- `/src/app/api/rsvp/tee-time/route.ts`
- `/src/app/api/cron/invite/route.ts`
- `/src/app/api/cron/reminder/route.ts`
- `/src/app/api/cron/confirmation/route.ts`

### Admin Actions
- `/src/app/admin/actions.ts`
- `/src/app/admin/rsvp/[scheduleId]/actions.ts`
- `/src/app/admin/rsvp/[scheduleId]/guest-actions.ts`

### Utilities
- `/src/lib/auth.ts`
- `/src/lib/email.ts`
- `/src/lib/schedule.ts`

### Documentation
- `/CLAUDE.md`
- `/TESTING-PREFERENCES.md`

## Search & Replace Patterns

### Variables/Parameters
- `program` → `event`
- `programs` → `events`
- `programId` → `eventId`
- `programsData` → `eventsData`
- `selectedProgram` → `selectedEvent`
- `Program` (type) → `Event`

### Database References
- `programs` table → `events`
- `program_schedules` → `event_schedules`
- `program_admins` → `event_admins`
- `program_subscriptions` → `event_subscriptions`
- `program_id` column → `event_id`

### UI Text
- "Program" → "Event"
- "program" → "event"
- "Programs" → "Events"
- "Program Admin" → "Event Admin"

## Notes
- Preserving function names like `getPrograms()` → `getEvents()`
- Keeping schedule-related naming (program_schedules becomes event_schedules)
- All RLS policies updated
- Foreign keys and indexes updated in migration
