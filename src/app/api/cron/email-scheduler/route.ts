import { NextResponse } from "next/server";
import { createAdminClient, ensureSchedule, ensureRsvps } from "@/lib/schedule";
import {
  sendEmail,
  rateLimitDelay,
  generateInviteEmail,
  generateReminderEmail,
  generateConfirmationEmail,
  generateProShopEmail,
} from "@/lib/email";
import {
  getNowPacific,
  getUpcomingGameDatePacific,
  calculateSendDateString,
  isWithinSendWindow,
} from "@/lib/timezone";
import { sendAdminAlert } from "@/lib/admin-alerts";

/**
 * Dynamic Email Scheduler Cron
 * Triggered by 5 daily cron entries in vercel.json, spaced across the day
 * at strategic UTC hours. Checks the email_schedules table to determine
 * what emails to send. Supports configurable scheduling per event with
 * multiple reminders.
 *
 * Architecture:
 *   - Vercel Hobby plan limits crons to once-per-day frequency.
 *   - 5 daily crons fire at: 15:00, 17:00, 19:00, 22:00, 01:00 UTC
 *     covering 7:45 AM – 4:45 PM Pacific in both PST and PDT.
 *   - Admin-configured send times use :45 past the hour (e.g., 9:45 AM PT).
 *   - When a cron fires, isWithinSendWindow() checks if any scheduled time
 *     falls within the past 3 hours, accounting for DST shifts (±1 hour).
 *   - Duplicate sends are prevented by "already sent" flags on each schedule
 *     (invite_sent, reminder_sent, etc.), NOT by the time window.
 *
 * The admin settings UI constrains time selection to :45 slots that are
 * guaranteed to be caught by the cron entries above, so admins can freely
 * change email times without any manual deployment steps.
 *
 * Query params:
 *   ?test=true — dry run, logs but doesn't send emails
 *   ?force=true — bypass time window check (sends immediately, still requires auth)
 *   ?type=invite|reminder|golfer_confirmation|pro_shop_detail — filter to specific email type
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const isForce = searchParams.get("force") === "true";
  const testType = searchParams.get("type");

  // Verify cron secret if set (for production security)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("Email scheduler cron triggered", { isTest, isForce, testType });

  try {
    const supabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Get all active events
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

    for (const event of events) {
      console.log(`Processing event: ${event.name}`);

      // Get the next game date for this event (in Pacific Time)
      const gameDateString = getUpcomingGameDatePacific(event.day_of_week);
      const nowPT = getNowPacific();

      // Get enabled email schedules for this event
      const { data: emailSchedules, error: schedulesError } = await supabase
        .from("email_schedules")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_enabled", true)
        .order("priority_order", { ascending: true });

      if (schedulesError) throw schedulesError;

      if (!emailSchedules || emailSchedules.length === 0) {
        console.log(`No enabled email schedules for event: ${event.name}`);
        continue;
      }

      // Process each email schedule entry
      for (const emailSchedule of emailSchedules) {
        // If testing specific type, skip others
        if (testType && emailSchedule.email_type !== testType) {
          continue;
        }

        // Calculate the send date for this email (Pacific Time)
        const sendDateStr = calculateSendDateString(
          gameDateString,
          emailSchedule.send_day_offset
        );

        // Check if we should send this email now
        const withinWindow = isWithinSendWindow(
          sendDateStr,
          emailSchedule.send_time
        );

        if (!withinWindow && !isTest && !isForce) {
          console.log(
            `Skipping ${emailSchedule.email_type} (priority ${emailSchedule.priority_order}) for ${event.name} - ` +
              `not time yet (scheduled for ${sendDateStr} ${emailSchedule.send_time} PT, ` +
              `current: ${nowPT.dateString} ${String(nowPT.hour).padStart(2, "0")}:${String(nowPT.minute).padStart(2, "0")})`
          );
          continue;
        }

        console.log(
          `Processing ${emailSchedule.email_type} (priority ${emailSchedule.priority_order}) for ${event.name}`
        );

        let result;
        switch (emailSchedule.email_type) {
          case "invite":
            result = await handleInviteEmails(
              supabase,
              event,
              gameDateString,
              siteUrl,
              isTest
            );
            break;

          case "reminder":
            result = await handleReminderEmails(
              supabase,
              event,
              gameDateString,
              emailSchedule.priority_order,
              siteUrl,
              isTest
            );
            break;

          case "golfer_confirmation":
            result = await handleGolferConfirmation(
              supabase,
              event,
              gameDateString,
              siteUrl,
              isTest
            );
            break;

          case "pro_shop_detail":
            result = await handleProShopDetail(
              supabase,
              event,
              gameDateString,
              isTest
            );
            break;

          default:
            console.log(`Unknown email type: ${emailSchedule.email_type}`);
            continue;
        }

        results.push({
          event: event.name,
          type: emailSchedule.email_type,
          priority: emailSchedule.priority_order,
          ...result,
        });
      }

      // Check low_response alert for this event
      if (!isTest) {
        try {
          await checkLowResponseAlert(supabase, event, gameDateString);
        } catch (err) {
          console.error(`Low response alert check failed for ${event.name}:`, err);
        }
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

// ============================================================
// INVITE EMAILS
// ============================================================

async function handleInviteEmails(
  supabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  gameDateString: string,
  siteUrl: string,
  isTest: boolean
) {
  // Ensure schedule exists
  const schedule = await ensureSchedule(
    supabase,
    event.id as string,
    gameDateString
  );

  if (!schedule) {
    return { message: "Failed to create/get schedule", sent: 0 };
  }

  // Skip cancelled games
  if (schedule.status === "cancelled") {
    return { message: "Game cancelled — skipping invite", sent: 0 };
  }

  // Check if already sent
  if (schedule.invite_sent) {
    return { message: "Invite already sent", sent: 0 };
  }

  // Ensure RSVP rows exist for all subscribers
  const rsvps = await ensureRsvps(
    supabase,
    schedule.id,
    event.id as string
  );

  if (!rsvps || rsvps.length === 0) {
    return { message: "No subscribers found", sent: 0 };
  }

  let sent = 0;
  const errors: { email: string; error: string }[] = [];

  for (const rsvp of rsvps) {
    const profile = rsvp.profile as {
      first_name: string;
      last_name: string;
      email: string;
    };
    if (!profile?.email) continue;

    try {
      const html = generateInviteEmail({
        golferName: profile.first_name,
        eventName: event.name as string,
        gameDate: gameDateString,
        rsvpToken: rsvp.token,
        siteUrl,
        adminNote: schedule.admin_notes,
        cutoffDay: event.cutoff_day as number | undefined,
        cutoffTime: event.cutoff_time as string | undefined,
      });

      if (!isTest) {
        await sendEmail({
          to: profile.email,
          subject: `${event.name}: ${formatGameDate(gameDateString)} — Are You In?`,
          html,
        });
        await rateLimitDelay();
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

  // Mark as sent
  if (!isTest && sent > 0) {
    await supabase
      .from("event_schedules")
      .update({ invite_sent: true })
      .eq("id", schedule.id);

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: "invite",
      subject: `${event.name}: Weekly Invite`,
      recipient_count: sent,
    });
  }

  return {
    message: `Invite emails ${isTest ? "would be" : ""} sent`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================
// REMINDER EMAILS (supports multiple: priority 1, 2, 3)
// ============================================================

async function handleReminderEmails(
  supabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  gameDateString: string,
  priorityOrder: number,
  siteUrl: string,
  isTest: boolean
) {
  console.log(`Sending reminder ${priorityOrder} for ${event.name}`);

  // Get event schedule
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule) {
    return { message: "No schedule found", sent: 0 };
  }

  if (schedule.status === "cancelled") {
    return { message: "Game cancelled — skipping reminder", sent: 0 };
  }

  // Check if this specific reminder was already sent
  // Priority 1 = reminder_sent, Priority 2 = reminder_2_sent, Priority 3 = reminder_3_sent
  const reminderField =
    priorityOrder === 1
      ? "reminder_sent"
      : priorityOrder === 2
        ? "reminder_2_sent"
        : "reminder_3_sent";

  if (schedule[reminderField]) {
    return { message: `Reminder ${priorityOrder} already sent`, sent: 0 };
  }

  // Get members who haven't RSVP'd or said "not sure"
  const { data: pendingRsvps, error } = await supabase
    .from("rsvps")
    .select("*, profile:profiles(id, first_name, last_name, email)")
    .eq("schedule_id", schedule.id)
    .in("status", ["no_response", "not_sure"]);

  if (error) throw error;

  if (!pendingRsvps || pendingRsvps.length === 0) {
    // Mark as sent even if no one to remind (all responded)
    if (!isTest) {
      await supabase
        .from("event_schedules")
        .update({ [reminderField]: true })
        .eq("id", schedule.id);
    }
    return { message: "Everyone has responded — no reminders needed", sent: 0 };
  }

  // Calculate spots remaining for the reminder message
  const { count: inCount } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", schedule.id)
    .eq("status", "in");

  const capacity =
    schedule.capacity || (event.default_capacity as number) || 16;
  const spotsRemaining = Math.max(0, capacity - (inCount || 0));

  let sent = 0;
  const errors: { email: string; error: string }[] = [];

  for (const rsvp of pendingRsvps) {
    const profile = rsvp.profile as {
      first_name: string;
      last_name: string;
      email: string;
    };
    if (!profile?.email) continue;

    try {
      const html = generateReminderEmail({
        golferName: profile.first_name,
        eventName: event.name as string,
        gameDate: gameDateString,
        rsvpToken: rsvp.token,
        siteUrl,
        spotsRemaining,
        adminNote: schedule.admin_notes,
        cutoffDay: event.cutoff_day as number | undefined,
        cutoffTime: event.cutoff_time as string | undefined,
      });

      if (!isTest) {
        await sendEmail({
          to: profile.email,
          subject: `${event.name}: ${formatGameDate(gameDateString)} — ${priorityOrder === 1 ? "Last Chance to RSVP" : "Final Reminder"}`,
          html,
        });
        await rateLimitDelay();
      }

      console.log(
        `${isTest ? "[TEST] Would send" : "Sent"} reminder ${priorityOrder} to ${profile.email}`
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

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: `reminder_${priorityOrder}`,
      subject: `${event.name}: Reminder ${priorityOrder}`,
      recipient_count: sent,
    });
  }

  return {
    message: `Reminder ${priorityOrder} emails ${isTest ? "would be" : ""} sent`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================
// GOLFER CONFIRMATION EMAIL
// ============================================================

async function handleGolferConfirmation(
  supabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  gameDateString: string,
  siteUrl: string,
  isTest: boolean
) {
  // Get event schedule
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule) {
    return { message: "No schedule found", sent: 0 };
  }

  if (schedule.status === "cancelled") {
    return { message: "Game cancelled — skipping confirmation", sent: 0 };
  }

  if (schedule.golfer_confirmation_sent) {
    return { message: "Golfer confirmation already sent", sent: 0 };
  }

  // Get confirmed ("in") RSVPs with full profile info
  const { data: confirmedRsvps } = await supabase
    .from("rsvps")
    .select(
      "*, profile:profiles(id, first_name, last_name, email, phone, ghin_number)"
    )
    .eq("schedule_id", schedule.id)
    .eq("status", "in")
    .order("responded_at", { ascending: true });

  if (!confirmedRsvps || confirmedRsvps.length === 0) {
    return { message: "No confirmed golfers found", sent: 0 };
  }

  // Get approved guests for this schedule
  const { data: approvedGuests } = await supabase
    .from("guest_requests")
    .select(
      "*, requested_by_profile:profiles!guest_requests_requested_by_fkey(first_name, last_name)"
    )
    .eq("schedule_id", schedule.id)
    .eq("status", "approved");

  // Build player list
  const confirmedPlayers = confirmedRsvps.map(
    (r: Record<string, unknown>) => {
      const profile = r.profile as {
        first_name: string;
        last_name: string;
        email: string;
      };
      return { ...profile, is_guest: false };
    }
  );

  const guestPlayers = (approvedGuests || []).map(
    (g: Record<string, unknown>) => {
      const sponsor = g.requested_by_profile as {
        first_name: string;
        last_name: string;
      };
      return {
        first_name: g.guest_first_name as string,
        last_name: g.guest_last_name as string,
        email: g.guest_email as string,
        is_guest: true,
        sponsor_name: sponsor
          ? `${sponsor.first_name} ${sponsor.last_name.charAt(0)}.`
          : "Member",
      };
    }
  );

  const allPlayers = [...confirmedPlayers, ...guestPlayers].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
  );

  // Get admin emails for CC
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", event.id);

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_super_admin", true);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const primaryAdminEmail = (primaryAdmin?.profile as unknown as { email: string })
    ?.email;

  const adminEmails = [
    ...(superAdmins || []).map((a: { email: string }) => a.email),
    ...(eventAdmins || []).map(
      (a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
    ),
  ].filter((e): e is string => !!e);

  const uniqueAdminEmails = [...new Set(adminEmails)];

  // Get pro shop contacts for CC
  const { data: proShopContacts } = await supabase
    .from("pro_shop_contacts")
    .select("email")
    .eq("event_id", event.id);

  const proShopEmails = (proShopContacts || []).map(
    (c: { email: string }) => c.email
  );
  const ccEmails = [...new Set([...uniqueAdminEmails, ...proShopEmails])];

  // Generate confirmation email
  const golferEmails = allPlayers
    .map((p) => p.email)
    .filter(Boolean);

  const confirmationHtml = generateConfirmationEmail({
    eventName: event.name as string,
    gameDate: gameDateString,
    confirmedPlayers: allPlayers,
    adminNote: schedule.admin_notes,
    siteUrl,
  });

  const formattedDate = formatGameDate(gameDateString);

  try {
    if (!isTest) {
      await sendEmail({
        to: golferEmails,
        cc: ccEmails,
        replyTo: primaryAdminEmail,
        subject: `${event.name}: ${formattedDate}: Registration Confirmation`,
        html: confirmationHtml,
      });

      await supabase
        .from("event_schedules")
        .update({ golfer_confirmation_sent: true })
        .eq("id", schedule.id);

      await supabase.from("email_log").insert({
        event_id: event.id,
        schedule_id: schedule.id,
        email_type: "confirmation_golfer",
        subject: `${event.name}: Confirmation`,
        recipient_count: golferEmails.length,
      });
    }

    console.log(
      `${isTest ? "[TEST] Would send" : "Sent"} golfer confirmation to ${golferEmails.length} golfers`
    );

    return {
      message: `Golfer confirmation ${isTest ? "would be" : ""} sent`,
      sent: golferEmails.length,
    };
  } catch (err) {
    console.error("Failed to send golfer confirmation:", err);
    return {
      message: "Failed to send golfer confirmation",
      sent: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================
// PRO SHOP DETAIL EMAIL
// ============================================================

async function handleProShopDetail(
  supabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  gameDateString: string,
  isTest: boolean
) {
  // Get event schedule
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule) {
    return { message: "No schedule found", sent: 0 };
  }

  if (schedule.status === "cancelled") {
    return { message: "Game cancelled — skipping pro shop email", sent: 0 };
  }

  if (schedule.pro_shop_sent) {
    return { message: "Pro shop email already sent", sent: 0 };
  }

  // Get confirmed golfers with full details
  const { data: confirmedRsvps } = await supabase
    .from("rsvps")
    .select(
      "*, profile:profiles(id, first_name, last_name, email, phone, ghin_number)"
    )
    .eq("schedule_id", schedule.id)
    .eq("status", "in")
    .order("responded_at", { ascending: true });

  // Get approved guests
  const { data: approvedGuests } = await supabase
    .from("guest_requests")
    .select(
      "*, requested_by_profile:profiles!guest_requests_requested_by_fkey(first_name, last_name)"
    )
    .eq("schedule_id", schedule.id)
    .eq("status", "approved");

  // Build full player list with contact details
  const confirmedPlayers = (confirmedRsvps || []).map(
    (r: Record<string, unknown>) => {
      const profile = r.profile as {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        ghin_number: string;
      };
      return { ...profile, is_guest: false };
    }
  );

  const guestPlayers = (approvedGuests || []).map(
    (g: Record<string, unknown>) => {
      const sponsor = g.requested_by_profile as {
        first_name: string;
        last_name: string;
      };
      return {
        first_name: g.guest_first_name as string,
        last_name: g.guest_last_name as string,
        email: (g.guest_email as string) || "",
        phone: (g.guest_phone as string) || "",
        ghin_number: (g.guest_ghin_number as string) || "",
        is_guest: true,
        sponsor_name: sponsor
          ? `${sponsor.first_name} ${sponsor.last_name.charAt(0)}.`
          : "Member",
      };
    }
  );

  const allPlayers = [...confirmedPlayers, ...guestPlayers].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
  );

  // Get pro shop contacts
  const { data: proShopContacts } = await supabase
    .from("pro_shop_contacts")
    .select("email")
    .eq("event_id", event.id);

  const proShopEmails = (proShopContacts || []).map(
    (c: { email: string }) => c.email
  );

  if (proShopEmails.length === 0) {
    return { message: "No pro shop contacts configured", sent: 0 };
  }

  // Get admin emails for CC
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", event.id);

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_super_admin", true);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const primaryAdminEmail = (primaryAdmin?.profile as unknown as { email: string })
    ?.email;

  const adminEmails = [
    ...(superAdmins || []).map((a: { email: string }) => a.email),
    ...(eventAdmins || []).map(
      (a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
    ),
  ].filter((e): e is string => !!e);

  const uniqueAdminEmails = [...new Set(adminEmails)];

  const proShopHtml = generateProShopEmail({
    eventName: event.name as string,
    gameDate: gameDateString,
    players: allPlayers,
  });

  const formattedDate = formatGameDate(gameDateString);

  try {
    if (!isTest) {
      await sendEmail({
        to: proShopEmails,
        cc: uniqueAdminEmails,
        replyTo: primaryAdminEmail,
        subject: `${event.name}: ${formattedDate}: Player Details & GHIN`,
        html: proShopHtml,
      });

      await supabase
        .from("event_schedules")
        .update({ pro_shop_sent: true })
        .eq("id", schedule.id);

      await supabase.from("email_log").insert({
        event_id: event.id,
        schedule_id: schedule.id,
        email_type: "confirmation_proshop",
        subject: `${event.name}: Pro Shop Detail`,
        recipient_count: proShopEmails.length,
      });
    }

    console.log(
      `${isTest ? "[TEST] Would send" : "Sent"} pro shop detail to ${proShopEmails.join(", ")}`
    );

    return {
      message: `Pro shop email ${isTest ? "would be" : ""} sent`,
      sent: proShopEmails.length,
    };
  } catch (err) {
    console.error("Failed to send pro shop email:", err);
    return {
      message: "Failed to send pro shop email",
      sent: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================
// LOW RESPONSE ALERT CHECK
// ============================================================

async function checkLowResponseAlert(
  supabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  gameDateString: string
) {
  // Get the low_response alert setting for this event
  const { data: alertSetting } = await supabase
    .from("event_alert_settings")
    .select("*")
    .eq("event_id", event.id)
    .eq("alert_type", "low_response")
    .maybeSingle();

  if (!alertSetting?.is_enabled) return;

  // Parse config: { day: number (0-6), time: "HH:MM" }
  const config = alertSetting.config as {
    day?: number;
    time?: string;
  } | null;
  if (!config?.time) return;

  const nowPT = getNowPacific();

  // Check if the configured day/time matches "now"
  // config.day is days-of-week (0=Sun..6=Sat), check if today matches
  const alertDay = config.day ?? 4; // default Thursday
  if (nowPT.dayOfWeek !== alertDay) return;

  // Check if within 1 hour of configured time
  const [alertHour, alertMinute] = config.time.split(":").map(Number);
  const nowMinutes = nowPT.hour * 60 + nowPT.minute;
  const alertMinutes = alertHour * 60 + alertMinute;
  if (Math.abs(nowMinutes - alertMinutes) > 60) return;

  // Get schedule for this game date
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("id, status")
    .eq("event_id", event.id)
    .eq("game_date", gameDateString)
    .maybeSingle();

  if (!schedule || schedule.status === "cancelled") return;

  // Count responses
  const { count: totalRsvps } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", schedule.id);

  const { count: respondedCount } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", schedule.id)
    .in("status", ["in", "out"]);

  const total = totalRsvps || 0;
  const responded = respondedCount || 0;

  // Alert if less than 50% have responded
  if (total > 0 && responded / total < 0.5) {
    await sendAdminAlert("low_response", {
      eventId: event.id as string,
      eventName: event.name as string,
      gameDate: gameDateString,
      respondedCount: responded,
      totalSubscribers: total,
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatGameDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
