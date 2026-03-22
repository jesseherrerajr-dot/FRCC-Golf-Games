"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  subscribeToEvent,
  unsubscribeFromEvent,
} from "@/lib/subscriptions";

/**
 * Verify the current user is an admin (super admin or event admin).
 * Returns supabase client + admin flag, or null if not authorized.
 */
async function requireAdminAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.is_super_admin ||
    !!(
      await supabase
        .from("event_admins")
        .select("id")
        .eq("profile_id", user.id)
        .limit(1)
    ).data?.length;

  if (!isAdmin) return null;

  return { supabase };
}

/**
 * Admin subscribes a golfer to an event.
 */
export async function adminSubscribeToEvent(
  profileId: string,
  eventId: string
) {
  const ctx = await requireAdminAction();
  if (!ctx) return { error: "Not authorized" };

  const result = await subscribeToEvent(ctx.supabase, profileId, eventId);
  if (!result.success) return { error: result.error };

  revalidatePath(`/admin/golfers/${profileId}`);
  revalidatePath("/admin/golfers");
  return { success: true };
}

/**
 * Admin sets or clears a golfer's manual handicap index override.
 * Pass null to clear the override (revert to GHIN-synced value).
 */
export async function updateManualHandicap(
  profileId: string,
  handicapIndex: number | null
) {
  const ctx = await requireAdminAction();
  if (!ctx) return { error: "Not authorized" };

  // Validate range if provided
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

  revalidatePath(`/admin/golfers/${profileId}`);
  return { success: true };
}

/**
 * Admin unsubscribes a golfer from an event.
 */
export async function adminUnsubscribeFromEvent(
  profileId: string,
  eventId: string
) {
  const ctx = await requireAdminAction();
  if (!ctx) return { error: "Not authorized" };

  const result = await unsubscribeFromEvent(ctx.supabase, profileId, eventId);
  if (!result.success) return { error: result.error };

  revalidatePath(`/admin/golfers/${profileId}`);
  revalidatePath("/admin/golfers");
  return { success: true };
}
