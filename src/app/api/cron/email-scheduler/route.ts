import { NextResponse } from "next/server";
import { createAdminClient, ensureSchedule, ensureRsvps } from "@/lib/schedule";
import { sendEmail } from "@/lib/email";
import {
  generateInviteEmail,
  generateReminderEmail,
  generateGolferConfirmationEmail,
  generateProShopDetailEmail,
} from "@/lib/email-templates";
import {
  getNowPacific,
  getUpcomingGameDatePacific,
  calculateSendDateString,
  isWithinSendWindow,
} from "@/lib/timezone";

/**
 * Dynamic Email Scheduler Cron
 * Runs hourly and checks email_schedules table to determine what emails to send
 * Supports configurable scheduling per event
 *
 * Query params:
 *   ?test=true — dry run, logs but doesn't send emails
 *   ?type=invite|reminder|golfer_confirmation|pro_shop_detail — test specific email type
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const testType = searchParams.get("type");

  console.log("Email scheduler cron triggered", { isTest, testType });

  try {
    const supabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Get all enabled events
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true);

    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active events found",
      });
    }

    const results = [];

    // Process each event
    for (const event of events) {
      console.log(`Processing event: ${event.name}`);

      // Get the next game date for this event (in Pacific Time)
      const gameDateString = getUpcomingGameDatePacific(event.day_of_week);
      const nowPT = getNowPacific();

      // Get enabled email schedules for this event
      const { data: schedules, error: schedulesError } = await supabase
        .from("email_schedules")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_enabled", true)
        .order("priority_order", { ascending: true });

      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        console.log(`No enabled email schedules for event: ${event.name}`);
        continue;
      }

      // Process each schedule
      for (const schedule of schedules) {
        // If testing specific type, skip others
        if (testType && schedule.email_type !== testType) {
          continue;
        }

        // Calculate the send date for this email (Pacific Time)
        const sendDateStr = calculateSendDateString(gameDateString, schedule.send_day_offset);

        // Check if we should send this email now (all times in Pacific)
        const withinWindow = isWithinSendWindow(sendDateStr, schedule.send_time);

        if (!withinWindow && !isTest) {
          console.log(
            `Skipping ${schedule.email_type} for ${event.name} - not time yet ` +
            `(scheduled for ${sendDateStr} ${schedule.send_time} PT, ` +
            `current Pacific time: ${nowPT.dateString} ${String(nowPT.hour).padStart(2, "0")}:${String(nowPT.minute).padStart(2, "0")})`
          );
          continue;
        }

        console.log(
          `Processing ${schedule.email_type} for ${event.name} (priority ${schedule.priority_order})`
        );

        let result;
        switch (schedule.email_type) {
          case "invite":
            result = await sendInviteEmails(
              supabase,
              event,
              gameDateString,
              siteUrl,
              isTest
            );
            break;

          case "reminder":
            result = await sendReminderEmails(
              supabase,
              event,
              gameDateString,
              schedule.priority_order,
              siteUrl,
              isTest
            );
            break;

          case "golfer_confirmation":
            result = await sendGolferConfirmationEmail(
              supabase,
              event,
              gameDateString,
              isTest
            );
            break;

          case "pro_shop_detail":
            result = await sendProShopDetailEmail(
              supabase,
              event,
              gameDateString,
              isTest
            );
            break;

          default:
            console.log(`Unknown email type: ${schedule.email_type}`);
            continue;
        }

        results.push({
          event: event.name,
          type: schedule.email_type,
          priority: schedule.priority_order,
          ...result,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      test: isTest,
    });
  } catch (error) {
    console.error("Email scheduler error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Send invite emails to all active, subscribed members
 */
