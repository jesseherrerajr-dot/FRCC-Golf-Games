"use server";

import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSchedulesForEvent } from "@/lib/schedule-gen";
import { sendEmail, rateLimitDelay, generateGameCancelledEmail } from "@/lib/email";
import { formatGameDateMonthDay } from "@/lib/format";
import type { Event } from "@/types/events";

export async function generateSchedules(eventId: string) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized" };
  }

  try {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (!event) return { error: "Event not found" };

    const created = await generateSchedulesForEvent(
      supabase,
      event as unknown as Event
    );

    revalidatePath(`/admin/events/${eventId}/schedule`);
    return { success: true, created };
  } catch (error) {
    console.error("Generate schedules error:", error);
    return { error: "Failed to generate schedules" };
  }
}

export async function toggleGameStatus(
  scheduleId: string,
  eventId: string,
  newStatus: "scheduled" | "cancelled",
  cancelReason?: string
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized" };
  }

  try {
    // Get the schedule details before updating (need game_date for email)
    const { data: schedule } = await supabase
      .from("event_schedules")
      .select("id, game_date, status")
      .eq("id", scheduleId)
      .single();

    if (!schedule) return { error: "Schedule not found" };

    const { error } = await supabase
      .from("event_schedules")
      .update({ status: newStatus })
      .eq("id", scheduleId);

    if (error) throw error;

    // Send cancellation emails when toggling to "cancelled"
    if (newStatus === "cancelled" && schedule.status !== "cancelled") {
      // Fire-and-forget so the admin UI doesn't wait
      sendCancellationEmails(supabase, eventId, scheduleId, schedule.game_date, cancelReason).catch(
        (err) => console.error("Cancellation email error:", err)
      );
    }

    revalidatePath(`/admin/events/${eventId}/schedule`);
    return { success: true };
  } catch (error) {
    console.error("Toggle game status error:", error);
    return { error: "Failed to update game status" };
  }
}

/**
 * Send cancellation notification emails to all active golfers
 * subscribed to this event.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendCancellationEmails(
  supabase: any,
  eventId: string,
  scheduleId: string,
  gameDate: string,
  cancelReason?: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Get event details
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) return;

  const eventName = event.name as string;

  // Find the next scheduled game after this one
  const { data: nextGame } = await supabase
    .from("event_schedules")
    .select("game_date")
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .gt("game_date", gameDate)
    .order("game_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Get all active golfers subscribed to this event
  const { data: subscribers } = await supabase
    .from("event_subscriptions")
    .select("profile:profiles(id, email, first_name, last_name, status)")
    .eq("event_id", eventId);

  const activeSubscribers = ((subscribers || []) as Record<string, unknown>[]).filter((s) => {
    const p = s.profile as {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      status: string;
    } | null;
    return p && p.status === "active" && p.email;
  });

  if (activeSubscribers.length === 0) return;

  // Get primary admin for reply-to
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", eventId);

  const primaryAdmin = ((eventAdmins || []) as Record<string, unknown>[]).find(
    (a) => a.role === "primary"
  );
  const replyTo = (primaryAdmin?.profile as { email: string } | null)?.email;

  const formattedDate = formatGameDateMonthDay(gameDate);

  let sentCount = 0;
  for (const sub of activeSubscribers) {
    const p = sub.profile as {
      email: string;
      first_name: string;
    };

    const html = generateGameCancelledEmail({
      golferName: p.first_name,
      eventName,
      gameDate,
      nextGameDate: (nextGame?.game_date as string) || null,
      reason: cancelReason,
      siteUrl,
    });

    const result = await sendEmail({
      to: p.email,
      replyTo: replyTo || undefined,
      subject: `[${eventName}] Game Cancelled — ${formattedDate}`,
      html,
    });

    if (result.success) sentCount++;
    await rateLimitDelay();
  }

  // Log the cancellation email batch
  await supabase.from("email_log").insert({
    event_id: eventId,
    schedule_id: scheduleId,
    email_type: "custom",
    subject: `[${eventName}] Game Cancelled — ${formattedDate}`,
    recipient_count: sentCount,
  });

  console.log(
    `Sent ${sentCount} cancellation emails for ${eventName} — ${formattedDate}`
  );
}

export async function updateWeekSettings(
  scheduleId: string,
  eventId: string,
  updates: {
    capacity?: number | null;
    min_players_override?: number | null;
    admin_notes?: string | null;
  }
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized" };
  }

  try {
    const { error } = await supabase
      .from("event_schedules")
      .update(updates)
      .eq("id", scheduleId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/schedule`);
    return { success: true };
  } catch (error) {
    console.error("Update week settings error:", error);
    return { error: "Failed to update week settings" };
  }
}
