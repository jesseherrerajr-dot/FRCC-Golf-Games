import Link from "next/link";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const isLogin = type === "login";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
          <svg
            className="h-8 w-8 text-teal-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">Check Your Email</h1>
        <p className="mt-3 text-gray-600">
          {isLogin
            ? "We sent a magic link to your email address. Click the link to sign in."
            : "We sent a magic link to your email address. Click the link to finish joining FRCC Golf Games."}
        </p>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-600">
          <p className="font-medium text-gray-700">Tip for mobile users:</p>
          <p className="mt-1">
            When you get the email, open the magic link in the same browser
            you&apos;re using now (Safari, Chrome, etc.). If your email app opens
            it in a built-in browser, long-press the link and choose
            &quot;Open in Safari&quot; or &quot;Open in Chrome&quot; instead.
          </p>
        </div>

        <p className="mt-3 text-sm text-gray-400">
          Didn&apos;t get it? Check your spam folder or{" "}
          <Link
            href={isLogin ? "/login" : "/join"}
            className="font-medium text-teal-700 hover:text-teal-600"
          >
            try again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
