"use client";

import { useState } from "react";
import type { LeagueTab } from "@/types/events";
import { Leaderboard } from "./leaderboard";

/** Serialized version of LeaderboardEntry (countingWeeks as string[] instead of Set) */
export interface SerializedLeaderboardEntry {
  rank: number;
  profileId: string;
  firstName: string;
  lastName: string;
  lowHiValue: number | null;
  weeklyScores: Record<string, number>;
  countingWeeks: string[];
  totalPoints: number;
  roundsPlayed: number;
  isQualified: boolean;
}

interface LeagueTabsProps {
  tabs: LeagueTab[];
  leaderboard: SerializedLeaderboardEntry[];
  seasonWeeks: string[];
  bestN: number | null;
  totalM: number | null;
  minRoundsToQualify: number | null;
}

export function LeagueTabs({
  tabs,
  leaderboard,
  seasonWeeks,
  bestN,
  totalM,
  minRoundsToQualify,
}: LeagueTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.tab_key || "");

  if (tabs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          No league information available yet.
        </p>
      </div>
    );
  }

  const currentTab = tabs.find((t) => t.tab_key === activeTab) || tabs[0];

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.tab_key}
            onClick={() => setActiveTab(tab.tab_key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              currentTab.tab_key === tab.tab_key
                ? "border-b-2 border-teal-600 text-teal-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {currentTab.content_type === "leaderboard" && (
          <Leaderboard
            entries={leaderboard}
            seasonWeeks={seasonWeeks}
            bestN={bestN}
            totalM={totalM}
            minRoundsToQualify={minRoundsToQualify}
          />
        )}

        {currentTab.content_type === "html" && currentTab.content && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div
              className="league-html-content max-w-none"
              dangerouslySetInnerHTML={{ __html: currentTab.content }}
            />
          </div>
        )}

        {currentTab.content_type === "html" && !currentTab.content && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Content coming soon.</p>
          </div>
        )}

        {currentTab.content_type === "weekly_results" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Weekly results will appear here once scores are entered.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
