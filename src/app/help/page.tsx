import Header from "@/components/header";
import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { createClient } from "@/lib/supabase/server";

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
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            {user && (
              <Link
                href="/dashboard"
                className="text-sm text-teal-700 hover:text-teal-600"
              >
                &larr; Back to Dashboard
              </Link>
            )}
            <h1 className="mt-2 text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Help & How It Works
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Everything you need to know about using FRCC Golf Games.
            </p>
          </div>

          {/* Golfer FAQ */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-navy-900">
              For Golfers
            </h2>
            <div className="space-y-2">
              <FAQ question="How do I RSVP for a game?">
                <p>
                  Before each game, you&apos;ll receive an invite email with a one-tap link.
                  Tap <strong>I&apos;m In</strong>, <strong>I&apos;m Out</strong>, or{" "}
                  <strong>Not Sure Yet</strong> — no login required. You can also RSVP
                  from your Dashboard after signing in.
                </p>
              </FAQ>

              <FAQ question="When do invites go out and what's the schedule?">
                <p>
                  Each event follows its own email cycle configured by the admin:{" "}
                  <strong>Invite</strong> — sent to all subscribed golfers.{" "}
                  <strong>Reminder</strong> — sent to anyone who hasn&apos;t responded
                  or said &quot;Not Sure.&quot;{" "}
                  <strong>Cutoff</strong> — RSVP deadline. After cutoff, only admins
                  can change responses.{" "}
                  <strong>Confirmation</strong> — sent to all confirmed players and
                  the pro shop. Check your invite email for the specific cutoff time
                  for your event.
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
                  using the link in your confirmation email or from your Dashboard.
                  After cutoff, only an admin can update your status.
                </p>
              </FAQ>

              <FAQ question="How do I bring a guest?">
                <p>
                  After you RSVP &quot;I&apos;m In,&quot; you&apos;ll see a{" "}
                  <strong>Request Guest</strong> section on the RSVP page. Enter your
                  guest&apos;s name, email, and GHIN number. An admin will review and
                  approve guest requests after the RSVP cutoff. Guests only fill spots
                  that members haven&apos;t claimed.
                </p>
              </FAQ>

              <FAQ question="What are playing partner preferences?">
                <p>
                  You can rank up to 10 preferred playing partners from the{" "}
                  <strong>Playing Partner Preferences</strong> page (accessible from
                  your Dashboard). These rankings help the system build suggested
                  foursomes. Higher-ranked partners are weighted more heavily. These are
                  suggestions — they don&apos;t guarantee you&apos;ll be paired
                  together.
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
                  On your Dashboard, scroll to the <strong>My Events</strong> section
                  and tap <strong>Unsubscribe</strong> next to the event. You&apos;ll
                  stop receiving invites but keep your account. To rejoin later, log in
                  and re-subscribe.
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

              <FAQ question='Who can see my information when I RSVP "In"?'>
                <p>
                  Other golfers who are also &quot;In&quot; can see a list of confirmed
                  players shown as first initial and last name only (e.g., &quot;J.
                  Smith&quot;). Your email, phone, and GHIN are never shown to other
                  golfers — only to admins and the pro shop in the confirmation email.
                </p>
              </FAQ>
            </div>
          </section>

          {/* Admin FAQ */}
          {isAdmin && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-semibold text-navy-900">
                For Admins
              </h2>
              <div className="space-y-2">
                <FAQ question="How does the email cycle work?">
                  <p>
                    Each event has four automated emails per cycle:{" "}
                    <strong>Invite</strong> — sent to all subscribed golfers.{" "}
                    <strong>Reminder</strong> — sent only to &quot;Not Sure&quot; and
                    &quot;No Response&quot; golfers.{" "}
                    <strong>Golfer Confirmation</strong> — sent to all confirmed
                    players with the player list.{" "}
                    <strong>Pro Shop Confirmation</strong> — sent to pro shop contacts
                    with full player details (names, phones, GHIN). You can customize
                    the send day and time for each email in{" "}
                    <strong>Event Settings → Email Schedule</strong>.
                  </p>
                </FAQ>

                <FAQ question="How do I approve new member registrations?">
                  <p>
                    When someone registers through a join link, they appear as
                    &quot;Pending Approval&quot; on the Admin Dashboard and in the{" "}
                    <strong>Member Directory</strong>. Tap <strong>Approve</strong> to
                    activate their account and subscribe them to the event, or{" "}
                    <strong>Deny</strong> to reject. You can also add golfers directly
                    via <strong>+ Add Golfer</strong> — this bypasses the approval
                    step.
                  </p>
                </FAQ>

                <FAQ question="How do I manage RSVPs after the cutoff?">
                  <p>
                    After the RSVP cutoff, go to the RSVP management page for that
                    week (tap any upcoming game on the Admin Dashboard). You&apos;ll
                    see a status dropdown next to each golfer — you can change anyone&apos;s
                    status (In, Out, Waitlisted, etc.) and promote golfers from the
                    waitlist using the <strong>Promote</strong> button.
                  </p>
                </FAQ>

                <FAQ question='How do I cancel a game or mark "No Game"?'>
                  <p>
                    Go to <strong>Event Settings → Schedule</strong> to see the
                    rolling 8-week calendar. Toggle any week to <strong>No Game</strong>.
                    If you toggle before the invite is sent, golfers will receive a
                    cancellation notice instead of an invite email. The notice tells them
                    the date of the next scheduled game.
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
                    members haven&apos;t claimed.
                  </p>
                </FAQ>

                <FAQ question="How do I share the event join link with new golfers?">
                  <p>
                    Go to <strong>Event Settings</strong> and look for the{" "}
                    <strong>Join Link</strong> section. You&apos;ll see the event-specific
                    URL with a copy button. Share this link with anyone you want to
                    invite — they&apos;ll fill out a short registration form and
                    you&apos;ll approve them from the Member Directory.
                  </p>
                </FAQ>

                <FAQ question="What are feature flags and how do they work?">
                  <p>
                    In <strong>Event Settings</strong>, the{" "}
                    <strong>Feature Flags</strong> section lets you toggle optional
                    features on or off for each event: guest requests, tee time
                    preferences, and playing partner preferences. Changes take effect
                    immediately — if you disable a feature, golfers won&apos;t see
                    that option on their RSVP page.
                  </p>
                </FAQ>

                <FAQ question="How do I send a custom email to golfers?">
                  <p>
                    Go to your event&apos;s page and tap <strong>Send Email</strong>.
                    You can choose a template (Game Cancelled, Extra Spots, Weather
                    Advisory, Course Update) or write a custom message. Select the
                    recipients by RSVP status (all confirmed, all not sure, everyone,
                    etc.) and send.
                  </p>
                </FAQ>

                <FAQ question="How do I manage member subscriptions?">
                  <p>
                    From the <strong>Member Directory</strong>, tap{" "}
                    <strong>Manage</strong> next to any member to see their detail
                    page. There you can toggle which events they&apos;re subscribed to.
                    You can also deactivate a member (stops all invites, preserves
                    history) or reactivate them later.
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
    </>
  );
}
