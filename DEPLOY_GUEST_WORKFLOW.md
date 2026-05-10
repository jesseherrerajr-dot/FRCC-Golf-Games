# Guest Workflow — Deployment Steps

## 1. Push to GitHub (triggers Vercel deploy)

```bash
cd ~/Developer/FRCC\ Golf\ Games
git push origin main
```

## 2. Run migration 025 in Supabase SQL Editor

Go to: https://supabase.com/dashboard → Your Project → SQL Editor

Paste and run:

```sql
-- Migration 025: Fix RLS enablement for three tables
ALTER TABLE public.handicap_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_shop_contacts_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pro_shop_contact_links ENABLE ROW LEVEL SECURITY;
```

## 3. Run migration 026 in Supabase SQL Editor

Paste and run:

```sql
-- Migration 026: Guest Workflow Enhancements
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_guests_per_week smallint NOT NULL DEFAULT 1
    CHECK (max_guests_per_week >= 1 AND max_guests_per_week <= 3);

ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS approval_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_requests_approval_token
  ON public.guest_requests (approval_token);

ALTER TABLE public.guest_requests
  ALTER COLUMN guest_email DROP NOT NULL;

ALTER TABLE public.guest_requests
  ALTER COLUMN guest_ghin_number DROP NOT NULL;
```

## 4. Verify Vercel deployment

Go to: https://vercel.com/dashboard → Your Project

Confirm the latest deployment completed successfully.

## 5. Enable guest requests for an event

1. Log in as super admin
2. Go to Admin → [Event] → Settings → Feature Flags
3. Toggle "Guest Requests" ON
4. Select max guests per week (1, 2, or 3)
5. Done — golfers will see the guest request form on their RSVP page

## 6. Test the flow

1. RSVP "In" for an event as a golfer
2. Submit a guest request (just a name is fine)
3. Check your admin email for the approve/decline links
4. Click "Approve" — verify the confirmation page and notification emails
