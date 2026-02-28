import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  BasicSettingsForm,
  JoinLinkSection,
  EmailScheduleForm,
  AlertSettingsForm,
  ProShopContactsForm,
  AdminAssignmentsForm,
  FeatureFlagsForm,
  DangerZone,
} from "./components";

export default async function EventSettingsPage({
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

  if (!event) {
    redirect("/admin");
  }

  // Fetch alert settings
  const { data: alertSettings } = await supabase
    .from("event_alert_settings")
    .select("*")
    .eq("event_id", eventId);

  // Fetch pro shop contacts
  const { data: proShopContacts } = await supabase
    .from("pro_shop_contacts")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");

  // Fetch event admins with profiles
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("*, profile:profiles(first_name, last_name, email)")
    .eq("event_id", eventId)
    .order("role");

  // Fetch active golfers for admin assignment dropdown
  const { data: activeGolfers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name");

  const isSuperAdmin = profile.is_super_admin;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumbs
              items={[
                { label: "Admin", href: "/admin" },
                { label: event.name },
              ]}
            />
            <h1 className="text-2xl font-bold text-navy-900">
              Event Settings
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/events/${eventId}/schedule`}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Schedule
            </Link>
          </div>
        </div>

        {/* Basic Settings */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Basic Settings
          </h2>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <BasicSettingsForm event={event} />
          </div>
        </section>

        {/* Join Link */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Join Link
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Shareable link for new golfers to request to join this event.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <JoinLinkSection slug={event.slug} />
          </div>
        </section>

        {/* Email Schedule */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Email Schedule
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure when automated emails are sent each week.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <EmailScheduleForm event={event} />
          </div>
        </section>

        {/* Alert Settings */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Admin Alerts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Get notified when important events happen.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <AlertSettingsForm
              eventId={eventId}
              alertSettings={alertSettings || []}
            />
          </div>
        </section>

        {/* Pro Shop Contacts */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Pro Shop Contacts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Email addresses that receive the Friday pro shop detail email.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ProShopContactsForm
              eventId={eventId}
              contacts={proShopContacts || []}
            />
          </div>
        </section>

        {/* Admin Assignments — Super Admin Only */}
        {isSuperAdmin && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Event Admins
              <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Assign admins to manage this event. Primary admin is the reply-to
              for emails.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <AdminAssignmentsForm
                eventId={eventId}
                eventAdmins={eventAdmins || []}
                activeGolfers={activeGolfers || []}
              />
            </div>
          </section>
        )}

        {/* Feature Flags — Super Admin Only */}
        {isSuperAdmin && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Feature Flags
              <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Enable or disable optional features. These should remain off until
              fully built and tested.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <FeatureFlagsForm event={event} />
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section className="mt-8 mb-12">
          <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
          <div className="mt-3 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <DangerZone eventId={eventId} isActive={event.is_active} />
          </div>
        </section>
      </div>
    </main>
  );
}
