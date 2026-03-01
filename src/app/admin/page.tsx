import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/format";
import Header from "@/components/header";
import { CollapsibleSection } from "@/components/collapsible-section";
import { WelcomeBanner } from "@/components/welcome-banner";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "./admin-actions";

export default async function AdminDashboard() {
  const { supabase, profile } = await requireAdmin();

  // Fetch all events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Fetch pending registrations
  const { data: pendingMembers } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "pending_approval")
    .eq("is_guest", false)
    .order("created_at", { ascending: true });

  // Fetch all active members
  const { data: activeMembers } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name", { ascending: true });

  // Fetch deactivated members
  const { data: deactivatedMembers } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "deactivated")
    .eq("is_guest", false)
    .order("last_name", { ascending: true });

  // Fetch pending guest requests
  const today = new Date().toISOString().split("T")[0];
  const { data: pendingGuestRequests } = await supabase
    .from("guest_requests")
    .select(
      "*, schedule:event_schedules(id, game_date, event:events(name)), requestor:profiles!requested_by(first_name, last_name)"
    )
    .eq("status", "pending")
    .gte("schedule.game_date", today)
    .order("created_at", { ascending: true });

  // Fetch upcoming schedules with RSVP counts
  const { data: upcomingGames } = await supabase
    .from("event_schedules")
    .select("*, events(name, default_capacity)")
    .gte("game_date", today)
    .order("game_date", { ascending: true })
    .limit(8);

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

      const capacity = game.capacity || game.events?.default_capacity || 16;

      return {
        ...game,
        inCount: inCount || 0,
        waitlistCount: waitlistCount || 0,
        noResponseCount: noResponseCount || 0,
        capacity,
      };
    })
  );

  const pendingCount = pendingMembers?.length || 0;
  const activeCount = activeMembers?.length || 0;
  const deactivatedCount = deactivatedMembers?.length || 0;
  const pendingGuestCount = pendingGuestRequests?.length || 0;

  return (
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
                Admin Dashboard
              </h1>
            <p className="text-sm text-gray-500">
              {profile.is_super_admin ? "Super Admin" : "Event Admin"} —{" "}
              {profile.first_name} {profile.last_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/members"
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              Members
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              My Dashboard
            </Link>
          </div>
        </div>

        {/* First-time admin welcome banner */}
        <div className="mt-6">
          <WelcomeBanner
            storageKey="frcc_admin_welcome_dismissed"
            title="Welcome, Admin!"
            items={[
              "<strong>Member Directory</strong> — approve registrations, add golfers, manage subscriptions",
              "<strong>Schedule</strong> — toggle games on/off for the rolling 8-week calendar",
              "<strong>RSVP Management</strong> — after Friday cutoff, override RSVPs, approve guests, manage the waitlist",
              "<strong>Event Settings</strong> — configure email times, capacity, feature flags, pro shop contacts",
            ]}
          />
        </div>

        {/* Action Items */}
        {(pendingCount > 0 || pendingGuestCount > 0) && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h2 className="font-semibold text-yellow-800">
              Action Required
            </h2>
            <div className="mt-1 space-y-1 text-sm text-yellow-700">
              {pendingCount > 0 && (
                <p>
                  • {pendingCount} registration{pendingCount !== 1 ? "s" : ""}{" "}
                  awaiting approval
                </p>
              )}
              {pendingGuestCount > 0 && (
                <p>
                  • {pendingGuestCount} guest request
                  {pendingGuestCount !== 1 ? "s" : ""} awaiting review
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-teal-700">{activeCount}</p>
            <p className="text-sm text-gray-500">Active Members</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-sm text-gray-500">Pending Approval</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-600">
              {events?.length || 0}
            </p>
            <p className="text-sm text-gray-500">Events</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-600">
              {upcomingGames?.length || 0}
            </p>
            <p className="text-sm text-gray-500">Upcoming Games</p>
          </div>
        </div>

        {/* Pending Registrations — expanded by default (actionable) */}
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
                {pendingMembers?.map((member) => (
                  <tr key={member.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {member.first_name} {member.last_name}
                      <span className="block text-xs text-gray-400 sm:hidden">
                        {member.email}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {member.email}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {member.ghin_number || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <ApproveButton profileId={member.id} />
                        <DenyButton profileId={member.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Pending Guest Requests — expanded by default (actionable) */}
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
                        {new Date(
                          schedule.game_date + "T12:00:00"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/admin/rsvp/${schedule.id}`}
                          className="text-sm text-teal-700 hover:text-teal-600"
                        >
                          Review &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Active Members — collapsed by default (biggest section, 50+ rows) */}
        <CollapsibleSection
          title="Active Members"
          count={activeCount}
          defaultOpen={false}
          viewAllHref="/admin/members"
          viewAllLabel="View All"
          emptyMessage="No active members yet."
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
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                    Phone
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                    GHIN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeMembers?.map((member) => (
                  <tr key={member.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {member.first_name} {member.last_name}
                      <span className="block text-xs text-gray-400 sm:hidden">
                        {member.email}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {member.email}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 md:table-cell">
                      {formatPhoneDisplay(member.phone)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {member.ghin_number || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {member.is_super_admin ? (
                        <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-600">
                          Golfer
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {!member.is_super_admin && (
                        <DeactivateButton profileId={member.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Deactivated Members — collapsed by default */}
        {deactivatedCount > 0 && (
          <CollapsibleSection
            title="Deactivated Members"
            count={deactivatedCount}
            defaultOpen={false}
            headerColor="text-gray-700"
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
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deactivatedMembers?.map((member) => (
                    <tr key={member.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                        {member.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <ReactivateButton profileId={member.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Upcoming Games — expanded by default (key info) */}
        <CollapsibleSection
          title="Upcoming Games"
          count={upcomingWithCounts.length}
          defaultOpen={true}
          emptyMessage="No upcoming games scheduled."
        >
          <div className="space-y-3">
            {upcomingWithCounts.map((game) => {
              const isCancelled = game.status === "cancelled";
              const formattedDate = new Date(
                game.game_date + "T12:00:00"
              ).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });

              return (
                <Link
                  key={game.id}
                  href={`/admin/rsvp/${game.id}`}
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
                      <p className="text-sm text-gray-500">
                        {game.events?.name}
                      </p>
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
            })}
          </div>
        </CollapsibleSection>

        {/* Events — expanded by default (small section) */}
        <CollapsibleSection
          title="Events"
          count={events?.length || 0}
          defaultOpen={true}
          emptyMessage="No events set up yet."
        >
          <div className="space-y-3">
            {profile.is_super_admin && (
              <div className="flex justify-end">
                <Link
                  href="/admin/events/new"
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
                >
                  + Create Event
                </Link>
              </div>
            )}
            {events?.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {event.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {event.description}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Capacity: {event.default_capacity}</p>
                    <p className="capitalize">{event.frequency}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <Link
                    href={`/admin/events/${event.id}/settings`}
                    className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/schedule`}
                    className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Schedule
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/email/compose`}
                    className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Send Email
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </main>
    </>
  );
}
