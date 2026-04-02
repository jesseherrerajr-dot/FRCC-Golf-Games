"use server";

import { requireAdmin, requireSuperAdmin, hasEventAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AlertType, GroupingPartnerPrefMode, GroupingTeeTimePrefMode, GroupingMethod, FlightTeamPairing } from "@/types/events";

// ============================================================
// Event Basic Settings
// ============================================================

export async function updateEventBasicSettings(
  eventId: string,
  formData: FormData
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  const updates: Record<string, unknown> = {};

  // Basic fields
  const name = formData.get("name") as string;
  if (name) updates.name = name.trim();

  const description = formData.get("description") as string;
  updates.description = description?.trim() || null;

  const slug = formData.get("slug") as string;
  if (slug !== null) {
    const sanitized = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-|-$/g, "");
    updates.slug = sanitized || null;
  }

  const frequency = formData.get("frequency") as string;
  if (frequency) updates.frequency = frequency;

  const dayOfWeek = formData.get("day_of_week");
  if (dayOfWeek !== null) updates.day_of_week = parseInt(dayOfWeek as string);

  const capacity = formData.get("default_capacity");
  if (capacity) updates.default_capacity = parseInt(capacity as string);

  const minPlayers = formData.get("min_players") as string;
  updates.min_players = minPlayers ? parseInt(minPlayers) : null;

  // Game time settings
  const gameType = formData.get("game_type") as string;
  if (gameType) updates.game_type = gameType;

  const firstTeeTime = formData.get("first_tee_time") as string;
  if (firstTeeTime) updates.first_tee_time = firstTeeTime;

  // Duration
  const durationMode = formData.get("duration_mode") as string;
  if (durationMode) {
    updates.duration_mode = durationMode;
    if (durationMode === "fixed_weeks") {
      updates.start_date = formData.get("start_date") || null;
      updates.duration_weeks = formData.get("duration_weeks")
        ? parseInt(formData.get("duration_weeks") as string)
        : null;
      // Calculate end_date
      if (updates.start_date && updates.duration_weeks) {
        const [y, m, d] = (updates.start_date as string).split("-").map(Number);
        const end = new Date(y, m - 1, d);
        end.setDate(end.getDate() + (updates.duration_weeks as number) * 7);
        updates.end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      }
    } else if (durationMode === "end_date") {
      updates.end_date = formData.get("end_date") || null;
      updates.start_date = null;
      updates.duration_weeks = null;
    } else {
      updates.end_date = null;
      updates.start_date = null;
      updates.duration_weeks = null;
    }
  }

  try {
    const { error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update event settings error:", error);
    return { error: "Failed to update event settings" };
  }
}

// ============================================================
// Email Schedule Settings
// ============================================================

