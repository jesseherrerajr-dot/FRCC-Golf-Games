"use client";

import { useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatGameDate } from "@/lib/format";

// ============================================================
// Types
// ============================================================

interface GolferEngagement {
  id: string;
  name: string;
  email: string;
  eventName: string;
  eventId: string;
  totalInvites: number;
  totalResponses: number;
  totalIn: number;
  totalOut: number;
  totalNotSure: number;
  totalNoResponse: number;
  responseRate: number;
  participationRate: number;
  consecutiveNoReplies: number;
  lastResponseDate: string | null;
}

interface EngagementData {
  golfers: GolferEngagement[];
  totalGolfers: number;
  avgResponseRate: number;
  avgParticipationRate: number;
  ghostCount: number;
  events: { id: string; name: string }[];
}

interface ActivityData {
  totalLogins: number;
  totalPageViews: number;
  uniqueLoggedIn: number;
  uniqueActiveUsers: number;
  topPages: { path: string; count: number }[];
  topLoginUsers: { profileId: string; name: string; count: number }[];
  topActiveUsers: { profileId: string; name: string; count: number }[];
}

interface TimingBucket {
  label: string;
  count: number;
  percentage: number;
}

interface ResponseTimingData {
  totalResponses: number;
  totalInvitesSent: number;
  buckets: TimingBucket[];
  averageHours: number | null;
  medianHours: number | null;
}

interface ProfileGolfer {
  id: string;
  name: string;
  displayName: string;
  email: string;
  missingGhin: boolean;
  missingPhone: boolean;
  hasHandicap: boolean;
  eventIds: string[];
}

interface ProfileCompletenessData {
  totalActive: number;
  missingGhinCount: number;
  missingPhoneCount: number;
  incompleteCount: number;
  allGolfers: ProfileGolfer[];
  golfers: ProfileGolfer[];
  events: { id: string; name: string }[];
}

// ============================================================
// Helpers
// ============================================================

function formatHours(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} min${mins !== 1 ? "s" : ""}`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h !== 1 ? "s" : ""}`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function rateColor(rate: number): string {
  if (rate >= 50) return "text-teal-700";
  if (rate >= 20) return "text-amber-700";
  return "text-red-700";
}

function rateBgColor(rate: number): string {
  if (rate >= 50) return "bg-teal-50";
  if (rate >= 20) return "bg-amber-50";
  return "bg-red-50";
}

/** Pretty labels for normalized page paths */
function pageLabel(path: string): string {
  const labels: Record<string, string> = {
    "/home": "Home",
    "/dashboard": "Home",
    "/profile": "Profile",
    "/help": "Help",
    "/login": "Login",
    "/admin": "Admin Dashboard",
    "/admin/reports": "Admin Reports",
    "/admin/golfers": "Admin Golfers",
    "/rsvp/[token]": "RSVP (via email link)",
  };
  if (labels[path]) return labels[path];
  if (path.startsWith("/admin/events/[id]/settings")) return "Event Settings";
  if (path.startsWith("/admin/events/[id]/golfers")) return "Event Golfers";
  if (path.startsWith("/admin/rsvp/") || path.startsWith("/admin/events/[id]/rsvp")) return "RSVP Management";
  if (path.startsWith("/admin/events/[id]/emails")) return "Emails & Comms";
  if (path.startsWith("/admin/events/[id]/schedule")) return "Event Schedule";
  if (path.startsWith("/admin/events/[id]")) return "Event Dashboard";
  if (path.startsWith("/join")) return "Join / Registration";
  return path;
}

// ============================================================
// Main Component — new order: Engagement → Activity → Timing → Profile
// ============================================================

export function ReportsClient({
  engagement,
  activity,
  responseTiming,
  profileCompleteness,
}: {
  engagement: EngagementData;
  activity: ActivityData;
  responseTiming: ResponseTimingData;
  profileCompleteness: ProfileCompletenessData;
}) {
  return (
    <div className="mt-6 space-y-2">
      <GolferEngagementReport data={engagement} />
      <ActivityReport data={activity} />
      <ResponseTimingReport data={responseTiming} />
      <ProfileCompletenessReport data={profileCompleteness} />
    </div>
  );
}

