"use client";

import { useActionState, useState } from "react";
import { login, verifyLoginOtp, type LoginFormState } from "./actions";
import Link from "next/link";
import Image from "next/image";

const initialState: LoginFormState = { step: "email" };

export default function LoginPage() {
  const [loginState, loginAction, isLoginPending] = useActionState(login, initialState);
  const [otpState, otpAction, isOtpPending] = useActionState(verifyLoginOtp, initialState);

  // Track which step we're on
  const showOtp = loginState.step === "otp";
  const currentError = showOtp ? otpState.error : loginState.error;
  const email = loginState.email || "";

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
          <h2 className="mt-2 text-xl text-gray-600">Sign In</h2>
          <p className="mt-1 text-sm text-gray-500">
            {showOtp
              ? "Enter the code we sent to your email."
              : "Enter your email and we'll send you a sign-in code."}
          </p>
        </div>

        {/* Error message */}
        {currentError && (
          <div className="mb-5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {currentError}
          </div>
        )}

        {!showOtp ? (
          /* Step 1: Email input */
          <form action={loginAction} className="space-y-5">
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
                autoFocus
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoginPending}
              className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoginPending ? "Sending Code..." : "Send Sign-In Code"}
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
                {isOtpPending ? "Verifying..." : "Verify & Sign In"}
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

        {/* Footer links */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Not a member yet?{" "}
          <Link href="/join" className="font-medium text-teal-700 hover:text-teal-600">
            Join the Group
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/help" className="text-gray-400 hover:text-gray-600">
            Need help?
          </Link>
        </p>
      </div>
    </main>
  );
}
