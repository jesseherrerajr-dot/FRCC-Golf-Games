import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatGameDate, formatGameDateShort } from "@/lib/format";
import { getTodayPacific } from "@/lib/timezone";
import {
  ApproveButton,
  DenyButton,
} from "@/app/admin/admin-actions";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, profile, adminEvents } = await requireAdmin();

  if (!hasEventAccess(profile, adminEvents, eventId)) {
    redirect("/admin");
  }

  // Fetch event details
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) {
    redirect("/admin");
  }

  const today = getTodayPacific();

  // Fetch pending registrations for this event
  // (registered through this event's join link OR generic registration)
  const { data: pendingGolfers } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "pending_approval")
    .eq("is_guest", false)
    .or(
      `registration_event_id.eq.${eventId},registration_event_id.is.null`
    )
    .order("created_at", { ascending: true });

  const pendingCount = pendingGolfers?.length || 0;

  // Fetch pending guest requests for this event's upcoming schedules
  const { data: pendingGuestRequests } = await supabase
    .from("guest_requests")
    .select(
      "*, schedule:event_schedules(id, game_date, event:events(name)), requestor:profiles!requested_by(first_name, last_name)"
    )
    .eq("schedule.event_id", eventId)
    .eq("status", "pending")
    .gte("schedule.game_date", today)
    .order("created_at", { ascending: true });

  const pendingGuestCount = pendingGuestRequests?.length || 0;

  // Fetch next upcoming game for this event (current week only)
  const { data: upcomingGames } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", eventId)
    .gte("game_date", today)
    .order("game_date", { ascending: true })
    .limit(1);

  // Get RSVP counts for each upcoming game
  const upcomingWithCounts = await Promise.all(
    (upcomingGames || []).map(async (game) => {
      const { count: inCount } = await supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", game.id)
        .eq("status", "in");

      const { count: waitlistCount } = await supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", game.id)
        .eq("status", "waitlisted");

      const { count: noResponseCount } = await supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", game.id)
        .in("status", ["no_response", "not_sure"]);

      const capacity = game.capacity || event.default_capacity || 16;

      return {
        ...game,
        inCount: inCount || 0,
        waitlistCount: waitlistCount || 0,
        noResponseCount: noResponseCount || 0,
        capacity,
      };
    })
  );

  // Check if guest requests feature is enabled for this event
  const guestRequestsEnabled = event.allow_guest_requests;

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Section 1: Action Required */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Action Required</h2>

            {/* Pending Registrations */}
            <CollapsibleSection
              title="Pending Registrations"
              count={pendingCount}
              defaultOpen={pendingCount > 0}
              emptyMessage="No registrations awaiting approval."
            >
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Name
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                        Email
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                        GHIN
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Registered
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingGolfers?.map((golfer) => (
                      <tr key={golfer.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {golfer.first_name} {golfer.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {golfer.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {golfer.email}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {golfer.ghin_number || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                          {new Date(golfer.created_at).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <ApproveButton profileId={golfer.id} />
                            <DenyButton profileId={golfer.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            {/* Pending Guest Requests — only shown when feature is enabled */}
            {guestRequestsEnabled && (
              <CollapsibleSection
                title="Pending Guest Requests"
                count={pendingGuestCount}
                defaultOpen={pendingGuestCount > 0}
                emptyMessage="No pending guest requests."
              >
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Guest Name
                        </th>
                        <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                          Requested By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Game Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pendingGuestRequests?.map((request: Record<string, unknown>) => {
                        const schedule = request.schedule as unknown as {
                          id: string;
                          game_date: string;
                          event: { name: string };
                        };
                        const requestor = request.requestor as {
                          first_name: string;
                          last_name: string;
                        };
                        return (
                          <tr key={request.id as string}>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                              {request.guest_first_name as string}{" "}
                              {request.guest_last_name as string}
                              <span className="block text-xs text-gray-400 sm:hidden">
                                by {requestor?.first_name} {requestor?.last_name}
                              </span>
                            </td>
                            <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                              {requestor?.first_name} {requestor?.last_name}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                              {formatGameDateShort(schedule.game_date)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <Link
                                href={`/admin/events/${eventId}/rsvp/${schedule.id}`}
                                className="text-sm text-teal-700 hover:text-teal-600"
                              >
                                Review →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            )}
          </section>

          {/* Section 2: Upcoming Games — current week only */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upcoming Games</h2>

            {upcomingWithCounts.length > 0 ? (
              (() => {
                const game = upcomingWithCounts[0];
                const isCancelled = game.status === "cancelled";
                const formattedDate = formatGameDate(game.game_date);

                return (
                  <Link
                    href={`/admin/events/${eventId}/rsvp/${game.id}`}
                    className={`block rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md ${
                      isCancelled
                        ? "border-red-200 opacity-60"
                        : "border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {formattedDate}
                          {isCancelled && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Cancelled
                            </span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-lg font-bold text-teal-700">
                            {game.inCount}/{game.capacity}
                          </p>
                          <p className="text-xs text-gray-500">Confirmed</p>
                        </div>
                        {game.waitlistCount > 0 && (
                          <div>
                            <p className="text-lg font-bold text-orange-600">
                              {game.waitlistCount}
                            </p>
                            <p className="text-xs text-gray-500">Waitlist</p>
                          </div>
                        )}
                        {game.noResponseCount > 0 && (
                          <div>
                            <p className="text-lg font-bold text-gray-400">
                              {game.noResponseCount}
                            </p>
                            <p className="text-xs text-gray-500">Pending</p>
                          </div>
                        )}
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
                      </div>
                    </div>
                    {/* Mini capacity bar */}
                    {!isCancelled && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${
                            game.inCount >= game.capacity
                              ? "bg-red-500"
                              : "bg-teal-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              (game.inCount / game.capacity) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })()
            ) : (
              <p className="text-sm text-gray-500">No upcoming games scheduled.</p>
            )}
          </section>

          {/* Quick Links */}
          <section className="mt-8 mb-12">
            <h2 className="text-lg font-semibold text-gray-900">Quick Links</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                href={`/admin/events/${eventId}/settings`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <span className="text-sm font-medium text-gray-900">
                  Settings
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>

              <Link
                href={`/admin/events/${eventId}/schedule`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <span className="text-sm font-medium text-gray-900">
                  Schedule
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>

              <Link
                href={`/admin/events/${eventId}/email/compose`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <span className="text-sm font-medium text-gray-900">
                  Send Email
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>

              <Link
                href={`/admin/events/${eventId}/golfers`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <span className="text-sm font-medium text-gray-900">
                  Golfers
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </section>
        </div>
      </main>
  );
}