export async function updateEmailScheduleSettings(
  eventId: string,
  formData: FormData
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  const updates: Record<string, unknown> = {};

  // Invite timing
  const inviteDay = formData.get("invite_day");
  if (inviteDay !== null) updates.invite_day = parseInt(inviteDay as string);
  const inviteTime = formData.get("invite_time") as string;
  if (inviteTime) updates.invite_time = inviteTime;

  // Primary reminder
  const reminderDay = formData.get("reminder_day");
  if (reminderDay !== null)
    updates.reminder_day = parseInt(reminderDay as string);
  const reminderTime = formData.get("reminder_time") as string;
  if (reminderTime) updates.reminder_time = reminderTime;

  // Number of reminders
  const numReminders = formData.get("num_reminders");
  if (numReminders !== null) {
    const num = parseInt(numReminders as string);
    updates.num_reminders = num;

    // Second reminder
    if (num >= 2) {
      updates.reminder2_day = parseInt(
        formData.get("reminder2_day") as string
      );
      updates.reminder2_time = formData.get("reminder2_time") as string;
    } else {
      updates.reminder2_day = null;
      updates.reminder2_time = null;
    }

    // Third reminder
    if (num >= 3) {
      updates.reminder3_day = parseInt(
        formData.get("reminder3_day") as string
      );
      updates.reminder3_time = formData.get("reminder3_time") as string;
    } else {
      updates.reminder3_day = null;
      updates.reminder3_time = null;
    }
  }

  // Cutoff
  const cutoffDay = formData.get("cutoff_day");
  if (cutoffDay !== null) updates.cutoff_day = parseInt(cutoffDay as string);
  const cutoffTime = formData.get("cutoff_time") as string;
  if (cutoffTime) updates.cutoff_time = cutoffTime;

  // Confirmation
  const confirmDay = formData.get("confirmation_day");
  if (confirmDay !== null)
    updates.confirmation_day = parseInt(confirmDay as string);
  const confirmTime = formData.get("confirmation_time") as string;
  if (confirmTime) updates.confirmation_time = confirmTime;

  try {
    const { data: updated, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", eventId)
      .select("id");

    if (error) throw error;

    if (!updated || updated.length === 0) {
      console.error("Email schedule update affected 0 rows — likely an RLS policy issue", { eventId, updates });
      return { error: "Save failed — no rows updated. Check admin permissions." };
    }

    // Also update the email_schedules table to stay in sync
    await syncEmailSchedules(supabase, eventId, formData);

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update email settings error:", error);
    return { error: "Failed to update email schedule settings" };
  }
}

async function syncEmailSchedules(
  supabase: any,
  eventId: string,
  formData: FormData
) {
  // Get the event to calculate offsets
  const { data: event } = await supabase
    .from("events")
    .select("day_of_week")
    .eq("id", eventId)
    .single();

  if (!event) return;

  const gameDow = event.day_of_week;

  // Helper: calculate send_day_offset from send day-of-week relative to game day
  const calcOffset = (sendDow: number): number => {
    let offset = sendDow - gameDow;
    if (offset > 0) offset -= 7; // send day must be before game day
    return offset;
  };

  // Upsert invite
  const inviteDay = parseInt(formData.get("invite_day") as string);
  const inviteTime = formData.get("invite_time") as string;
  if (!isNaN(inviteDay) && inviteTime) {
    await supabase
      .from("email_schedules")
      .upsert(
        {
          event_id: eventId,
          email_type: "invite",
          priority_order: 1,
          send_day_offset: calcOffset(inviteDay),
          send_time: inviteTime,
          is_enabled: true,
        },
        { onConflict: "event_id,email_type,priority_order" }
      );
  }

  // Upsert reminders (respecting enabled/disabled toggle)
  const reminderEnabled = formData.get("reminder_enabled") !== "false";
  const numReminders = reminderEnabled
    ? parseInt(formData.get("num_reminders") as string) || 0
    : 0;

  for (let i = 1; i <= 3; i++) {
    if (i <= numReminders) {
      const dayKey = i === 1 ? "reminder_day" : `reminder${i}_day`;
      const timeKey = i === 1 ? "reminder_time" : `reminder${i}_time`;
      const rDay = parseInt(formData.get(dayKey) as string);
      const rTime = formData.get(timeKey) as string;
      if (!isNaN(rDay) && rTime) {
        await supabase
          .from("email_schedules")
          .upsert(
            {
              event_id: eventId,
              email_type: "reminder",
              priority_order: i,
              send_day_offset: calcOffset(rDay),
              send_time: rTime,
              is_enabled: reminderEnabled,
            },
            { onConflict: "event_id,email_type,priority_order" }
          );
      }
    } else {
      // Disable or delete excess reminders
      await supabase
        .from("email_schedules")
        .delete()
        .eq("event_id", eventId)
        .eq("email_type", "reminder")
        .eq("priority_order", i);
    }
  }

  // Upsert golfer confirmation: same time as cutoff (the ~15 min cron
  // delay from :45 settings to :00 cron runs provides sufficient buffer)
  const cutoffDayVal = parseInt(formData.get("cutoff_day") as string);
  const cutoffTimeVal = formData.get("cutoff_time") as string;
  if (!isNaN(cutoffDayVal) && cutoffTimeVal) {
    const golferConfirmDay = cutoffDayVal;
    const golferConfirmTime = cutoffTimeVal;
    const golferOffset = calcOffset(golferConfirmDay);

    await supabase
      .from("email_schedules")
      .upsert(
        {
          event_id: eventId,
          email_type: "golfer_confirmation",
          priority_order: 1,
          send_day_offset: golferOffset,
          send_time: golferConfirmTime,
          is_enabled: true,
        },
        { onConflict: "event_id,email_type,priority_order" }
      );
  }

  // Upsert pro shop detail email at the admin-configured confirmation time
  const proShopEnabled = formData.get("pro_shop_enabled") !== "false";
  const confirmDay = parseInt(formData.get("confirmation_day") as string);
  const confirmTime = formData.get("confirmation_time") as string;
  if (!isNaN(confirmDay) && confirmTime) {
    const offset = calcOffset(confirmDay);
    await supabase
      .from("email_schedules")
      .upsert(
        {
          event_id: eventId,
          email_type: "pro_shop_detail",
          priority_order: 1,
          send_day_offset: offset,
          send_time: confirmTime,
          is_enabled: proShopEnabled,
        },
        { onConflict: "event_id,email_type,priority_order" }
      );
  } else if (!proShopEnabled) {
    // If pro shop is disabled and no day/time provided, still update the enabled state
    await supabase
      .from("email_schedules")
      .update({ is_enabled: false })
      .eq("event_id", eventId)
      .eq("email_type", "pro_shop_detail");
  }
}

// ============================================================
// Email Type Toggle (enable/disable specific email types)
// ============================================================

export async function updateEmailTypeEnabled(
  eventId: string,
  emailType: "reminder" | "pro_shop_detail",
  isEnabled: boolean
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  try {
    // Update all rows for this email type in email_schedules
    const { error } = await supabase
      .from("email_schedules")
      .update({ is_enabled: isEnabled })
      .eq("event_id", eventId)
      .eq("email_type", emailType);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update email type enabled error:", error);
    return { error: "Failed to update email type setting" };
  }
}

// ============================================================
// Alert Settings
// ============================================================

export async function updateAlertSetting(
  eventId: string,
  alertType: AlertType,
  isEnabled: boolean,
  config?: { day: number; time: string }
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  try {
    const { error } = await supabase
      .from("event_alert_settings")
      .upsert(
        {
          event_id: eventId,
          alert_type: alertType,
          is_enabled: isEnabled,
          config: config || null,
        },
        { onConflict: "event_id,alert_type" }
      );

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update alert error:", error);
    return { error: "Failed to update alert settings" };
  }
}

// ============================================================
// Pro Shop Contacts
// ============================================================

export async function addProShopContact(eventId: string, email: string, name?: string) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  const trimmedEmail = email.trim().toLowerCase();
  // Use provided name, or derive from email prefix (e.g., "proshop" from "proshop@frcc.com")
  const contactName = name?.trim() || trimmedEmail.split("@")[0];

  try {
    const { error } = await supabase
      .from("pro_shop_contacts")
      .insert({ event_id: eventId, email: trimmedEmail, name: contactName });

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Add pro shop contact error:", error);
    return { error: "Failed to add pro shop contact" };
  }
}

