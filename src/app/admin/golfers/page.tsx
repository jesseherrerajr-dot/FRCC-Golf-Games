import { requireSuperAdmin } from "@/lib/auth";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "../admin-actions";
import { GolferSearch } from "./golfer-search";

export default async function GolferDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; event?: string }>;
}) {
  const { supabase } = await requireSuperAdmin();
  const params = await searchParams;

  const searchQuery = params.q?.trim() || "";
  const statusFilter = params.status || "all";
  const sortBy = params.sort || "name";
  const eventFilter = params.event || "all";

  // Fetch all active events for the filter dropdown
  const { data: allEvents } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Fetch all non-guest profiles
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_guest", false);

  // Apply status filter
  if (statusFilter === "active") {
    query = query.eq("status", "active");
  } else if (statusFilter === "pending") {
    query = query.eq("status", "pending_approval");
  } else if (statusFilter === "deactivated") {
    query = query.eq("status", "deactivated");
  }

  // Apply sort
  if (sortBy === "name") {
    query = query.order("last_name", { ascending: true }).order("first_name", { ascending: true });
  } else if (sortBy === "email") {
    query = query.order("email", { ascending: true });
  } else if (sortBy === "joined") {
    query = query.order("created_at", { ascending: false });
  } else if (sortBy === "status") {
    query = query.order("status", { ascending: true }).order("last_name", { ascending: true });
  }

  const { data: allGolfers } = await query;

  // Fetch event subscriptions for all golfers
  const { data: subscriptions } = await supabase
    .from("event_subscriptions")
    .select("profile_id, event_id")
    .eq("is_active", true);

  // Map profile_id -> event_ids
  const subscriptionMap = new Map<string, string[]>();
  (subscriptions || []).forEach((sub: any) => {
    const current = subscriptionMap.get(sub.profile_id) || [];
    current.push(sub.event_id);
    subscriptionMap.set(sub.profile_id, current);
  });

  // Filter by event if specified
  let filteredByEvent = allGolfers || [];
  if (eventFilter !== "all") {
    filteredByEvent = filteredByEvent.filter((golfer: any) => {
      const golferEvents = subscriptionMap.get(golfer.id) || [];
      return golferEvents.includes(eventFilter);
    });
  }

  // Apply search filter client-side (Supabase ilike doesn't support OR across columns easily)
  const golfers = searchQuery
    ? filteredByEvent.filter((m: any) => {
        const q = searchQuery.toLowerCase();
        return (
          m.first_name?.toLowerCase().includes(q) ||
          m.last_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.ghin_number?.toLowerCase().includes(q) ||
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
        );
      })
    : filteredByEvent;

  // Counts for filter chips
  const totalCount = allGolfers?.length || 0;
  const activeCount =
    allGolfers?.filter((m) => m.status === "active").length || 0;
  const pendingCount =
    allGolfers?.filter((m) => m.status === "pending_approval").length || 0;
  const deactivatedCount =
    allGolfers?.filter((m) => m.status === "deactivated").length || 0;

  return (
    <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "All Golfers" },
            ]}
          />

          {/* Header */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
                Golfer Directory
              </h1>
            <p className="text-sm text-gray-500">
              {totalCount} total golfers &mdash; approve pending registrations or use &quot;+ Add Golfer&quot; to add directly
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/golfers/add"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
            >
              + Add Golfer
            </Link>
          </div>
        </div>

        {/* Search + Filters */}
        <GolferSearch
          currentQuery={searchQuery}
          currentStatus={statusFilter}
          currentSort={sortBy}
          currentEvent={eventFilter}
          events={allEvents || []}
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
                    href={`/admin/golfers/${golfer.id}`}
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
                  <GolferActions golfer={golfer} />
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
}: {
  golfer: Record<string, unknown>;
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
