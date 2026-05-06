"use client";

import { useState, useMemo } from "react";
import { formatInitialLastName } from "@/lib/format";
import type { SerializedLeaderboardEntry } from "./league-tabs";

interface LeaderboardProps {
  entries: SerializedLeaderboardEntry[];
  seasonWeeks: string[];
  bestN: number | null;
  totalM: number | null;
  minRoundsToQualify: number | null;
}

type SortField = "rank" | "golfer" | "total" | string; // string for week dates
type SortDir = "asc" | "desc";

/**
 * Format a date string "YYYY-MM-DD" as "M/D" for compact column headers.
 */
function formatWeekDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${month}/${day}`;
}

export function Leaderboard({
  entries,
  seasonWeeks,
  bestN,
  totalM,
  minRoundsToQualify,
}: LeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Default: desc for scores/total/rank, asc for golfer name
      setSortDir(field === "golfer" ? "asc" : "desc");
    }
  };

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    sorted.sort((a, b) => {
      let cmp = 0;

      if (sortField === "rank" || sortField === "total") {
        cmp = a.totalPoints - b.totalPoints;
      } else if (sortField === "golfer") {
        cmp = `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        );
      } else {
        // Sort by a specific week's score
        const aScore = a.weeklyScores[sortField];
        const bScore = b.weeklyScores[sortField];
        // DNP (undefined) sorts to the bottom
        if (aScore === undefined && bScore === undefined) cmp = 0;
        else if (aScore === undefined) cmp = -1;
        else if (bScore === undefined) cmp = 1;
        else cmp = aScore - bScore;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });

    // Re-compute display ranks based on total (always by total desc)
    const byTotal = [...sorted].sort((a, b) => b.totalPoints - a.totalPoints);
    const rankMap = new Map<string, number>();
    let currentRank = 1;
    for (let i = 0; i < byTotal.length; i++) {
      if (i > 0 && byTotal[i].totalPoints < byTotal[i - 1].totalPoints) {
        currentRank = i + 1;
      }
      rankMap.set(byTotal[i].profileId, byTotal[i].roundsPlayed > 0 ? currentRank : 0);
    }

    return sorted.map((e) => ({ ...e, rank: rankMap.get(e.profileId) || 0 }));
  }, [entries, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="ml-1 inline h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      );
    }
    return sortDir === "desc" ? (
      <svg className="ml-1 inline h-3 w-3 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="ml-1 inline h-3 w-3 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  const hasAnyScores = entries.some((e) => e.roundsPlayed > 0);

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Scrollable table wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Row 1: Week numbers */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 min-w-[48px]"
                  onClick={() => handleSort("rank")}
                >
                  Rank
                  <SortIcon field="rank" />
                </th>
                <th
                  className="sticky left-[48px] z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 min-w-[120px]"
                  onClick={() => handleSort("golfer")}
                >
                  Golfer
                  <SortIcon field="golfer" />
                </th>
                {seasonWeeks.map((week, i) => (
                  <th
                    key={week}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 min-w-[52px]"
                    onClick={() => handleSort(week)}
                  >
                    Wk {i + 1}
                    <SortIcon field={week} />
                  </th>
                ))}
                <th
                  className="sticky right-0 z-20 bg-gray-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 min-w-[60px] border-l border-gray-200"
                  onClick={() => handleSort("total")}
                >
                  Total
                  <SortIcon field="total" />
                </th>
              </tr>
              {/* Row 2: Dates */}
              <tr className="bg-gray-50/50 border-b border-gray-300">
                <th className="sticky left-0 z-20 bg-gray-50/50 px-3 py-1" />
                <th className="sticky left-[48px] z-20 bg-gray-50/50 px-3 py-1" />
                {seasonWeeks.map((week) => (
                  <th
                    key={`date-${week}`}
                    className="px-2 py-1 text-center text-[10px] text-gray-400 font-normal"
                  >
                    {formatWeekDate(week)}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-gray-50/50 px-3 py-1 border-l border-gray-200" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedEntries.map((entry, idx) => {
                const countingSet = new Set(entry.countingWeeks);
                return (
                  <tr
                    key={entry.profileId}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}
                  >
                    {/* Rank */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 text-center font-semibold text-navy-900">
                      {entry.rank > 0 ? entry.rank : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    {/* Golfer name */}
                    <td className="sticky left-[48px] z-10 bg-inherit px-3 py-2.5 font-medium text-navy-900 whitespace-nowrap">
                      {formatInitialLastName(entry.firstName, entry.lastName)}
                    </td>
                    {/* Weekly scores */}
                    {seasonWeeks.map((week) => {
                      const score = entry.weeklyScores[week];
                      const isCounting = countingSet.has(week);
                      const isDNP = score === undefined;

                      return (
                        <td
                          key={week}
                          className={`px-2 py-2.5 text-center tabular-nums ${
                            isDNP
                              ? "text-gray-300 text-xs italic"
                              : isCounting
                                ? "text-gray-900 font-medium"
                                : "text-gray-300"
                          }`}
                        >
                          {isDNP ? "DNP" : score}
                        </td>
                      );
                    })}
                    {/* Total */}
                    <td className="sticky right-0 z-10 bg-inherit px-3 py-2.5 text-center font-bold text-navy-900 border-l border-gray-200">
                      {entry.roundsPlayed > 0 ? entry.totalPoints : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {sortedEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={seasonWeeks.length + 3}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No golfers subscribed to this event yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnotes */}
      <div className="mt-3 space-y-1 text-xs text-gray-400">
        <p>DNP = Did Not Play</p>
        {bestN && totalM && (
          <p>
            Total = Best {bestN} of {totalM} weekly scores.
            {hasAnyScores && " Dimmed scores are not counted toward the total."}
          </p>
        )}
        {minRoundsToQualify && (
          <p>
            Must play at least {minRoundsToQualify} weeks to qualify for season
            prizes.
          </p>
        )}
      </div>
    </div>
  );
}