export async function removeProShopContact(contactId: string, eventId: string) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  try {
    const { error } = await supabase
      .from("pro_shop_contacts")
      .delete()
      .eq("id", contactId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Remove pro shop contact error:", error);
    return { error: "Failed to remove pro shop contact" };
  }
}

// ============================================================
// Event Admin Assignments (super admin only)
// ============================================================

export async function assignEventAdmin(
  eventId: string,
  profileId: string,
  role: "primary" | "secondary"
) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("event_admins")
      .upsert(
        { event_id: eventId, profile_id: profileId, role },
        { onConflict: "event_id,profile_id" }
      );

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Assign admin error:", error);
    return { error: "Failed to assign event admin" };
  }
}

export async function removeEventAdmin(eventId: string, profileId: string) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("event_admins")
      .delete()
      .eq("event_id", eventId)
      .eq("profile_id", profileId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Remove admin error:", error);
    return { error: "Failed to remove event admin" };
  }
}

// ============================================================
// Feature Flags (super admin only)
// ============================================================

export async function updateFeatureFlags(
  eventId: string,
  flags: {
    allow_guest_requests?: boolean;
    allow_tee_time_preferences?: boolean;
    allow_playing_partner_preferences?: boolean;
    allow_auto_grouping?: boolean;
  }
) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("events")
      .update(flags)
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update feature flags error:", error);
    return { error: "Failed to update feature flags" };
  }
}

// ============================================================
// Grouping Preferences
// ============================================================

const VALID_PARTNER_MODES: GroupingPartnerPrefMode[] = ['off', 'light', 'moderate', 'full'];
const VALID_TEE_TIME_MODES: GroupingTeeTimePrefMode[] = ['off', 'light', 'moderate', 'full'];
const VALID_GROUPING_METHODS: GroupingMethod[] = ['harmony', 'flight_foursomes', 'balanced_foursomes', 'flight_teams', 'balanced_teams'];
const VALID_FLIGHT_TEAM_PAIRINGS: FlightTeamPairing[] = ['similar', 'random'];

