import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CreateEventForm } from "./create-event-form";

export default async function CreateEventPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  // Fetch active golfers for admin assignment
  const { data: activeGolfers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name");

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin"
          className="text-sm text-green-700 hover:text-green-600"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-green-800">
          Create New Event
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new recurring game with its schedule and email configuration.
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <CreateEventForm activeGolfers={activeGolfers || []} />
        </div>
      </div>
    </main>
  );
}
