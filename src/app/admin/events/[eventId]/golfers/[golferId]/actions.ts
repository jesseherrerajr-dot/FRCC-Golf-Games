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
