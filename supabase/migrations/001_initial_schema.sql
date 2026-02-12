-- ============================================================
-- FRCC Golf Group Tracker — Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- Every user (golfer, admin, super admin) has a profile.
-- Linked to Supabase Auth via auth.users.id.
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text not null,
  ghin_number text not null,
  is_super_admin boolean not null default false,
  is_guest boolean not null default false,
  status text not null default 'pending_approval'
    check (status in ('pending_email', 'pending_approval', 'active', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'All users: golfers, admins, and guests. Linked to Supabase Auth.';
comment on column public.profiles.is_guest is 'True for guest golfers who are NOT on any distribution list.';
comment on column public.profiles.status is 'pending_email: awaiting email verification. pending_approval: email verified, awaiting admin approval. active: approved member. deactivated: removed from distribution.';

-- ============================================================
-- 2. PROGRAMS
-- Each recurring game (e.g., "FRCC Saturday Morning Group").
-- ============================================================
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  frequency text not null default 'weekly'
    check (frequency in ('weekly', 'biweekly', 'monthly')),
  day_of_week smallint not null default 6
    check (day_of_week between 0 and 6),
  default_capacity smallint not null default 16,
  timezone text not null default 'America/Los_Angeles',
  invite_day smallint not null default 1
    check (invite_day between 0 and 6),
  invite_time time not null default '10:00',
  reminder_day smallint not null default 4
    check (reminder_day between 0 and 6),
  reminder_time time not null default '10:00',
  cutoff_day smallint not null default 5
    check (cutoff_day between 0 and 6),
  cutoff_time time not null default '10:00',
  confirmation_day smallint not null default 5
    check (confirmation_day between 0 and 6),
  confirmation_time time not null default '13:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programs is 'Recurring game programs. Each has its own schedule, capacity, and RSVP cycle.';
comment on column public.programs.day_of_week is '0=Sunday, 1=Monday, ..., 6=Saturday';
comment on column public.programs.invite_day is 'Day of week to send the weekly invite (1=Monday).';
comment on column public.programs.cutoff_day is 'Day of week for RSVP cutoff (5=Friday).';

-- ============================================================
-- 3. PROGRAM ADMINS
-- Links profiles to programs with a role (primary/secondary).
-- ============================================================
create table public.program_admins (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'secondary'
    check (role in ('primary', 'secondary')),
  created_at timestamptz not null default now(),
  unique (program_id, profile_id)
);

comment on table public.program_admins is 'Admin assignments per program. Primary admin is the reply-to for emails.';

-- ============================================================
-- 4. PROGRAM SUBSCRIPTIONS
-- Which golfers are subscribed to which programs.
-- ============================================================
create table public.program_subscriptions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, profile_id)
);

comment on table public.program_subscriptions is 'Golfer subscriptions to programs. Inactive = unsubscribed (no invites, invisible).';

-- ============================================================
-- 5. PROGRAM SCHEDULES
-- Individual game dates for each program.
-- ============================================================
create table public.program_schedules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  game_date date not null,
  capacity smallint,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  admin_notes text,
  invite_sent boolean not null default false,
  reminder_sent boolean not null default false,
  confirmation_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, game_date)
);

comment on table public.program_schedules is 'Individual game dates. Capacity overrides program default if set. Status controls whether invites fire.';

-- ============================================================
-- 6. RSVPS
-- Weekly responses from golfers.
-- ============================================================
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.program_schedules(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'no_response'
    check (status in ('in', 'out', 'not_sure', 'no_response', 'waitlisted')),
  waitlist_position smallint,
  token uuid not null default gen_random_uuid(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, profile_id)
);

comment on table public.rsvps is 'Weekly RSVP responses. Token is used for one-tap email links (no login needed).';
comment on column public.rsvps.token is 'Unique token per golfer per week for tokenized RSVP links.';
comment on column public.rsvps.waitlist_position is 'Position on waitlist (1 = first). NULL if not waitlisted.';

-- Index for fast token lookups (one-tap RSVP links)
create unique index idx_rsvps_token on public.rsvps(token);

-- ============================================================
-- 7. RSVP HISTORY
-- Immutable log of every RSVP change for participation tracking.
-- ============================================================
create table public.rsvp_history (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  schedule_id uuid not null references public.program_schedules(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.rsvp_history is 'Immutable audit log of every RSVP status change. Used for participation history and reporting.';
comment on column public.rsvp_history.changed_by is 'NULL = self-service change by the golfer. Set to admin profile_id if changed by an admin after cutoff.';

-- ============================================================
-- 8. GUEST REQUESTS
-- Members requesting to bring guests for a specific week.
-- ============================================================
create table public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.program_schedules(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  guest_first_name text not null,
  guest_last_name text not null,
  guest_email text not null,
  guest_phone text,
  guest_ghin_number text not null,
  guest_profile_id uuid references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guest_requests is 'Guest requests for specific weeks. Pending until admin approves after Friday cutoff.';
comment on column public.guest_requests.guest_profile_id is 'Links to profiles if the guest has been registered in the system before.';

-- ============================================================
-- 9. PLAYING PARTNER PREFERENCES
-- Standing preferences per golfer per program (up to 10).
-- ============================================================
create table public.playing_partner_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  preferred_partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, program_id, preferred_partner_id)
);

comment on table public.playing_partner_preferences is 'Standing playing partner preferences. Up to 10 per golfer per program.';

-- ============================================================
-- 10. TEE TIME PREFERENCES
-- Per golfer per program: early, late, or no preference.
-- ============================================================
create table public.tee_time_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  preference text not null default 'no_preference'
    check (preference in ('early', 'late', 'no_preference')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, program_id)
);

