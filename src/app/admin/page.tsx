import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { formatGameDate } from "@/lib/format";
import { getTodayPacific, calculateSendDateString } from "@/lib/timezone";

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
      // Respect event start_date — don't show games before the event officially begins
      const earliestDate = event.start_date && event.start_date > today ? event.start_date : today;
      const { data: nextGame } = await supabase
        .from("event_schedules")
        .select("*")
        .eq("event_id", event.id)
        .gte("game_date", earliestDate)
        .order("game_date", { ascending: true })
        .limit(1)
        .single();

      // Get all RSVP status counts for next game
      let inCount = 0;
      let outCount = 0;
      let notSureCount = 0;
      let noResponseCount = 0;
      let waitlistCount = 0;

      if (nextGame) {
        const [
          { count: inC },
          { count: outC },
          { count: notSureC },
          { count: noResponseC },
          { count: waitlistC },
        ] = await Promise.all([
          supabase
            .from("rsvps")
            .select("*", { count: "exact", head: true })
            .eq("schedule_id", nextGame.id)
            .eq("status", "in"),
          supabase
            .from("rsvps")
            .select("*", { count: "exact", head: true })
            .eq("schedule_id", nextGame.id)
            .eq("status", "out"),
          supabase
            .from("rsvps")
            .select("*", { count: "exact", head: true })
            .eq("schedule_id", nextGame.id)
            .eq("status", "not_sure"),
          supabase
            .from("rsvps")
            .select("*", { count: "exact", head: true })
            .eq("schedule_id", nextGame.id)
            .eq("status", "no_response"),
          supabase
            .from("rsvps")
            .select("*", { count: "exact", head: true })
            .eq("schedule_id", nextGame.id)
            .eq("status", "waitlisted"),
        ]);
        inCount = inC || 0;
        outCount = outC || 0;
        notSureCount = notSureC || 0;
        noResponseCount = noResponseC || 0;
        waitlistCount = waitlistC || 0;
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

      // Get email status for next game
      let emailsSent = 0;
      let enabledEmailCount = 4; // default fallback
      let inviteSentAt: string | null = null;
      let nextEmailDisplay: string | null = null;

      if (nextGame) {
        // Fetch email log for this schedule
        const { data: emailLogs } = await supabase
          .from("email_log")
          .select("email_type, sent_at")
          .eq("schedule_id", nextGame.id)
          .order("sent_at", { ascending: false });

        // Fetch ALL email schedules (not just enabled) to know which types are on/off
        const { data: allEmailSchedules } = await supabase
          .from("email_schedules")
          .select("email_type, send_day_offset, send_time, is_enabled")
          .eq("event_id", event.id);

        // Build enabled map
        const enabledMap: Record<string, boolean> = {
          invite: true,
          golfer_confirmation: true,
          reminder: false,
          pro_shop: false,
        };
        for (const es of allEmailSchedules || []) {
          const key = es.email_type.startsWith("reminder") ? "reminder" :
            es.email_type === "confirmation_golfer" ? "golfer_confirmation" :
            es.email_type === "confirmation_proshop" ? "pro_shop" :
            es.email_type === "pro_shop_detail" ? "pro_shop" :
            es.email_type;
          if (es.is_enabled) enabledMap[key] = true;
        }
        enabledEmailCount = Object.values(enabledMap).filter(Boolean).length;

        const sentTypes = new Set<string>();
        for (const log of emailLogs || []) {
          const key = log.email_type.startsWith("reminder") ? "reminder" :
            log.email_type === "confirmation_golfer" ? "golfer_confirmation" :
            log.email_type === "confirmation_proshop" ? "pro_shop" :
            log.email_type === "pro_shop_detail" ? "pro_shop" :
            log.email_type;
          if (!sentTypes.has(key)) {
            sentTypes.add(key);
            if (key === "invite") {
              inviteSentAt = log.sent_at;
            }
          }
        }
        // Only count sent types that are enabled
        emailsSent = [...sentTypes].filter((t) => enabledMap[t]).length;

        // Fetch next unsent enabled email
        if (emailsSent < enabledEmailCount) {
          const enabledSchedules = (allEmailSchedules || []).filter((es) => es.is_enabled);

          const emailOrder = ["invite", "reminder", "golfer_confirmation", "pro_shop"];
          const emailLabels: Record<string, string> = {
            invite: "Invite",
            reminder: "Reminder",
            golfer_confirmation: "Confirmation",
            pro_shop: "Pro Shop",
          };

          for (const type of emailOrder) {
            if (!enabledMap[type]) continue; // skip disabled types
            if (sentTypes.has(type)) continue;
            // Find matching schedule
            const sched = enabledSchedules.find((es) => {
              const key = es.email_type.startsWith("reminder") ? "reminder" :
                es.email_type === "confirmation_golfer" ? "golfer_confirmation" :
                es.email_type === "confirmation_proshop" ? "pro_shop" :
                es.email_type === "pro_shop_detail" ? "pro_shop" :
                es.email_type;
              return key === type;
            });
            if (sched) {
              const sendDate = calculateSendDateString(nextGame.game_date, sched.send_day_offset);
              const [h, m] = (sched.send_time as string).split(":").map(Number);
              const hour12 = h % 12 || 12;
              const ampm = h < 12 ? "AM" : "PM";
              const timeStr = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
              const [year, month, day] = sendDate.split("-").map(Number);
              const dateObj = new Date(year, month - 1, day);
              const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
              const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });
              nextEmailDisplay = `${emailLabels[type]} ${dayName}, ${monthName} ${day} at ${timeStr}`;
              break;
            }
          }
        }
      }

      const capacity = nextGame?.capacity || event.default_capacity || 16;

      return {
        event,
        nextGame,
        inCount,
        outCount,
        notSureCount,
        noResponseCount,
        waitlistCount,
        capacity,
        pendingRegistrations: pendingForEvent?.length || 0,
        pendingGuests: pendingGuestsFiltered.length,
        emailsSent,
        enabledEmailCount,
        inviteSentAt,
        nextEmailDisplay,
      };
    })
  );

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

          {/* Event Summary Cards */}
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {eventCards.map(
                  ({
                    event,
                    nextGame,
                    inCount,
                    outCount,
                    notSureCount,
                    noResponseCount,
                    waitlistCount,
                    capacity,
                    pendingRegistrations,
                    pendingGuests,
                    emailsSent,
                    enabledEmailCount,
                    nextEmailDisplay,
                  }) => {
                    const hasActionNeeded =
                      pendingRegistrations > 0 || pendingGuests > 0;
                    const isCancelled = nextGame?.status === "cancelled";
                    const nextGameDate = nextGame
                      ? formatGameDate(nextGame.game_date)
                      : null;

                    return (
                      <div
                        key={event.id}
                        className="rounded-lg border border-gray-200 bg-white shadow-sm"
                      >
                        {/* Header — event name + next game date */}
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="flex items-center justify-between border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50"
                        >
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">
                              {event.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {nextGameDate ? (
                                <>
                                  Next game: {nextGameDate}
                                  {isCancelled && (
                                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                      Cancelled
                                    </span>
                                  )}
                                </>
                              ) : (
                                "No upcoming games"
                              )}
                            </p>
                          </div>
                          <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>

                        {/* Card body */}
                        <div className="divide-y divide-gray-100">
                          {/* Action Required */}
                          {hasActionNeeded ? (
                            <div className="bg-yellow-50 px-4 py-3">
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-800">
                                Action Required
                              </p>
                              <div className="space-y-1">
                                {pendingRegistrations > 0 && (
                                  <Link
                                    href={`/admin/events/${event.id}/golfers`}
                                    className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-yellow-800 transition-colors hover:bg-yellow-100"
                                  >
                                    <span>
                                      {pendingRegistrations} pending registration{pendingRegistrations !== 1 ? "s" : ""}
                                    </span>
                                    <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </Link>
                                )}
                                {pendingGuests > 0 && nextGame && (
                                  <Link
                                    href={`/admin/events/${event.id}/rsvp/${nextGame.id}`}
                                    className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-yellow-800 transition-colors hover:bg-yellow-100"
                                  >
                                    <span>
                                      {pendingGuests} guest request{pendingGuests !== 1 ? "s" : ""} awaiting review
                                    </span>
                                    <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </Link>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="px-4 py-2.5">
                              <p className="text-xs text-gray-400">No action needed</p>
                            </div>
                          )}

                          {/* RSVP Summary — compact line */}
                          {nextGame && !isCancelled && (
                            <Link
                              href={`/admin/events/${event.id}/rsvp/${nextGame.id}`}
                              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                            >
                              <div className="min-w-0">
                                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  RSVPs
                                </p>
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold text-teal-700">{inCount}/{capacity} In</span>
                                  <span className="text-gray-400"> · </span>
                                  <span>{outCount} Out</span>
                                  <span className="text-gray-400"> · </span>
                                  <span>{notSureCount} Not Sure</span>
                                  <span className="text-gray-400"> · </span>
                                  <span>{noResponseCount} No Reply</span>
                                  {waitlistCount > 0 && (
                                    <>
                                      <span className="text-gray-400"> · </span>
                                      <span className="text-orange-600">{waitlistCount} Waitlist</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </Link>
                          )}

                          {/* Email Status — compact line */}
                          {nextGame && !isCancelled && (
                            <Link
                              href={`/admin/events/${event.id}/emails`}
                              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                            >
                              <div className="min-w-0">
                                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Emails
                                </p>
                                <p className="text-sm text-gray-700">
                                  {emailsSent === enabledEmailCount ? (
                                    <span className="text-teal-700">{enabledEmailCount}/{enabledEmailCount} sent ✓</span>
                                  ) : (
                                    <>
                                      <span className="font-semibold">{emailsSent}/{enabledEmailCount} sent</span>
                                      {nextEmailDisplay && (
                                        <>
                                          <span className="text-gray-400"> · </span>
                                          <span className="text-gray-500">Next: {nextEmailDisplay}</span>
                                        </>
                                      )}
                                    </>
                                  )}
                                </p>
                              </div>
                              <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </Link>
                          )}

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 px-4 py-3">
                            <Link
                              href={`/admin/events/${event.id}/golfers`}
                              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                            >
                              + Add Golfer
                            </Link>
                            <Link
                              href={`/admin/events/${event.id}/emails`}
                              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                            >
                              Emails & Comms
                            </Link>
                            <Link
                              href={`/admin/events/${event.id}/settings`}
                              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                            >
                              Manage Event
                            </Link>
                          </div>
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
                  href="/admin/reports"
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">Reports</h3>
                    <p className="text-xs text-gray-500 mt-1">Profile completeness, engagement, and response timing</p>
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
