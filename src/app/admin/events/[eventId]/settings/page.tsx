import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  BasicSettingsForm,
  EmailScheduleForm,
  AlertSettingsForm,
  ProShopContactsSection,
  AdminAssignmentsForm,
  GroupingPreferencesForm,
  HandicapSyncForm,
  FeatureFlagsForm,
  DangerZone,
} from "./components";
import { getLatestSyncStatus } from "@/lib/handicap-sync";

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

  // Fetch pro shop contacts linked to this event (via global directory)
  const { data: eventContactLinks } = await supabase
    .from("event_pro_shop_contact_links")
    .select("id, contact_id, contact:pro_shop_contacts_directory(id, name, email)")
    .eq("event_id", eventId)
    .order("created_at");

  // Fetch all global pro shop contacts (for the picker dropdown)
  const { data: allGlobalContacts } = await supabase
    .from("pro_shop_contacts_directory")
    .select("id, name, email")
    .order("name");

  // Fetch event admins with profiles
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("*, profile:profiles(first_name, last_name, email)")
    .eq("event_id", eventId)
    .order("role");

  // Fetch email schedules (for enabled/disabled toggle state)
  const { data: emailSchedules } = await supabase
    .from("email_schedules")
    .select("email_type, priority_order, is_enabled")
    .eq("event_id", eventId);

  // Fetch active golfers for admin assignment dropdown
  const { data: activeGolfers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name");

  // Fetch handicap sync status (non-fatal)
  let syncStatus = null;
  try {
    syncStatus = await getLatestSyncStatus(eventId);
  } catch {
    // Non-fatal — sync status display is optional
  }

  const isSuperAdmin = profile.is_super_admin;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: event.name, href: `/admin/events/${eventId}` },
              { label: "Settings" },
            ]}
          />
          <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
            Event Settings
          </h1>
        </div>

        {/* Basic Settings */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Event Details
          </h2>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <BasicSettingsForm event={event} />
          </div>
        </section>

        {/* Automated Email Settings */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Automated Email Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure when automated emails are sent each week. All times are Pacific Time.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <EmailScheduleForm event={event} emailSchedules={emailSchedules || []} />
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
            Pro shop contacts who can receive the suggested groupings email.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ProShopContactsSection
              eventId={eventId}
              linkedContacts={eventContactLinks || []}
              allGlobalContacts={allGlobalContacts || []}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </section>

        {/* Grouping Engine — Super Admin Only */}
        {isSuperAdmin && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Grouping Engine
              <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Control how the automatic grouping engine balances player preferences,
              tee time requests, and group variety.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <GroupingPreferencesForm event={event} />
            </div>
          </section>
        )}

        {/* Handicap Sync — Super Admin Only */}
        {isSuperAdmin && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Handicap Sync
              <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Automatically fetch USGA Handicap Index from GHIN before each game.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <HandicapSyncForm event={event} syncStatus={syncStatus} />
            </div>
          </section>
        )}

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
              Toggle features on or off for this event. Changes take effect
              immediately for golfers on their RSVP page.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <FeatureFlagsForm event={event} />
            </div>
          </section>
        )}

        {/* Danger Zone — Super Admin Only */}
        {isSuperAdmin && (
          <section className="mt-8 mb-12">
            <h2 className="text-lg font-semibold text-red-700">
              Danger Zone
              <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </h2>
            <div className="mt-3 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
              <DangerZone eventId={eventId} eventName={event.name} isActive={event.is_active} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
