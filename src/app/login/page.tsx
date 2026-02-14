"use client";

import { useActionState } from "react";
import { login, type LoginFormState } from "./actions";
import Link from "next/link";
import Image from "next/image";

const initialState: LoginFormState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState);

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
            Enter your email and we&apos;ll send you a magic link.
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          {/* Error / info message */}
          {state.error && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {state.error}
            </div>
          )}

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
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              placeholder="you@example.com"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Sending Magic Link..." : "Send Magic Link"}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Not a member yet?{" "}
          <Link href="/join" className="font-medium text-teal-700 hover:text-teal-600">
            Join the Group
          </Link>
        </p>
      </div>
    </main>
  );
}
