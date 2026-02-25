"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { unsubscribeFromEvent as unsubscribeHelper } from "@/lib/subscriptions";

/**
 * Unsubscribe the current golfer from an event.
 * Self-service — uses the authenticated user's ID.
 */
export async function unsubscribeFromEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const result = await unsubscribeHelper(supabase, user.id, eventId);

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
