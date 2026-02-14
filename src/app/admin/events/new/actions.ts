"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AlertType } from "@/types/events";

export async function createEvent(formData: FormData) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Event name is required" };

  // Build event row
  const eventData: Record<string, unknown> = {
    name,
    description: (formData.get("description") as string)?.trim() || null,
    frequency: formData.get("frequency") as string,
    day_of_week: parseInt(formData.get("day_of_week") as string),
    default_capacity: parseInt(formData.get("default_capacity") as string),
    timezone: "America/Los_Angeles",

    // Duration
    duration_mode: formData.get("duration_mode") as string,

    // Email schedule
    invite_day: parseInt(formData.get("invite_day") as string),
    invite_time: formData.get("invite_time") as string,
    num_reminders: parseInt(formData.get("num_reminders") as string) || 1,
    reminder_day: parseInt(formData.get("reminder_day") as string),
    reminder_time: formData.get("reminder_time") as string,
    cutoff_day: parseInt(formData.get("cutoff_day") as string),
    cutoff_time: formData.get("cutoff_time") as string,
    confirmation_day: parseInt(formData.get("confirmation_day") as string),
    confirmation_time: formData.get("confirmation_time") as string,

    // Feature flags — all OFF for MVP
    allow_guest_requests: false,
    allow_tee_time_preferences: false,
    allow_playing_partner_preferences: false,
  };

  // Min players
  const minPlayers = formData.get("min_players") as string;
  if (minPlayers) eventData.min_players = parseInt(minPlayers);

  // Duration specifics
  const durationMode = eventData.duration_mode as string;
  if (durationMode === "fixed_weeks") {
    eventData.start_date = formData.get("start_date") || null;
    eventData.duration_weeks = formData.get("duration_weeks")
      ? parseInt(formData.get("duration_weeks") as string)
      : null;
    if (eventData.start_date && eventData.duration_weeks) {
      const [y, m, d] = (eventData.start_date as string)
        .split("-")
        .map(Number);
      const end = new Date(y, m - 1, d);
      end.setDate(end.getDate() + (eventData.duration_weeks as number) * 7);
      eventData.end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    }
  } else if (durationMode === "end_date") {
    eventData.end_date = formData.get("end_date") || null;
  }

  // Reminder 2/3
  const numReminders = eventData.num_reminders as number;
  if (numReminders >= 2) {
    eventData.reminder2_day = parseInt(
      formData.get("reminder2_day") as string
    );
    eventData.reminder2_time = formData.get("reminder2_time") as string;
  }
  if (numReminders >= 3) {
    eventData.reminder3_day = parseInt(
      formData.get("reminder3_day") as string
    );
    eventData.reminder3_time = formData.get("reminder3_time") as string;
  }

  try {
    // 1. Insert event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert(eventData)
      .select()
      .single();

    if (eventError) throw eventError;

    const eventId = event.id;
    const gameDow = event.day_of_week;

    // Helper: calculate send_day_offset
    const calcOffset = (sendDow: number): number => {
      let offset = sendDow - gameDow;
      if (offset > 0) offset -= 7;
      return offset;
    };

    // 2. Create email_schedules rows
    const emailSchedules = [
      {
        event_id: eventId,
        email_type: "invite",
        send_day_offset: calcOffset(event.invite_day),
        send_time: event.invite_time,
        priority_order: 1,
      },
      {
        event_id: eventId,
        email_type: "golfer_confirmation",
        send_day_offset: calcOffset(event.confirmation_day),
        send_time: event.confirmation_time,
        priority_order: 1,
      },
      {
        event_id: eventId,
        email_type: "pro_shop_detail",
        send_day_offset: calcOffset(event.confirmation_day),
        send_time: event.confirmation_time,
        priority_order: 1,
      },
    ];

    // Add reminder rows
    if (numReminders >= 1) {
      emailSchedules.push({
        event_id: eventId,
        email_type: "reminder",
        send_day_offset: calcOffset(event.reminder_day),
        send_time: event.reminder_time,
        priority_order: 1,
      });
    }
    if (numReminders >= 2 && event.reminder2_day != null) {
      emailSchedules.push({
        event_id: eventId,
        email_type: "reminder",
        send_day_offset: calcOffset(event.reminder2_day),
        send_time: event.reminder2_time,
        priority_order: 2,
      });
    }
    if (numReminders >= 3 && event.reminder3_day != null) {
      emailSchedules.push({
        event_id: eventId,
        email_type: "reminder",
        send_day_offset: calcOffset(event.reminder3_day),
        send_time: event.reminder3_time,
        priority_order: 3,
      });
    }

    await supabase.from("email_schedules").insert(emailSchedules);

    // 3. Create default alert settings
    const alertDefaults: {
      event_id: string;
      alert_type: AlertType;
      is_enabled: boolean;
      config: Record<string, unknown> | null;
    }[] = [
      {
        event_id: eventId,
        alert_type: "new_registration",
        is_enabled: true,
        config: null,
      },
      {
        event_id: eventId,
        alert_type: "capacity_reached",
        is_enabled: true,
        config: null,
      },
      {
        event_id: eventId,
        alert_type: "spot_opened",
        is_enabled: false,
        config: null,
      },
      {
        event_id: eventId,
        alert_type: "low_response",
        is_enabled: true,
        config: { day: 4, time: "17:00" },
      },
    ];

    await supabase.from("event_alert_settings").insert(alertDefaults);

    // 4. Assign primary admin if specified
    const primaryAdminId = formData.get("primary_admin_id") as string;
    if (primaryAdminId) {
      await supabase.from("event_admins").insert({
        event_id: eventId,
        profile_id: primaryAdminId,
        role: "primary",
      });
    }

    redirect(`/admin/events/${eventId}/settings`);
  } catch (error) {
    // redirect() throws a special error — let it propagate
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    console.error("Create event error:", error);
    return { error: "Failed to create event" };
  }
}
