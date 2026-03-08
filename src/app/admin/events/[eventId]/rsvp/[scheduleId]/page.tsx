import { redirect } from "next/navigation";
import { requireAdmin, hasEventAccess } from "@/lib/auth";

export default async function EventRsvpRedirectPage({
  params,
}: {
  params: Promise<{ eventId: string; scheduleId: string }>;
}) {
  const { eventId, scheduleId } = await params;
  const { profile, adminEvents } = await requireAdmin();

  // Verify the user has access to this event
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    redirect("/admin");
  }

  // Redirect to the main RSVP management page
  redirect(`/admin/rsvp/${scheduleId}`);
}
