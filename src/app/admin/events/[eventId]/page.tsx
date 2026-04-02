import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatGameDate, formatGameDateShort, formatDateTime } from "@/lib/format";
import { getTodayPacific, calculateSendDateString } from "@/lib/timezone";
import {
  ApproveButton,
  DenyButton,
} from "@/app/admin/admin-actions";
import { JoinLinkSection } from "./settings/components";

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

  // Fetch next upcoming game for this event
  // Respect event start_date — don't show games before the event officially begins
  const earliestDate = event.start_date && event.start_date > today ? event.start_date : today;
  const { data: upcomingGames } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", eventId)
    .gte("game_date", earliestDate)
    .order("game_date", { ascending: true })
    .limit(1);

  // Get invite email schedule config for this event
  const { data: inviteSchedule } = await supabase
    .from("email_schedules")
    .select("*")
    .eq("event_id", eventId)
    .eq("email_type", "invite")
    .eq("is_enabled", true)
    .limit(1)
    .single();

  // Get RSVP counts and invite info for the upcoming game
  const upcomingWithCounts = await Promise.all(
    (upcomingGames || []).map(async (game) => {
      const [
        { count: inCount },
        { count: outCount },
        { count: notSureCount },
        { count: noResponseCount },
        { count: waitlistCount },
      ] = await Promise.all([
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", game.id)
          .eq("status", "in"),
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", game.id)
          .eq("status", "out"),
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", game.id)
          .eq("status", "not_sure"),
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", game.id)
          .eq("status", "no_response"),
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", game.id)
          .eq("status", "waitlisted"),
      ]);

      // Check if invite was sent — look up email_log
      const { data: inviteLog } = await supabase
        .from("email_log")
        .select("created_at, recipient_count")
        .eq("schedule_id", game.id)
        .eq("email_type", "invite")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Compute scheduled invite date/time if not yet sent
      let scheduledInviteDisplay: string | null = null;
      if (!inviteLog && inviteSchedule) {
        const sendDate = calculateSendDateString(
          game.game_date,
          inviteSchedule.send_day_offset
        );
        const sendTime = inviteSchedule.send_time as string; // e.g. "08:45:00"
        const [h, m] = sendTime.split(":").map(Number);
        const hour12 = h % 12 || 12;
        const ampm = h < 12 ? "AM" : "PM";
        const timeStr = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
        // Format the date
        const [year, month, day] = sendDate.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
        const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });
        scheduledInviteDisplay = `${dayName}, ${monthName} ${day} at ${timeStr}`;
      }

      const capacity = game.capacity || event.default_capacity || 16;

      return {
        ...game,
        inCount: inCount || 0,
        outCount: outCount || 0,
        notSureCount: notSureCount || 0,
        noResponseCount: noResponseCount || 0,
        waitlistCount: waitlistCount || 0,
        capacity,
        inviteSent: !!inviteLog,
        inviteSentAt: inviteLog?.created_at || null,
        inviteRecipientCount: inviteLog?.recipient_count || 0,
        scheduledInviteDisplay,
      };
    })
  );

  // Check if guest requests feature is enabled for this event
  const guestRequestsEnabled = event.allow_guest_requests;

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name },
            ]}
          />

          {/* Section 1: Action Required */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Action Required</h2>

            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              {/* Pending Registrations */}
              <div className="px-4 pb-2">
                <CollapsibleSection
                  title="Pending Registrations"
                  count={pendingCount}
                  defaultOpen={pendingCount > 0}
                  emptyMessage="No registrations awaiting approval."
                  className=""
                >
                  <div className="overflow-hidden rounded-lg border border-gray-200">
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
              </div>

              {/* Pending Guest Requests — only shown when feature is enabled */}
              {guestRequestsEnabled && (
                <div className="border-t border-gray-100 px-4 pb-2">
                  <CollapsibleSection
                    title="Pending Guest Requests"
                    count={pendingGuestCount}
                    defaultOpen={pendingGuestCount > 0}
                    emptyMessage="No pending guest requests."
                    className=""
                  >
                    <div className="overflow-hidden rounded-lg border border-gray-200">
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
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Upcoming Game */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upcoming Game</h2>

            {upcomingWithCounts.length > 0 ? (
              (() => {
                const game = upcomingWithCounts[0];
                const isCancelled = game.status === "cancelled";
                const formattedDate = formatGameDate(game.game_date);

                return (
                  <Link
                    href={`/admin/events/${eventId}/rsvp/${game.id}`}
                    className={`block rounded-lg border bg-white shadow-sm transition hover:shadow-md ${
                      isCancelled
                        ? "border-red-200 opacity-60"
                        : "border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    {/* Header with date and chevron */}
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <h3 className="font-semibold text-gray-900">
                        {formattedDate}
                        {isCancelled && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Cancelled
                          </span>
                        )}
                      </h3>
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

                    {/* Summary tiles — responsive: 2col mobile, 3col tablet, 6col desktop */}
                    {!isCancelled && (
                      <div className="px-3 pb-4 pt-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                          {/* Invited */}
                          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invited</p>
                            <p className="mt-1 text-2xl font-bold text-gray-700">
                              {game.inviteSent ? game.inviteRecipientCount : "—"}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-gray-400">
                              {game.inviteSent
                                ? <>Sent {formatDateTime(game.inviteSentAt)}</>
                                : game.scheduledInviteDisplay
                                  ? <>{game.scheduledInviteDisplay}</>
                                  : <>Not scheduled</>
                              }
                            </p>
                          </div>

                          {/* I'm In */}
                          <div className="rounded-lg bg-teal-50 px-3 py-3 text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">In</p>
                            <p className="mt-1">
                              <span className="text-2xl font-bold text-teal-700">{game.inCount}</span>
                              <span className="text-base text-teal-400">/{game.capacity}</span>
                            </p>
                          </div>

                          {/* I'm Out */}
                          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Out</p>
                            <p className="mt-1 text-2xl font-bold text-gray-700">{game.outCount}</p>
                          </div>

                          {/* Not Sure */}
                          <div className="rounded-lg bg-amber-50 px-3 py-3 text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Not Sure</p>
                            <p className="mt-1 text-2xl font-bold text-amber-600">{game.notSureCount}</p>
                          </div>

                          {/* No Reply */}
                          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">No Reply</p>
                            <p className="mt-1 text-2xl font-bold text-gray-400">{game.noResponseCount}</p>
                          </div>

                          {/* Waitlist */}
                          <div className={`rounded-lg px-3 py-3 text-center ${game.waitlistCount > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${game.waitlistCount > 0 ? "text-orange-600" : "text-gray-400"}`}>Waitlist</p>
                            <p className={`mt-1 text-2xl font-bold ${game.waitlistCount > 0 ? "text-orange-600" : "text-gray-400"}`}>{game.waitlistCount}</p>
                          </div>
                        </div>

                        {/* Capacity bar */}
                        <div className="mt-3">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
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
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })()
            ) : (
              <p className="text-sm text-gray-500">No upcoming games scheduled.</p>
            )}
          </section>

          {/* Section 3: Manage Golfers */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Manage Golfers</h2>

            {/* Add New Golfer subsection */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Add New Golfer</h3>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Option 1: Register on their behalf */}
                <Link
                  href={`/admin/events/${eventId}/golfers/add`}
                  className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Already know the golfer&apos;s info?
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Register on their behalf — they&apos;ll be automatically approved and subscribed.
                    </p>
                  </div>
                  <svg className="ml-3 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>

                {/* Option 2: Share join link */}
                <div className="px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">
                    Don&apos;t know the golfer&apos;s info?
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Share this link so they can self-register. You&apos;ll need to approve them before they become active and subscribed.
                  </p>
                  <div className="mt-3">
                    <JoinLinkSection slug={event.slug} />
                  </div>
                </div>
              </div>
            </div>

            {/* Golfer Directory */}
            <Link
              href={`/admin/events/${eventId}/golfers`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
            >
              <div>
                <h3 className="font-semibold text-gray-900">Golfer Directory</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Search, view, deactivate, or manage event subscriptions
                </p>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </section>

          {/* Section 5: Manage Event */}
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Manage Event</h2>
            <div className="space-y-3">
              <Link
                href={`/admin/events/${eventId}/settings`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">Event Settings</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Name, capacity, admins, pro shop contacts, and feature flags
                  </p>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link
                href={`/admin/events/${eventId}/schedule`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">Schedule</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Toggle games on/off, override weekly capacity
                  </p>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </section>
        </div>
      </main>
  );
}