// ============================================================
// 1. Golfer Engagement Report
// ============================================================

function GolferEngagementReport({ data }: { data: EngagementData }) {
  const [filter, setFilter] = useState<"all" | "ghosts" | "low" | "active">("all");
  const [sortBy, setSortBy] = useState<"responseRate" | "participationRate" | "consecutiveNoReplies">("responseRate");
  const [eventFilter, setEventFilter] = useState<string>("all");

  // Filter by event first, then by status filter
  const eventFiltered = eventFilter === "all"
    ? data.golfers
    : data.golfers.filter((g) => g.eventId === eventFilter);

  // Recalculate aggregate stats based on event filter
  const totalGolfers = eventFiltered.length;
  const avgResponseRate = totalGolfers > 0
    ? Math.round(eventFiltered.reduce((sum, g) => sum + g.responseRate, 0) / totalGolfers)
    : 0;
  const ghostCount = eventFiltered.filter((g) => g.consecutiveNoReplies >= 3).length;
  const activeCount = eventFiltered.filter((g) => g.responseRate >= 50).length;

  const filtered = eventFiltered.filter((g) => {
    if (filter === "ghosts") return g.consecutiveNoReplies >= 3;
    if (filter === "low") return g.responseRate < 20;
    if (filter === "active") return g.responseRate >= 50;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "responseRate") return b.responseRate - a.responseRate;
    if (sortBy === "participationRate") return b.participationRate - a.participationRate;
    return b.consecutiveNoReplies - a.consecutiveNoReplies;
  });

  return (
    <CollapsibleSection
      title="Golfer Engagement"
      count={totalGolfers}
      defaultOpen={true}
      badge={{
        label: `${activeCount} Active`,
        className: "bg-teal-100 text-teal-700",
      }}
    >
      <p className="text-xs text-gray-500 mb-3">
        RSVP response rates and participation trends over the last 12 weeks.
      </p>

      {/* Event filter */}
      {data.events.length > 1 && (
        <div className="mb-3">
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setFilter("all"); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Events</option>
            {data.events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Active (50%+)</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Avg Response Rate</p>
          <p className={`mt-1 text-2xl font-bold ${rateColor(avgResponseRate)}`}>{avgResponseRate}%</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Golfers</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalGolfers}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ghosts (3+ wks)</p>
          <p className="mt-1 text-2xl font-bold text-gray-500">{ghostCount}</p>
        </div>
      </div>

      {eventFiltered.length > 0 && (
        <>
          {/* Filter + sort controls */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {([
                { key: "all", label: "All", count: totalGolfers },
                { key: "active", label: "Active (50%+)", count: activeCount },
                { key: "low", label: "Low (<20%)", count: eventFiltered.filter((g) => g.responseRate < 20).length },
                { key: "ghosts", label: "Ghosts", count: ghostCount },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f.key
                      ? "bg-navy-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
              >
                <option value="responseRate">Response Rate</option>
                <option value="participationRate">Participation Rate</option>
                <option value="consecutiveNoReplies">Consecutive No-Replies</option>
              </select>
            </div>
          </div>

          {/* Golfer list */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-white">
            {sorted.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No golfers match this filter.</p>
            )}
            {sorted.map((golfer, i) => (
              <Link
                key={`${golfer.id}-${golfer.eventId}`}
                href={`/admin/events/${golfer.eventId}/golfers/${golfer.id}`}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{golfer.name}</p>
                    {golfer.consecutiveNoReplies >= 3 && (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Ghost
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{golfer.eventName}</p>
                  {/* Stats row */}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className={rateColor(golfer.responseRate)}>
                      <span className="font-semibold">{golfer.responseRate}%</span> response
                    </span>
                    <span className={rateColor(golfer.participationRate)}>
                      <span className="font-semibold">{golfer.participationRate}%</span> participation
                    </span>
                    <span className="text-gray-500">
                      {golfer.totalIn} in · {golfer.totalOut} out · {golfer.totalNoResponse} no reply
                    </span>
                  </div>
                  {golfer.consecutiveNoReplies >= 3 && (
                    <p className="mt-1 text-xs text-red-600">
                      {golfer.consecutiveNoReplies} consecutive weeks with no reply
                      {golfer.lastResponseDate
                        ? ` · Last response: ${formatGameDate(golfer.lastResponseDate)}`
                        : " · Never responded"}
                    </p>
                  )}
                </div>
                {/* Mini response rate bar */}
                <div className="ml-3 flex flex-shrink-0 flex-col items-end gap-1">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        golfer.responseRate >= 50 ? "bg-teal-500" :
                        golfer.responseRate >= 20 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${golfer.responseRate}%` }}
                    />
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}

// ============================================================
// 2. Activity Report (Logins & Page Views)
// ============================================================

function ActivityReport({ data }: { data: ActivityData }) {
  const hasData = data.totalLogins > 0 || data.totalPageViews > 0;

  return (
    <CollapsibleSection
      title="Platform Activity"
      defaultOpen={hasData}
      emptyMessage="No activity data yet. Login and page view tracking has been enabled — data will appear after users start using the app."
      badge={
        hasData
          ? { label: "Last 12 Weeks", className: "bg-blue-100 text-blue-700" }
          : { label: "New", className: "bg-gray-100 text-gray-500" }
      }
    >
      {hasData && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            Login and page view activity over the last 12 weeks.
          </p>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Logins</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{data.totalLogins}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Unique Users</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{data.uniqueLoggedIn}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Page Views</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data.totalPageViews}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active Users</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data.uniqueActiveUsers}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Top Pages */}
            {data.topPages.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Most Visited Pages
                </p>
                <div className="space-y-1.5">
                  {data.topPages.map((page) => (
                    <div key={page.path} className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 truncate">{pageLabel(page.path)}</p>
                      <span className="ml-2 flex-shrink-0 text-xs font-medium text-gray-500">{page.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most Active Users */}
            {data.topActiveUsers.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Most Active Users
                </p>
                <div className="space-y-1.5">
                  {data.topActiveUsers.map((user) => (
                    <div key={user.profileId} className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 truncate">{user.name}</p>
                      <span className="ml-2 flex-shrink-0 text-xs font-medium text-gray-500">
                        {user.count} view{user.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}

// ============================================================
// 3. Response Timing Report
// ============================================================

function ResponseTimingReport({ data }: { data: ResponseTimingData }) {
  const hasData = data.totalResponses > 0;

  return (
    <CollapsibleSection
      title="Response Timing"
      defaultOpen={hasData}
      emptyMessage="No invite response data available yet. Data will appear after the first invite cycle completes."
      count={hasData ? data.totalInvitesSent : undefined}
      badge={
        hasData
          ? { label: `${data.totalResponses} Responses`, className: "bg-blue-100 text-blue-700" }
          : undefined
      }
    >
      {hasData && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            How quickly golfers respond after receiving the invite email. Based on the last 8 weeks of data across all events.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Median Response</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {data.medianHours !== null ? formatHours(data.medianHours) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Average Response</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {data.averageHours !== null ? formatHours(data.averageHours) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Responses</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data.totalResponses}</p>
            </div>
          </div>

          {/* Distribution bar chart */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              Response Time Distribution
            </p>
            <div className="space-y-2">
              {data.buckets.map((bucket) => {
                const maxPercentage = Math.max(...data.buckets.map((b) => b.percentage), 1);
                const barWidth = bucket.percentage > 0
                  ? Math.max((bucket.percentage / maxPercentage) * 100, 2)
                  : 0;

                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <p className="w-24 flex-shrink-0 text-right text-xs text-gray-600">
                      {bucket.label}
                    </p>
                    <div className="flex-1">
                      <div className="h-6 w-full rounded-full bg-gray-100">
                        <div
                          className="flex h-6 items-center rounded-full bg-blue-400 px-2 transition-all duration-300"
                          style={{ width: `${barWidth}%`, minWidth: bucket.count > 0 ? "2rem" : "0" }}
                        >
                          {bucket.count > 0 && (
                            <span className="text-xs font-medium text-white">
                              {bucket.count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="w-10 flex-shrink-0 text-xs text-gray-500">
                      {bucket.percentage}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insight callout */}
          {data.buckets.length > 0 && (
            <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-800">
                {(() => {
                  const within4Hours = data.buckets
                    .filter((b) => b.label === "Within 1 hour" || b.label === "1–4 hours")
                    .reduce((sum, b) => sum + b.percentage, 0);
                  if (within4Hours >= 60) {
                    return `${within4Hours}% of golfers respond within 4 hours of the invite — your send time is well-optimized.`;
                  }
                  if (within4Hours >= 40) {
                    return `${within4Hours}% respond within 4 hours. Most golfers check the invite the same day.`;
                  }
                  return `Only ${within4Hours}% respond within 4 hours. Consider adjusting invite send time to when golfers are most likely checking email.`;
                })()}
              </p>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}

// ============================================================
// 4. Profile Completeness Report
// ============================================================

function ProfileCompletenessReport({ data }: { data: ProfileCompletenessData }) {
  const [filter, setFilter] = useState<"all" | "ghin" | "phone">("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  // Filter all golfers by event first
  const eventFilteredAll = eventFilter === "all"
    ? data.allGolfers
    : data.allGolfers.filter((g) => g.eventIds.includes(eventFilter));

  // Recalculate stats based on event filter
  const totalActive = eventFilteredAll.length;
  const missingGhinCount = eventFilteredAll.filter((g) => g.missingGhin).length;
  const missingPhoneCount = eventFilteredAll.filter((g) => g.missingPhone).length;
  const incompleteGolfers = eventFilteredAll.filter((g) => g.missingGhin || g.missingPhone);
  const incompleteCount = incompleteGolfers.length;

  const completionRate = totalActive > 0
    ? Math.round(((totalActive - incompleteCount) / totalActive) * 100)
    : 100;

  const filtered = incompleteGolfers.filter((g) => {
    if (filter === "ghin") return g.missingGhin;
    if (filter === "phone") return g.missingPhone;
    return true;
  });

  return (
    <CollapsibleSection
      title="Profile Completeness"
      count={incompleteCount}
      defaultOpen={incompleteCount > 0}
      emptyMessage="All golfer profiles are complete."
      badge={
        incompleteCount > 0
          ? { label: "Needs Attention", className: "bg-amber-100 text-amber-700" }
          : { label: "All Good", className: "bg-teal-100 text-teal-700" }
      }
    >
      {/* Event filter */}
      {data.events.length > 1 && (
        <div className="mb-4">
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setFilter("all"); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All Events</option>
            {data.events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Completion Rate</p>
          <p className="mt-1 text-2xl font-bold text-teal-900">{completionRate}%</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active Golfers</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalActive}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Missing GHIN</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{missingGhinCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Missing Phone</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{missingPhoneCount}</p>
        </div>
      </div>

      {incompleteCount > 0 && (
        <>
          {/* Filter buttons */}
          <div className="mt-4 flex gap-2">
            {(["all", "ghin", "phone"] as const).map((f) => {
              const labels = { all: "All Incomplete", ghin: "Missing GHIN", phone: "Missing Phone" };
              const counts = { all: incompleteCount, ghin: missingGhinCount, phone: missingPhoneCount };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-navy-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {labels[f]} ({counts[f]})
                </button>
              );
            })}
          </div>

          {/* Golfer list */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-white">
            {filtered.map((golfer, i) => (
              <Link
                key={golfer.id}
                href={`/admin/golfers/${golfer.id}`}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{golfer.name}</p>
                  <p className="text-xs text-gray-500">{golfer.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {golfer.missingGhin && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No GHIN
                      </span>
                    )}
                    {golfer.missingPhone && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No Phone
                      </span>
                    )}
                    {golfer.missingGhin && !golfer.hasHandicap && (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        No Handicap
                      </span>
                    )}
                  </div>
                </div>
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
