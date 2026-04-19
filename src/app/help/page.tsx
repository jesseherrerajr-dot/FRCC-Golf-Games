import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";

function FAQ({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50">
        <span>{question}</span>
        <svg
          className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-600">
        {children}
      </div>
    </details>
  );
}

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is an admin to show admin section prominently
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (profile?.is_super_admin) {
      isAdmin = true;
    } else {
      const { count } = await supabase
        .from("event_admins")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id);
      isAdmin = (count || 0) > 0;
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            {user && (
              <Breadcrumbs
                items={[
                  { label: "Home", href: "/home" },
                  { label: "Help" },
                ]}
              />
            )}
            <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Help & How It Works
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Everything you need to know about using FRCC Golf Games.
            </p>
          </div>

          {/* Golfer FAQ */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-navy-900">
              Golfer FAQ
            </h2>
            <div className="space-y-2">
              <FAQ question="How do I RSVP for a game?">
                <p>
                  Before each game, you&apos;ll receive an invite email with a one-tap link.
                  Tap <strong>I&apos;m In</strong>, <strong>I&apos;m Out</strong>, or{" "}
                  <strong>Not Sure Yet</strong> — no login required. You can also RSVP
                  from your Home page after signing in.
                </p>
              </FAQ>

              <FAQ question="When do invites go out and what's the schedule?">
                <p>
                  Each event follows its own email cycle configured by the admin:{" "}
                  <strong>Invite</strong> — sent to all subscribed golfers.{" "}
                  <strong>Reminder</strong> — sent to anyone who hasn&apos;t responded
                  or said &quot;Not Sure&quot; (if enabled by the admin).{" "}
                  <strong>RSVP Cutoff / Golfer Confirmation</strong> — RSVP deadline
                  and confirmation email sent to all confirmed players. After cutoff,
                  only admins can change responses.{" "}
                  <strong>Suggested Groupings</strong> — optional email with player details
                  and suggested groupings (if enabled by the admin). Check your invite
                  email for the specific cutoff time for your event.
                </p>
              </FAQ>

              <FAQ question='What does "Not Sure Yet" do?'>
                <p>
                  Choosing &quot;Not Sure Yet&quot; means you&apos;ll receive a reminder
                  email before the deadline so you can make a final decision. If you
                  don&apos;t respond by the RSVP cutoff, you&apos;ll be counted as
                  &quot;No Response&quot; and won&apos;t be included in the confirmed list.
                </p>
              </FAQ>

              <FAQ question="How does the waitlist work?">
                <p>
                  Each game has a limited number of spots (typically 16). If all spots
                  are filled when you tap &quot;I&apos;m In,&quot; you&apos;re
                  automatically added to a waitlist ranked by response time. If a spot
                  opens up, an admin will promote you from the waitlist and you&apos;ll
                  be notified.
                </p>
              </FAQ>

              <FAQ question="Can I change my RSVP after responding?">
                <p>
                  Yes — you can change your response anytime before the RSVP cutoff
                  using the link in your confirmation email or from your Home page.
                  After cutoff, only an admin can update your status.
                </p>
              </FAQ>

              {/* Guest FAQ hidden until guest feature is enabled
              <FAQ question="How do I bring a guest?">
                <p>
                  After you RSVP &quot;I&apos;m In,&quot; you&apos;ll see a{" "}
                  <strong>Request Guest</strong> section on the RSVP page. Enter your
                  guest&apos;s name, email, and GHIN number. An admin will review and
                  approve guest requests after the RSVP cutoff. Guests only fill spots
                  that golfers haven&apos;t claimed.
                </p>
              </FAQ>
              */}

              <FAQ question="What are playing partner preferences?">
                <p>
                  You can rank up to 10 preferred playing partners from the{" "}
                  <strong>Playing Partner Preferences</strong> page (accessible from
                  your Home page). These rankings help the system build suggested
                  foursomes. Higher-ranked partners are weighted more heavily. These are
                  suggestions — they don&apos;t guarantee you&apos;ll be paired
                  together.
                </p>
              </FAQ>

              <FAQ question="Can other golfers or admins see my playing partner preferences?">
                <p>
                  No — your preferences are completely private. Only you can see your
                  ranked list. Other golfers and admins cannot view who you&apos;ve
                  selected or how you&apos;ve ranked them. The system uses preferences
                  behind the scenes when building suggested foursomes, but the
                  preferences themselves are never shared. You can update your
                  preferences at any time from the{" "}
                  <strong>Playing Partner Preferences</strong> page.
                </p>
              </FAQ>

              <FAQ question="How do I update my profile (phone, GHIN, email)?">
                <p>
                  Go to <strong>Profile</strong> in the top navigation. You can update
                  your name, email, phone number, and GHIN number at any time. This info
                  is shared with the pro shop for game setup, so keep it current.
                </p>
              </FAQ>

              <FAQ question="How do I unsubscribe from an event?">
                <p>
                  On your Home page, scroll to the <strong>My Events</strong> section
                  and tap <strong>Unsubscribe</strong> next to the event. You&apos;ll
                  stop receiving invites but keep your account. To rejoin later, log in
                  and re-subscribe.
                </p>
              </FAQ>

              <FAQ question="What happens if a game is cancelled?">
                <p>
                  If an admin cancels an upcoming game, you&apos;ll receive an email
                  right away letting you know. The email will include the specific date
                  that was cancelled, a reason (if the admin provided one), and the date
                  of the next scheduled game. No action is needed on your part.
                </p>
              </FAQ>

              <FAQ question="I didn't get my invite or login email — what should I do?">
                <p>
                  Check your spam/junk folder first. If you&apos;re on a mobile device,
                  make sure to open the magic link in the same browser you used to
                  request it. If you still can&apos;t find the email, contact your group
                  organizer (see below) for assistance.
                </p>
              </FAQ>

              <FAQ question="What is a GHIN number and do I need one?">
                <p>
                  GHIN stands for Golf Handicap and Information Network. It&apos;s your
                  USGA handicap ID number. It&apos;s optional — you can add or update it
                  anytime in your Profile settings. The pro shop may use it when setting
                  up the game in Golf Genius.
                </p>
              </FAQ>

              <FAQ question="How does my Handicap Index get updated?">
                <p>
                  If you have a GHIN number on file, your Handicap Index is
                  automatically fetched from the USGA/GHIN system before each
                  scheduled game. You can see your current index and the date it was
                  last updated on your Home page under &quot;My Profile.&quot; You
                  don&apos;t need to do anything — it syncs automatically. If your
                  index doesn&apos;t appear, make sure your GHIN number is entered
                  correctly in your Profile settings.
                </p>
              </FAQ>

              <FAQ question='Who can see my information when I RSVP "In"?'>
                <p>
                  Other golfers who are also &quot;In&quot; can see a list of confirmed
                  players shown as first initial and last name only (e.g., &quot;J.
                  Smith&quot;). Your email, phone, and GHIN are never shown to other
                  golfers — only to admins and the pro shop in the confirmation email.
                </p>
              </FAQ>

              <FAQ question="How do I turn on push notifications?">
                <p>
                  Push notifications let you get alerts about game updates and
                  reminders even when the app isn&apos;t open. To enable them,
                  tap the{" "}
                  <strong>bell icon</strong> in the top menu bar. You&apos;ll be
                  asked to allow notifications — tap <strong>Allow</strong>.
                  The bell will appear filled in when notifications are on.
                </p>
                <p className="mt-2">
                  <strong>iPhone users:</strong> Push notifications only work
                  if you&apos;ve added FRCC Golf Games to your home screen
                  first (see below). This is an iOS requirement — notifications
                  aren&apos;t available when using Safari directly.
                </p>
                <p className="mt-2">
                  <strong>Android &amp; Desktop:</strong> Notifications work
                  in Chrome and most modern browsers without any extra setup.
                  Just tap the bell icon.
                </p>
                <p className="mt-2">
                  To turn notifications off, tap the bell icon again.
                </p>
              </FAQ>

              <FAQ question="How do I add FRCC Golf Games to my home screen?">
                <p>
                  You can install FRCC Golf Games as an app on your phone for
                  quick, one-tap access — no app store needed. On{" "}
                  <strong>iPhone</strong>, open the site in Safari, tap the Share
                  button, and select &quot;Add to Home Screen.&quot; On{" "}
                  <strong>Android</strong>, open the site in Chrome, tap the
                  three-dot menu, and select &quot;Add to Home screen&quot; or
                  &quot;Install app.&quot; For detailed steps, visit the{" "}
                  <a
                    href="/install"
                    className="text-teal-700 underline hover:text-teal-600"
                  >
                    install guide
                  </a>
                  .
                </p>
              </FAQ>
            </div>
          </section>

          {/* Admin FAQ */}
          {isAdmin && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold text-navy-900">
                Admin FAQ
              </h2>
              <div className="space-y-2">
                <FAQ question="How does the email cycle work?">
                  <p>
                    Each event has up to four automated emails per cycle:{" "}
                    <strong>Invite</strong> — sent to all subscribed golfers.{" "}
                    <strong>Reminder</strong> — sent only to &quot;Not Sure&quot; and
                    &quot;No Response&quot; golfers. Reminders can be toggled on or off
                    per event.{" "}
                    <strong>RSVP Cutoff / Golfer Confirmation</strong> — sent to all
                    confirmed players with the player list.{" "}
                    <strong>Suggested Groupings</strong> — sent to configured
                    recipients (pro shop contacts, admins, and/or confirmed golfers)
                    with full player details and suggested foursome groupings. This
                    email can be toggled on or off per event (off by default). You can customize the send day, time, and
                    on/off toggles for each email in{" "}
                    <strong>Event Settings → Automated Email Settings</strong>.
                    To see the status of each email, use the{" "}
                    <strong>Emails &amp; Comms</strong> button on your event card
                    on the Admin Dashboard, or tap the Emails row on the event card.
                    From there you can also manually trigger any email using the
                    Send Now buttons.
                  </p>
                </FAQ>

                <FAQ question="How do I approve new golfer registrations?">
                  <p>
                    When someone registers through a join link, they appear as
                    &quot;Pending Approval&quot; in the <strong>Action Required</strong>{" "}
                    section of your event card on the Admin Dashboard. Tap the pending
                    registration link to go directly to the Golfer Directory where you
                    can <strong>Approve</strong> or <strong>Deny</strong> each request.
                    You can also add golfers directly via the{" "}
                    <strong>+ Add Golfer</strong> button on the event card — this
                    bypasses the approval step entirely.
                  </p>
                </FAQ>

                <FAQ question="How do I manage RSVPs after the cutoff?">
                  <p>
                    After the RSVP cutoff, tap the RSVPs row on your event card
                    (on the Admin Dashboard) to go directly to the RSVP management
                    page for that week. You&apos;ll see a status dropdown next to
                    each golfer — you can change anyone&apos;s status (In, Out,
                    Waitlist, etc.) and promote golfers from the waitlist using the{" "}
                    <strong>Promote</strong> button.
                  </p>
                </FAQ>

                <FAQ question='How do I cancel a game or mark "No Game"?'>
                  <p>
                    Go to <strong>Schedule</strong> (from the event dashboard) to see the
                    rolling 8-week calendar. Tap <strong>Cancel</strong> next to any
                    week. You&apos;ll be asked to confirm and can optionally provide a
                    reason (e.g., &quot;Club tournament this week&quot;). Once confirmed,
                    a cancellation email is automatically sent to all active subscribers
                    with the cancelled date, your reason (if provided), and the next
                    scheduled game date.
                  </p>
                </FAQ>

                <FAQ question="How do I change capacity for a specific week?">
                  <p>
                    On the <strong>Schedule</strong> page, each week shows the current
                    capacity. You can override it for any individual week without
                    changing the event&apos;s default. This is useful for weeks when the
                    course can accommodate more or fewer groups.
                  </p>
                </FAQ>

                <FAQ question="How do I approve or deny guest requests?">
                  <p>
                    Guest requests appear on the RSVP management page for the relevant
                    week, under <strong>Pending Guest Requests</strong>. After the
                    RSVP cutoff, review each request and tap{" "}
                    <strong>Approve</strong> or <strong>Deny</strong>. Approved guests
                    are included in the confirmation emails. Guests only fill spots that
                    golfers haven&apos;t claimed.
                  </p>
                </FAQ>

                <FAQ question="How do I share the event join link with new golfers?">
                  <p>
                    The easiest way is to tap <strong>+ Add Golfer</strong> on your
                    event card (Admin Dashboard). On the Golfers page, you&apos;ll see
                    the join link with a copy button under &quot;Don&apos;t know the
                    golfer&apos;s info?&quot; Share this link with anyone you want to
                    invite — they&apos;ll fill out a short registration form and
                    you&apos;ll approve them from the Golfer Directory. The join link
                    is also available in <strong>Event Settings</strong>.
                  </p>
                </FAQ>

                <FAQ question="What are feature flags and how do they work?">
                  <p>
                    In <strong>Event Settings</strong>, the{" "}
                    <strong>Feature Flags</strong> section lets you toggle optional
                    features on or off for each event (currently: guest requests).
                    Changes take effect immediately — if you disable a feature,
                    golfers won&apos;t see that option on their RSVP page.
                    Playing partner preferences and tee time preferences are
                    managed in the <strong>Grouping Engine</strong> section
                    (super admin only).
                  </p>
                </FAQ>

                <FAQ question="How do I send a custom email to golfers?">
                  <p>
                    From your event card on the Admin Dashboard, tap{" "}
                    <strong>Emails &amp; Comms</strong> to see the email status page.
                    From there, tap <strong>Message Golfers</strong> to compose a
                    custom email. You can choose a template (Extra Spots,
                    Weather Advisory, Course Update) or write a custom message.
                    Select the recipients by RSVP status (all confirmed, all not sure,
                    everyone, etc.) and send.
                  </p>
                </FAQ>

                <FAQ question="How do I manage golfer subscriptions?">
                  <p>
                    From the <strong>Golfer Directory</strong>, tap any golfer&apos;s
                    row to see their detail page. There you can toggle which events
                    they&apos;re subscribed to.
                    You can also deactivate a golfer (stops all invites, preserves
                    history) or reactivate them later.
                  </p>
                </FAQ>

                <FAQ question="Where can I see admin reports?">
                  <p>
                    Super admins can access <strong>Reports</strong> from the
                    Admin Dashboard. The reports page includes four sections:{" "}
                    <strong>Golfer Engagement</strong> — RSVP response rates,
                    participation rates, and ghost detection (golfers who
                    haven&apos;t responded in 3+ weeks).{" "}
                    <strong>Platform Activity</strong> — login counts, page
                    views, most visited pages, and most active users over the
                    last 30 days.{" "}
                    <strong>Response Timing</strong> — how quickly golfers
                    respond after receiving the invite email.{" "}
                    <strong>Profile Completeness</strong> — identifies golfers
                    missing GHIN numbers, phone numbers, or handicap data.
                    Reports update automatically each time you visit the page.
                  </p>
                </FAQ>

                <FAQ question="How does the GHIN Handicap Sync work?">
                  <p>
                    When enabled in <strong>Event Settings</strong>, the system
                    automatically fetches each golfer&apos;s current Handicap Index
                    from the USGA/GHIN system before each scheduled game. Handicaps
                    are updated in batches (up to 20 per sync run) and shared across
                    events — if a golfer plays in multiple events, one sync covers
                    them all. You can see each golfer&apos;s handicap and last-updated
                    date in the <strong>Golfer Directory</strong> and on individual
                    golfer detail pages. Handicaps are also included in the Suggested
                    Groupings email. If the GHIN API becomes unavailable, the system
                    auto-disables and alerts the super admin — the rest of the app
                    continues working normally.
                  </p>
                </FAQ>
              </div>
            </section>
          )}

          {/* Contact Section */}
          <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Still need help?</h2>
            <p className="mt-2 text-sm text-gray-600">
              If you can&apos;t find what you&apos;re looking for, reach out to your
              group organizer and they&apos;ll get you sorted out.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              You can also reply to any automated email from FRCC Golf Games — it
              goes directly to the event admin.
            </p>
          </section>
        </div>
          </main>
  );
}
