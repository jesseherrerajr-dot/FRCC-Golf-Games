import { requireAdmin } from "@/lib/auth";
import { getSubscriptionsForProfile } from "@/lib/subscriptions";
import { formatPhoneDisplay } from "@/lib/format";
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SubscribeButton, AdminUnsubscribeButton } from "./subscription-toggles";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "../../admin-actions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const { supabase } = await requireAdmin();

  // Fetch the member profile
  const { data: member } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", memberId)
    .single();

  if (!member) {
    notFound();
  }

  // Fetch subscriptions
  const { subscribed, available } = await getSubscriptionsForProfile(
    supabase,
    memberId
  );

  const statusLabel =
    member.status === "active"
      ? "Active"
      : member.status === "pending_approval"
        ? "Pending Approval"
        : member.status === "deactivated"
          ? "Deactivated"
          : member.status;

  const statusStyle =
    member.status === "active"
      ? "bg-teal-100 text-teal-700"
      : member.status === "pending_approval"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-600";

  return (
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Members", href: "/admin/members" },
              { label: `${member.first_name} ${member.last_name}` },
            ]}
          />

          {/* Member Info */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-xl font-bold uppercase tracking-wide text-navy-900">
                  {member.first_name} {member.last_name}
                </h1>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex gap-2">
                {member.status === "pending_approval" && (
                  <>
                    <ApproveButton profileId={memberId} />
                    <DenyButton profileId={memberId} />
                  </>
                )}
                {member.status === "active" && !member.is_super_admin && (
                  <DeactivateButton profileId={memberId} />
                )}
                {member.status === "deactivated" && (
                  <ReactivateButton profileId={memberId} />
                )}
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{member.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">
                  {formatPhoneDisplay(member.phone) || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">GHIN</dt>
                <dd className="font-medium text-gray-900">
                  {member.ghin_number || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Joined</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(member.created_at).toLocaleDateString("en-US", {
                    timeZone: "America/Los_Angeles",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
              {member.is_super_admin && (
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
                      profileId={memberId}
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
                        profileId={memberId}
                        eventId={event.id}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
