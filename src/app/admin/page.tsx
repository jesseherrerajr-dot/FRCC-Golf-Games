import { requireAdmin, hasEventAccess } from "@/lib/auth";
import Link from "next/link";
import { formatGameDate } from "@/lib/format";
import { getTodayPacific } from "@/lib/timezone";

export default async function AdminDashboard() {
  const { supabase, profile, adminEvents } = await requireAdmin();

  const today = getTodayPacific();

  // Fetch events visible to this admin
  let eventsQuery = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Event admins only see their assigned events
  if (!profile.is_super_admin) {
    const assignedEventIds = adminEvents.map((e) => e.event_id);
    eventsQuery = eventsQuery.in("id", assignedEventIds);
  }

  const { data: events } = await eventsQuery;

  // Build event cards with metrics
  const eventCards = await Promise.all(
    (events || []).map(async (event) => {
      // Get next upcoming game for this event
      const { data: nextGame } = await supabase
        .from("event_schedules")
        .select("*")
        .eq("event_id", event.id)
        .gte("game_date", today)
        .order("game_date", { ascending: true })
        .limit(1)
        .single();

      // Get confirmed count for next game
      let inCount = 0;
      if (nextGame) {
        const { count } = await supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", nextGame.id)
          .eq("status", "in");
        inCount = count || 0;
      }

      // Get pending registrations for this event
      const { data: pendingForEvent } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "pending_approval")
        .eq("is_guest", false)
        .or(`registration_event_id.eq.${event.id},registration_event_id.is.null`);

      // Get pending guest requests for this event's upcoming games
      const { data: pendingGuestsForEvent } = await supabase
        .from("guest_requests")
        .select(
          "*, schedule:event_schedules(id, game_date, event:events(id))"
        )
        .eq("status", "pending")
        .gte("schedule.game_date", today);

      const pendingGuestsFiltered = (pendingGuestsForEvent || []).filter(
        (req: any) => req.schedule?.event?.id === event.id
      );

      const capacity = nextGame?.capacity || event.default_capacity || 16;

      return {
        event,
        nextGame,
        inCount,
        capacity,
        pendingRegistrations: pendingForEvent?.length || 0,
        pendingGuests: pendingGuestsFiltered.length,
      };
    })
  );

  // Calculate global stats
  const totalPendingRegistrations = eventCards.reduce(
    (sum, card) => sum + card.pendingRegistrations,
    0
  );
  const totalPendingGuests = eventCards.reduce(
    (sum, card) => sum + card.pendingGuests,
    0
  );
  const hasActionItems = totalPendingRegistrations > 0 || totalPendingGuests > 0;

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-navy-900 uppercase tracking-wide">
              Admin
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {profile.is_super_admin ? "Super Admin" : "Event Admin"} — {profile.first_name}{" "}
              {profile.last_name}
            </p>
          </div>

          {/* Action Alert (Global) */}
          {hasActionItems && (
            <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h2 className="font-semibold text-yellow-800">Action Required</h2>
              <div className="mt-2 space-y-1 text-sm text-yellow-700">
                {totalPendingRegistrations > 0 && (
                  <p>
                    • {totalPendingRegistrations} registration
                    {totalPendingRegistrations !== 1 ? "s" : ""} awaiting approval
                  </p>
                )}
                {totalPendingGuests > 0 && (
                  <p>
                    • {totalPendingGuests} guest request
                    {totalPendingGuests !== 1 ? "s" : ""} awaiting review
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Event Summary Cards (first — most used section) */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {profile.is_super_admin ? "Events" : "Your Events"}
            </h2>

            {eventCards.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <p className="text-gray-500">
                  {profile.is_super_admin
                    ? "No events set up yet. Create one to get started."
                    : "You are not assigned to any events yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {eventCards.map(
                  ({
                    event,
                    nextGame,
                    inCount,
                    capacity,
                    pendingRegistrations,
                    pendingGuests,
                  }) => {
                    const hasActionNeeded =
                      pendingRegistrations > 0 || pendingGuests > 0;
                    const nextGameDate = nextGame
                      ? formatGameDate(nextGame.game_date)
                      : "No upcoming games";

                    return (
                      <div
                        key={event.id}
                        className={`relative rounded-lg border shadow-sm transition hover:shadow-md ${
                          hasActionNeeded
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-gray-200 bg-white hover:border-teal-300"
                        }`}
                      >
                        {/* Action badge */}
                        {hasActionNeeded && (
                          <div className="absolute -right-2 -top-2">
                            <span className="inline-flex rounded-full bg-yellow-500 px-2.5 py-1 text-xs font-medium text-white">
                              Action
                            </span>
                          </div>
                        )}

                        <div className="p-4">
                          {/* Event name and next game date */}
                          <div className="mb-4">
                            <h3 className="text-base font-semibold text-gray-900">
                              {event.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-gray-500">
                              Next game: {nextGameDate}
                            </p>
                          </div>

                          {/* Key metrics */}
                          <div className="mb-4 grid grid-cols-2 gap-3">
                            {nextGame && (
                              <div className="rounded border border-gray-200 bg-white px-3 py-2">
                                <p className="text-lg font-bold text-teal-700">
                                  {inCount}/{capacity}
                                </p>
                                <p className="text-xs text-gray-500">Confirmed</p>
                              </div>
                            )}

                            {pendingRegistrations > 0 && (
                              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2">
                                <p className="text-lg font-bold text-yellow-700">
                                  {pendingRegistrations}
                                </p>
                                <p className="text-xs text-yellow-600">
                                  Pending{" "}
                                  {pendingRegistrations === 1 ? "Approval" : "Approvals"}
                                </p>
                              </div>
                            )}

                            {pendingGuests > 0 && (
                              <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2">
                                <p className="text-lg font-bold text-orange-700">
                                  {pendingGuests}
                                </p>
                                <p className="text-xs text-orange-600">
                                  Pending Guest
                                  {pendingGuests === 1 ? "" : "s"}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Manage button */}
                          <Link
                            href={`/admin/events/${event.id}`}
                            className={`inline-flex items-center gap-1 text-sm font-medium transition ${
                              hasActionNeeded
                                ? "text-yellow-700 hover:text-yellow-600"
                                : "text-teal-700 hover:text-teal-600"
                            }`}
                          >
                            Manage →
                          </Link>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* Super Admin Section */}
          {profile.is_super_admin && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Super Admin</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href="/admin/golfers"
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">Golfer Directory (All Events)</h3>
                    <p className="text-xs text-gray-500 mt-1">Manage all golfers and pending approvals</p>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400"
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
                </Link>

                <Link
                  href="/admin/events/new"
                  className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm hover:border-teal-400 hover:shadow-md transition"
                >
                  <div>
                    <h3 className="font-semibold text-teal-900">+ Create New Event</h3>
                    <p className="text-xs text-teal-700 mt-1">Set up a new recurring golf game</p>
                  </div>
                  <svg
                    className="h-5 w-5 text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
  );
}
