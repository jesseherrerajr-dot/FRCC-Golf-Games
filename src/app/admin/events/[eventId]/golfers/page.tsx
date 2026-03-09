import { requireAdmin, hasEventAccess } from "@/lib/auth";
import Link from "next/link";
import { formatPhoneDisplay, formatDateTimeDateOnly } from "@/lib/format";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { redirect } from "next/navigation";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "@/app/admin/admin-actions";
import { EventGolferSearch } from "./golfer-search";

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
                Golfer Directory
              </h1>
              <p className="text-sm text-gray-500">
                {totalCount} golfers subscribed to {event.name} &mdash; approve
                pending registrations or use &quot;+ Add Golfer&quot; to add
                directly
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/admin/events/${eventId}/golfers/add`}
                className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
              >
                + Add Golfer
              </Link>
            </div>
          </div>

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
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Name
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                        Email
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                        Phone
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                        GHIN
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">
                        Joined
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {golfers.map((golfer: any) => (
                      <tr key={golfer.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {golfer.first_name} {golfer.last_name}
                          <span className="block text-xs text-gray-400 sm:hidden">
                            {golfer.email}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {golfer.email}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 md:table-cell">
                          {formatPhoneDisplay(golfer.phone)}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                          {golfer.ghin_number || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <StatusBadge
                            status={golfer.status}
                            isSuperAdmin={golfer.is_super_admin}
                          />
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 lg:table-cell">
                          {formatDateTimeDateOnly(golfer.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <GolferActions
                            golfer={golfer}
                            eventId={eventId}
                            isSuperAdmin={profile.is_super_admin}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/admin/events/${eventId}/golfers/${id}`}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Manage
      </Link>
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
