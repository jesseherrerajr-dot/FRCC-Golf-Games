"use client";

import { useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatGameDate } from "@/lib/format";

// ============================================================
// Types
// ============================================================

interface IncompleteGolfer {
  id: string;
  name: string;
  displayName: string;
  email: string;
  missingGhin: boolean;
  missingPhone: boolean;
  hasHandicap: boolean;
}

interface ProfileCompletenessData {
  totalActive: number;
  missingGhinCount: number;
  missingPhoneCount: number;
  incompleteCount: number;
  golfers: IncompleteGolfer[];
}

interface GhostGolfer {
  id: string;
  name: string;
  displayName: string;
  email: string;
  eventName: string;
  eventId: string;
  consecutiveNoReplies: number;
  lastResponseDate: string | null;
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

// ============================================================
// Helper: format hours to human-readable
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
  const days = Math.round(hours / 24 * 10) / 10;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

// ============================================================
// Main Component
// ============================================================

export function ReportsClient({
  profileCompleteness,
  ghosts,
  responseTiming,
}: {
  profileCompleteness: ProfileCompletenessData;
  ghosts: GhostGolfer[];
  responseTiming: ResponseTimingData;
}) {
  return (
    <div className="mt-6 space-y-2">
      {/* Profile Completeness */}
      <ProfileCompletenessReport data={profileCompleteness} />

      {/* Ghost Report */}
      <GhostReport ghosts={ghosts} />

      {/* Response Timing */}
      <ResponseTimingReport data={responseTiming} />
    </div>
  );
}

// ============================================================
// 1. Profile Completeness Report
// ============================================================

function ProfileCompletenessReport({ data }: { data: ProfileCompletenessData }) {
  const [filter, setFilter] = useState<"all" | "ghin" | "phone">("all");

  const completionRate = data.totalActive > 0
    ? Math.round(((data.totalActive - data.incompleteCount) / data.totalActive) * 100)
    : 100;

  const filtered = data.golfers.filter((g) => {
    if (filter === "ghin") return g.missingGhin;
    if (filter === "phone") return g.missingPhone;
    return true;
  });

  return (
    <CollapsibleSection
      title="Profile Completeness"
      count={data.incompleteCount}
      defaultOpen={data.incompleteCount > 0}
      emptyMessage="All golfer profiles are complete."
      badge={
        data.incompleteCount > 0
          ? { label: "Needs Attention", className: "bg-amber-100 text-amber-700" }
          : { label: "All Good", className: "bg-teal-100 text-teal-700" }
      }
    >
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Completion Rate</p>
          <p className="mt-1 text-2xl font-bold text-teal-900">{completionRate}%</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active Golfers</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.totalActive}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Missing GHIN</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{data.missingGhinCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Missing Phone</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{data.missingPhoneCount}</p>
        </div>
      </div>

      {data.incompleteCount > 0 && (
        <>
          {/* Filter buttons */}
          <div className="mt-4 flex gap-2">
            {(["all", "ghin", "phone"] as const).map((f) => {
              const labels = { all: "All Incomplete", ghin: "Missing GHIN", phone: "Missing Phone" };
              const counts = { all: data.incompleteCount, ghin: data.missingGhinCount, phone: data.missingPhoneCount };
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

// ============================================================
// 2. Ghost Report
// ============================================================

function GhostReport({ ghosts }: { ghosts: GhostGolfer[] }) {
  return (
    <CollapsibleSection
      title="Unresponsive Golfers"
      count={ghosts.length}
      defaultOpen={ghosts.length > 0}
      emptyMessage="All subscribed golfers have responded within the last 3 weeks."
      badge={
        ghosts.length > 0
          ? { label: `${ghosts.length} Ghost${ghosts.length !== 1 ? "s" : ""}`, className: "bg-red-100 text-red-700" }
          : { label: "All Active", className: "bg-teal-100 text-teal-700" }
      }
    >
      <p className="text-xs text-gray-500 mb-3">
        Golfers who are active and subscribed but haven&apos;t responded to 3 or more consecutive invites.
        Consider reaching out or deactivating if they&apos;re no longer participating.
      </p>

      {ghosts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          {ghosts.map((ghost, i) => (
            <Link
              key={`${ghost.id}-${ghost.eventId}`}
              href={`/admin/events/${ghost.eventId}/golfers/${ghost.id}`}
              className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{ghost.name}</p>
                <p className="text-xs text-gray-500">{ghost.eventName}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {ghost.consecutiveNoReplies} weeks no reply
                  </span>
                  {ghost.lastResponseDate && (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Last response: {formatGameDate(ghost.lastResponseDate)}
                    </span>
                  )}
                  {!ghost.lastResponseDate && (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Never responded
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
