import Link from "next/link";
import { InstallContent } from "./install-content";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default function InstallPage() {
  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/home" },
                { label: "Get the App" },
              ]}
            />
            <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Get the App
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Add FRCC Golf Games to your home screen for quick, one-tap access
              — just like a regular app.
            </p>
          </div>

          <InstallContent />

          {/* Help link */}
          <div className="mt-6 text-center">
            <Link
              href="/help"
              className="text-sm text-teal-700 hover:text-teal-600"
            >
              Need help? Visit our FAQ &rarr;
            </Link>
          </div>
        </div>
          </main>
  );
}
