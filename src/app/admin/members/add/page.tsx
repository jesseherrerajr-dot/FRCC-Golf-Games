import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import Header from "@/components/header";
import { AddGolferForm } from "./add-golfer-form";

export default async function AddGolferPage() {
  const { supabase } = await requireAdmin();

  // Fetch active events for the subscription dropdown
  const { data: events } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Link
            href="/admin/members"
            className="text-sm text-teal-700 hover:text-teal-600"
          >
            ← Back to Members
          </Link>

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="font-serif text-xl font-bold uppercase tracking-wide text-navy-900">
              Add New Golfer
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Add a golfer directly — they&apos;ll be set to active and start
              receiving invites immediately. No approval step needed.
            </p>

            <div className="mt-6">
              <AddGolferForm events={events || []} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
