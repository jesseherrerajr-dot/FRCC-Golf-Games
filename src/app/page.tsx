import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <Image
          src="/logo.png"
          alt="Fairbanks Ranch Country Club"
          width={80}
          height={80}
          className="mx-auto mb-6 h-20 w-20 object-contain"
        />
        <h1 className="font-serif text-4xl font-bold uppercase tracking-wide text-navy-900 sm:text-5xl">
          FRCC Golf Games
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Fairbanks Ranch Country Club event management
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/join"
            className="rounded-lg bg-teal-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            Join the Group
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-navy-800 px-6 py-3 text-lg font-semibold text-navy-800 shadow-sm transition-colors hover:bg-navy-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-800"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
