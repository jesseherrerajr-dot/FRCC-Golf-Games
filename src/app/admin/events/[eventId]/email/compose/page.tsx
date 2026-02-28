import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmailComposerForm } from "./email-composer-form";

export default async function EmailComposerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, profile, adminEvents } = await requireAdmin();

  if (!hasEventAccess(profile, adminEvents, eventId)) {
    redirect("/admin");
  }

  // Get event info
  const { data: event } = await supabase
    .from("events")
    .select("id, name, day_of_week")
    .eq("id", eventId)
    .single();

  if (!event) redirect("/admin");

  // Get upcoming schedules (next 8 weeks)
  const today = new Date().toISOString().split("T")[0];
  const { data: schedules } = await supabase
    .from("event_schedules")
    .select("id, game_date, status")
    .eq("event_id", eventId)
    .gte("game_date", today)
    .eq("status", "scheduled")
    .order("game_date", { ascending: true })
    .limit(8);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div>
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name, href: `/admin/events/${eventId}/settings` },
              { label: "Send Email" },
            ]}
          />
          <h1 className="text-2xl font-bold text-navy-900">
            Send Email
          </h1>
        </div>

        <div className="mt-6">
          <EmailComposerForm
            eventId={eventId}
            eventName={event.name}
            schedules={
              (schedules || []).map((s) => ({
                id: s.id,
                gameDate: s.game_date,
              }))
            }
          />
        </div>
      </div>
    </main>
  );
}
