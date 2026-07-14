"use client";

import { useState, useMemo } from "react";
import { formatInitialLastName } from "@/lib/format";

export interface SerializedMoneyLeaderboardEntry {
  rank: number;
  profileId: string;
  firstName: string;
  lastName: string;
  weeklyAmounts: Record<string, number>;
  totalAmount: number;
  weeksWon: number;
  seasonAmount: number | null;
}

interface MoneyLeaderboardProps {
  entries: SerializedMoneyLeaderboardEntry[];
  seasonWeeks: string[];
}

type SortField = "rank" | "golfer" | "total" | string;
type SortDir = "asc" | "desc";

function formatWeekDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${month}/${day}`;
}

function formatDollars(amount: number): string {
  if (amount === 0) return "$0";
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function MoneyLeaderboard({
  entries,
  seasonWeeks,
}: MoneyLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "golfer" ? "asc" : "desc");
    }
  };

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    sorted.sort((a, b) => {
      let cmp = 0;

      if (sortField === "rank" || sortField === "total") {
        cmp = a.totalAmount - b.totalAmount;
      } else if (sortField === "season") {
        cmp = (a.seasonAmount ?? -1) - (b.seasonAmount ?? -1);
      } else if (sortField === "golfer") {
        cmp = `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        );
      } else {
        // Sort by a specific week's amount
        const aAmt = a.weeklyAmounts[sortField];
        const bAmt = b.weeklyAmounts[sortField];
        if (aAmt === undefined && bAmt === undefined) cmp = 0;
        else if (aAmt === undefined) cmp = -1;
        else if (bAmt === undefined) cmp = 1;
        else cmp = aAmt - bAmt;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });

    // Re-compute display ranks based on total (always by total desc)
    const byTotal = [...sorted].sort((a, b) => b.totalAmount - a.totalAmount);
    const rankMap = new Map<string, number>();
    const tiedRanks = new Set<number>();
    let currentRank = 1;
    for (let i = 0; i < byTotal.length; i++) {
      if (i > 0 && byTotal[i].totalAmount < byTotal[i - 1].totalAmount) {
        currentRank = i + 1;
      } else if (
        i > 0 &&
        byTotal[i].totalAmount === byTotal[i - 1].totalAmount &&
        Object.keys(byTotal[i].weeklyAmounts).length > 0
      ) {
        tiedRanks.add(currentRank);
      }
      const hasData = Object.keys(byTotal[i].weeklyAmounts).length > 0;
      rankMap.set(byTotal[i].profileId, hasData ? currentRank : 0);
    }

    return sorted.map((e) => ({
      ...e,
      rank: rankMap.get(e.profileId) || 0,
      isTied: tiedRanks.has(rankMap.get(e.profileId) || 0),
    }));
  }, [entries, sortField, sortDir]);

  // Column totals for the grand-total footer row: per-week sums, the season
  // payout sum, and the overall grand total. DNP weeks (undefined) contribute
  // nothing; $0 weeks contribute 0.
  const columnTotals = useMemo(() => {
    const weekly: Record<string, number> = {};
    for (const week of seasonWeeks) {
      weekly[week] = entries.reduce(
        (sum, e) => sum + (e.weeklyAmounts[week] ?? 0),
        0
      );
    }
    const season = entries.reduce((sum, e) => sum + (e.seasonAmount ?? 0), 0);
    const grand = entries.reduce((sum, e) => sum + e.totalAmount, 0);
    return { weekly, season, grand };
  }, [entries, seasonWeeks]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg
          className="ml-1 inline h-3 w-3 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 9l4-4 4 4M8 15l4 4 4-4"
          />
        </svg>
      );
    }
    return sortDir === "desc" ? (
      <svg
        className="ml-1 inline h-3 w-3 text-teal-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    ) : (
      <svg
        className="ml-1 inline h-3 w-3 text-teal-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 15l7-7 7 7"
        />
      </svg>
    );
  };

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {/* table-fixed so explicit column widths are honored exactly, letting
              the right-pinned Season/Total columns abut without gaps. */}
          <table className="w-full text-sm table-fixed">
            <thead>
              {/* Row 1: Week numbers */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 w-[48px]"
                  onClick={() => handleSort("rank")}
                >
                  Rank
                  <SortIcon field="rank" />
                </th>
                <th
                  className="sticky left-[48px] z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 w-[150px]"
                  onClick={() => handleSort("golfer")}
                >
                  Golfer
                  <SortIcon field="golfer" />
                </th>
                {seasonWeeks.map((week, i) => (
                  <th
                    key={week}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 w-[56px]"
                    onClick={() => handleSort(week)}
                  >
                    Wk {i + 1}
                    <SortIcon field={week} />
                  </th>
                ))}
                {/* Summary columns pinned to the right (sm+), stacked at exact
                    offsets so they never overlap. Static (scroll) below sm. */}
                <th
                  className="w-[88px] sm:sticky sm:right-[88px] sm:z-20 bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 border-l border-gray-200"
                  onClick={() => handleSort("season")}
                >
                  Season
                  <SortIcon field="season" />
                </th>
                <th
                  className="w-[88px] sm:sticky sm:right-0 sm:z-20 bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 border-l border-gray-200"
                  onClick={() => handleSort("total")}
                >
                  Total
                  <SortIcon field="total" />
                </th>
              </tr>
              {/* Row 2: Dates */}
              <tr className="bg-gray-50/50 border-b border-gray-300">
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1" />
                <th className="sticky left-[48px] z-20 bg-gray-50 px-3 py-1" />
                {seasonWeeks.map((week) => (
                  <th
                    key={`date-${week}`}
                    className="px-2 py-1 text-center text-[10px] text-gray-400 font-normal"
                  >
                    {formatWeekDate(week)}
                  </th>
                ))}
                <th className="w-[88px] sm:sticky sm:right-[88px] sm:z-20 bg-gray-50 px-2 py-1 border-l border-gray-200" />
                <th className="w-[88px] sm:sticky sm:right-0 sm:z-20 bg-gray-50 px-2 py-1 border-l border-gray-200" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedEntries.map((entry, idx) => {
                const hasData =
                  Object.keys(entry.weeklyAmounts).length > 0;
                return (
                  <tr
                    key={entry.profileId}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {/* Rank */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 text-center font-semibold text-navy-900">
                      {entry.rank > 0 ? (
                        <>
                          {entry.isTied ? "T" : ""}
                          {entry.rank}
                        </>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    {/* Golfer name */}
                    <td className="sticky left-[48px] z-10 bg-inherit px-3 py-2.5 font-medium text-navy-900 whitespace-nowrap">
                      {formatInitialLastName(entry.firstName, entry.lastName)}
                    </td>
                    {/* Weekly amounts */}
                    {seasonWeeks.map((week) => {
                      const amount = entry.weeklyAmounts[week];
                      const isDNP = amount === undefined;
                      const isZero = amount === 0;

                      return (
                        <td
                          key={week}
                          className={`px-2 py-2.5 text-center tabular-nums ${
                            isDNP
                              ? "text-gray-300 text-xs italic"
                              : isZero
                                ? "text-gray-400"
                                : "text-green-700 font-medium"
                          }`}
                        >
                          {isDNP ? "DNP" : formatDollars(amount)}
                        </td>
                      );
                    })}
                    {/* Season payout */}
                    <td className="w-[88px] sm:sticky sm:right-[88px] sm:z-10 bg-inherit px-2 py-2.5 text-center tabular-nums border-l border-gray-200">
                      {entry.seasonAmount != null ? (
                        <span
                          className={
                            entry.seasonAmount > 0
                              ? "text-green-700 font-medium"
                              : "text-gray-400"
                          }
                        >
                          {formatDollars(entry.seasonAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    {/* Total */}
                    <td className="w-[88px] sm:sticky sm:right-0 sm:z-10 bg-inherit px-2 py-2.5 text-center font-bold text-navy-900 border-l border-gray-200">
                      {hasData ? (
                        <span className={entry.totalAmount > 0 ? "text-green-700" : ""}>
                          {formatDollars(entry.totalAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {sortedEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={seasonWeeks.length + 4}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No golfers subscribed to this event yet.
                  </td>
                </tr>
              )}
            </tbody>
            {sortedEntries.length > 0 && (
              <tfoot>
                {/* Grand total row: sums each column across all golfers. */}
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-navy-900">
                  <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2.5" />
                  <td className="sticky left-[48px] z-10 bg-gray-100 px-3 py-2.5 text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Total
                  </td>
                  {seasonWeeks.map((week) => (
                    <td
                      key={`total-${week}`}
                      className="px-2 py-2.5 text-center tabular-nums text-green-700"
                    >
                      {formatDollars(columnTotals.weekly[week])}
                    </td>
                  ))}
                  {/* Season payout total */}
                  <td className="w-[88px] sm:sticky sm:right-[88px] sm:z-10 bg-gray-100 px-2 py-2.5 text-center tabular-nums text-green-700 border-l border-gray-200">
                    {formatDollars(columnTotals.season)}
                  </td>
                  {/* Grand total */}
                  <td className="w-[88px] sm:sticky sm:right-0 sm:z-10 bg-gray-100 px-2 py-2.5 text-center tabular-nums text-green-700 border-l border-gray-200">
                    {formatDollars(columnTotals.grand)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Footnotes */}
      <div className="mt-3 space-y-1 text-xs text-gray-400">
        <p>DNP = Did Not Play &bull; $0 = Played but no winnings</p>
        <p>
          Season = season-long prize payout (top finishers only), separate
          from weekly winnings. Shown once entered at season end.
        </p>
      </div>
    </div>
  );
}
