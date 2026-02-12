# Testing Playing Partner Preferences

## What Was Built

1. **New `/preferences` page** - Manage playing partners and tee time preferences
2. **Dashboard link** - Quick access from main dashboard
3. **Admin view** - Preferences displayed in RSVP management page

## Test Plan

### Part 1: Member Preferences Page

**Access:**
1. Log in as a regular member (active status)
2. From dashboard, click "Playing Preferences" card
3. Should navigate to `/preferences`

**Tee Time Preferences:**
1. Select "Prefer earlier tee times" radio button
   - Should see success message "Tee time preference updated"
   - Message auto-dismisses after 3 seconds
2. Switch to "Prefer later tee times"
   - Should update successfully
3. Switch to "No preference"
   - Should update successfully

**Playing Partners:**
1. Click in the "Add Playing Partner" search box
2. Type a partial name (e.g., "Herr" for "Herrera")
   - Dropdown should appear with matching members
   - Should show full name and email
3. Click on a member to add them
   - Should see success message "Playing partner added successfully"
   - Search box should clear
   - Partner should appear in numbered list below
   - Counter should update (e.g., "1/10")
4. Add 2-3 more partners
   - Counter should increment
   - All partners numbered and listed
5. Try to add the same partner again
   - Should see error "This partner is already in your list"
6. Click "Remove" on one partner
   - Should see success message
   - Partner removed from list
   - Counter should decrement

**Multi-Program (if applicable):**
1. If you have multiple programs, select different program from dropdown
2. Preferences should be empty (per-program)
3. Add different partners for this program
4. Switch back to first program
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
   - Should see error "Maximum 10 playing partners allowed per program"
   - Add button should not work

**Search Functionality:**
1. Search by partial first name
2. Search by partial last name
3. Search by email
4. All should filter correctly

**Data Persistence:**
1. Set preferences and navigate away
2. Come back to `/preferences`
3. All preferences should be saved and displayed

## Expected Database State

After testing, check Supabase:

**playing_partner_preferences table:**
- Rows for each partner added
- `profile_id` = your user ID
- `program_id` = selected program
- `preferred_partner_id` = partner's user ID
- Unique constraint prevents duplicates

**tee_time_preferences table:**
- One row per profile per program
- `preference` = "early", "late", or "no_preference"
- Updates in place (upsert)

## Known Issues / Notes

- Preferences are suggestions only (not guaranteed pairings)
- Dropdown shows up to 50 members at a time
- On small screens, preferences column hidden on admin page
- Cannot add yourself as a playing partner
- Preferences are completely independent per program

## Success Criteria

✅ Can add/remove playing partners
✅ Can set tee time preference
✅ Preferences save and persist
✅ Search/filter works correctly
✅ Admin can view preferences for confirmed players
✅ Multi-program support works
✅ Validation prevents duplicates and self-selection
✅ 10 partner maximum enforced
