import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/header";
import {
  StatusDropdown,
  PromoteButton,
  QuickActionButton,
} from "./rsvp-controls";
import { GuestApprovalButton, GuestDenialButton } from "./guest-controls";
import { formatPhoneDisplay } from "@/lib/format";

type RsvpStatus = "in" | "out" | "not_sure" | "no_response" | "waitlisted";

const statusLabels: Record<RsvpStatus, string> = {
  in: "In",
  out: "Out",
  not_sure: "Not Sure",
  no_response: "No Response",
  waitlisted: "Waitlisted",
};

const statusBadgeColors: Record<RsvpStatus, string> = {
  in: "bg-teal-100 text-navy-900",
  out: "bg-red-100 text-red-800",
  not_sure: "bg-yellow-100 text-yellow-800",
  no_response: "bg-gray-100 text-gray-600",
  waitlisted: "bg-orange-100 text-orange-800",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function AdminRsvpPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  const { scheduleId } = await params;
  const { supabase } = await requireAdmin();

  // Fetch the schedule with event info
  const { data: schedule, error: schedError } = await supabase
    .from("event_schedules")
    .select("*, event:events(*)")
    .eq("id", scheduleId)
    .single();

  if (schedError || !schedule) {
    notFound();
  }

  const event = schedule.event;
  const capacity = schedule.capacity || event?.default_capacity || 16;

  // Fetch all RSVPs for this schedule with profile info
  const { data: rsvps, error: rsvpsError } = await supabase
    .from("rsvps")
    .select(
      "*, profile:profiles(id, first_name, last_name, email, phone, ghin_number)"
    )
    .eq("schedule_id", scheduleId)
    .order("responded_at", { ascending: true, nullsFirst: false });

  console.log('Admin RSVP query:', { scheduleId, rsvps, error: rsvpsError });

  const allRsvps = rsvps || [];

  // Fetch guest requests for this schedule
  const { data: guestRequests } = await supabase
    .from("guest_requests")
    .select(
      "*, requestor:profiles!requested_by(first_name, last_name, email)"
    )
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: true });

  const allGuestRequests = guestRequests || [];
  const pendingGuests = allGuestRequests.filter((g) => g.status === "pending");
  const approvedGuests = allGuestRequests.filter((g) => g.status === "approved");
  const deniedGuests = allGuestRequests.filter((g) => g.status === "denied");

  // Fetch playing partner preferences for confirmed golfers
  const confirmedIds = (rsvps || [])
    .filter((r) => r.status === "in")
    .map((r) => r.profile_id);

  const { data: preferences } = await supabase
    .from("playing_partner_preferences")
    .select(
      `
      profile_id,
      preferred_partner:profiles!playing_partner_preferences_preferred_partner_id_fkey(first_name, last_name)
    `
    )
    .eq("event_id", event?.id)
    .in("profile_id", confirmedIds.length > 0 ? confirmedIds : ["00000000-0000-0000-0000-000000000000"]);

  // Group preferences by profile (playing partners + tee time from RSVP)
  const preferencesByProfile: Record<string, { partners: string[]; teeTime: string }> = {};

  // Add playing partner preferences
  for (const pref of preferences || []) {
    if (!preferencesByProfile[pref.profile_id]) {
      preferencesByProfile[pref.profile_id] = { partners: [], teeTime: "no_preference" };
    }
    const partner = pref.preferred_partner as { first_name: string; last_name: string };
    preferencesByProfile[pref.profile_id].partners.push(
      `${partner.first_name[0]}. ${partner.last_name}`
    );
  }

  // Add tee time preferences from RSVPs (per-week)
  for (const rsvp of allRsvps) {
    if (rsvp.status === "in") {
      if (!preferencesByProfile[rsvp.profile_id]) {
        preferencesByProfile[rsvp.profile_id] = { partners: [], teeTime: rsvp.tee_time_preference || "no_preference" };
      } else {
        preferencesByProfile[rsvp.profile_id].teeTime = rsvp.tee_time_preference || "no_preference";
      }
    }
  }

  // Group by status
  const grouped: Record<RsvpStatus, typeof allRsvps> = {
    in: [],
    waitlisted: [],
    not_sure: [],
    no_response: [],
    out: [],
  };

  for (const rsvp of allRsvps) {
    const status = rsvp.status as RsvpStatus;
    if (grouped[status]) {
      grouped[status].push(rsvp);
    }
  }

  // Sort waitlisted by position
  grouped.waitlisted.sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.waitlist_position as number) || 999) -
      ((b.waitlist_position as number) || 999)
  );

  const inCount = grouped.in.length;
  const waitlistCount = grouped.waitlisted.length;
  const notSureCount = grouped.not_sure.length;
  const noResponseCount = grouped.no_response.length;
  const outCount = grouped.out.length;
  const spotsRemaining = Math.max(0, capacity - inCount);

  // Check cutoff status
  let isPastCutoff = false;
  if (event) {
    const gameDate = new Date(schedule.game_date);
    const cutoffDate = new Date(gameDate);
    const dayDiff = event.cutoff_day - gameDate.getDay();
    cutoffDate.setDate(
      gameDate.getDate() + (dayDiff <= 0 ? dayDiff : dayDiff - 7)
    );
    const [hours, minutes] = (event.cutoff_time || "10:00").split(":");
    cutoffDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    isPastCutoff = new Date() > cutoffDate;
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-teal-600 hover:text-teal-500"
          >
            &larr; Back to Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-navy-900">
            RSVP Management
          </h1>
          <p className="mt-1 text-lg text-gray-600">
            {event?.name} — {formatDate(schedule.game_date)}
          </p>
          {schedule.status === "cancelled" && (
            <span className="mt-1 inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Cancelled
            </span>
          )}
          {isPastCutoff && schedule.status !== "cancelled" && (
            <span className="mt-1 inline-block rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
              Past Cutoff — Admin Override Active
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-teal-200 bg-navy-50 p-3 text-center">
            <p className="text-2xl font-bold text-teal-600">{inCount}</p>
            <p className="text-xs text-teal-500">Confirmed</p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center">
            <p className="text-2xl font-bold text-orange-700">
              {waitlistCount}
            </p>
            <p className="text-xs text-orange-600">Waitlisted</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {notSureCount}
            </p>
            <p className="text-xs text-yellow-600">Not Sure</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-600">
              {noResponseCount}
            </p>
            <p className="text-xs text-gray-500">No Response</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{outCount}</p>
            <p className="text-xs text-red-600">Out</p>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {inCount} / {capacity} spots filled
            </span>
            <span
              className={`font-medium ${
                spotsRemaining > 0 ? "text-teal-500" : "text-red-600"
              }`}
            >
              {spotsRemaining > 0
                ? `${spotsRemaining} spots remaining`
                : "Full"}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                inCount >= capacity ? "bg-red-500" : "bg-teal-500"
              }`}
              style={{
                width: `${Math.min((inCount / capacity) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Confirmed Players */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-navy-900">
            Confirmed ({inCount})
          </h2>
          {inCount === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No confirmed players yet.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">
                      Preferences
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Email
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                      Responded
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {grouped.in.map((rsvp: Record<string, unknown>) => {
                    const profile = rsvp.profile as {
                      first_name: string;
                      last_name: string;
                      email: string;
                    };
                    const prefs = preferencesByProfile[rsvp.profile_id as string];
                    return (
                      <tr key={rsvp.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {profile?.email}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-gray-600 lg:table-cell">
                          {prefs ? (
                            <div className="space-y-1">
                              {prefs.partners.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Partners:</span>{" "}
                                  {prefs.partners.slice(0, 3).join(", ")}
                                  {prefs.partners.length > 3 && ` +${prefs.partners.length - 3}`}
                                </div>
                              )}
                              {prefs.teeTime !== "no_preference" && (
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Tee:</span>{" "}
                                  {prefs.teeTime === "early" ? "🌅 Early" : "🌄 Late"}
                                </div>
                              )}
                              {prefs.partners.length === 0 && prefs.teeTime === "no_preference" && (
                                <span className="text-xs text-gray-400">None set</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">None set</span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {profile?.email}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 md:table-cell">
                          {formatTime(rsvp.responded_at as string | null)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <StatusDropdown
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              currentStatus={rsvp.status as RsvpStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Approved Guests */}
        {approvedGuests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-blue-800">
              Approved Guests ({approvedGuests.length})
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Guest Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Guest Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Invited By
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                      GHIN
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {approvedGuests.map((guest: Record<string, unknown>) => {
                    const requestor = guest.requestor as {
                      first_name: string;
                      last_name: string;
                    };
                    return (
                      <tr key={guest.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {guest.guest_first_name as string}{" "}
                          {guest.guest_last_name as string}
                          <span className="ml-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Guest
                          </span>
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {guest.guest_email as string}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {guest.guest_email as string}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {requestor?.first_name} {requestor?.last_name}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 md:table-cell">
                          {guest.guest_ghin_number as string}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Pending Guest Requests */}
        {pendingGuests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-yellow-800">
              Pending Guest Requests ({pendingGuests.length})
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review these guest requests and approve or deny after the Friday
              cutoff.
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Guest Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Guest Email / Phone
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                      Guest GHIN
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingGuests.map((guest: Record<string, unknown>) => {
                    const requestor = guest.requestor as {
                      first_name: string;
                      last_name: string;
                    };
                    const guestName = `${guest.guest_first_name} ${guest.guest_last_name}`;
                    return (
                      <tr key={guest.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {requestor?.first_name} {requestor?.last_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          {guestName}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {guest.guest_email as string}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          <div>{guest.guest_email as string}</div>
                          <div className="text-xs text-gray-500">
                            {formatPhoneDisplay(guest.guest_phone as string)}
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 md:table-cell">
                          {guest.guest_ghin_number as string}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <GuestApprovalButton
                              guestRequestId={guest.id as string}
                              scheduleId={scheduleId}
                              guestName={guestName}
                            />
                            <GuestDenialButton
                              guestRequestId={guest.id as string}
                              scheduleId={scheduleId}
                              guestName={guestName}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Waitlisted */}
        {waitlistCount > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-orange-800">
              Waitlisted ({waitlistCount})
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Select golfers to promote to confirmed. Order is by response
              time, but you can promote anyone.
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Email
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                      Responded
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {grouped.waitlisted.map((rsvp: Record<string, unknown>) => {
                    const profile = rsvp.profile as {
                      first_name: string;
                      last_name: string;
                      email: string;
                    };
                    return (
                      <tr key={rsvp.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-orange-600">
                          #{rsvp.waitlist_position as number}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {profile?.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {profile?.email}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 md:table-cell">
                          {formatTime(rsvp.responded_at as string | null)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <PromoteButton
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              golferName={`${profile?.first_name} ${profile?.last_name}`}
                            />
                            <StatusDropdown
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              currentStatus={rsvp.status as RsvpStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Not Sure */}
        {notSureCount > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-yellow-800">
              Not Sure ({notSureCount})
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                  {grouped.not_sure.map((rsvp: Record<string, unknown>) => {
                    const profile = rsvp.profile as {
                      first_name: string;
                      last_name: string;
                      email: string;
                    };
                    return (
                      <tr key={rsvp.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {profile?.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {profile?.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <QuickActionButton
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              action="in"
                              label="Set In"
                              className="bg-teal-600 text-white hover:bg-teal-500"
                            />
                            <StatusDropdown
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              currentStatus={rsvp.status as RsvpStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* No Response */}
        {noResponseCount > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-700">
              No Response ({noResponseCount})
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                  {grouped.no_response.map((rsvp: Record<string, unknown>) => {
                    const profile = rsvp.profile as {
                      first_name: string;
                      last_name: string;
                      email: string;
                    };
                    return (
                      <tr key={rsvp.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {profile?.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {profile?.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <QuickActionButton
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              action="in"
                              label="Set In"
                              className="bg-teal-600 text-white hover:bg-teal-500"
                            />
                            <StatusDropdown
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              currentStatus={rsvp.status as RsvpStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Out */}
        {outCount > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-red-800">
              Out ({outCount})
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                  {grouped.out.map((rsvp: Record<string, unknown>) => {
                    const profile = rsvp.profile as {
                      first_name: string;
                      last_name: string;
                      email: string;
                    };
                    return (
                      <tr key={rsvp.id as string}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {profile?.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {profile?.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <QuickActionButton
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              action="in"
                              label="Set In"
                              className="border border-teal-300 text-teal-600 hover:bg-navy-50"
                            />
                            <StatusDropdown
                              rsvpId={rsvp.id as string}
                              scheduleId={scheduleId}
                              currentStatus={rsvp.status as RsvpStatus}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* No RSVPs at all */}
        {allRsvps.length === 0 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">
              No RSVPs have been created for this game yet. Invites will
              generate RSVPs automatically when the Monday cron runs.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
