import Link from "next/link";

export default function LinkErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold uppercase tracking-wide text-navy-900">
          Magic Link Issue
        </h1>
        <p className="mt-3 text-gray-600">
          It looks like the magic link opened in a different browser than the one
          you used to request it. This usually happens when your email app opens
          links in its own built-in browser.
        </p>
        <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-4 text-left">
          <p className="font-semibold text-teal-900">To fix this:</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-teal-800">
            <li>
              Go back to the magic link email
            </li>
            <li>
              <strong>Long-press</strong> (tap and hold) the sign-in link
            </li>
            <li>
              Choose <strong>&quot;Open in Safari&quot;</strong> or{" "}
              <strong>&quot;Open in Chrome&quot;</strong>
            </li>
          </ol>
          <p className="mt-3 text-sm text-teal-700">
            Or copy the link from the email and paste it into your browser&apos;s
            address bar.
          </p>
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-block rounded-lg bg-teal-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500"
          >
            Request a New Magic Link
          </Link>
        </div>
      </div>
    </main>
  );
}
