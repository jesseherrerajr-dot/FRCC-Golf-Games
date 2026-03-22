import { requireAdmin } from "@/lib/auth";
import { getSubscriptionsForProfile } from "@/lib/subscriptions";
import { formatPhoneDisplay, formatDateTimeDateOnly } from "@/lib/format";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SubscribeButton, AdminUnsubscribeButton } from "./subscription-toggles";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
  PermanentlyDeleteGolferButton,
} from "../../admin-actions";
import { GolferManualHandicapField } from "./manual-handicap";

export default async function GolferDetailPage({
  params,
}: {
  params: Promise<{ golferId: string }>;
}) {
  const { golferId } = await params;
  const { supabase, profile: adminUser } = await requireAdmin();
  const isSuperAdmin = adminUser?.is_super_admin || false;

  // Fetch the golfer profile
  const { data: golfer } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", golferId)
    .single();

  if (!golfer) {
    notFound();
  }

  // Fetch subscriptions
  const { subscribed, available } = await getSubscriptionsForProfile(
    supabase,
    golferId
  );

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
              { label: "Golfers", href: "/admin/golfers" },
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
                <dt className="text-gray-500">Handicap Index</dt>
                <dd className="font-medium text-gray-900">
                  {golfer.handicap_index != null ? golfer.handicap_index.toFixed(1) : "N/A"}
                </dd>
              </div>
              <GolferManualHandicapField
                profileId={golfer.id}
                manualHandicap={golfer.manual_handicap_index ?? null}
                syncedHandicap={golfer.handicap_index ?? null}
              />
              {golfer.handicap_index != null && golfer.handicap_updated_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last Synced</dt>
                  <dd className="text-sm text-gray-400">
                    {new Date(golfer.handicap_updated_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })}
                  </dd>
                </div>
              )}
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

          {/* Event Subscriptions */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
              Event Subscriptions
            </h2>

            {/* Currently subscribed */}
            {subscribed.length > 0 ? (
              <div className="mt-3 space-y-3">
                {subscribed.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {sub.event_name}
                      </p>
                      <p className="text-xs text-teal-700">Subscribed</p>
                    </div>
                    <AdminUnsubscribeButton
                      profileId={golferId}
                      eventId={sub.event_id}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Not subscribed to any events.
              </p>
            )}

            {/* Available events to subscribe */}
            {available.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-medium text-gray-700">
                  Available Events
                </h3>
                <div className="mt-2 space-y-3">
                  {available.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {event.name}
                        </p>
                        <p className="text-xs text-gray-500">Not subscribed</p>
                      </div>
                      <SubscribeButton
                        profileId={golferId}
                        eventId={event.id}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Danger Zone — Super Admin Only, not for super admin accounts */}
          {isSuperAdmin && !golfer.is_super_admin && (
            <div className="mt-4 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-red-700">
                Danger Zone
                <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  Super Admin
                </span>
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Permanently remove this golfer and all their associated data from the platform.
              </p>
              <div className="mt-3">
                <PermanentlyDeleteGolferButton
                  profileId={golferId}
                  golferEmail={golfer.email}
                />
              </div>
            </div>
          )}
        </div>
          </main>
  );
}
