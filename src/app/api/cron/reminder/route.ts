import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/schedule";
import { sendEmail, generateReminderEmail, sendAdminSummaryEmail, rateLimitDelay } from "@/lib/email";
import { getTodayPacific, getDateOffsetPacific } from "@/lib/timezone";

/**
 * Thursday Reminder Cron
 * Sends reminders ONLY to golfers who haven't responded or said "Not Sure Yet."
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Find schedules that have had invites sent but not reminders,
  // with game dates in the next 3 days (covers Thursday → Saturday)
  // Uses Pacific Time so late-night PT doesn't accidentally shift to the next day
  const today = getTodayPacific();
  const maxDate = getDateOffsetPacific(3);

  const { data: schedules } = await supabase
    .from("event_schedules")
    .select("*, event:events(*)")
    .eq("invite_sent", true)
    .eq("reminder_sent", false)
    .eq("status", "scheduled")
    .gte("game_date", today)
    .lte("game_date", maxDate);

  if (!schedules?.length) {
    return NextResponse.json({ message: "No reminders to send" });
  }

  const results = [];

  for (const schedule of schedules) {
    const event = schedule.event;

    // Get RSVPs that need reminders: no_response or not_sure
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("*, profile:profiles(id, first_name, last_name, email, phone)")
      .eq("schedule_id", schedule.id)
      .in("status", ["no_response", "not_sure"]);

    if (!rsvps?.length) {
      await supabase
        .from("event_schedules")
        .update({ reminder_sent: true })
        .eq("id", schedule.id);
      results.push({ event: event.name, skipped: "Everyone has responded" });
      continue;
    }

    // Get count of spots remaining
    const { count: inCount } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "in");

    const capacity = schedule.capacity || event.default_capacity || 16;
    const spotsRemaining = Math.max(0, capacity - (inCount || 0));

    let sentCount = 0;
    const sentNames: string[] = [];
    const rsvpStatuses: string[] = [];
    for (const rsvp of rsvps) {
      const profile = rsvp.profile as {
        first_name: string;
        last_name?: string;
        email: string;
      };
      if (!profile?.email) continue;

      const html = generateReminderEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: schedule.game_date,
        rsvpToken: rsvp.token,
        siteUrl,
        spotsRemaining,
      });

      const displayName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      const statusLabel = rsvp.status === "not_sure" ? "Not Sure" : "No Response";

      if (isTest) {
        console.log(`[TEST] Would send reminder to ${profile.email}`);
        sentNames.push(`${displayName} (${statusLabel})`);
      } else {
        const result = await sendEmail({
          to: profile.email,
          subject: `${event.name}: ${new Date(schedule.game_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} — Last Chance to RSVP`,
          html,
        });
        if (result.success) {
          sentCount++;
          sentNames.push(`${displayName} (${statusLabel})`);
        }
        await rateLimitDelay();
      }
    }

    if (!isTest) {
      await supabase
        .from("event_schedules")
        .update({ reminder_sent: true })
        .eq("id", schedule.id);

      await supabase.from("email_log").insert({
        event_id: event.id,
        schedule_id: schedule.id,
        email_type: "reminder",
        subject: `${event.name}: Reminder`,
        recipient_count: sentCount,
      });

      // Send admin summary with who got reminded and why
      await sendAdminSummaryEmail({
        eventId: event.id,
        eventName: event.name,
        gameDate: schedule.game_date,
        emailType: "reminder",
        recipientNames: sentNames,
        totalSent: sentCount,
        additionalInfo: `${spotsRemaining} spot${spotsRemaining !== 1 ? "s" : ""} still available. Reminders sent to golfers who had not responded or said "Not Sure."`,
      });
    }

    results.push({
      event: event.name,
      gameDate: schedule.game_date,
      remindersSent: isTest ? `${rsvps.length} (test mode)` : sentCount,
      spotsRemaining,
    });
  }

  return NextResponse.json({ results });
}
