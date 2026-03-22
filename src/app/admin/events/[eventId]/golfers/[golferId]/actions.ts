"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { unsubscribeFromEvent } from "@/lib/subscriptions";
import { requireAdmin, hasEventAccess } from "@/lib/auth";

/**
 * Verify the current user is an admin with access to this event.
 */
async function requireEventAdmin(eventId: string) {
  const { supabase, profile, adminEvents } = await requireAdmin();

  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return null;
  }

  return { supabase };
}

/**
 * Event admin sets or clears a golfer's manual handicap index override.
 */
export async function eventUpdateManualHandicap(
  profileId: string,
  handicapIndex: number | null,
  eventId?: string
) {
  // Use event-level auth if eventId is provided, otherwise require any admin
  if (eventId) {
    const ctx = await requireEventAdmin(eventId);
    if (!ctx) return { error: "Not authorized" };

    if (handicapIndex !== null && (handicapIndex < -10 || handicapIndex > 54)) {
      return { error: "Handicap index must be between -10 and 54" };
    }

    const { error } = await ctx.supabase
      .from("profiles")
      .update({ manual_handicap_index: handicapIndex })
      .eq("id", profileId);

    if (error) {
      console.error("Update manual handicap error:", error);
      return { error: "Failed to update handicap" };
    }

    revalidatePath(`/admin/events/${eventId}/golfers/${profileId}`);
    return { success: true };
  }

  return { error: "Event ID required" };
}

/**
 * Event admin removes a golfer from this specific event.
 */
export async function eventRemoveGolferFromEvent(
  profileId: string,
  eventId: string
) {
  const ctx = await requireEventAdmin(eventId);
  if (!ctx) return { error: "Not authorized" };

  const result = await unsubscribeFromEvent(ctx.supabase, profileId, eventId);
  if (!result.success) return { error: result.error };

  revalidatePath(`/admin/events/${eventId}/golfers/${profileId}`);
  revalidatePath(`/admin/events/${eventId}/golfers`);
  return { success: true };
}
