import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GuestRequestForm, GuestRequestStatus } from "./guest-request-form";
import { getGuestRequests } from "./guest-actions";
import { TeeTimePreference } from "./tee-time-preference";
import { CollapsibleSection } from "./collapsible-section";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

type RsvpStatus = "in" | "out" | "not_sure" | "no_response" | "waitlisted";

const statusLabels: Record<RsvpStatus, string> = {
  in: "I'm In",
  out: "I'm Out",
  not_sure: "Not Sure Yet",
  no_response: "No Response",
  waitlisted: "Waitlisted",
};

const statusColors: Record<RsvpStatus, string> = {
  in: "bg-teal-100 text-teal-800 border-teal-200",
  out: "bg-red-100 text-red-800 border-red-200",
  not_sure: "bg-yellow-100 text-yellow-800 border-yellow-200",
  no_response: "bg-gray-100 text-gray-600 border-gray-200",
  waitlisted: "bg-orange-100 text-orange-800 border-orange-200",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ updated?: string; locked?: string; cancelled?: string }>;
}) {
  const { token } = await params;
  const { updated, locked, cancelled } = await searchParams;

  const supabase = createAdminClient();

  // Fetch the RSVP with schedule and event info
  const { data: rsvp, error } = await supabase
    .from("rsvps")
    .select(
      `*,
       profile:profiles(id, first_name, last_name),
       schedule:event_schedules(
         id, game_date, capacity, status, admin_notes,
         event:events(id, name, default_capacity, cutoff_day, cutoff_time, timezone, allow_guest_requests, allow_tee_time_preferences, allow_playing_partner_preferences)
       )`
    )
    .eq("token", token)
    .single();

  if (error || !rsvp) {
    notFound();
  }

  const schedule = rsvp.schedule;
  const event = schedule?.event;
  const golferName = rsvp.profile?.first_name || "Golfer";
  const currentStatus = rsvp.status as RsvpStatus;
  const capacity = schedule?.capacity || event?.default_capacity || 16;

  // Check cutoff
  let isPastCutoff = locked === "true";
  if (!isPastCutoff && event && schedule) {
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

  const isCancelled = cancelled === "true" || schedule?.status === "cancelled";

  // Fetch "In" list — only show if this golfer is "in"
  let inList: { first_name: string; last_name: string }[] = [];
  let inCount = 0;
  if (currentStatus === "in" || currentStatus === "waitlisted") {
    const { data: inRsvps } = await supabase
      .from("rsvps")
      .select("profile:profiles(first_name, last_name)")
      .eq("schedule_id", rsvp.schedule_id)
      .eq("status", "in")
      .order("responded_at", { ascending: true });

    if (inRsvps) {
      inList = inRsvps
        .map((r: Record<string, unknown>) => r.profile as { first_name: string; last_name: string })
        .filter(Boolean);
      inCount = inList.length;
    }
  }

  // Fetch waitlist count
  const { count: waitlistCount } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", rsvp.schedule_id)
    .eq("status", "waitlisted");

  // Fetch guest requests if user is "in"
  const guestRequests =
    currentStatus === "in" ? await getGuestRequests(token) : [];
  const MAX_GUESTS = 3;
  const remainingSlots = MAX_GUESTS - guestRequests.length;

  const baseUrl = `/api/rsvp?token=${token}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
            {event?.name || "FRCC Golf Games"}
          </h1>
          <p className="mt-1 text-lg text-gray-600">
            {schedule ? formatDate(schedule.game_date) : "Upcoming Game"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Hey {golferName}, are you playing this week?
          </p>
        </div>

        {/* Status update confirmation */}
        {updated && (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-center text-sm text-teal-700">
            {updated === "waitlisted"
              ? "The game is full — you've been added to the waitlist. We'll let you know if a spot opens up."
              : `Got it! You're marked as "${statusLabels[updated as RsvpStatus] || updated}".`}
          </div>
        )}

        {/* Cancelled */}
        {isCancelled && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            This game has been cancelled.
          </div>
        )}

        {/* Locked */}
        {isPastCutoff && !isCancelled && (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800">
            The RSVP deadline has passed. Contact a event admin to change your
            status.
          </div>
        )}

        {/* Current status */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Your current response:</p>
          <span
            className={`mt-1 inline-block rounded-full border px-4 py-1.5 text-sm font-semibold ${statusColors[currentStatus]}`}
          >
            {statusLabels[currentStatus]}
          </span>
          {currentStatus === "waitlisted" && rsvp.waitlist_position && (
            <p className="mt-1 text-xs text-gray-500">
              Waitlist position: #{rsvp.waitlist_position}
            </p>
          )}
        </div>

        {/* Response buttons */}
        {!isPastCutoff && !isCancelled && (
          <div className="mt-6 space-y-3">
            <a
              href={`${baseUrl}&action=in`}
              className={`block w-full rounded-lg px-4 py-3.5 text-center text-base font-semibold shadow-sm transition ${
                currentStatus === "in"
                  ? "bg-teal-600 text-white"
                  : "border-2 border-teal-600 text-teal-700 hover:bg-teal-50"
              }`}
            >
              {currentStatus === "in" ? "✓ I'm In" : "I'm In"}
            </a>
            <a
              href={`${baseUrl}&action=out`}
              className={`block w-full rounded-lg px-4 py-3.5 text-center text-base font-semibold shadow-sm transition ${
                currentStatus === "out"
                  ? "bg-red-700 text-white"
                  : "border-2 border-red-300 text-red-700 hover:bg-red-50"
              }`}
            >
              {currentStatus === "out" ? "✓ I'm Out" : "I'm Out"}
            </a>
            <a
              href={`${baseUrl}&action=not_sure`}
              className={`block w-full rounded-lg px-4 py-3.5 text-center text-base font-semibold shadow-sm transition ${
                currentStatus === "not_sure"
                  ? "bg-yellow-600 text-white"
                  : "border-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
              }`}
            >
              {currentStatus === "not_sure"
                ? "✓ Not Sure Yet"
                : "Not Sure Yet (please ask me again later)"}
            </a>
          </div>
        )}

        {/* Capacity bar */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {inCount} / {capacity} spots filled
            </span>
            {(waitlistCount || 0) > 0 && (
              <span className="text-orange-600">
                {waitlistCount} waitlisted
              </span>
            )}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                inCount >= capacity ? "bg-red-500" : "bg-teal-500"
              }`}
              style={{ width: `${Math.min((inCount / capacity) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* "In" list — collapsible, only visible if golfer is "in" or "waitlisted" */}
        {(currentStatus === "in" || currentStatus === "waitlisted") &&
          inList.length > 0 && (
            <CollapsibleSection title={`Who's In (${inList.length})`} defaultOpen={false}>
              <ul className="mt-2 space-y-1">
                {inList.map((golfer, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    {golfer.first_name.charAt(0)}. {golfer.last_name}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

        {/* Tee time preference — collapsible, only if enabled for event */}
        {currentStatus === "in" &&
          !isPastCutoff &&
          !isCancelled &&
          event?.allow_tee_time_preferences && (
            <CollapsibleSection title="Request Tee Time Preference (Optional)" defaultOpen={false}>
              <TeeTimePreference
                token={token}
                currentPreference={rsvp.tee_time_preference as "no_preference" | "early" | "late"}
              />
            </CollapsibleSection>
          )}

        {/* Guest requests — collapsible, only if enabled for event */}
        {currentStatus === "in" &&
          !isPastCutoff &&
          !isCancelled &&
          event?.allow_guest_requests && (
            <CollapsibleSection
              title={`Request Guest${remainingSlots > 0 ? ` (${guestRequests.length}/${MAX_GUESTS})` : "s"} (Optional)`}
              defaultOpen={false}
            >
              {guestRequests.length > 0 && (
                <GuestRequestStatus
                  guestRequests={guestRequests}
                  remainingSlots={remainingSlots}
                />
              )}
              {remainingSlots > 0 && <GuestRequestForm token={token} remainingSlots={remainingSlots} cutoffDayName={["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][event?.cutoff_day ?? 5]} />}
              {remainingSlots === 0 && guestRequests.length === 0 && (
                <p className="text-sm text-gray-500">No guest slots available.</p>
              )}
            </CollapsibleSection>
          )}

        {/* Admin notes */}
        {schedule?.admin_notes && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">Admin Note</p>
            <p className="mt-1 text-sm text-blue-700">
              {schedule.admin_notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-teal-700 hover:text-teal-600"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