-- ============================================================
-- 11. PRO SHOP CONTACTS
-- Email contacts per program for Friday detail emails.
-- ============================================================
create table public.pro_shop_contacts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.pro_shop_contacts is 'Pro shop email recipients for Friday detail emails. Multiple per program.';

-- ============================================================
-- 12. EMAIL TEMPLATES
-- Canned message templates for admin custom emails.
-- ============================================================
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  category text not null default 'custom'
    check (category in ('cancellation', 'extra_spots', 'weather', 'course_update', 'custom')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_templates is 'Canned email templates. program_id NULL = global template available to all programs.';

-- ============================================================
-- 13. EMAIL LOG
-- Record of every email sent by the system.
-- ============================================================
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  schedule_id uuid references public.program_schedules(id) on delete set null,
  email_type text not null
    check (email_type in ('invite', 'reminder', 'confirmation_golfer', 'confirmation_proshop', 'no_game', 'guest_approved', 'guest_denied', 'guest_request_pending', 'registration_pending', 'custom')),
  subject text not null,
  recipient_count smallint not null default 0,
  sent_by uuid references public.profiles(id),
  sent_at timestamptz not null default now()
);

comment on table public.email_log is 'Audit trail of every email sent. sent_by is NULL for automated emails.';

-- ============================================================
-- SEED: Default email templates
-- ============================================================
insert into public.email_templates (name, subject, body, category) values
  ('Game Cancelled',
   '{{program_name}}: {{game_date}} — Game Cancelled',
   'Unfortunately, {{program_name}} for {{game_date}} has been cancelled due to {{reason}}.\n\nThe next scheduled game is {{next_game_date}}.\n\nSee you then!',
   'cancellation'),
  ('Extra Spots Available',
   '{{program_name}}: {{game_date}} — Spots Still Available!',
   'We still have {{open_spots}} spots open for {{program_name}} on {{game_date}}!\n\nIf you''re available, update your RSVP now:\n{{rsvp_link}}',
   'extra_spots'),
  ('Weather Advisory',
   '{{program_name}}: {{game_date}} — Weather Update',
   'Heads up for {{program_name}} on {{game_date}}:\n\n{{weather_details}}\n\nThe game is still on. See you there!',
   'weather'),
  ('Course Update',
   '{{program_name}}: {{game_date}} — Course Update',
   'Important update for {{program_name}} on {{game_date}}:\n\n{{update_details}}',
   'course_update');

-- ============================================================
-- SEED: First program — FRCC Saturday Morning Group
-- ============================================================
insert into public.programs (name, description, frequency, day_of_week, default_capacity)
values (
  'FRCC Saturday Morning Group',
  'Weekly Saturday morning game at Fairbanks Ranch Country Club.',
  'weekly',
  6,
  16
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_admins enable row level security;
alter table public.program_subscriptions enable row level security;
alter table public.program_schedules enable row level security;
alter table public.rsvps enable row level security;
alter table public.rsvp_history enable row level security;
alter table public.guest_requests enable row level security;
alter table public.playing_partner_preferences enable row level security;
alter table public.tee_time_preferences enable row level security;
alter table public.pro_shop_contacts enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_log enable row level security;

-- --------------------------------------------------------
-- RLS POLICIES: Profiles
-- --------------------------------------------------------
-- Everyone can read active profiles (for partner search, RSVP display)
create policy "Profiles: public read for active members"
  on public.profiles for select
  using (status = 'active' or id = auth.uid());

-- Users can update their own profile
create policy "Profiles: users update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Super admins can do everything with profiles
create policy "Profiles: super admin full access"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- Program admins can read all profiles and update status
create policy "Profiles: program admin read"
  on public.profiles for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Programs
-- --------------------------------------------------------
create policy "Programs: authenticated read"
  on public.programs for select
  to authenticated
  using (true);

create policy "Programs: super admin manage"
  on public.programs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: RSVPs
-- --------------------------------------------------------
-- Golfers can read their own RSVPs
create policy "RSVPs: users read own"
  on public.rsvps for select
  using (profile_id = auth.uid());

-- Golfers who are "in" can see other "in" RSVPs for the same schedule
create policy "RSVPs: in members see other in members"
  on public.rsvps for select
  using (
    status = 'in'
    and exists (
      select 1 from public.rsvps my_rsvp
      where my_rsvp.schedule_id = rsvps.schedule_id
        and my_rsvp.profile_id = auth.uid()
        and my_rsvp.status = 'in'
    )
  );

-- Admins can see all RSVPs for their programs
create policy "RSVPs: program admin full read"
  on public.rsvps for select
  using (
    exists (
      select 1 from public.program_admins pa
      join public.program_schedules ps on ps.program_id = pa.program_id
      where pa.profile_id = auth.uid()
        and ps.id = rsvps.schedule_id
    )
  );

-- Super admins can do everything with RSVPs
create policy "RSVPs: super admin full access"
  on public.rsvps for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- Golfers can update their own RSVP
create policy "RSVPs: users update own"
  on public.rsvps for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- --------------------------------------------------------
-- RLS POLICIES: Program Subscriptions
-- --------------------------------------------------------
create policy "Subscriptions: users manage own"
  on public.program_subscriptions for all
  using (profile_id = auth.uid());

create policy "Subscriptions: admin read"
  on public.program_subscriptions for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid() and pa.program_id = program_subscriptions.program_id
    )
  );

