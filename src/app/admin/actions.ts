"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendAdminAlert } from "@/lib/admin-alerts";

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

  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId)
    .eq("status", "pending_approval");

  if (error) {
    console.error("Approve error:", error);
    return { error: "Failed to approve registration." };
  }

  // Auto-subscribe the newly approved golfer to all active events
  const { data: activeEvents } = await supabase
    .from("events")
    .select("id")
    .eq("is_active", true);

  if (activeEvents && activeEvents.length > 0) {
    const subscriptions = activeEvents.map((event) => ({
      event_id: event.id,
      profile_id: profileId,
      is_active: true,
    }));

    const { error: subError } = await supabase
      .from("event_subscriptions")
      .upsert(subscriptions, {
        onConflict: "event_id,profile_id",
        ignoreDuplicates: true,
      });

    if (subError) {
      console.error("Auto-subscribe error:", subError);
      // Don't fail the approval — the golfer is active, just not subscribed
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
  const { data: activeEvents } = await supabase
    .from("events")
    .select("id")
    .eq("is_active", true);

  if (activeEvents && activeEvents.length > 0) {
    // Reactivate existing subscriptions
    for (const event of activeEvents) {
      await supabase
        .from("event_subscriptions")
        .upsert(
          {
            event_id: event.id,
            profile_id: profileId,
            is_active: true,
          },
          { onConflict: "event_id,profile_id" }
        );
    }
  }

  revalidatePath("/admin");
  return { success: true };
}
