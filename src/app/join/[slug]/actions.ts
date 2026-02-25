"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type JoinEventFormState = {
  error?: string;
  success?: boolean;
  step?: "form" | "otp";
  email?: string;
};

/** Strip phone to digits only and validate it's 10 digits */
function validatePhone(raw: string): { valid: boolean; digits: string } {
  const digits = raw.replace(/\D/g, "");
  return { valid: digits.length === 10, digits };
}

/**
 * Register a golfer for a specific event via /join/[slug].
 * Sets registration_event_id so approval subscribes to that event only.
 */
export async function joinEvent(
  _prevState: JoinEventFormState,
  formData: FormData
): Promise<JoinEventFormState> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phoneRaw = formData.get("phone") as string;
  const ghin = formData.get("ghin") as string;
  const eventId = formData.get("eventId") as string;

  // Validate required fields
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
    return { error: "First name, last name, and email are required.", step: "form" };
  }

  if (!eventId) {
    return { error: "Event not found.", step: "form" };
  }

  // Validate phone if provided
  const phone = phoneRaw?.trim()
    ? validatePhone(phoneRaw)
    : { valid: true, digits: "" };
  if (!phone.valid) {
    return { error: "Please enter a valid 10-digit US phone number.", step: "form" };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address.", step: "form" };
  }

  const supabase = await createClient();

  // Sign up with magic link — includes event_id in metadata
  const { error: authError } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.digits || null,
        ghin_number: ghin?.trim() || null,
        role: "golfer",
        registration_event_id: eventId,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (authError) {
    console.error("Auth error:", authError);
    return { error: "Something went wrong. Please try again.", step: "form" };
  }

  // For existing users, update their registration_event_id
  // (New users get it set via the handle_new_user trigger from metadata)
  // We also set it directly in case the user already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (existingProfile) {
    await supabase
      .from("profiles")
      .update({ registration_event_id: eventId })
      .eq("id", existingProfile.id);
  }

  return { success: true, step: "otp", email: email.trim().toLowerCase() };
}

export async function verifyEventJoinOtp(
  _prevState: JoinEventFormState,
  formData: FormData
): Promise<JoinEventFormState> {
  const email = formData.get("email") as string;
  const token = formData.get("otp") as string;

  if (!token?.trim()) {
    return { error: "Please enter the code from your email.", step: "otp", email };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: token.trim(),
    type: "email",
  });

  if (error) {
    console.error("OTP verification error:", error);
    return {
      error: "Invalid or expired code. Please try again or request a new one.",
      step: "otp",
      email,
    };
  }

  redirect("/dashboard");
}
