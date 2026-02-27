# Testing Playing Partner Preferences

## What Was Built

1. **New `/preferences` page** - Manage playing partners per event (ranked 1–10 with up/down reordering)
2. **Dashboard link** - Quick access from main dashboard
3. **Admin view** - Preferences displayed in RSVP management page

## Test Plan

### Part 1: Member Preferences Page

**Access:**
1. Log in as a regular member (active status)
2. From dashboard, click "Playing Preferences" card
3. Should navigate to `/preferences`

**Tee Time Preferences:**
- Note: Tee time preferences are now set **per-week during RSVP**, not on this page.
- The standing `tee_time_preferences` table still exists but is ignored by the grouping engine.

**Playing Partners:**
1. Click in the "Add Playing Partner" search box
2. Type a partial name (e.g., "Herr" for "Herrera")
   - Dropdown should appear with matching members
   - Should show full name only (no email displayed)
   - Email can be used as a search term but is not shown
3. Click on a member to add them
   - Should see success message "Playing partner added successfully"
   - Search box should clear
   - Partner should appear in numbered list below with ▲/▼ arrows
   - Counter should update (e.g., "1/10")
4. Add 2-3 more partners
   - Counter should increment
   - All partners numbered and listed in rank order
5. Try to add the same partner again
   - Should see error "This partner is already in your list"
6. Click "Remove" on one partner
   - Should see success message
   - Partner removed from list
   - Counter should decrement
   - Remaining partners re-ranked (no gaps)

**Reordering:**
1. With 3+ partners in the list, click ▼ on the #1 partner
   - Partner should move to #2, previous #2 moves to #1
2. Click ▲ on the last partner
   - Partner should move up one rank
3. Verify ▲ is disabled on the #1 partner (can't move higher)
4. Verify ▼ is disabled on the last partner (can't move lower)
5. While a reorder is processing, buttons should be disabled (no double-tap)

**Multi-Event (if applicable):**
1. If you have multiple events, select different event from dropdown
2. Preferences should be empty (per-event)
3. Add different partners for this event
4. Switch back to first event
5. Original preferences should still be there

### Part 2: Admin View

**Setup:**
1. Log in as super admin
2. Make sure you have at least one upcoming game with confirmed players
3. Ensure at least one confirmed player has set preferences

**View Preferences:**
1. Go to Admin Dashboard
2. Click on an upcoming game's RSVP management link
3. In the "Confirmed" table:
   - Should see new "Preferences" column (on large screens)
   - For players with preferences:
     - Shows "Partners: J. Doe, K. Smith..." (first 3)
     - Shows "+X" if more than 3 partners
     - Shows "Tee: 🌅 Early" or "🌄 Late" if set
   - For players without preferences:
     - Shows "None set" in gray text

### Part 3: Edge Cases

**Maximum Partners:**
1. Try to add 10 partners
   - All should add successfully
2. Try to add an 11th partner
   - Should see error "Maximum 10 playing partners allowed per event"
   - Add button should not work

**Search Functionality:**
1. Search by partial first name
2. Search by partial last name
3. Search by email (matches but email not displayed in dropdown)
4. All should filter correctly

**Data Persistence:**
1. Set preferences and navigate away
2. Come back to `/preferences`
3. All preferences should be saved and displayed in correct rank order

## Expected Database State

After testing, check Supabase:

**playing_partner_preferences table:**
- Rows for each partner added
- `profile_id` = your user ID
- `event_id` = selected event
- `preferred_partner_id` = partner's user ID
- `rank` = 1–10 (sequential, no gaps)
- Unique constraints: `(profile_id, event_id, preferred_partner_id)` prevents duplicates, `(profile_id, event_id, rank)` prevents rank collisions

**tee_time_preferences table:**
- Standing preferences table still exists but is **not used by the grouping engine**
- Per-week tee time preference is stored in `rsvps.tee_time_preference` during RSVP

## Known Issues / Notes

- Preferences are suggestions only (not guaranteed pairings)
- Dropdown shows up to 50 members at a time
- On small screens, preferences column hidden on admin page
- Cannot add yourself as a playing partner
- Preferences are completely independent per event
- Email addresses are hidden from the partner dropdown and list (privacy)
- Partners are ranked 1–10; rank drives the grouping engine's harmony scoring

## Success Criteria

✅ Can add/remove playing partners
✅ Can reorder partners via up/down arrows
✅ Partners are ranked 1–10 with correct scoring weight
✅ Email is hidden from dropdown and partner list
✅ Preferences save and persist in correct rank order
✅ Search/filter works correctly (including email search)
✅ Admin can view preferences for confirmed players
✅ Multi-event support works
✅ Validation prevents duplicates and self-selection
✅ 10 partner maximum enforced
✅ Ranks re-compact after removal (no gaps)
