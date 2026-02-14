import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/format";
import {
  ApproveButton,
  DenyButton,
  DeactivateButton,
  ReactivateButton,
} from "../admin-actions";
import { MemberSearch } from "./member-search";

export default async function MemberDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const params = await searchParams;

  const searchQuery = params.q?.trim() || "";
  const statusFilter = params.status || "all";
  const sortBy = params.sort || "name";

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

  const { data: allMembers } = await query;

  // Apply search filter client-side (Supabase ilike doesn't support OR across columns easily)
  const members = searchQuery
    ? (allMembers || []).filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.first_name?.toLowerCase().includes(q) ||
          m.last_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.ghin_number?.toLowerCase().includes(q) ||
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
        );
      })
    : allMembers || [];

  // Counts for filter chips
  const totalCount = allMembers?.length || 0;
  const activeCount =
    allMembers?.filter((m) => m.status === "active").length || 0;
  const pendingCount =
    allMembers?.filter((m) => m.status === "pending_approval").length || 0;
  const deactivatedCount =
    allMembers?.filter((m) => m.status === "deactivated").length || 0;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-green-800">
              Member Directory
            </h1>
            <p className="text-sm text-gray-500">
              {totalCount} total members
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-green-700 hover:text-green-600"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Search + Filters */}
        <MemberSearch
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
          {members.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              {searchQuery
                ? `No members found matching "${searchQuery}".`
                : "No members in this category."}
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
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                        <span className="block text-xs text-gray-400 sm:hidden">
                          {member.email}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                        {member.email}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 md:table-cell">
                        {formatPhoneDisplay(member.phone)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                        {member.ghin_number || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <StatusBadge
                          status={member.status}
                          isSuperAdmin={member.is_super_admin}
                        />
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 lg:table-cell">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <MemberActions
                          member={member}
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
            Showing {members.length} of {totalCount} members
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
      <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
        Super Admin
      </span>
    );
  }

  switch (status) {
    case "active":
      return (
        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
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

function MemberActions({
  member,
  isSuperAdmin,
}: {
  member: Record<string, unknown>;
  isSuperAdmin: boolean;
}) {
  const status = member.status as string;
  const id = member.id as string;
  const memberIsSuperAdmin = member.is_super_admin as boolean;

  if (status === "pending_approval") {
    return (
      <div className="flex justify-end gap-2">
        <ApproveButton profileId={id} />
        <DenyButton profileId={id} />
      </div>
    );
  }

  if (status === "active" && !memberIsSuperAdmin) {
    return <DeactivateButton profileId={id} />;
  }

  if (status === "deactivated") {
    return <ReactivateButton profileId={id} />;
  }

  return null;
}
