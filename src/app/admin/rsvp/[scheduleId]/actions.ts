"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Verify the current user is a super admin or event admin.
 * Returns an admin supabase client (bypasses RLS), the admin user id,
 * and event admin assignments for event-scoped access checks.
 * Auth verification uses the session-based client; data operations use the admin client
 * so event admins have full access to RSVPs they manage.
 */
async function requireAdminAccess() {
  const sessionSupabase = await createClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await sessionSupabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  // Use admin client for data operations (bypasses RLS)
  const supabase = createAdminClient();

  const { data: eventAdmins } = await sessionSupabase
    .from("event_admins")
    .select("event_id")
    .eq("profile_id", user.id);

  if (!profile.is_super_admin && (!eventAdmins || eventAdmins.length === 0)) {
    throw new Error("Not authorized");
  }

  const isSuperAdmin = profile.is_super_admin;
  const adminEventIds = (eventAdmins || []).map((e: { event_id: string }) => e.event_id);

  return { supabase, adminId: user.id, isSuperAdmin, adminEventIds };
}

/**
 * Verify the admin has access to the event that a schedule belongs to.
 * Super admins always have access. Event admins only have access to their assigned events.
 */
function verifyEventAccess(isSuperAdmin: boolean, adminEventIds: string[], eventId: string) {
  if (isSuperAdmin) return;
  if (!adminEventIds.includes(eventId)) {
    throw new Error("Not authorized for this event");
  }
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
    const { supabase, adminId, isSuperAdmin, adminEventIds } = await requireAdminAccess();

    // Get the current RSVP with schedule info for event access check
    const { data: rsvp, error: fetchError } = await supabase
      .from("rsvps")
      .select("id, status, profile_id, schedule_id, waitlist_position, schedule:event_schedules(event_id)")
      .eq("id", rsvpId)
      .single();

    if (fetchError || !rsvp) {
      return { error: "RSVP not found" };
    }

    // Verify event access
    const eventId = (rsvp.schedule as unknown as { event_id: string })?.event_id;
    if (eventId) verifyEventAccess(isSuperAdmin, adminEventIds, eventId);

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
    const { supabase, adminId, isSuperAdmin, adminEventIds } = await requireAdminAccess();

    // Get the waitlisted RSVP with schedule info for event access check
    const { data: rsvp, error: fetchError } = await supabase
      .from("rsvps")
      .select("id, status, profile_id, schedule_id, waitlist_position, schedule:event_schedules(event_id)")
      .eq("id", rsvpId)
      .eq("status", "waitlisted")
      .single();

    if (fetchError || !rsvp) {
      return { error: "Waitlisted RSVP not found" };
    }

    // Verify event access
    const eventId = (rsvp.schedule as unknown as { event_id: string })?.event_id;
    if (eventId) verifyEventAccess(isSuperAdmin, adminEventIds, eventId);

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

/**
 * Fetch active, subscribed golfers who don't already have an RSVP row
 * for this schedule. Used by the "Add Golfer to Game" feature.
 */
export async function getEligibleGolfersForGame(
  scheduleId: string,
  eventId: string
) {
  try {
    const { supabase, isSuperAdmin, adminEventIds } = await requireAdminAccess();

    // Verify event access
    verifyEventAccess(isSuperAdmin, adminEventIds, eventId);

    // Get all active, subscribed golfers for this event
    const { data: subscribers } = await supabase
      .from("event_subscriptions")
      .select("profile_id, profiles(id, first_name, last_name, email, status, is_guest)")
      .eq("event_id", eventId)
      .eq("is_active", true);

    if (!subscribers) return { golfers: [] };

    const activeSubscribers = subscribers.filter(
      (s: Record<string, unknown>) => {
        const profile = s.profiles as { status: string; is_guest: boolean } | null;
        return profile && profile.status === "active" && !profile.is_guest;
      }
    );

    // Get existing RSVPs for this schedule
    const { data: existingRsvps } = await supabase
      .from("rsvps")
      .select("profile_id")
      .eq("schedule_id", scheduleId);

    const existingIds = new Set(
      (existingRsvps || []).map((r: { profile_id: string }) => r.profile_id)
    );

    // Return golfers who don't have an RSVP row yet
    const eligible = activeSubscribers
      .filter((s: { profile_id: string }) => !existingIds.has(s.profile_id))
      .map((s: Record<string, unknown>) => {
        const profile = s.profiles as {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
        };
        return {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        };
      })
      .sort((a: { last_name: string }, b: { last_name: string }) =>
        a.last_name.localeCompare(b.last_name)
      );

    return { golfers: eligible };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { golfers: [], error: message };
  }
}

/**
 * Admin adds a golfer to a game by creating an RSVP row with status "in".
 * Used for golfers who registered/were approved after the invite was sent.
 */
export async function adminAddGolferToGame(
  profileId: string,
  scheduleId: string,
  status: "in" | "no_response" = "in"
) {
  try {
    const { supabase, adminId, isSuperAdmin, adminEventIds } = await requireAdminAccess();

    // Verify the schedule exists
    const { data: schedule, error: schedError } = await supabase
      .from("event_schedules")
      .select("id, event_id")
      .eq("id", scheduleId)
      .single();

    if (schedError || !schedule) {
      return { error: "Schedule not found" };
    }

    // Verify event access
    verifyEventAccess(isSuperAdmin, adminEventIds, schedule.event_id);

    // Verify golfer is subscribed and active
    const { data: sub } = await supabase
      .from("event_subscriptions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("event_id", schedule.event_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!sub) {
      return { error: "Golfer is not subscribed to this event" };
    }

    // Check if RSVP already exists
    const { data: existing } = await supabase
      .from("rsvps")
      .select("id")
      .eq("profile_id", profileId)
      .eq("schedule_id", scheduleId)
      .maybeSingle();

    if (existing) {
      return { error: "Golfer already has an RSVP for this game" };
    }

    // Create the RSVP row
    const { error: insertError } = await supabase
      .from("rsvps")
      .insert({
        schedule_id: scheduleId,
        profile_id: profileId,
        status,
        responded_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Add golfer to game error:", insertError);
      return { error: "Failed to add golfer to game" };
    }

    // Log to history
    await supabase.from("rsvp_history").insert({
      rsvp_id: null, // We don't have the new RSVP ID easily
      schedule_id: scheduleId,
      profile_id: profileId,
      old_status: null,
      new_status: status,
      changed_by: adminId,
    });

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
