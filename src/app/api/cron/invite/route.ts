import { NextResponse } from "next/server";
import {
  createAdminClient,
  getUpcomingGameDate,
  ensureSchedule,
  ensureRsvps,
} from "@/lib/schedule";
import { sendEmail, generateInviteEmail } from "@/lib/email";

/**
 * Monday Invite Cron
 * Sends weekly invite emails to all active, subscribed members.
 * Also callable manually via GET for testing.
 *
 * Query params:
 *   ?test=true — dry run, logs but doesn't send emails
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Verify cron secret if set (for production security)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Get all active events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true);

  if (!events?.length) {
    return NextResponse.json({ message: "No active events" });
  }

  const results = [];

  for (const event of events) {
    // Get the upcoming game date
    const gameDate = getUpcomingGameDate(event.day_of_week);

    // Ensure schedule exists
    const schedule = await ensureSchedule(supabase, event.id, gameDate);
    if (!schedule) {
      results.push({ event: event.name, error: "Failed to create schedule" });
      continue;
    }

    // If game is cancelled, send cancellation notice instead
    if (schedule.status === "cancelled") {
      results.push({ event: event.name, skipped: "Game cancelled" });
      continue;
    }

    // If invite already sent, skip
    if (schedule.invite_sent) {
      results.push({ event: event.name, skipped: "Invite already sent" });
      continue;
    }

    // Ensure RSVP rows exist for all subscribers
    const rsvps = await ensureRsvps(supabase, schedule.id, event.id);

    // Send invite to each golfer
    let sentCount = 0;
    for (const rsvp of rsvps) {
      const profile = rsvp.profile as {
        first_name: string;
        last_name: string;
        email: string;
      };
      if (!profile?.email) continue;

      const html = generateInviteEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: schedule.game_date,
        rsvpToken: rsvp.token,
        siteUrl,
      });

      if (isTest) {
        console.log(`[TEST] Would send invite to ${profile.email}`);
      } else {
        const result = await sendEmail({
          to: profile.email,
          subject: `${event.name}: ${new Date(schedule.game_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} — Are You In?`,
          html,
        });
        if (result.success) sentCount++;
      }
    }

    // Mark invite as sent
    if (!isTest) {
      await supabase
        .from("event_schedules")
        .update({ invite_sent: true })
        .eq("id", schedule.id);

      // Log to email_log
      await supabase.from("email_log").insert({
        event_id: event.id,
        schedule_id: schedule.id,
        email_type: "invite",
        subject: `${event.name}: Weekly Invite`,
        recipient_count: sentCount,
      });
    }

    results.push({
      event: event.name,
      gameDate,
      rsvpCount: rsvps.length,
      sentCount: isTest ? `${rsvps.length} (test mode)` : sentCount,
    });
  }

  return NextResponse.json({ results });
}
