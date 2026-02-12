"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type JoinFormState = {
  error?: string;
  success?: boolean;
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
    !email?.trim() ||
    !phoneRaw?.trim() ||
    !ghin?.trim()
  ) {
    return { error: "All fields are required." };
  }

  // Validate phone is exactly 10 US digits
  const phone = validatePhone(phoneRaw);
  if (!phone.valid) {
    return { error: "Please enter a valid 10-digit US phone number." };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();

  // Sign up with magic link — Supabase sends the confirmation email
  const { error: authError } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.digits,
        ghin_number: ghin.trim(),
        role: "golfer",
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (authError) {
    console.error("Auth error:", authError);
    return { error: "Something went wrong. Please try again." };
  }

  // Redirect to confirmation page
  redirect("/auth/confirm");
}
