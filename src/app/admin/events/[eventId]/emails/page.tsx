import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatGameDate } from "@/lib/format";
import { getTodayPacific, calculateSendDateString } from "@/lib/timezone";
import { EmailStatusPanel } from "@/app/admin/rsvp/[scheduleId]/email-controls";

export default async function EventEmailsPage({
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

  // Fetch next upcoming game for this event
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", eventId)
    .gte("game_date", today)
    .order("game_date", { ascending: true })
    .limit(1)
    .single();

  if (!schedule) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name, href: `/admin/events/${eventId}` },
              { label: "Emails & Communications" },
            ]}
          />
          <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
            Emails & Communications
          </h1>
          <p className="mt-4 text-sm text-gray-500">
            No upcoming games scheduled. Emails will appear here when a game is on the schedule.
          </p>
        </div>
      </main>
    );
  }

  // Fetch RSVP counts for context
  const [
    { count: inCount },
    { count: notSureCount },
    { count: noResponseCount },
  ] = await Promise.all([
    supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "in"),
    supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "not_sure"),
    supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "no_response"),
  ]);

  // Total subscribers (all RSVPs for this schedule)
  const { count: totalSubscribers } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", schedule.id);

  // Fetch email log entries for this schedule
  const { data: emailLogs } = await supabase
    .from("email_log")
    .select("email_type, sent_at, recipient_count")
    .eq("schedule_id", schedule.id)
    .order("sent_at", { ascending: false });

  type EmailLogEntry = { sentAt: string; recipientCount: number };
  const emailLogMap: Record<string, EmailLogEntry> = {};
  for (const log of emailLogs || []) {
    const key = log.email_type.startsWith("reminder") ? "reminder" :
      log.email_type === "confirmation_golfer" ? "golfer_confirmation" :
      log.email_type === "confirmation_proshop" ? "pro_shop" :
      log.email_type;
    if (!emailLogMap[key]) {
      emailLogMap[key] = {
        sentAt: log.sent_at,
        recipientCount: log.recipient_count || 0,
      };
    }
  }

  // Fetch email schedules for this event
  const { data: emailSchedules } = await supabase
    .from("email_schedules")
    .select("email_type, send_day_offset, send_time, is_enabled")
    .eq("event_id", eventId)
    .eq("is_enabled", true);

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

  const emailsSentCount = [
    schedule.invite_sent,
    schedule.reminder_sent,
    schedule.golfer_confirmation_sent,
    schedule.pro_shop_sent,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin" },
            { label: event.name, href: `/admin/events/${eventId}` },
            { label: "Emails & Communications" },
          ]}
        />
        <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
          Emails & Communications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{formatGameDate(schedule.game_date)}</span>
          {" — "}{event.name}
        </p>

        {schedule.status === "cancelled" ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              This game has been cancelled. No automated emails will be sent.
            </p>
          </div>
        ) : (
          <>
            {/* Email Status Panel */}
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-700">
                Automated Emails
                <span className={`ml-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  emailsSentCount === 4
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {emailsSentCount}/4 sent
                </span>
              </h2>
              <div className="mt-3">
                <EmailStatusPanel
                  scheduleId={schedule.id}
                  status={{
                    inviteSent: schedule.invite_sent,
                    reminderSent: schedule.reminder_sent,
                    golferConfirmationSent: schedule.golfer_confirmation_sent,
                    proShopSent: schedule.pro_shop_sent,
                  }}
                  emailLog={emailLogMap}
                  emailSchedule={emailScheduleMap}
                  confirmedCount={inCount || 0}
                  pendingCount={(notSureCount || 0) + (noResponseCount || 0)}
                  totalSubscribers={totalSubscribers || 0}
                />
              </div>
            </section>

            {/* Custom Email Composer */}
            <section className="mt-6">
              <Link
                href={`/admin/events/${eventId}/email/compose`}
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
            </section>
          </>
        )}
      </div>
    </main>
  );
}
