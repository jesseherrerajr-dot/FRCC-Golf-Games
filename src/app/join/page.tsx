"use client";

import { useActionState, useState } from "react";
import { joinGroup, verifyJoinOtp, type JoinFormState } from "./actions";
import Link from "next/link";
import Image from "next/image";

const initialState: JoinFormState = { step: "form" };

/** Format phone as (XXX) XXX-XXXX as the user types.
 *  Strips leading US country code (+1 or 1) from Chrome autofill. */
function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Strip leading "1" country code if we got 11 digits (e.g., +1 from autofill)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function JoinPage() {
  const [joinState, joinAction, isJoinPending] = useActionState(joinGroup, initialState);
  const [otpState, otpAction, isOtpPending] = useActionState(verifyJoinOtp, initialState);
  const [phone, setPhone] = useState("");

  const showOtp = joinState.step === "otp";
  const currentError = showOtp ? otpState.error : joinState.error;
  const email = joinState.email || "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.png"
              alt="Fairbanks Ranch Country Club"
              width={64}
              height={64}
              className="mx-auto mb-4 h-16 w-16 object-contain"
            />
            <h1 className="font-serif text-3xl font-bold uppercase tracking-wide text-navy-900">
              FRCC Golf Games
            </h1>
          </Link>
          <h2 className="mt-2 text-xl text-gray-600">Join the Group</h2>
          <p className="mt-1 text-sm text-gray-500">
            {showOtp
              ? "Enter the code we sent to your email."
              : "Sign up to get weekly invites and track your rounds."}
          </p>
        </div>

        {/* Error message */}
        {currentError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {currentError}
          </div>
        )}

        {!showOtp ? (
          /* Step 1: Registration form */
          <form action={joinAction} className="space-y-5">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                autoComplete="given-name"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                placeholder="Jesse"
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                autoComplete="family-name"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                placeholder="Herrera"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                placeholder="you@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
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
              <label htmlFor="ghin" className="block text-sm font-medium text-gray-700">
                GHIN Number
              </label>
              <input
                id="ghin"
                name="ghin"
                type="text"
                required
                inputMode="numeric"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                placeholder="1234567"
              />
              <p className="mt-1 text-xs text-gray-400">
                Your USGA Golf Handicap ID
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isJoinPending}
              className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isJoinPending ? "Sending Code..." : "Join & Verify Email"}
            </button>
          </form>
        ) : (
          /* Step 2: OTP code input */
          <div>
            <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              We sent a verification code to <strong>{email}</strong>. Check your inbox (and spam folder).
            </div>

            <form action={otpAction} className="space-y-5">
              <input type="hidden" name="email" value={email} />

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-gray-700"
                >
                  Verification Code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-2xl tracking-[0.3em] text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={isOtpPending}
                className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOtpPending ? "Verifying..." : "Verify & Complete Registration"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              Didn&apos;t get the code?{" "}
              <button
                onClick={() => window.location.reload()}
                className="font-medium text-teal-700 hover:text-teal-600"
              >
                Try again
              </button>
            </p>
          </div>
        )}

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Already a member?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
