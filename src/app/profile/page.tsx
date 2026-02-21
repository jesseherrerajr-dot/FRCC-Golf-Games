"use client";

import { useActionState, useState, useEffect } from "react";
import { updateProfile, type ProfileFormState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

const initialState: ProfileFormState = {};

/** Format phone as (XXX) XXX-XXXX.
 *  Strips leading US country code (+1 or 1) from Chrome autofill. */
function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type Profile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ghin_number: string;
  status: string;
};

export default function ProfilePage() {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setPhone(formatPhone(data.phone || ""));
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">
          Profile not found.{" "}
          <Link href="/login" className="text-teal-700 hover:text-teal-600">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Profile Settings
            </h1>
          <p className="mt-1 text-sm text-gray-500">
            Update your personal information.
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          {/* Success message */}
          {state.success && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
              Profile updated successfully.
            </div>
          )}

          {/* Error message */}
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* First Name */}
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              defaultValue={profile.first_name}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              defaultValue={profile.last_name}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={profile.email}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1 text-xs text-gray-400">
              Changing your email will require re-verification.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              placeholder="(555) 123-4567"
            />
            <p className="mt-1 text-xs text-gray-400">US 10-digit format</p>
          </div>

          {/* GHIN Number */}
          <div>
            <label
              htmlFor="ghin"
              className="block text-sm font-medium text-gray-700"
            >
              GHIN Number
            </label>
            <input
              id="ghin"
              name="ghin"
              type="text"
              required
              inputMode="numeric"
              defaultValue={profile.ghin_number}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              placeholder="1234567"
            />
            <p className="mt-1 text-xs text-gray-400">
              Your USGA Golf Handicap ID
            </p>
          </div>

          {/* Account status (read-only) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-500">
              Account Status:{" "}
              <span className="font-medium capitalize text-gray-900">
                {profile.status?.replace(/_/g, " ")}
              </span>
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
        </div>
      </main>
  );
}
