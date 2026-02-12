"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Verify the current user is a super admin or event admin.
 * Returns the supabase client and admin user id, or throws.
 */
async function requireAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_super_admin) {
    return { supabase, adminId: user.id };
  }

  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1);

  if (!eventAdmins?.length) {
    throw new Error("Not authorized");
  }

  return { supabase, adminId: user.id };
}

/**
 * Admin updates a golfer's RSVP status (works post-cutoff).
 */
export async function adminUpdateRsvpStatus(
  rsvpId: string,
  newStatus: "in" | "out" | "not_sure" | "no_response" | "waitlisted",
  scheduleId: string
) {
  try {
    const { supabase, adminId } = await requireAdminAccess();

    // Get the current RSVP
    const { data: rsvp, error: fetchError } = await supabase
      .from("rsvps")
      .select("id, status, profile_id, schedule_id, waitlist_position")
      .eq("id", rsvpId)
      .single();

    if (fetchError || !rsvp) {
      return { error: "RSVP not found" };
    }

    if (rsvp.status === newStatus) {
      return { success: true }; // No change needed
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      responded_at: new Date().toISOString(),
    };

    // Handle waitlist position
    if (newStatus === "waitlisted") {
      // Get next waitlist position
      const { data: lastWaitlisted } = await supabase
        .from("rsvps")
        .select("waitlist_position")
        .eq("schedule_id", rsvp.schedule_id)
        .eq("status", "waitlisted")
        .order("waitlist_position", { ascending: false })
        .limit(1)
        .single();

      updateData.waitlist_position =
        (lastWaitlisted?.waitlist_position || 0) + 1;
    } else {
      // Clear waitlist position when leaving waitlist
      if (rsvp.status === "waitlisted") {
        updateData.waitlist_position = null;
      }
    }

    // Update the RSVP
    const { error: updateError } = await supabase
      .from("rsvps")
      .update(updateData)
      .eq("id", rsvpId);

    if (updateError) {
      console.error("RSVP update error:", updateError);
      return { error: "Failed to update RSVP" };
    }

    // Log to history with admin as changed_by
    await supabase.from("rsvp_history").insert({
      rsvp_id: rsvp.id,
      schedule_id: rsvp.schedule_id,
      profile_id: rsvp.profile_id,
      old_status: rsvp.status,
      new_status: newStatus,
      changed_by: adminId,
    });

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}

/**
 * Admin promotes a golfer from the waitlist to "in".
 * Also reorders remaining waitlist positions.
 */
export async function adminPromoteFromWaitlist(
  rsvpId: string,
  scheduleId: string
) {
  try {
    const { supabase, adminId } = await requireAdminAccess();

    // Get the waitlisted RSVP
    const { data: rsvp, error: fetchError } = await supabase
      .from("rsvps")
      .select("id, status, profile_id, schedule_id, waitlist_position")
      .eq("id", rsvpId)
      .eq("status", "waitlisted")
      .single();

    if (fetchError || !rsvp) {
      return { error: "Waitlisted RSVP not found" };
    }

    // Promote to "in"
    const { error: updateError } = await supabase
      .from("rsvps")
      .update({
        status: "in",
        waitlist_position: null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", rsvpId);

    if (updateError) {
      console.error("Promote error:", updateError);
      return { error: "Failed to promote from waitlist" };
    }

    // Log to history
    await supabase.from("rsvp_history").insert({
      rsvp_id: rsvp.id,
      schedule_id: rsvp.schedule_id,
      profile_id: rsvp.profile_id,
      old_status: "waitlisted",
      new_status: "in",
      changed_by: adminId,
    });

    // Reorder remaining waitlist positions
    const { data: remainingWaitlisted } = await supabase
      .from("rsvps")
      .select("id, waitlist_position")
      .eq("schedule_id", rsvp.schedule_id)
      .eq("status", "waitlisted")
      .order("waitlist_position", { ascending: true });

    if (remainingWaitlisted) {
      for (let i = 0; i < remainingWaitlisted.length; i++) {
        if (remainingWaitlisted[i].waitlist_position !== i + 1) {
          await supabase
            .from("rsvps")
            .update({ waitlist_position: i + 1 })
            .eq("id", remainingWaitlisted[i].id);
        }
      }
    }

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}

/**
 * Admin moves a golfer who is "in" back to "out" (frees a spot).
 */
export async function adminRemoveFromGame(
  rsvpId: string,
  scheduleId: string
) {
  return adminUpdateRsvpStatus(rsvpId, "out", scheduleId);
}
