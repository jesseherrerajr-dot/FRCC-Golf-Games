"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/schedule";
import { revalidatePath } from "next/cache";
import { subscribeToEvent, subscribeToAllActiveEvents } from "@/lib/subscriptions";

export type AddGolferFormState = {
  error?: string;
  success?: boolean;
  memberName?: string;
};

/** Strip phone to digits only and validate it's 10 digits */
function validatePhone(raw: string): { valid: boolean; digits: string } {
  const digits = raw.replace(/\D/g, "");
  return { valid: digits.length === 10, digits };
}

/**
 * Admin adds a new golfer directly — no OTP needed.
 * Creates the auth user with service role, sets status to "active",
 * and subscribes to the selected event (or all events).
 */
export async function addGolfer(
  _prevState: AddGolferFormState,
  formData: FormData
): Promise<AddGolferFormState> {
  // First verify the caller is an admin using their session
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
    !!(
      await supabase
        .from("event_admins")
        .select("id")
        .eq("profile_id", user.id)
        .limit(1)
    ).data?.length;

  if (!isAdmin) return { error: "Not authorized" };

  // Parse form data
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phoneRaw = (formData.get("phone") as string) || "";
  const ghin = (formData.get("ghin") as string)?.trim() || null;
  const eventId = (formData.get("eventId") as string) || "";

  // Validate required fields
  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  // Validate phone if provided
  if (phoneRaw.trim()) {
    const phone = validatePhone(phoneRaw);
    if (!phone.valid) {
      return { error: "Please enter a valid 10-digit US phone number." };
    }
  }

  const phoneDigits = phoneRaw.trim()
    ? phoneRaw.replace(/\D/g, "")
    : null;

  // Check if this email already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return {
      error: `A golfer with email ${email} already exists (status: ${existingProfile.status}). Use the member directory to manage them.`,
    };
  }

  // Use admin client (service role) to create the auth user directly
  const adminSupabase = createAdminClient();

  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phoneDigits,
        ghin_number: ghin,
        role: "golfer",
      },
    });

  if (authError) {
    console.error("Admin create user error:", authError);
    if (authError.message?.includes("already been registered")) {
      return {
        error: `Email ${email} is already registered in auth. The profile may not exist yet — try refreshing.`,
      };
    }
    return { error: "Failed to create user. Please try again." };
  }

  const newUserId = authData.user.id;

  // Wait a moment for the handle_new_user trigger to fire
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Set status to active (the trigger creates as pending_approval)
  await adminSupabase
    .from("profiles")
    .update({
      status: "active",
      phone: phoneDigits,
      ghin_number: ghin,
    })
    .eq("id", newUserId);

  // Subscribe to event(s)
  if (eventId && eventId !== "all") {
    await subscribeToEvent(adminSupabase, newUserId, eventId);
  } else {
    await subscribeToAllActiveEvents(adminSupabase, newUserId);
  }

  revalidatePath("/admin/members");
  return { success: true, memberName: `${firstName} ${lastName}` };
}
