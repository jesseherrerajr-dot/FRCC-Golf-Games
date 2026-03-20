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
import { sendPushToUsers } from "@/lib/push";
import { generateGroupings, DEFAULT_GROUPING_OPTIONS } from "@/lib/grouping-engine";
import type { GroupingOptions, GroupingPartnerPrefMode, GroupingTeeTimePrefMode } from "@/types/events";
import {
  fetchConfirmedGolfers,
  fetchPartnerPreferences,
  storeGroupings,
  fetchStoredGroupings,
  fetchApprovedGuests,
  fetchTeeTimeHistory,
  fetchRecentPairings,
} from "@/lib/grouping-db";
import { formatGameDate, formatSponsorName, getSiteUrl } from "@/lib/format";
import { getGameWeather } from "@/lib/weather";
import { needsHandicapSync, runHandicapSync, getConsecutiveFailureCount, isGhinConfigured } from "@/lib/handicap-sync";
import type { GameType } from "@/types/events";

/**
 * Dynamic Email Scheduler Cron
 * Triggered by 6 daily cron entries in vercel.json, each paired 1:1 with
 * an admin-selectable time slot. Checks the email_schedules table to
 * determine what emails to send. Supports configurable scheduling per
 * event with multiple reminders.
 *
 * Architecture:
 *   - Vercel Hobby plan limits crons to once-per-day frequency.
 *   - 6 daily crons, each firing 15 min after its paired dropdown option:
 *       Dropdown    Cron (PST)   UTC
 *        4:45 AM →  5:00 AM  → 0 13 * * *
 *        5:45 AM →  6:00 AM  → 0 14 * * *
 *       10:45 AM → 11:00 AM  → 0 19 * * *
 *       11:45 AM → 12:00 PM  → 0 20 * * *
 *        4:45 PM →  5:00 PM  → 0  1 * * *
 *        5:45 PM →  6:00 PM  → 0  2 * * *
 *   - During PDT (Mar–Nov), crons fire 1 hour later in Pacific Time.
 *     The 3-hour send window in isWithinSendWindow() still catches every slot.
 *   - Duplicate sends are prevented by "already sent" flags on each schedule
 *     (invite_sent, reminder_sent, etc.), NOT by the time window.
 *
 * The admin settings UI constrains time selection to 6 slots that are
 * 1:1 with the cron entries above, so admins can freely change email
 * times without any manual deployment steps.
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
    const siteUrl = getSiteUrl();

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
    const debug: string[] = []; // TEMP: debug output for handicap sync troubleshooting

    for (const event of events) {
      console.log(`Processing event: ${event.name}`);
      debug.push(`Processing event: ${event.name} (id: ${event.id})`);

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
        debug.push(`No email schedules — skipping event entirely (including handicap sync)`);
        continue;
      }
      debug.push(`Found ${emailSchedules.length} email schedules`);

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

      // Check if handicap sync is needed for this event (non-fatal)
      if (!isTest) {
        try {
          debug.push(`Checking handicap sync: isGhinConfigured=${isGhinConfigured()}, event.handicap_sync_enabled=${event.handicap_sync_enabled}`);
          const syncNeeded = await needsHandicapSync(event.id as string);
          debug.push(`needsHandicapSync returned: ${syncNeeded}`);
          if (syncNeeded) {
            console.log(`Running handicap sync for ${event.name}...`);
            const syncResult = await runHandicapSync(event.id as string);

            results.push({
              event: event.name,
              type: "handicap_sync",
              priority: 0,
              message: syncResult.success
                ? `Synced ${syncResult.successCount} handicaps (${syncResult.skippedCount} fresh, ${syncResult.failureCount} failed)`
                : `Handicap sync failed: ${syncResult.errorMessage}`,
              sent: syncResult.successCount,
            });

            // Send admin alert if sync failed
            if (!syncResult.success || (syncResult.failureCount > 0 && syncResult.successCount === 0)) {
              const consecutiveFailures = await getConsecutiveFailureCount(event.id as string);
              // Alert on first failure or every 3rd consecutive failure
              if (consecutiveFailures === 1 || consecutiveFailures % 3 === 0) {
                await sendAdminAlert("handicap_sync_failed", {
                  eventId: event.id as string,
                  eventName: event.name as string,
                  syncSuccessCount: syncResult.successCount,
                  syncFailureCount: syncResult.failureCount,
                  syncErrorMessage: syncResult.errorMessage,
                  consecutiveFailures,
                });
              }
            }
          }
        } catch (err) {
          console.error(`Handicap sync failed for ${event.name} (non-fatal):`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      debug, // TEMP: remove after handicap sync is verified
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

  // Fetch weather forecast for the game (non-fatal)
  let weather = null;
  try {
    weather = await getGameWeather(
      event.id as string,
      gameDateString,
      (event.first_tee_time as string) || "07:30",
      ((event.game_type as string) || "18_holes") as GameType
    );
  } catch (err) {
    console.error("Weather fetch failed (non-fatal):", err);
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
        weather,
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

    // Send push notifications (non-fatal)
    try {
      const profileIds = rsvps
        .map((r: Record<string, unknown>) => (r.profile as { id?: string })?.id)
        .filter((id): id is string => !!id);
      const formattedDate = formatGameDate(gameDateString);
      await sendPushToUsers(supabase, profileIds, {
        title: event.name as string,
        body: `New game ${formattedDate}. Tap to RSVP now.`,
        url: `${siteUrl}/home`,
        tag: `invite-${schedule.id}`,
      });
    } catch (pushErr) {
      console.error("Push notification error (invite, non-fatal):", pushErr);
    }
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

  // Get golfers who haven't RSVP'd or said "not sure"
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

  // Fetch weather forecast for the game (non-fatal)
  let weather = null;
  try {
    weather = await getGameWeather(
      event.id as string,
      gameDateString,
      (event.first_tee_time as string) || "07:30",
      ((event.game_type as string) || "18_holes") as GameType
    );
  } catch (err) {
    console.error("Weather fetch for reminder failed (non-fatal):", err);
  }

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
        weather,
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
      email_type: "reminder",
      subject: `${event.name}: Reminder`,
      recipient_count: sent,
    });

    // Send push notifications to non-responders (non-fatal)
    try {
      const profileIds = (pendingRsvps || [])
        .map((r: Record<string, unknown>) => (r.profile as { id?: string })?.id)
        .filter((id): id is string => !!id);
      const formattedDate = formatGameDate(gameDateString);
      await sendPushToUsers(supabase, profileIds, {
        title: event.name as string,
        body: `You haven't responded for ${formattedDate}. Tap to RSVP.`,
        url: `${siteUrl}/home`,
        tag: `reminder-${schedule.id}`,
      });
    } catch (pushErr) {
      console.error("Push notification error (reminder, non-fatal):", pushErr);
    }
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

  // Run grouping engine if enabled for this event
  if (event.allow_auto_grouping) {
    try {
      console.log(`Running grouping engine for ${event.name}...`);
      const eventId = event.id as string;
      const golfers = await fetchConfirmedGolfers(supabase, schedule.id);
      const preferences = await fetchPartnerPreferences(supabase, eventId);

      // Build grouping options from event settings + historical data
      const partnerPrefMode = (event.grouping_partner_pref_mode as GroupingPartnerPrefMode) || 'full';
      const teeTimePrefMode = (event.grouping_tee_time_pref_mode as GroupingTeeTimePrefMode) || 'full';
      const promoteVariety = (event.grouping_promote_variety as boolean) || false;

      // Fetch historical data only when needed
      const teeTimeHistory = teeTimePrefMode !== 'full' && teeTimePrefMode !== 'off'
        ? await fetchTeeTimeHistory(supabase, eventId, 8)
        : new Map();

      const recentPairings = promoteVariety
        ? await fetchRecentPairings(supabase, eventId, 8)
        : new Map();

      const groupingOptions: GroupingOptions = {
        partnerPreferenceMode: partnerPrefMode,
        teeTimePreferenceMode: teeTimePrefMode,
        promoteVariety,
        teeTimeHistory,
        recentPairings,
        shuffle: true,
      };

      console.log(`Grouping options: partner=${partnerPrefMode}, teeTime=${teeTimePrefMode}, variety=${promoteVariety}`);

      const groupingResult = generateGroupings(golfers, preferences, groupingOptions);
      const approvedGuestsForGrouping = await fetchApprovedGuests(supabase, schedule.id);
      const guestPairs = approvedGuestsForGrouping.map((g) => ({
        guestRequestId: g.guestRequestId,
        hostProfileId: g.hostProfileId,
      }));
      const storeResult = await storeGroupings(supabase, schedule.id, groupingResult, guestPairs);

      if (storeResult.success) {
        console.log(
          `Grouping engine complete: ${groupingResult.groups.length} groups, ` +
          `harmony score ${groupingResult.totalHarmonyScore}`
        );
      } else {
        console.error(`Failed to store groupings: ${storeResult.error}`);
      }
    } catch (err) {
      console.error("Grouping engine error (non-fatal):", err);
      // Grouping failure should NOT block the confirmation email
    }
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
          ? formatSponsorName(sponsor.first_name, sponsor.last_name)
          : "Golfer",
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

  // Fetch weather forecast for the confirmation email (non-fatal)
  let weather = null;
  try {
    weather = await getGameWeather(
      event.id as string,
      gameDateString,
      (event.first_tee_time as string) || "07:30",
      ((event.game_type as string) || "18_holes") as GameType
    );
  } catch (err) {
    console.error("Weather fetch for confirmation failed (non-fatal):", err);
  }

  const confirmationHtml = generateConfirmationEmail({
    eventName: event.name as string,
    gameDate: gameDateString,
    confirmedPlayers: allPlayers,
    adminNote: schedule.admin_notes,
    siteUrl,
    weather,
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

      // Send push notifications to confirmed golfers (non-fatal)
      try {
        const profileIds = confirmedRsvps
          .map((r: Record<string, unknown>) => (r.profile as { id?: string })?.id)
          .filter((id): id is string => !!id);
        await sendPushToUsers(supabase, profileIds, {
          title: event.name as string,
          body: `You're confirmed for ${formattedDate}! ${allPlayers.length} golfers playing.`,
          url: `${siteUrl}/home`,
          tag: `confirmation-${schedule.id}`,
        });
      } catch (pushErr) {
        console.error("Push notification error (confirmation, non-fatal):", pushErr);
      }
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
      "*, profile:profiles(id, first_name, last_name, email, phone, ghin_number, handicap_index)"
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
        handicap_index: number | null;
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
        handicap_index: null as number | null,
        is_guest: true,
        sponsor_name: sponsor
          ? formatSponsorName(sponsor.first_name, sponsor.last_name)
          : "Golfer",
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

  // Fetch stored groupings if auto-grouping is enabled
  const groupings = event.allow_auto_grouping
    ? await fetchStoredGroupings(supabase, schedule.id)
    : [];

  const proShopHtml = generateProShopEmail({
    eventName: event.name as string,
    gameDate: gameDateString,
    players: allPlayers,
    groupings,
  });

  const formattedDate = formatGameDate(gameDateString);

  try {
    if (!isTest) {
      await sendEmail({
        to: proShopEmails,
        cc: uniqueAdminEmails,
        replyTo: primaryAdminEmail,
        subject: `${event.name}: ${formattedDate}: Player Details & Suggested Groups`,
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

