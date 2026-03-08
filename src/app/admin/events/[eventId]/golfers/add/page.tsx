import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { redirect } from "next/navigation";
import { AddEventGolferForm } from "./add-golfer-form";

export default async function AddEventGolferPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, profile, adminEvents } = await requireAdmin();

  // Verify access to this event
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    redirect("/admin");
  }

  // Fetch event details
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name, href: `/admin/events/${eventId}` },
              {
                label: "Golfers",
                href: `/admin/events/${eventId}/golfers`,
              },
              { label: "Add Golfer" },
            ]}
          />

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="font-serif text-xl font-bold uppercase tracking-wide text-navy-900">
              Add New Golfer
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Add a golfer to <strong>{event.name}</strong> &mdash; they&apos;ll be set to
              active and start receiving weekly invites for this event
              immediately. No approval step needed.
            </p>

            <div className="mt-6">
              <AddEventGolferForm eventId={eventId} eventName={event.name} />
            </div>
          </div>
        </div>
          </main>
  );
}
