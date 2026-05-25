#!/usr/bin/env python3
"""Parse a Golf Genius .xls file and output JSON for the import script."""
import xlrd, json, sys

wb = xlrd.open_workbook(sys.argv[1])

# Find stableford sheet or use first
sheet = None
for s in wb.sheets():
    if "stableford" in s.name.lower():
        sheet = s
        break
if not sheet:
    sheet = wb.sheet_by_index(0)

print("SHEET:" + sheet.name, file=sys.stderr)

rows = []
for r in range(sheet.nrows):
    row = [sheet.cell(r, c).value for c in range(sheet.ncols)]
    rows.append(row)

print(json.dumps(rows))
