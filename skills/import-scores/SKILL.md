---
name: import-scores
description: "Import weekly Thursday League Stableford scores from a Golf Genius Excel (.xls) export into the leaderboard database. Use this skill whenever the user uploads a Golf Genius leaderboard file, mentions importing scores, updating the leaderboard, or adding weekly league results. Also trigger when the user says things like 'new scores', 'this week's results', 'update the standings', or attaches an .xls file with 'leaderboard' in the filename."
---

# Weekly Score Import — Golf Genius to Supabase

This skill processes a Golf Genius XLS export and generates SQL to upsert Stableford scores into the `league_scores` table for the Thursday League leaderboard.

## Why this exists

The sandbox environment cannot connect to Supabase directly (DNS/network restriction), so the workflow is: parse the file here, generate SQL, and the user pastes it into the Supabase SQL Editor. The import-scores.ts CLI script exists for local use but the Cowork upload path consistently produces 0-byte files when copied, making it unreliable.

## Step-by-step workflow

### 1. Parse the uploaded XLS file

Use Python with xlrd to read the file directly from the uploads path. SheetJS often fails on these old .xls binary files, but xlrd handles them reliably.

```python
import xlrd, json, sys

wb = xlrd.open_workbook("<uploaded-file-path>")

# Find the stableford sheet (case-insensitive), fall back to first sheet
sheet = None
for s in wb.sheets():
    if "stableford" in s.name.lower():
        sheet = s
        break
if not sheet:
    sheet = wb.sheet_by_index(0)

# Print header and all data rows
print(f"Sheet: {sheet.name} ({sheet.nrows} rows)")
for r in range(sheet.nrows):
    row = [sheet.cell(r, c).value for c in range(sheet.ncols)]
    print(row)
```

Expected columns: `[Pos., Player, Club, Stableford Points, Thru]`

### 2. Apply the name alias map

Golf Genius sometimes uses different names than what's stored in the database. Apply these known aliases before generating SQL. The key is the full name from Golf Genius (lowercase); the value is the corrected name as it appears in the `profiles` table.

```
Golf Genius Name        →  Database Name
─────────────────────────────────────────
Douglas Irwin           →  Doug Irwin
Mike Leiby              →  Michael Leiby
Samuel Dagan            →  Sam Dagan
Bradley Schluter        →  Brad Schluter
Tony Dambrosia          →  Tony D'Ambrosia
```

**Important rules for name mismatches:**
- NEVER change the golfer's name in the database `profiles` table to match Golf Genius.
- ALWAYS resolve mismatches via the alias map (in this skill and in `scripts/import-scores.ts`).
- If a new unmatched name appears, ask the user to confirm the correct DB name, then add it to this alias map AND to the `NAME_ALIASES` constant in `scripts/import-scores.ts`.

### 3. Determine the game date

The game date should be provided by the user or inferred from the filename. The filename format is typically: `YYYYMMDD 2026 Thursday League Leaderboard.xls`. Extract the date and format as `YYYY-MM-DD`.

If the date in the filename is the day AFTER the actual game (Golf Genius sometimes exports the next day), confirm with the user.

### 4. Generate the SQL

Produce an INSERT statement using this exact pattern (it works reliably in the Supabase SQL Editor — DO NOT use `DO $` blocks, they fail there):

```sql
-- Week N: [Month Day, Year] — Thursday League Stableford Scores
-- [count] golfers, aliases pre-resolved to match DB profiles

INSERT INTO league_scores (event_id, profile_id, game_date, stableford_points, metadata)
SELECT
  e.id,
  p.id,
  '[YYYY-MM-DD]',
  v.pts,
  jsonb_build_object('source', 'golf_genius', 'imported_at', now()::text)
FROM (VALUES
  ('[FirstName]', '[LastName]', [points]),
  ...
) AS v(first_name, last_name, pts)
CROSS JOIN events e
JOIN profiles p
  ON lower(p.first_name) = lower(v.first_name)
  AND lower(p.last_name) = lower(v.last_name)
WHERE e.slug = 'thursday-league'
ON CONFLICT (event_id, profile_id, game_date)
DO UPDATE SET
  stableford_points = EXCLUDED.stableford_points,
  metadata = EXCLUDED.metadata;
```

**SQL escaping:** Single quotes in names must be doubled (e.g., `D''Ambrosia`).

### 5. Provide a verification query

Always include this after the INSERT SQL:

```sql
-- Verify: should return [expected count]
SELECT count(*) FROM league_scores WHERE game_date = '[YYYY-MM-DD]';
```

### 6. Present to user

Show the user:
1. A summary of parsed scores (count, any new unmatched names)
2. The ready-to-paste SQL
3. The verification query
4. Instruct them to run both in the Supabase SQL Editor

## Edge cases

- **Negative Stableford points** are valid (e.g., -1). Include them as-is.
- **Tied positions** show as "T4", "T9", etc. in the Pos. column — ignore position data, only use Player and Stableford Points.
- **New/unmatched players**: If a name doesn't match any known alias and isn't an obvious first-name variant, flag it for the user. Ask them to check the DB for the correct spelling before proceeding.
- **Duplicate game dates**: The `ON CONFLICT` clause handles re-imports gracefully — it updates existing scores rather than failing.

## Related files

- `scripts/import-scores.ts` — CLI import script (for local terminal use, not Cowork)
- `scripts/parse-xls.py` — Python xlrd helper used by the CLI script
- `src/lib/league.ts` — Leaderboard computation logic
- `src/app/league/[slug]/leaderboard.tsx` — Leaderboard display component
