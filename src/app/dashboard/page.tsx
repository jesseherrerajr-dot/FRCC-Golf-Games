import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPhoneDisplay, formatGameDateShort } from "@/lib/format";
import { HelpText } from "@/components/help-text";
import { WelcomeBanner } from "@/components/welcome-banner";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { UnsubscribeButton } from "./subscription-actions";
import { getTodayPacific } from "@/lib/timezone";
import { RSVP_GOLFER_LABELS as statusLabels, RSVP_GOLFER_COLORS as statusStyles, type RsvpStatus } from "@/lib/rsvp-status";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, redirect to home
  if (!user) {
    redirect("/");
  }

  // Fetch the user's profile from the profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch the user's event subscriptions (two queries to avoid FK join issues)
  const { data: rawSubs } = await supabase
    .from("event_subscriptions")
    .select("id, event_id, is_active")
    .eq("profile_id", user.id)
    .eq("is_active", true);

  const { data: allEvents } = await supabase
    .from("events")
    .select("id, name, day_of_week, frequency")
    .eq("is_active", true);

  // Merge subscriptions with event data
  const subscriptions = (rawSubs || []).map((sub) => {
    const event = (allEvents || []).find((e) => e.id === sub.event_id);
    return { ...sub, event };
  });

  // Fetch upcoming RSVPs for this user (games today or in the future)
  const today = getTodayPacific();
  const { data: upcomingRsvps } = await supabase
    .from("rsvps")
    .select(
      `id, token, status, waitlist_position,
       schedule:event_schedules(
         id, game_date, capacity, status,
         event:events(id, name, default_capacity)
       )`
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  // Check if user has any playing partner preferences (for onboarding checklist)
  const { count: partnerPrefCount } = await supabase
    .from("playing_partner_preferences")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // Filter to upcoming games only and sort by date
  const upcoming = (upcomingRsvps || [])
    .filter((rsvp: Record<string, unknown>) => {
      const schedule = rsvp.schedule as { game_date: string; status: string } | null;
      return schedule && schedule.game_date >= today && schedule.status !== "cancelled";
    })
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const dateA = (a.schedule as { game_date: string })?.game_date || "";
      const dateB = (b.schedule as { game_date: string })?.game_date || "";
      return dateA.localeCompare(dateB);
    });

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Welcome */}
          <div className="rounded-lg border border-navy-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-semibold uppercase tracking-wide text-navy-900">
              Welcome, {profile?.first_name || user.user_metadata?.first_name || "Golfer"}!
            </h2>

            {/* Status badge */}
            {profile?.status === "pending_approval" && (
              <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                Your registration is pending admin approval. You&apos;ll receive
                invite emails once an administrator confirms your account.
              </div>
            )}

            {profile?.status === "active" && (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                Your account is active. You&apos;ll receive invite emails for
                your subscribed events.
              </div>
            )}

            {profile?.status === "deactivated" && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Your account has been deactivated. Please contact an
                administrator if you believe this is an error.
              </div>
            )}
          </div>

          {/* First-time welcome banner */}
          {profile?.status === "active" && (
            <div className="mt-4">
              <WelcomeBanner
                storageKey="frcc_welcome_dismissed"
                title="Welcome to FRCC Golf Games!"
                items={[
                  "You'll get an <strong>invite email</strong> before each game with a one-tap link to RSVP",
                  "Respond <strong>In</strong>, <strong>Out</strong>, or <strong>Not Sure</strong> — you can change anytime before the RSVP cutoff",
                  "Visit <strong>Profile</strong> to update your info and <strong>Preferences</strong> to set playing partners",
                ]}
              />
            </div>
          )}

          {/* Onboarding checklist */}
          {profile?.status === "active" && (
            <div className="mt-4">
              <OnboardingChecklist
                phone={profile.phone}
                ghin={profile.ghin_number}
                hasPartnerPrefs={(partnerPrefCount || 0) > 0}
              />
            </div>
          )}

          {/* Next Game — highlighted hero card */}
          {upcoming.length > 0 && (() => {
            const nextRsvp = upcoming[0] as Record<string, unknown>;
            const nextSchedule = nextRsvp.schedule as {
              game_date: string;
              capacity: number | null;
              event: { id: string; name: string; default_capacity: number } | null;
            };
            const nextEvent = nextSchedule?.event;
            const nextStatus = nextRsvp.status as RsvpStatus;
            const nextToken = nextRsvp.token as string;
            const rest = upcoming.slice(1);

            return (
              <>
                <Link
                  href={`/rsvp/${nextToken}`}
                  className="mt-4 block rounded-lg border-2 border-teal-200 bg-white p-6 shadow-sm transition-colors hover:bg-teal-50/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                        Next Game
                      </p>
                      <p className="mt-1 font-serif text-lg font-semibold text-navy-900">
                        {nextEvent?.name || "Game"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatGameDateShort(nextSchedule.game_date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-block rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[nextStatus]}`}
                      >
                        {statusLabels[nextStatus]}
                      </span>
                      <span className="text-xs text-teal-600">Tap to respond &rarr;</span>
                    </div>
                  </div>
                </Link>

                {/* Additional upcoming games */}
                {rest.length > 0 && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                      More Upcoming
                    </h3>
                    <div className="mt-3 space-y-3">
                      {rest.map((rsvp: Record<string, unknown>) => {
                        const schedule = rsvp.schedule as {
                          game_date: string;
                          capacity: number | null;
                          event: { id: string; name: string; default_capacity: number } | null;
                        };
                        const event = schedule?.event;
                        const status = rsvp.status as RsvpStatus;
                        const token = rsvp.token as string;

                        return (
                          <Link
                            key={rsvp.id as string}
                            href={`/rsvp/${token}`}
                            className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                          >
                            <div>
                              <p className="font-semibold text-gray-900">
                                {event?.name || "Game"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatGameDateShort(schedule.game_date)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
                              >
                                {statusLabels[status]}
                              </span>
                              <svg
                                className="h-4 w-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                />
                              </svg>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {upcoming.length === 0 && profile?.status === "active" && (
            <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
              <p className="font-serif text-lg font-semibold text-navy-900">
                No Upcoming Games
              </p>
              <p className="mt-2 text-sm text-gray-500">
                No upcoming games scheduled yet. When an admin opens the next game,
                you&apos;ll get an invite email with a one-tap link to RSVP.
              </p>
            </div>
          )}

          {/* My Events (subscriptions) */}
          {profile?.status === "active" && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                My Events
              </h3>
              <div className="mt-1 mb-2">
                <HelpText>These are the games you receive weekly invites for. Unsubscribe anytime.</HelpText>
              </div>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {subscriptions.map((sub) => {
                    const event = sub.event as {
                      id: string;
                      name: string;
                      day_of_week: number | null;
                      frequency: string | null;
                    } | null;
                    if (!event) return null;
                    const freq =
                      event.frequency === "biweekly"
                        ? "Bi-weekly"
                        : event.frequency === "monthly"
                          ? "Monthly"
                          : "Weekly";
                    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const day = event.day_of_week != null
                      ? dayNames[event.day_of_week] || ""
                      : "";
                    return (
                      <div
                        key={sub.id as string}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{event.name}</p>
                          <p className="text-sm text-gray-500">
                            {freq} &middot; {day}
                          </p>
                        </div>
                        <UnsubscribeButton eventId={event.id} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  You&apos;re not subscribed to any events yet. Ask your group
                  organizer for a join link, or check if you have a pending
                  registration being reviewed.
                </p>
              )}
            </div>
          )}

          {/* Profile summary */}
          {profile && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                  Your Profile
                </h3>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-teal-700 hover:text-teal-600"
                >
                  Edit
                </Link>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{profile.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">
                    {formatPhoneDisplay(profile.phone) || "Not set"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">GHIN</dt>
                  <dd className="font-medium text-gray-900">
                    {profile.ghin_number || "Not set"}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Admin link */}
          {profile?.is_super_admin && (
            <Link
              href="/admin"
              className="mt-4 flex items-center justify-between rounded-lg border border-navy-200 bg-navy-50 p-4 shadow-sm transition-colors hover:bg-navy-100"
            >
              <div>
                <h3 className="font-semibold text-navy-900">Admin Dashboard</h3>
                <p className="text-sm text-navy-600">
                  Manage golfers, events, and approvals
                </p>
              </div>
              <svg className="h-5 w-5 text-navy-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}

          {/* Quick links */}
          <div className="mt-4 space-y-3">
            <Link
              href="/profile"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
            >
              <div>
                <h3 className="font-semibold text-gray-900">Playing Partner Preferences</h3>
                <p className="text-sm text-gray-600">
                  Manage your preferred playing partners
                </p>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
  );
}
