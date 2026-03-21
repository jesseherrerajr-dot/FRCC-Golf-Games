import { requireAdmin, hasEventAccess } from "@/lib/auth";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { redirect } from "next/navigation";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "@/app/admin/admin-actions";
import { EventGolferSearch } from "./golfer-search";
import { JoinLinkSection } from "../settings/components";

export default async function EventGolferDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
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

  const params_data = await searchParams;
  const searchQuery = params_data.q?.trim() || "";
  const statusFilter = params_data.status || "all";
  const sortBy = params_data.sort || "name";

  // Fetch golfers subscribed to this event, joined with event_subscriptions
  let query = supabase
    .from("event_subscriptions")
    .select("profile:profiles(*)")
    .eq("event_id", eventId)
    .eq("is_active", true);

  const { data: subscriptions } = await query;

  // Extract profiles from the subscriptions, filter by status
  let allGolfers = (subscriptions || [])
    .map((sub: any) => sub.profile)
    .filter((p: any) => !p.is_guest);

  // Apply status filter
  if (statusFilter === "active") {
    allGolfers = allGolfers.filter((m: any) => m.status === "active");
  } else if (statusFilter === "pending") {
    allGolfers = allGolfers.filter((m: any) => m.status === "pending_approval");
  } else if (statusFilter === "deactivated") {
    allGolfers = allGolfers.filter((m: any) => m.status === "deactivated");
  }

  // Apply sort
  if (sortBy === "name") {
    allGolfers = allGolfers.sort(
      (a: any, b: any) =>
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name)
    );
  } else if (sortBy === "email") {
    allGolfers = allGolfers.sort((a: any, b: any) =>
      a.email.localeCompare(b.email)
    );
  } else if (sortBy === "joined") {
    allGolfers = allGolfers.sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else if (sortBy === "status") {
    allGolfers = allGolfers.sort(
      (a: any, b: any) =>
        a.status.localeCompare(b.status) ||
        a.last_name.localeCompare(b.last_name)
    );
  }

  // Apply search filter client-side
  const golfers = searchQuery
    ? allGolfers.filter((m: any) => {
        const q = searchQuery.toLowerCase();
        return (
          m.first_name?.toLowerCase().includes(q) ||
          m.last_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.ghin_number?.toLowerCase().includes(q) ||
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
        );
      })
    : allGolfers;

  // Counts for filter chips
  const totalCount = allGolfers.length;
  const activeCount = allGolfers.filter((m: any) => m.status === "active")
    .length;
  const pendingCount = allGolfers.filter(
    (m: any) => m.status === "pending_approval"
  ).length;
  const deactivatedCount = allGolfers.filter(
    (m: any) => m.status === "deactivated"
  ).length;

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: "Admin", href: "/admin" },
                { label: event.name, href: `/admin/events/${eventId}` },
                { label: "Golfer Directory" },
              ]}
            />
          </div>

          {/* Header */}
          <div>
            <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
              Golfers
            </h1>
            <p className="text-sm text-gray-500">
              {totalCount} golfers subscribed to {event.name}
            </p>
          </div>

          {/* Add New Golfer */}
          <div className="mt-6 mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Add New Golfer</h2>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Option 1: Register on their behalf */}
              <Link
                href={`/admin/events/${eventId}/golfers/add`}
                className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Already know the golfer&apos;s info?
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Register on their behalf — they&apos;ll be automatically approved and subscribed.
                  </p>
                </div>
                <svg className="ml-3 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>

              {/* Option 2: Share join link */}
              <div className="px-4 py-4">
                <p className="text-sm font-medium text-gray-900">
                  Don&apos;t know the golfer&apos;s info?
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Share this link so they can self-register. You&apos;ll need to approve them before they become active and subscribed.
                </p>
                <div className="mt-3">
                  <JoinLinkSection slug={event.slug} />
                </div>
              </div>
            </div>
          </div>

          {/* Golfer Directory */}
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Golfer Directory</h2>

          {/* Search + Filters */}
          <EventGolferSearch
            eventId={eventId}
            currentQuery={searchQuery}
            currentStatus={statusFilter}
            currentSort={sortBy}
            counts={{
              all: totalCount,
              active: activeCount,
              pending: pendingCount,
              deactivated: deactivatedCount,
            }}
          />

          {/* Results */}
          <div className="mt-4">
            {golfers.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {searchQuery
                  ? `No golfers match "${searchQuery}". Try a different name or email, or use "+ Add Golfer" to add someone new.`
                  : "No golfers in this category."}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-200">
                {golfers.map((golfer: any) => (
                  <div key={golfer.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <Link
                      href={`/admin/events/${eventId}/golfers/${golfer.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-900">
                          {golfer.first_name} {golfer.last_name}
                        </span>
                        <span className="block truncate text-xs text-gray-400">
                          {golfer.email}
                        </span>
                        {golfer.handicap_index != null && (
                          <span className="block text-xs text-teal-600">
                            HCP: {Number(golfer.handicap_index).toFixed(1)}
                            {golfer.handicap_updated_at && (
                              <span className="ml-1 text-gray-400">
                                (updated {new Date(golfer.handicap_updated_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <StatusBadge
                        status={golfer.status}
                        isSuperAdmin={golfer.is_super_admin}
                      />
                    </Link>
                    <GolferActions
                      golfer={golfer}
                      eventId={eventId}
                      isSuperAdmin={profile.is_super_admin}
                    />
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">
              Showing {golfers.length} of {totalCount} golfers
              {searchQuery ? ` matching "${searchQuery}"` : ""}
            </p>
          </div>
        </div>
          </main>
  );
}

function StatusBadge({
  status,
  isSuperAdmin,
}: {
  status: string;
  isSuperAdmin: boolean;
}) {
  if (isSuperAdmin) {
    return (
      <span className="inline-flex rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-700">
        Super Admin
      </span>
    );
  }

  switch (status) {
    case "active":
      return (
        <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
          Active
        </span>
      );
    case "pending_approval":
      return (
        <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          Pending
        </span>
      );
    case "deactivated":
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Deactivated
        </span>
      );
    default:
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {status}
        </span>
      );
  }
}

function GolferActions({
  golfer,
  eventId,
  isSuperAdmin,
}: {
  golfer: Record<string, unknown>;
  eventId: string;
  isSuperAdmin: boolean;
}) {
  const status = golfer.status as string;
  const id = golfer.id as string;
  const golferIsSuperAdmin = golfer.is_super_admin as boolean;

  // Only show inline action buttons for statuses that need quick actions
  const hasActions =
    status === "pending_approval" ||
    (status === "active" && !golferIsSuperAdmin) ||
    status === "deactivated";

  if (!hasActions) return null;

  return (
    <div className="ml-3 flex shrink-0 items-center gap-2">
      {status === "pending_approval" && (
        <>
          <ApproveButton profileId={id} />
          <DenyButton profileId={id} />
        </>
      )}
      {status === "active" && !golferIsSuperAdmin && (
        <DeactivateButton profileId={id} />
      )}
      {status === "deactivated" && <ReactivateButton profileId={id} />}
    </div>
  );
}
