"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type LoginFormState = {
  error?: string;
  success?: boolean;
  step?: "email" | "otp";
  email?: string;
};

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get("email") as string;

  if (!email?.trim()) {
    return { error: "Please enter your email address.", step: "email" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address.", step: "email" };
  }

  const supabase = await createClient();

  const { error: authError } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (authError) {
    console.error("Login error:", authError);
    return { error: "If that email is registered, you'll receive a sign-in code shortly.", step: "email" };
  }

  return { success: true, step: "otp", email: email.trim().toLowerCase() };
}

export async function verifyLoginOtp(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
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

  redirect("/dashboard");
}
