"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendAdminAlert } from "@/lib/admin-alerts";
import {
  subscribeToEvent,
  subscribeToAllActiveEvents,
} from "@/lib/subscriptions";

export async function approveRegistration(profileId: string) {
  const supabase = await createClient();

  // Verify the current user is an admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const isAdmin =
    adminProfile?.is_super_admin ||
    (
      await supabase
        .from("event_admins")
        .select("id")
        .eq("profile_id", user.id)
        .limit(1)
    ).data?.length;

  if (!isAdmin) return { error: "Not authorized" };

  // Fetch the profile to check for event-specific registration
  const { data: pendingProfile } = await supabase
    .from("profiles")
    .select("registration_event_id")
    .eq("id", profileId)
    .eq("status", "pending_approval")
    .single();

  if (!pendingProfile) {
    return { error: "Profile not found or already approved." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId)
    .eq("status", "pending_approval");

  if (error) {
    console.error("Approve error:", error);
    return { error: "Failed to approve registration." };
  }

  // Subscribe based on how the golfer registered:
  // - Event-specific join link → subscribe to that event only
  // - Generic /join or import → subscribe to all active events
  if (pendingProfile.registration_event_id) {
    const result = await subscribeToEvent(
      supabase,
      profileId,
      pendingProfile.registration_event_id
    );
    if (!result.success) {
      console.error("Event-specific subscribe error:", result.error);
    }
  } else {
    const result = await subscribeToAllActiveEvents(supabase, profileId);
    if (!result.success) {
      console.error("Auto-subscribe error:", result.error);
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function denyRegistration(profileId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const isAdmin =
    adminProfile?.is_super_admin ||
    (
      await supabase
        .from("event_admins")
        .select("id")
        .eq("profile_id", user.id)
        .limit(1)
    ).data?.length;

  if (!isAdmin) return { error: "Not authorized" };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "deactivated" })
    .eq("id", profileId)
    .eq("status", "pending_approval");

  if (error) {
    console.error("Deny error:", error);
    return { error: "Failed to deny registration." };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function deactivateMember(profileId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.is_super_admin) {
    const { data: eventAdmins } = await supabase
      .from("event_admins")
      .select("id")
      .eq("profile_id", user.id)
      .limit(1);
    if (!eventAdmins?.length) return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "deactivated" })
    .eq("id", profileId)
    .eq("status", "active");

  if (error) {
    console.error("Deactivate error:", error);
    return { error: "Failed to deactivate member." };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function reactivateMember(profileId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.is_super_admin) {
    const { data: eventAdmins } = await supabase
      .from("event_admins")
      .select("id")
      .eq("profile_id", user.id)
      .limit(1);
    if (!eventAdmins?.length) return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId)
    .eq("status", "deactivated");

  if (error) {
    console.error("Reactivate error:", error);
    return { error: "Failed to reactivate member." };
  }

  // Re-subscribe to all active events
  const subResult = await subscribeToAllActiveEvents(supabase, profileId);
  if (!subResult.success) {
    console.error("Reactivation subscribe error:", subResult.error);
  }

  revalidatePath("/admin");
  return { success: true };
}
