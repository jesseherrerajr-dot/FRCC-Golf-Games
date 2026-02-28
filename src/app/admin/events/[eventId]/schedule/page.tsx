import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { generateSchedulesForEvent } from "@/lib/schedule-gen";
import { getTodayPacific } from "@/lib/timezone";
import type { Event } from "@/types/events";
import { ScheduleRow } from "./schedule-row";

export default async function ScheduleManagementPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, profile, adminEvents } = await requireAdmin();

  if (!hasEventAccess(profile, adminEvents, eventId)) {
    redirect("/admin");
  }

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) redirect("/admin");

  // Auto-generate missing schedules on page load
  try {
    await generateSchedulesForEvent(
      supabase,
      event as unknown as Event
    );
  } catch (e) {
    console.error("Failed to auto-generate schedules:", e);
  }

  // Fetch schedules for next 8 weeks
  const today = getTodayPacific();
  const { data: schedules } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", eventId)
    .gte("game_date", today)
    .order("game_date", { ascending: true })
    .limit(8);

  // Get RSVP counts for each schedule
  const schedulesWithCounts = await Promise.all(
    (schedules || []).map(async (schedule) => {
      const { count: inCount } = await supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", schedule.id)
        .eq("status", "in");

      const { count: waitlistCount } = await supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", schedule.id)
        .eq("status", "waitlisted");

      return {
        ...schedule,
        inCount: inCount || 0,
        waitlistCount: waitlistCount || 0,
        effectiveCapacity:
          schedule.capacity || event.default_capacity || 16,
        effectiveMinPlayers:
          schedule.min_players_override ?? event.min_players ?? null,
      };
    })
  );

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumbs
              items={[
                { label: "Admin", href: "/admin" },
                { label: event.name, href: `/admin/events/${eventId}/settings` },
                { label: "Schedule" },
              ]}
            />
            <h1 className="text-2xl font-bold text-navy-900">
              Schedule Management
            </h1>
          </div>
          <Link
            href="/admin"
            className="text-sm text-teal-600 hover:text-teal-500"
          >
            Dashboard
          </Link>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Manage the next 8 weeks. Toggle games on/off, adjust capacity, and add
          notes that appear in emails.
        </p>

        {/* Schedule Grid */}
        <div className="mt-6 space-y-3">
          {schedulesWithCounts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No upcoming schedules. The event may have ended or is not active.
            </p>
          ) : (
            schedulesWithCounts.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                eventId={eventId}
                defaultCapacity={event.default_capacity}
                defaultMinPlayers={event.min_players}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
