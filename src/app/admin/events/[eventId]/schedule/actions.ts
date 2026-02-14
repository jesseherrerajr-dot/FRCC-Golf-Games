"use server";

import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSchedulesForEvent } from "@/lib/schedule-gen";
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
  newStatus: "scheduled" | "cancelled"
) {
  const { profile, adminEvents, supabase } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized" };
  }

  try {
    const { error } = await supabase
      .from("event_schedules")
      .update({ status: newStatus })
      .eq("id", scheduleId);

    if (error) throw error;

    revalidatePath(`/admin/events/${eventId}/schedule`);
    return { success: true };
  } catch (error) {
    console.error("Toggle game status error:", error);
    return { error: "Failed to update game status" };
  }
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
