"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/admin");
  return { success: true };
}
