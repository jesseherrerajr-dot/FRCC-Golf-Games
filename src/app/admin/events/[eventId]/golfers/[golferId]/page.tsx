import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { formatPhoneDisplay, formatDateTimeDateOnly } from "@/lib/format";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EventRemoveGolferButton } from "./remove-golfer-button";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "@/app/admin/admin-actions";

export default async function EventGolferDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; golferId: string }>;
}) {
  const { eventId, golferId } = await params;
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

  // Fetch the golfer profile
  const { data: golfer } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", golferId)
    .single();

  if (!golfer) {
    notFound();
  }

  // Verify the golfer is subscribed to this event
  const { data: subscription } = await supabase
    .from("event_subscriptions")
    .select("*")
    .eq("profile_id", golferId)
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (!subscription) {
    notFound();
  }

  const statusLabel =
    golfer.status === "active"
      ? "Active"
      : golfer.status === "pending_approval"
        ? "Pending Approval"
        : golfer.status === "deactivated"
          ? "Deactivated"
          : golfer.status;

  const statusStyle =
    golfer.status === "active"
      ? "bg-teal-100 text-teal-700"
      : golfer.status === "pending_approval"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-600";

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name, href: `/admin/events/${eventId}` },
              {
                label: "Golfers",
                href: `/admin/events/${eventId}/golfers`,
              },
              { label: `${golfer.first_name} ${golfer.last_name}` },
            ]}
          />

          {/* Golfer Info */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-xl font-bold uppercase tracking-wide text-navy-900">
                  {golfer.first_name} {golfer.last_name}
                </h1>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex gap-2">
                {golfer.status === "pending_approval" && (
                  <>
                    <ApproveButton profileId={golferId} />
                    <DenyButton profileId={golferId} />
                  </>
                )}
                {golfer.status === "active" && !golfer.is_super_admin && (
                  <DeactivateButton profileId={golferId} />
                )}
                {golfer.status === "deactivated" && (
                  <ReactivateButton profileId={golferId} />
                )}
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{golfer.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">
                  {formatPhoneDisplay(golfer.phone) || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">GHIN</dt>
                <dd className="font-medium text-gray-900">
                  {golfer.ghin_number || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Joined</dt>
                <dd className="font-medium text-gray-900">
                  {formatDateTimeDateOnly(golfer.created_at)}
                </dd>
              </div>
              {golfer.is_super_admin && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-medium text-navy-700">Super Admin</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Event-Specific Actions */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
              {event.name}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              This golfer is subscribed to <strong>{event.name}</strong> and
              receives weekly invites for this event.
            </p>

            <div className="mt-4">
              <EventRemoveGolferButton
                profileId={golferId}
                eventId={eventId}
                eventName={event.name}
              />
            </div>
          </div>

          {/* Future RSVP History */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
              RSVP History
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              RSVP history for this golfer at {event.name} will be displayed
              here in a future update.
            </p>
          </div>

        </div>
          </main>
  );
}