create policy "Subscriptions: super admin full access"
  on public.program_subscriptions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Program Schedules
-- --------------------------------------------------------
create policy "Schedules: authenticated read"
  on public.program_schedules for select
  to authenticated
  using (true);

create policy "Schedules: program admin manage"
  on public.program_schedules for all
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid() and pa.program_id = program_schedules.program_id
    )
  );

create policy "Schedules: super admin full access"
  on public.program_schedules for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Guest Requests
-- --------------------------------------------------------
create policy "Guests: members manage own requests"
  on public.guest_requests for all
  using (requested_by = auth.uid());

create policy "Guests: program admin manage"
  on public.guest_requests for all
  using (
    exists (
      select 1 from public.program_admins pa
      join public.program_schedules ps on ps.program_id = pa.program_id
      where pa.profile_id = auth.uid()
        and ps.id = guest_requests.schedule_id
    )
  );

create policy "Guests: super admin full access"
  on public.guest_requests for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Playing Partner Preferences
-- --------------------------------------------------------
create policy "Partners: users manage own"
  on public.playing_partner_preferences for all
  using (profile_id = auth.uid());

create policy "Partners: admin read for program"
  on public.playing_partner_preferences for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid() and pa.program_id = playing_partner_preferences.program_id
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Tee Time Preferences
-- --------------------------------------------------------
create policy "Tee time: users manage own"
  on public.tee_time_preferences for all
  using (profile_id = auth.uid());

create policy "Tee time: admin read for program"
  on public.tee_time_preferences for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid() and pa.program_id = tee_time_preferences.program_id
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: Pro Shop Contacts, Templates, Email Log
-- --------------------------------------------------------
create policy "Pro shop: admin read"
  on public.pro_shop_contacts for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid() and pa.program_id = pro_shop_contacts.program_id
    )
  );

create policy "Pro shop: super admin manage"
  on public.pro_shop_contacts for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

create policy "Templates: authenticated read"
  on public.email_templates for select
  to authenticated
  using (true);

create policy "Templates: super admin manage"
  on public.email_templates for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

create policy "Email log: admin read"
  on public.email_log for select
  using (
    exists (
      select 1 from public.program_admins pa
      where pa.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

create policy "Email log: system insert"
  on public.email_log for insert
  to authenticated
  with check (true);

-- --------------------------------------------------------
-- RLS POLICIES: Program Admins
-- --------------------------------------------------------
create policy "Program admins: authenticated read"
  on public.program_admins for select
  to authenticated
  using (true);

create policy "Program admins: super admin manage"
  on public.program_admins for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- --------------------------------------------------------
-- RLS POLICIES: RSVP History
-- --------------------------------------------------------
create policy "RSVP history: users read own"
  on public.rsvp_history for select
  using (profile_id = auth.uid());

create policy "RSVP history: admin read for program"
  on public.rsvp_history for select
  using (
    exists (
      select 1 from public.program_admins pa
      join public.program_schedules ps on ps.program_id = pa.program_id
      where pa.profile_id = auth.uid()
        and ps.id = rsvp_history.schedule_id
    )
  );

create policy "RSVP history: super admin read"
  on public.rsvp_history for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- ============================================================
-- FUNCTIONS: Auto-update updated_at timestamp
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.programs
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.program_subscriptions
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.program_schedules
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.rsvps
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.guest_requests
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.tee_time_preferences
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.email_templates
  for each row execute function public.handle_updated_at();

-- ============================================================
-- FUNCTION: Create profile on auth signup
-- Triggered when a new user signs up via Supabase Auth.
-- Pulls metadata from the magic link signup.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, ghin_number, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'ghin_number', ''),
    case
      when new.email_confirmed_at is not null then 'pending_approval'
      else 'pending_email'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNCTION: Update profile status when email is confirmed
-- ============================================================
create or replace function public.handle_email_confirmed()
returns trigger as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set status = 'pending_approval'
    where id = new.id and status = 'pending_email';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_email_confirmed();