async function sendInviteEmails(
  supabase: any,
  event: any,
  gameDateString: string,
  siteUrl: string,
  isTest: boolean
) {
  console.log(`Sending invite emails for ${event.name}`);

  // Ensure schedule exists
  const schedule = await ensureSchedule(supabase, event.id, gameDateString);

  if (!schedule) {
    return {
      message: "Failed to create/get schedule",
      sent: 0,
    };
  }

  // Check if already sent
  if (schedule.invite_sent) {
    return {
      message: "Invite already sent",
      sent: 0,
    };
  }

  // Ensure RSVP rows exist for all subscribers
  const rsvps = await ensureRsvps(supabase, schedule.id, event.id);

  if (!rsvps || rsvps.length === 0) {
    return {
      message: "No subscribers found",
      sent: 0,
    };
  }

  let sent = 0;
  const errors = [];

  // Send invite to each golfer
  for (const rsvp of rsvps) {
    const profile = rsvp.profile as {
      first_name: string;
      last_name: string;
      email: string;
    };

    if (!profile?.email) continue;

    try {
      const emailHtml = generateInviteEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: gameDateString,
        rsvpUrl: `${siteUrl}/rsvp/${rsvp.token}`,
        eventDetails: event.description || "",
      });

      if (!isTest) {
        await sendEmail({
          to: profile.email,
          subject: `${event.name} - ${formatGameDate(gameDateString)}`,
          html: emailHtml,
        });
      }

      console.log(
        `${isTest ? "[TEST] Would send" : "Sent"} invite to ${profile.email}`
      );
      sent++;
    } catch (err) {
      console.error(`Failed to send invite to ${profile.email}:`, err);
      errors.push({
        email: profile.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Mark as sent in schedule (if not test)
  if (!isTest) {
    await supabase
      .from("event_schedules")
      .update({ invite_sent: true })
      .eq("id", schedule.id);
  }

  return {
    message: `Invite emails ${isTest ? "would be" : ""} sent`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send reminder emails to members who haven't RSVP'd
 */
async function sendReminderEmails(
  supabase: any,
  event: any,
  gameDateString: string,
  priorityOrder: number,
  siteUrl: string,
  isTest: boolean
) {
  console.log(`Sending reminder ${priorityOrder} emails for ${event.name}`);

  // Get event schedule
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule) {
    return {
      message: "No schedule found for this game date",
      sent: 0,
    };
  }

  // Check if this reminder was already sent
  const reminderField =
    priorityOrder === 1
      ? "reminder_sent"
      : priorityOrder === 2
      ? "reminder_2_sent"
      : "reminder_3_sent";

  if (schedule[reminderField]) {
    return {
      message: `Reminder ${priorityOrder} already sent`,
      sent: 0,
    };
  }

  // Get members who haven't RSVP'd yet
  const { data: pendingRsvps, error } = await supabase
    .from("rsvps")
    .select("*, profile:profiles(id, first_name, last_name, email)")
    .eq("schedule_id", schedule.id)
    .in("status", ["no_response", "not_sure"]);

  if (error) throw error;

  if (!pendingRsvps || pendingRsvps.length === 0) {
    return {
      message: "No pending RSVPs found",
      sent: 0,
    };
  }

  let sent = 0;
  const errors = [];

  for (const rsvp of pendingRsvps) {
    const profile = rsvp.profile as {
      email: string;
      first_name: string;
      last_name: string;
    };

    if (!profile?.email) continue;

    try {
      const emailHtml = generateReminderEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: formatGameDate(gameDateString),
        rsvpUrl: `${siteUrl}/rsvp/${rsvp.token}`,
        reminderNumber: priorityOrder,
      });

      if (!isTest) {
        await sendEmail({
          to: profile.email,
          subject: `Reminder: RSVP for ${event.name} - ${formatGameDate(
            gameDateString
          )}`,
          html: emailHtml,
        });
      }

      console.log(
        `${isTest ? "[TEST] Would send" : "Sent"} reminder to ${profile.email}`
      );
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder to ${profile.email}:`, err);
      errors.push({
        email: profile.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Mark reminder as sent
  if (!isTest) {
    await supabase
      .from("event_schedules")
      .update({ [reminderField]: true })
      .eq("id", schedule.id);
  }

  return {
    message: `Reminder ${priorityOrder} emails ${isTest ? "would be" : ""} sent`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send confirmation email to confirmed golfers
 */
async function sendGolferConfirmationEmail(
  supabase: any,
  event: any,
  gameDateString: string,
  isTest: boolean
) {
  console.log(`Sending golfer confirmation emails for ${event.name}`);
  console.log(`Looking for schedule with game_date: ${gameDateString}`);

  // Get event schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  console.log('Schedule query result:', { schedule, error: scheduleError });

  if (!schedule) {
    return {
      message: "No schedule found for this game date",
      sent: 0,
    };
  }

  console.log(`Found schedule with ID: ${schedule.id}`);

  if (schedule.golfer_confirmation_sent) {
    return {
      message: "Golfer confirmation already sent",
      sent: 0,
    };
  }

  // Get confirmed golfers
  console.log(`Querying for RSVPs with schedule_id: ${schedule.id} and status: "in"`);
  const { data: confirmedRsvps, error } = await supabase
    .from("rsvps")
    .select("*, profile:profiles(id, first_name, last_name, email)")
    .eq("schedule_id", schedule.id)
    .eq("status", "in");

  console.log('RSVP query result:', { confirmedRsvps, error });

  if (error) throw error;

  if (!confirmedRsvps || confirmedRsvps.length === 0) {
    return {
      message: "No confirmed golfers found",
      sent: 0,
    };
  }

  // Build golfer list - keep the array format for the email template
  const confirmedPlayers = confirmedRsvps.map((r: { profile: { first_name: string; last_name: string } }) => {
    const profile = r.profile as { first_name: string; last_name: string };
    return {
      first_name: profile.first_name,
      last_name: profile.last_name,
    };
  });

  let sent = 0;
  const errors = [];

  for (const rsvp of confirmedRsvps) {
    const profile = rsvp.profile as {
      email: string;
      first_name: string;
      last_name: string;
    };

    if (!profile?.email) continue;

    try {
      const emailHtml = generateGolferConfirmationEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: formatGameDate(gameDateString),
        confirmedPlayers: confirmedPlayers,
        playerCount: confirmedRsvps.length,
      });

      if (!isTest) {
        await sendEmail({
          to: profile.email,
          subject: `Confirmed: ${event.name} - ${formatGameDate(gameDateString)}`,
          html: emailHtml,
        });
      }

      console.log(
        `${isTest ? "[TEST] Would send" : "Sent"} confirmation to ${profile.email}`
      );
      sent++;
    } catch (err) {
      console.error(`Failed to send confirmation to ${profile.email}:`, err);
      errors.push({
        email: profile.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Mark as sent
  if (!isTest) {
    await supabase
      .from("event_schedules")
      .update({ golfer_confirmation_sent: true })
      .eq("id", schedule.id);
  }

  return {
    message: `Golfer confirmation emails ${isTest ? "would be" : ""} sent`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send pro shop detail email with tee times and pairings
 */
async function sendProShopDetailEmail(
  supabase: any,
  event: any,
  gameDateString: string,
  isTest: boolean
) {
  console.log(`Sending pro shop detail email for ${event.name}`);

  // Get event schedule
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule) {
    return {
      message: "No schedule found for this game date",
      sent: 0,
    };
  }

  if (schedule.pro_shop_sent) {
    return {
      message: "Pro shop email already sent",
      sent: 0,
    };
  }

  // Get confirmed golfers for the email
  const { data: confirmedRsvps } = await supabase
    .from("rsvps")
    .select("*, profile:profiles(id, first_name, last_name, email)")
    .eq("schedule_id", schedule.id)
    .eq("status", "in");

  const emailHtml = generateProShopDetailEmail({
    eventName: event.name,
    gameDate: formatGameDate(gameDateString),
    confirmedPlayers: confirmedRsvps || [],
    playerCount: confirmedRsvps?.length || 0,
  });

  const proShopEmail =
    process.env.PRO_SHOP_EMAIL || "proshop@fairbanksranch.com";

  try {
    if (!isTest) {
      await sendEmail({
        to: proShopEmail,
        subject: `Tee Times: ${event.name} - ${formatGameDate(
          gameDateString
        )}`,
        html: emailHtml,
      });

      await supabase
        .from("event_schedules")
        .update({ pro_shop_sent: true })
        .eq("id", schedule.id);
    }

    console.log(
      `${isTest ? "[TEST] Would send" : "Sent"} pro shop email to ${proShopEmail}`
    );

    return {
      message: `Pro shop email ${isTest ? "would be" : ""} sent`,
      sent: 1,
    };
  } catch (err) {
    console.error(`Failed to send pro shop email:`, err);
    return {
      message: "Failed to send pro shop email",
      sent: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Helper: Format YYYY-MM-DD date string for display.
 * Uses local date parsing to avoid timezone shift.
 */
function formatGameDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}