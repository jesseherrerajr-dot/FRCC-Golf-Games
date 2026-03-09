import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CollapsibleSection } from "@/components/collapsible-section";
import {
  StatusDropdown,
  PromoteButton,
  QuickActionButton,
} from "./rsvp-controls";
import { GuestApprovalButton, GuestDenialButton } from "./guest-controls";
import { formatPhoneDisplay, formatGameDate, formatDateTime, formatInitialLastName } from "@/lib/format";
import { isPastCutoffPacific, calculateSendDateString } from "@/lib/timezone";
import { EmailStatusPanel } from "./email-controls";
import { RSVP_ADMIN_LABELS as statusLabels, RSVP_ADMIN_COLORS as statusBadgeColors, type RsvpStatus } from "@/lib/rsvp-status";

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

  // Fetch email log entries for this schedule (most recent per type)
  const { data: emailLogs } = await supabase
    .from("email_log")
    .select("email_type, sent_at, recipient_count")
    .eq("schedule_id", scheduleId)
    .order("sent_at", { ascending: false });

  type EmailLogEntry = { sentAt: string; recipientCount: number };
  const emailLogMap: Record<string, EmailLogEntry> = {};
  for (const log of emailLogs || []) {
    const key = log.email_type.startsWith("reminder") ? "reminder" :
      log.email_type === "confirmation_golfer" ? "golfer_confirmation" :
      log.email_type === "confirmation_proshop" ? "pro_shop" :
      log.email_type;
    // Keep the most recent (first in desc order)
    if (!emailLogMap[key]) {
      emailLogMap[key] = {
        sentAt: log.sent_at,
        recipientCount: log.recipient_count || 0,
      };
    }
  }

  // Fetch email schedules for this event (to compute scheduled send times)
  const { data: emailSchedules } = await supabase
    .from("email_schedules")
    .select("email_type, send_day_offset, send_time, is_enabled")
    .eq("event_id", event?.id)
    .eq("is_enabled", true);

  // Compute scheduled send display for each email type
  function formatScheduledTime(dayOffset: number, sendTime: string, gameDateStr: string): string {
    const sendDate = calculateSendDateString(gameDateStr, dayOffset);
    const [h, m] = sendTime.split(":").map(Number);
    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    const timeStr = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    const [year, month, day] = sendDate.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });
    return `${dayName}, ${monthName} ${day} at ${timeStr}`;
  }

  const emailScheduleMap: Record<string, string> = {};
  for (const es of emailSchedules || []) {
    const key = es.email_type.startsWith("reminder") ? "reminder" :
      es.email_type === "confirmation_golfer" ? "golfer_confirmation" :
      es.email_type === "confirmation_proshop" ? "pro_shop" :
      es.email_type === "pro_shop_detail" ? "pro_shop" :
      es.email_type;
    emailScheduleMap[key] = formatScheduledTime(
      es.send_day_offset,
      es.send_time,
      schedule.game_date
    );
  }

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
      formatInitialLastName(partner.first_name, partner.last_name)
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

  // Check cutoff status (using Pacific Time — Vercel runs in UTC)
  let isPastCutoff = false;
  if (event) {
    isPastCutoff = isPastCutoffPacific(
      schedule.game_date,
      event.cutoff_day,
      event.cutoff_time || "10:00"
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event?.name || "Event", href: `/admin/events/${event?.id}` },
              { label: "RSVP Management" },
            ]}
          />
          <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
            RSVP Management
          </h1>
          <p className="mt-1 text-lg text-gray-600">
            <span className="font-semibold text-gray-900">{formatGameDate(schedule.game_date)}</span>
            {" — "}{event?.name}
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

        {/* RSVP Summary Tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* Invited */}
          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invited</p>
            <p className="mt-1 text-2xl font-bold text-gray-700">{allRsvps.length}</p>
          </div>

          {/* In */}
          <div className="rounded-lg bg-teal-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">In</p>
            <p className="mt-1">
              <span className="text-2xl font-bold text-teal-700">{inCount}</span>
              <span className="text-base text-teal-400">/{capacity}</span>
            </p>
            <p className="mt-1 text-xs leading-snug text-teal-500">
              {spotsRemaining > 0 ? `${spotsRemaining} open` : "Full"}
            </p>
          </div>

          {/* Out */}
          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Out</p>
            <p className="mt-1 text-2xl font-bold text-gray-700">{outCount}</p>
          </div>

          {/* Not Sure */}
          <div className="rounded-lg bg-amber-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Not Sure</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{notSureCount}</p>
          </div>

          {/* No Reply */}
          <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">No Reply</p>
            <p className="mt-1 text-2xl font-bold text-gray-400">{noResponseCount}</p>
          </div>

          {/* Waitlist */}
          <div className={`rounded-lg px-3 py-3 text-center ${waitlistCount > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${waitlistCount > 0 ? "text-orange-600" : "text-gray-400"}`}>Waitlist</p>
            <p className={`mt-1 text-2xl font-bold ${waitlistCount > 0 ? "text-orange-600" : "text-gray-400"}`}>{waitlistCount}</p>
          </div>
        </div>

        {/* RSVP Detail Sections — order matches tiles: In, Out, Not Sure, No Reply, Waitlist */}

        {/* In */}
        <CollapsibleSection
          title="In"
          count={inCount}
          defaultOpen={false}
          headerColor="text-teal-800"
          emptyMessage="No golfers confirmed yet."
        >
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                                {prefs.teeTime === "early" ? "Early" : "Late"}
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
                        {formatDateTime(rsvp.responded_at as string | null)}
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
        </CollapsibleSection>

        {/* Approved Guests — only shown when there are approved guests */}
        {approvedGuests.length > 0 && (
          <CollapsibleSection
            title="Approved Guests"
            count={approvedGuests.length}
            defaultOpen={true}
            headerColor="text-blue-800"
          >
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
          </CollapsibleSection>
        )}

        {/* Pending Guest Requests — only shown when there are pending requests */}
        {pendingGuests.length > 0 && (
          <CollapsibleSection
            title="Pending Guest Requests"
            count={pendingGuests.length}
            defaultOpen={true}
            headerColor="text-yellow-800"
          >
            <p className="mb-3 text-sm text-gray-500">
              Review these guest requests and approve or deny after the RSVP
              cutoff.
            </p>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Golfer
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
          </CollapsibleSection>
        )}

        {/* Out */}
        <CollapsibleSection
          title="Out"
          count={outCount}
          defaultOpen={false}
          headerColor="text-gray-700"
          emptyMessage="No golfers have declined yet."
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
        </CollapsibleSection>

        {/* Not Sure */}
        <CollapsibleSection
          title="Not Sure"
          count={notSureCount}
          defaultOpen={false}
          headerColor="text-gray-700"
          emptyMessage="No golfers are undecided."
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
        </CollapsibleSection>

        {/* No Reply */}
        <CollapsibleSection
          title="No Reply"
          count={noResponseCount}
          defaultOpen={false}
          headerColor="text-gray-700"
          emptyMessage="All golfers have responded."
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
        </CollapsibleSection>

        {/* Waitlist */}
        <CollapsibleSection
          title="Waitlist"
          count={waitlistCount}
          defaultOpen={waitlistCount > 0}
          headerColor="text-gray-700"
          emptyMessage="No golfers on the waitlist."
        >
          {waitlistCount > 0 && (
            <p className="mb-3 text-sm text-gray-500">
              Select golfers to promote to confirmed. Order is by response
              time, but you can promote anyone.
            </p>
          )}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                        {formatDateTime(rsvp.responded_at as string | null)}
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
        </CollapsibleSection>

        {/* Emails & Communications — always visible */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700">
            Emails & Communications
            <span className={`ml-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              [schedule.invite_sent, schedule.reminder_sent, schedule.golfer_confirmation_sent, schedule.pro_shop_sent].every(Boolean)
                ? "bg-teal-100 text-teal-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {[schedule.invite_sent, schedule.reminder_sent, schedule.golfer_confirmation_sent, schedule.pro_shop_sent].filter(Boolean).length}/4 sent
            </span>
          </h2>
          <div className="mt-3">
            <EmailStatusPanel
              scheduleId={scheduleId}
              status={{
                inviteSent: schedule.invite_sent,
                reminderSent: schedule.reminder_sent,
                golferConfirmationSent: schedule.golfer_confirmation_sent,
                proShopSent: schedule.pro_shop_sent,
              }}
              emailLog={emailLogMap}
              emailSchedule={emailScheduleMap}
              confirmedCount={inCount}
              pendingCount={notSureCount + noResponseCount}
              totalSubscribers={allRsvps.length}
            />

            {/* Compose custom email — contextual to this week */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <Link
                href={`/admin/events/${event?.id}/email/compose`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">Message Golfers</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Send a custom message — cancellations, weather updates, extra spots, and more
                  </p>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
