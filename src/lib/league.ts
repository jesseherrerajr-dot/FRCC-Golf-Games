import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { LeagueConfig, LeagueTab, LeagueScore, LeaderboardEntry, LeagueMoneyScore, MoneyLeaderboardEntry } from "@/types/events";

/**
 * Fetch league config for an event by slug.
 * Returns null if no config exists or league is not enabled.
 */
export async function getLeagueConfigBySlug(slug: string): Promise<{
  config: LeagueConfig;
  event: { id: string; name: string; slug: string };
} | null> {
  const supabase = await createClient();

  // Look up event by slug
  const { data: event } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!event) return null;

  // Fetch league config (admin client bypasses RLS — session client silently
  // fails for non-admin golfers despite "authenticated read" policy)
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("event_league_config")
    .select("*")
    .eq("event_id", event.id)
    .single();

  if (!config || !config.league_enabled) return null;

  return { config: config as LeagueConfig, event };
}

/**
 * Fetch league config for an event by event ID.
 * Returns the config or null if not found/not enabled.
 */
export async function getLeagueConfigByEventId(eventId: string): Promise<LeagueConfig | null> {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("event_league_config")
    .select("*")
    .eq("event_id", eventId)
    .single();

  if (!config || !config.league_enabled) return null;
  return config as LeagueConfig;
}

/**
 * Fetch active league tabs for an event, ordered by sort_order.
 */
export async function getLeagueTabs(eventId: string): Promise<LeagueTab[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("event_league_tabs")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data || []) as LeagueTab[];
}

/**
 * Fetch all scores for an event within the season date range.
 */
export async function getLeagueScores(
  eventId: string,
  seasonStart?: string | null,
  seasonEnd?: string | null
): Promise<LeagueScore[]> {
  const admin = createAdminClient();

  let query = admin
    .from("league_scores")
    .select("*")
    .eq("event_id", eventId)
    .order("game_date", { ascending: true });

  if (seasonStart) {
    query = query.gte("game_date", seasonStart);
  }
  if (seasonEnd) {
    query = query.lte("game_date", seasonEnd);
  }

  const { data } = await query;
  return (data || []) as LeagueScore[];
}

/**
 * Fetch all golfers subscribed to an event (for displaying full roster on leaderboard).
 */
export async function getSubscribedGolfers(eventId: string): Promise<{
  id: string;
  first_name: string;
  last_name: string;
  low_hi_value: number | null;
}[]> {
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("event_subscriptions")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("is_active", true);

  if (!subs || subs.length === 0) return [];

  const profileIds = subs.map((s) => s.profile_id);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, first_name, last_name, low_hi_value")
    .in("id", profileIds)
    .eq("status", "active")
    .order("last_name", { ascending: true });

  return (profiles || []) as { id: string; first_name: string; last_name: string; low_hi_value: number | null }[];
}

/**
 * Compute the season week dates for the leaderboard header.
 * Returns an ordered array of YYYY-MM-DD date strings for each Thursday
 * from season_start through season_end (or total_m weeks).
 */
export function computeSeasonWeeks(
  seasonStart: string,
  totalWeeks: number
): string[] {
  const [year, month, day] = seasonStart.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const weeks: string[] = [];

  for (let i = 0; i < totalWeeks; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    weeks.push(`${y}-${m}-${dd}`);
  }

  return weeks;
}

/**
 * Build the leaderboard from scores and golfer data.
 * Applies best-N-of-M logic and computes ranks.
 */
