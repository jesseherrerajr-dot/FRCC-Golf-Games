"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfileFormState = {
  error?: string;
  success?: boolean;
};

/** Strip phone to digits only and validate it's 10 digits */
function validatePhone(raw: string): { valid: boolean; digits: string } {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return { valid: digits.length === 10, digits };
}

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phoneRaw = formData.get("phone") as string;
  const ghin = formData.get("ghin") as string;

  // Validate required fields
  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !email?.trim() ||
    !phoneRaw?.trim() ||
    !ghin?.trim()
  ) {
    return { error: "All fields are required." };
  }

  // Validate phone
  const phone = validatePhone(phoneRaw);
  if (!phone.valid) {
    return { error: "Please enter a valid 10-digit US phone number." };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Check if email is changing
  const newEmail = email.trim().toLowerCase();
  const emailChanged = newEmail !== user.email;

  // Update the profile in the profiles table
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: newEmail,
      phone: phone.digits,
      ghin_number: ghin.trim(),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("Profile update error:", profileError);
    if (profileError.code === "23505") {
      return { error: "That email address is already in use by another member." };
    }
    return { error: "Failed to update profile. Please try again." };
  }

  // If email changed, update it in Supabase Auth as well
  if (emailChanged) {
    const { error: authError } = await supabase.auth.updateUser({
      email: newEmail,
    });
    if (authError) {
      console.error("Auth email update error:", authError);
      // Revert the profile email change
      await supabase
        .from("profiles")
        .update({ email: user.email })
        .eq("id", user.id);
      return {
        error:
          "Failed to update email. A confirmation may be required. Please try again.",
      };
    }
  }

  // Also update the auth user metadata
  await supabase.auth.updateUser({
    data: {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.digits,
      ghin_number: ghin.trim(),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}
