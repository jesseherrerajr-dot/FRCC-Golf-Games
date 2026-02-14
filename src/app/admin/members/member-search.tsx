"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

interface MemberSearchProps {
  currentQuery: string;
  currentStatus: string;
  currentSort: string;
  counts: {
    all: number;
    active: number;
    pending: number;
    deactivated: number;
  };
}

export function MemberSearch({
  currentQuery,
  currentStatus,
  currentSort,
  counts,
}: MemberSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentQuery);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      startTransition(() => {
        router.push(`/admin/members?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchInput });
  };

  const handleStatusFilter = (status: string) => {
    updateParams({ status: status === "all" ? "" : status });
  };

  const handleSortChange = (sort: string) => {
    updateParams({ sort });
  };

  const statusFilters = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Active", count: counts.active },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "deactivated", label: "Deactivated", count: counts.deactivated },
  ];

  return (
    <div className="mt-6 space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or GHIN..."
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-green-500 focus:ring-green-500"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          Search
        </button>
        {currentQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              updateParams({ q: "" });
            }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </form>

      {/* Status Filter Chips + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleStatusFilter(filter.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                currentStatus === filter.key ||
                (filter.key === "all" && !currentStatus)
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}{" "}
              <span className="text-xs opacity-75">({filter.count})</span>
            </button>
          ))}
        </div>

        <select
          value={currentSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-600"
        >
          <option value="name">Sort by Name</option>
          <option value="email">Sort by Email</option>
          <option value="joined">Sort by Joined Date</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      {isPending && (
        <div className="text-xs text-gray-400">Loading...</div>
      )}
    </div>
  );
}