export async function updateGroupingPreferences(
  eventId: string,
  settings: {
    grouping_method?: GroupingMethod;
    grouping_partner_pref_mode?: GroupingPartnerPrefMode;
    grouping_tee_time_pref_mode?: GroupingTeeTimePrefMode;
    grouping_promote_variety?: boolean;
    flight_team_pairing?: FlightTeamPairing;
  }
) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  // Validate enum values
  if (settings.grouping_method && !VALID_GROUPING_METHODS.includes(settings.grouping_method)) {
    return { error: "Invalid grouping method" };
  }
  if (settings.grouping_partner_pref_mode && !VALID_PARTNER_MODES.includes(settings.grouping_partner_pref_mode)) {
    return { error: "Invalid partner preference mode" };
  }
  if (settings.grouping_tee_time_pref_mode && !VALID_TEE_TIME_MODES.includes(settings.grouping_tee_time_pref_mode)) {
    return { error: "Invalid tee time preference mode" };
  }
  if (settings.flight_team_pairing && !VALID_FLIGHT_TEAM_PAIRINGS.includes(settings.flight_team_pairing)) {
    return { error: "Invalid flight team pairing mode" };
  }

  try {
    const { error } = await supabase
      .from("events")
      .update(settings)
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update grouping preferences error:", error);
    return { error: "Failed to update grouping preferences" };
  }
}

// ============================================================
// Handicap Sync Settings
// ============================================================

export async function updateHandicapSyncEnabled(
  eventId: string,
  enabled: boolean
) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("events")
      .update({ handicap_sync_enabled: enabled })
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Update handicap sync error:", error);
    return { error: "Failed to update handicap sync setting" };
  }
}

// ============================================================
// Deactivate Event
// ============================================================

export async function deactivateEvent(eventId: string) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("events")
      .update({ is_active: false })
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Deactivate event error:", error);
    return { error: "Failed to deactivate event" };
  }
}

// Helper: add minutes to a "HH:MM" time string, returns "HH:MM"
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export async function reactivateEvent(eventId: string) {
  await requireSuperAdmin();
  const { supabase } = await requireAdmin();

  try {
    const { error } = await supabase
      .from("events")
      .update({ is_active: true })
      .eq("id", eventId);

    if (error) throw error;

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Reactivate event error:", error);
    return { error: "Failed to reactivate event" };
  }
}

// ============================================================
// Permanently Delete Event
// ============================================================

export async function permanentlyDeleteEvent(eventId: string, confirmName: string) {
  await requireSuperAdmin();
  const supabase = createAdminClient();

  try {
    // Verify the event exists and name matches (safety check)
    const { data: event } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", eventId)
      .single();

    if (!event) {
      return { error: "Event not found" };
    }

    if (event.name.trim().toLowerCase() !== confirmName.trim().toLowerCase()) {
      return { error: "Event name does not match. Deletion cancelled." };
    }

    // Delete all related data in dependency order (child tables first)
    // 1. RSVPs and groupings depend on event_schedules
    await supabase
      .from("rsvps")
      .delete()
      .in("schedule_id",
        (await supabase.from("event_schedules").select("id").eq("event_id", eventId)).data?.map((s: { id: string }) => s.id) || []
      );

    await supabase
      .from("groupings")
      .delete()
      .in("schedule_id",
        (await supabase.from("event_schedules").select("id").eq("event_id", eventId)).data?.map((s: { id: string }) => s.id) || []
      );

    // 2. Direct event children
    await supabase.from("event_schedules").delete().eq("event_id", eventId);
    await supabase.from("event_subscriptions").delete().eq("event_id", eventId);
    await supabase.from("email_schedules").delete().eq("event_id", eventId);
    await supabase.from("event_alert_settings").delete().eq("event_id", eventId);
    await supabase.from("playing_partner_preferences").delete().eq("event_id", eventId);
    await supabase.from("pro_shop_contacts").delete().eq("event_id", eventId);
    await supabase.from("event_admins").delete().eq("event_id", eventId);
    await supabase.from("email_log").delete().eq("event_id", eventId);
    await supabase.from("weather_cache").delete().eq("event_id", eventId);
    await supabase.from("guest_requests").delete().eq("event_id", eventId);

    // 3. Delete the event itself
    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) throw error;

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Permanently delete event error:", error);
    return { error: "Failed to permanently delete event. Some related data may still exist." };
  }
}
