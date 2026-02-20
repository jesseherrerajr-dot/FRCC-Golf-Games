import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/format";
import Header from "@/components/header";

type RsvpStatus = "in" | "out" | "not_sure" | "no_response" | "waitlisted";

const statusLabels: Record<RsvpStatus, string> = {
  in: "I'm In",
  out: "I'm Out",
  not_sure: "Not Sure Yet",
  no_response: "No Response",
  waitlisted: "Waitlisted",
};

const statusStyles: Record<RsvpStatus, string> = {
  in: "bg-teal-100 text-teal-800 border-teal-200",
  out: "bg-red-100 text-red-800 border-red-200",
  not_sure: "bg-yellow-100 text-yellow-800 border-yellow-200",
  no_response: "bg-gray-100 text-gray-600 border-gray-200",
  waitlisted: "bg-orange-100 text-orange-800 border-orange-200",
};

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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

  // Fetch upcoming RSVPs for this user (games today or in the future)
  const today = new Date().toISOString().split("T")[0];
  const { data: upcomingRsvps } = await supabase
    .from("rsvps")
    .select(
      `id, token, status, waitlist_position,
       schedule:event_schedules(
         id, game_date, capacity, status,
         event:events(id, name, default_capacity)
       )`
    )
    .eq("golfer_id", user.id)
    .order("created_at", { ascending: true });

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
    <>
      <Header />
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
                weekly invites once an administrator confirms your membership.
              </div>
            )}

            {profile?.status === "active" && (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                Your account is active. You&apos;ll receive weekly invites for
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

          {/* Upcoming Games & RSVPs */}
          {upcoming.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                Upcoming Games
              </h3>
              <div className="mt-3 space-y-3">
                {upcoming.map((rsvp: Record<string, unknown>) => {
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
                          {formatGameDate(schedule.game_date)}
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
              <p className="mt-3 text-xs text-gray-400">
                Tap any game to view details or change your response.
              </p>
            </div>
          )}

          {upcoming.length === 0 && profile?.status === "active" && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                Upcoming Games
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                No upcoming games right now. You&apos;ll see your RSVPs here once
                the next invite goes out.
              </p>
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
                  Manage members, events, and approvals
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
              href="/preferences"
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
    </>
  );
}
