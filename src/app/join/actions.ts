"use server";

import { createClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/admin-alerts";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/format";

export type JoinFormState = {
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

export async function joinGroup(
  _prevState: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phoneRaw = formData.get("phone") as string;
  const ghin = formData.get("ghin") as string;

  // Validate required fields
  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !email?.trim()
  ) {
    return { error: "First name, last name, and email are required.", step: "form" };
  }

  // Validate phone if provided (optional, but must be valid format if entered)
  const phone = phoneRaw?.trim() ? validatePhone(phoneRaw) : { valid: true, digits: "" };
  if (!phone.valid) {
    return { error: "Please enter a valid 10-digit US phone number.", step: "form" };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address.", step: "form" };
  }

  const supabase = await createClient();

  // Sign up with magic link — Supabase sends the confirmation email
  const { error: authError } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.digits || null,
        ghin_number: ghin?.trim() || null,
        role: "golfer",
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (authError) {
    console.error("Auth error:", authError);
    return { error: "Something went wrong. Please try again.", step: "form" };
  }

  return { success: true, step: "otp", email: email.trim().toLowerCase() };
}

export async function verifyJoinOtp(
  _prevState: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
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
    return { error: "Invalid or expired code. Please try again or request a new one.", step: "otp", email };
  }

  // Send admin alert for new registration pending approval
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, status")
        .eq("id", user.id)
        .single();

      if (profile?.status === "pending_approval") {
        // Generic registration — notify all active events
        const { data: events } = await supabase
          .from("events")
          .select("id, name")
          .eq("is_active", true);

        for (const event of events || []) {
          sendAdminAlert("new_registration", {
            eventId: event.id,
            eventName: event.name,
            golferName: `${profile.first_name} ${profile.last_name}`,
            golferEmail: profile.email,
          }).catch((err) =>
            console.error("New registration alert error:", err)
          );
        }
      }
    }
  } catch (alertErr) {
    // Don't block the redirect for alert failures
    console.error("Alert check error:", alertErr);
  }

  redirect("/home");
}
