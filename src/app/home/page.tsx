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
import { getGameWeather } from "@/lib/weather";
import { WeatherForecast } from "@/components/weather-forecast";
import type { GameType, GameWeatherForecast } from "@/types/events";

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
    .select("*")
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
  // Also skip games before the event's start_date (e.g., new events not yet launched)
  const upcoming = (upcomingRsvps || [])
    .filter((rsvp: Record<string, unknown>) => {
      const schedule = rsvp.schedule as { game_date: string; status: string; event: { id: string } | null } | null;
      if (!schedule || schedule.game_date < today || schedule.status === "cancelled") return false;
      // Check event start_date — skip games before the event officially begins
      if (schedule.event) {
        const evt = (allEvents || []).find((e) => e.id === schedule.event!.id);
        if (evt?.start_date && schedule.game_date < evt.start_date) return false;
      }
      return true;
    })
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const dateA = (a.schedule as { game_date: string })?.game_date || "";
      const dateB = (b.schedule as { game_date: string })?.game_date || "";
      return dateA.localeCompare(dateB);
    });

  // Fetch weather for each upcoming game (in parallel)
  const weatherMap: Record<string, GameWeatherForecast | null> = {};
  await Promise.all(
    upcoming.map(async (rsvp: Record<string, unknown>) => {
      const schedule = rsvp.schedule as {
        game_date: string;
        event: { id: string; game_type?: string; first_tee_time?: string } | null;
      } | null;
      if (!schedule?.event) return;
      try {
        const weather = await getGameWeather(
          schedule.event.id,
          schedule.game_date,
          schedule.event.first_tee_time || "07:30",
          (schedule.event.game_type as GameType) || "18_holes"
        );
        weatherMap[schedule.game_date + "_" + schedule.event.id] = weather;
      } catch {
        // Weather fetch failed — not critical, just skip
      }
    })
  );

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

          {/* My Events — unified section: each event with next game + RSVP + unsubscribe */}
          {profile?.status === "active" && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                My Events
              </h3>
              <div className="mt-1 mb-2">
                <HelpText>Your subscribed events with upcoming games and RSVP status.</HelpText>
              </div>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {subscriptions.map((sub) => {
                    const event = sub.event as {
                      id: string;
                      name: string;
                      day_of_week: number | null;
                      frequency: string | null;
                      game_type?: string;
                      first_tee_time?: string;
                    } | null;
                    if (!event) return null;

                    // Find the next upcoming RSVP for this event
                    const nextRsvp = upcoming.find((rsvp: Record<string, unknown>) => {
                      const schedule = rsvp.schedule as {
                        event: { id: string } | null;
                      } | null;
                      return schedule?.event?.id === event.id;
                    }) as Record<string, unknown> | undefined;

                    const nextSchedule = nextRsvp?.schedule as {
                      game_date: string;
                    } | null;
                    const nextStatus = nextRsvp?.status as RsvpStatus | undefined;
                    const nextToken = nextRsvp?.token as string | undefined;

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
                        className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
                      >
                        {/* Event header */}
                        <div className="px-4 pt-4 pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-serif font-semibold text-navy-900">
                                {event.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {freq} &middot; {day}
                              </p>
                            </div>
                            <UnsubscribeButton eventId={event.id} />
                          </div>
                        </div>

                        {/* Weather forecast */}
                        {nextSchedule && event && weatherMap[nextSchedule.game_date + "_" + event.id] && (
                          <div className="border-t border-gray-200 px-3 py-2">
                            <WeatherForecast
                              forecast={weatherMap[nextSchedule.game_date + "_" + event.id]!}
                              variant="compact"
                            />
                          </div>
                        )}

                        {/* Next game row */}
                        {nextRsvp && nextSchedule && nextToken ? (
                          <Link
                            href={`/rsvp/${nextToken}`}
                            className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-teal-50/30"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium uppercase tracking-wide text-teal-700">
                                Next Game
                              </span>
                              <span className="text-sm text-gray-600">
                                {formatGameDateShort(nextSchedule.game_date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[nextStatus || "no_response"]}`}
                              >
                                {statusLabels[nextStatus || "no_response"]}
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
                        ) : (
                          <div className="border-t border-gray-200 bg-white px-4 py-3">
                            <p className="text-xs text-gray-400">
                              No upcoming game scheduled
                            </p>
                          </div>
                        )}
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

          {/* My Profile */}
          {profile && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="p-6">
                <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                  My Profile
                </h3>
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
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Handicap Index</dt>
                    <dd className="font-medium text-gray-900">
                      {profile.handicap_index != null
                        ? Number(profile.handicap_index).toFixed(1)
                        : <span className="text-gray-400">—</span>}
                    </dd>
                  </div>
                  {profile.handicap_index != null && profile.handicap_updated_at && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Last Synced</dt>
                      <dd className="text-sm text-gray-400">
                        {new Date(profile.handicap_updated_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Single edit link */}
              <Link
                href="/profile"
                className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4 transition-colors hover:bg-gray-100"
              >
                <div>
                  <p className="font-semibold text-teal-700">Edit Profile &amp; Playing Partners</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update your contact info, GHIN, and playing partner preferences
                  </p>
                </div>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          )}

          {/* Get the App */}
          <Link
            href="/install"
            className="mt-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:bg-teal-50/30"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-50">
              <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-teal-700">Get the App</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Add FRCC Golf Games to your home screen for one-tap access
              </p>
            </div>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </main>
  );
}
