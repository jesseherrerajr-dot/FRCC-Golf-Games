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

  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/admin/members");
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

  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/admin/members");
  return { success: true };
}