export function buildLeaderboard(
  golfers: { id: string; first_name: string; last_name: string; low_hi_value: number | null }[],
  scores: LeagueScore[],
  bestN: number | null,
  minRoundsToQualify: number | null
): LeaderboardEntry[] {
  // Group scores by profile_id
  const scoresByGolfer = new Map<string, LeagueScore[]>();
  for (const score of scores) {
    const existing = scoresByGolfer.get(score.profile_id) || [];
    existing.push(score);
    scoresByGolfer.set(score.profile_id, existing);
  }

  // Build entries for all subscribed golfers
  const entries: LeaderboardEntry[] = golfers.map((golfer) => {
    const golferScores = scoresByGolfer.get(golfer.id) || [];
    const weeklyScores: Record<string, number> = {};
    for (const s of golferScores) {
      weeklyScores[s.game_date] = s.stableford_points;
    }

    // Determine which scores count (top N by points)
    const sortedByPoints = [...golferScores].sort(
      (a, b) => b.stableford_points - a.stableford_points
    );

    const countingScores =
      bestN && sortedByPoints.length > bestN
        ? sortedByPoints.slice(0, bestN)
        : sortedByPoints;

    const countingWeeks = new Set(countingScores.map((s) => s.game_date));
    const totalPoints = countingScores.reduce(
      (sum, s) => sum + s.stableford_points,
      0
    );
    const roundsPlayed = golferScores.length;
    const isQualified = minRoundsToQualify
      ? roundsPlayed >= minRoundsToQualify
      : true;

    return {
      rank: 0, // computed below
      profileId: golfer.id,
      firstName: golfer.first_name,
      lastName: golfer.last_name,
      lowHiValue: golfer.low_hi_value,
      weeklyScores,
      countingWeeks,
      totalPoints,
      roundsPlayed,
      isQualified,
    };
  });

  // Sort by total points descending, then by last name for ties
  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.lastName.localeCompare(b.lastName);
  });

  // Assign ranks (ties share rank)
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].totalPoints < entries[i - 1].totalPoints) {
      currentRank = i + 1;
    }
    // Golfers with 0 rounds get no rank
    entries[i].rank = entries[i].roundsPlayed > 0 ? currentRank : 0;
  }

  return entries;
}

/**
 * Fetch all money scores for an event within the season date range.
 */
export async function getLeagueMoneyScores(
  eventId: string,
  seasonStart?: string | null,
  seasonEnd?: string | null
): Promise<LeagueMoneyScore[]> {
  const admin = createAdminClient();

  let query = admin
    .from("league_money_scores")
    .select("*")
    .eq("event_id", eventId)
    .order("game_date", { ascending: true });

  if (seasonStart) {
    query = query.gte("game_date", seasonStart);
  }
  if (seasonEnd) {
    query = query.lte("game_date", seasonEnd);
  }

  const { data } = await query;
  return (data || []) as LeagueMoneyScore[];
}

/**
 * Build the money leaderboard from scores and golfer data.
 * Simpler than points leaderboard — every dollar counts (no best-N-of-M).
 * Golfers who played but won nothing show $0; golfers who didn't play show DNP.
 */
export function buildMoneyLeaderboard(
  golfers: { id: string; first_name: string; last_name: string }[],
  moneyScores: LeagueMoneyScore[],
  pointsScores: LeagueScore[]
): MoneyLeaderboardEntry[] {
  // Group money scores by profile_id
  const moneyByGolfer = new Map<string, LeagueMoneyScore[]>();
  for (const score of moneyScores) {
    const existing = moneyByGolfer.get(score.profile_id) || [];
    existing.push(score);
    moneyByGolfer.set(score.profile_id, existing);
  }

  // Build set of (profile_id, game_date) pairs where the golfer played (from points scores)
  const playedWeeks = new Map<string, Set<string>>();
  for (const score of pointsScores) {
    const existing = playedWeeks.get(score.profile_id) || new Set();
    existing.add(score.game_date);
    playedWeeks.set(score.profile_id, existing);
  }

  // Build entries
  const entries: MoneyLeaderboardEntry[] = golfers.map((golfer) => {
    const golferMoney = moneyByGolfer.get(golfer.id) || [];
    const golferPlayed = playedWeeks.get(golfer.id) || new Set<string>();

    const weeklyAmounts: Record<string, number> = {};

    // Add money score weeks
    for (const s of golferMoney) {
      weeklyAmounts[s.game_date] = s.amount;
    }

    // For weeks where golfer played but has no money score, show $0
    for (const week of golferPlayed) {
      if (!(week in weeklyAmounts)) {
        weeklyAmounts[week] = 0;
      }
    }

    const totalAmount = golferMoney.reduce((sum, s) => sum + s.amount, 0);
    const weeksWon = golferMoney.filter((s) => s.amount > 0).length;

    return {
      rank: 0,
      profileId: golfer.id,
      firstName: golfer.first_name,
      lastName: golfer.last_name,
      weeklyAmounts,
      totalAmount,
      weeksWon,
    };
  });

  // Sort by total amount descending, then by last name for ties
  entries.sort((a, b) => {
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return a.lastName.localeCompare(b.lastName);
  });

  // Assign ranks (ties share rank; golfers with no money at all get no rank)
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].totalAmount < entries[i - 1].totalAmount) {
      currentRank = i + 1;
    }
    const hasAnyData = Object.keys(entries[i].weeklyAmounts).length > 0;
    entries[i].rank = hasAnyData ? currentRank : 0;
  }

  return entries;
}
