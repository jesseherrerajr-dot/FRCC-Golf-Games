#!/bin/bash

# Fix email-scheduler route.ts - replace 'any' with proper types
sed -i '' 's/const rsvps = members\.filter((m: any)/const rsvps = members.filter((m: { rsvp_status?: string })/g' src/app/api/cron/email-scheduler/route.ts
sed -i '' 's/\.map((r: any)/\.map((r: { profile: { first_name: string; last_name: string } })/g' src/app/api/cron/email-scheduler/route.ts

# Fix preferences page - escape apostrophe
sed -i '' "s/Don't show/Don\&apos;t show/g" src/app/preferences/page.tsx

# Fix guest-request-form - escape apostrophes
sed -i '' "s/golfer's/golfer\&apos;s/g" src/app/rsvp/[token]/guest-request-form.tsx
sed -i '' "s/Don't/Don\&apos;t/g" src/app/rsvp/[token]/guest-request-form.tsx

echo "✅ Build errors fixed!"
