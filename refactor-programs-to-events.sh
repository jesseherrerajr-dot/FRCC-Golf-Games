#!/bin/bash
# Script to refactor "programs" to "events" across all TypeScript files

cd "$(dirname "$0")"

# Find all TypeScript/TSX files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  echo "Processing: $file"

  # Create backup
  cp "$file" "$file.bak"

  # Replace in order (most specific first to avoid double-replacements)
  sed -i.tmp \
    -e 's/program_schedules/event_schedules/g' \
    -e 's/program_admins/event_admins/g' \
    -e 's/program_subscriptions/event_subscriptions/g' \
    -e 's/program_id/event_id/g' \
    -e 's/programId/eventId/g' \
    -e 's/programsData/eventsData/g' \
    -e 's/selectedProgram/selectedEvent/g' \
    -e 's/loadProgramPreferences/loadEventPreferences/g' \
    -e 's/getPrograms/getEvents/g' \
    -e 's/programs:programs/event:events/g' \
    -e 's/from("programs")/from("events")/g' \
    -e 's/\.programs /\.events /g' \
    -e 's/program:programs/event:events/g' \
    -e 's/schedule\.program/schedule.event/g' \
    -e 's/const program =/const event =/g' \
    -e 's/program?/event?/g' \
    -e 's/program\./event./g' \
    -e 's/program,/event,/g' \
    -e 's/program &&/event \&\&/g' \
    -e 's/type Program/type Event/g' \
    -e 's/<Program>/<Event>/g' \
    -e 's/Program\[\]/Event[]/g' \
    -e 's/"Program/"Event/g' \
    -e 's/ program / event /g' \
    -e 's/a program/an event/g' \
    -e 's/Program Admin/Event Admin/g' \
    -e 's/program admin/event admin/g' \
    "$file"

  rm "$file.tmp"
done

echo "Refactoring complete!"
echo "Backups saved with .bak extension"
echo "Review changes and remove backups when satisfied"
