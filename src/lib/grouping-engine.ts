/**
 * Grouping Engine — Pure algorithm for generating suggested foursome groupings.
 *
 * This module has ZERO dependencies on Supabase, Next.js, or any external service.
 * It takes structured input and returns structured output, making it fully testable
 * in isolation.
 *
 * Constraint Hierarchy:
 *   Level 1 — Guest-Host Pairing (hard — handled in grouping-db.ts post-engine)
 *   Level 2 — Group Math (hard — correct group sizes of 3/4/5)
 *   Level 3 — Tee Time Preferences (soft — configurable via teeTimePreferenceMode)
 *   Level 4 — Weighted Partner Preferences (soft — configurable via partnerPreferenceMode)
 *   Level 5 — Group Variety (soft — optional repeat-pairing penalty)
 */

import type {
  GroupingGolfer,
  PartnerPreference,
  GroupingAssignment,
  GroupResult,
  GroupingResult,
  GroupingOptions,
  TeeTimePreference,
} from '../types/events';

import { PARTNER_PREF_MODE_CONFIG } from '../types/events';

// ============================================================
// Default Options (matches legacy behavior)
// ============================================================

export const DEFAULT_GROUPING_OPTIONS: GroupingOptions = {
  partnerPreferenceMode: 'full',
  teeTimePreferenceMode: 'full',
  promoteVariety: false,
  teeTimeHistory: new Map(),
  recentPairings: new Map(),
  shuffle: false,
};

// ============================================================
// Constants
// ============================================================

/** Variety penalty points by recency (index 0 = not used, index 1 = last week, etc.) */
const VARIETY_PENALTY_BY_WEEKS_AGO: Record<number, number> = {
  1: -60,
  2: -45,
  3: -30,
  4: -20,
  5: -10,
  6: -10,
  7: -10,
  8: -10,
};

// ============================================================
// Rank → Points scoring table
// ============================================================

/**
 * Convert a partner preference rank (1–10) to points.
 * Formula: floor(100 / rank)
 */
export function rankToPoints(rank: number): number {
  if (rank < 1 || rank > 10) return 0;
  return Math.round(100 / rank);
}

// ============================================================
// Group Size Calculator (Level 2 — Hard Constraint)
// ============================================================

/**
 * Calculate the group sizes for N golfers.
 * Returns an array of group sizes ordered by tee position:
 *   - 3-somes first, 4-somes middle, 5-somes last
 *
 * Rules:
 *   - Default group size: 4
 *   - Minimum: 3, Maximum: 5
 *   - N=5 → single fivesome (don't split to 3+2)
 *   - N=6 → two threesomes (don't make a sixsome)
 */
export function calculateGroupSizes(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  if (n === 2) return [2];
  if (n === 3) return [3];
  if (n === 4) return [4];
  if (n === 5) return [5];
  if (n === 6) return [3, 3];

  const groupsOf4 = Math.floor(n / 4);
  const remainder = n % 4;

  if (remainder === 0) {
    // All groups of 4
    return new Array(groupsOf4).fill(4);
  }

  if (remainder === 1) {
    // Special case: N=9 → [3,3,3] is preferred over [4,5]
    if (n === 9) {
      return [3, 3, 3];
    }
    // Convert one group of 4 → fivesome (last position)
    const sizes = new Array(groupsOf4 - 1).fill(4);
    sizes.push(5);
    return sizes;
  }

  if (remainder === 2) {
    // Convert one group of 4 → two threesomes at the front
    const sizes = [3, 3];
    for (let i = 0; i < groupsOf4 - 1; i++) {
      sizes.push(4);
    }
    return sizes;
  }

  // remainder === 3: add one threesome at the front
  const sizes = [3];
  for (let i = 0; i < groupsOf4; i++) {
    sizes.push(4);
  }
  return sizes;
}

// ============================================================
// Pairwise Harmony Scoring
// ============================================================

/** Build a bidirectional pair score lookup from preference data */
export function buildPairScores(
  preferences: PartnerPreference[],
  confirmedIds: Set<string>
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const pref of preferences) {
    // Skip stale preferences (partner not confirmed this week)
    if (!confirmedIds.has(pref.preferredPartnerId)) continue;
    // Skip if the golfer themselves isn't confirmed (shouldn't happen, but be safe)
    if (!confirmedIds.has(pref.profileId)) continue;

    const key = pairKey(pref.profileId, pref.preferredPartnerId);
    const existing = scores.get(key) || 0;
    scores.set(key, existing + rankToPoints(pref.rank));
  }

  return scores;
}

/**
 * Apply grouping option modifiers to raw pair scores:
 * 1. Harmony multiplier from partner preference mode
 * 2. Variety penalty from recent pairings history
 *
 * Returns a new Map with adjusted scores (original is not mutated).
 */
export function applyScoreModifiers(
  rawScores: Map<string, number>,
  options: GroupingOptions
): Map<string, number> {
  const config = PARTNER_PREF_MODE_CONFIG[options.partnerPreferenceMode];
  const multiplier = config.harmonyMultiplier;
  const adjusted = new Map<string, number>();

  // If partner preference mode is 'off', start with all-zero scores
  // but we still need the keys for variety penalties
  if (multiplier === 0 && !options.promoteVariety) {
    return adjusted; // empty map — no scores at all
  }

  // Apply harmony multiplier to all raw scores
  for (const [key, score] of rawScores) {
    adjusted.set(key, Math.round(score * multiplier));
  }

  // Apply variety penalties from recent pairings
  if (options.promoteVariety && options.recentPairings.size > 0) {
    for (const [key, weeksAgoList] of options.recentPairings) {
      let penalty = 0;
      for (const weeksAgo of weeksAgoList) {
        penalty += VARIETY_PENALTY_BY_WEEKS_AGO[weeksAgo] || 0;
      }
      const existing = adjusted.get(key) || 0;
      adjusted.set(key, existing + penalty);
      // Note: scores can go negative — this is intentional.
      // A negative score means the engine actively avoids pairing these golfers.
    }
  }

  return adjusted;
}

/** Create a consistent key for a pair of golfer IDs (order-independent) */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Calculate the harmony score for a group of golfer IDs */
export function groupHarmonyScore(
  golfers: string[],
  pairScores: Map<string, number>
): number {
  let score = 0;
  for (let i = 0; i < golfers.length; i++) {
    for (let j = i + 1; j < golfers.length; j++) {
      const key = pairKey(golfers[i], golfers[j]);
      score += pairScores.get(key) || 0;
    }
  }
  return score;
}

// ============================================================
// Tee Time Partitioning (Level 3 — Soft Constraint)
// ============================================================

interface TeeTimePools {
  early: string[];
  late: string[];
  noPreference: string[];
}

/**
 * Partition golfers by tee time preference, applying the tee time preference mode.
 *
 * - 'off': All golfers are treated as no_preference (tee time ignored).
 * - 'light': Habitual requesters in the bottom 50% of priority are demoted to no_preference.
 * - 'moderate': All golfers keep their preference, but pools are sorted by priority (infrequent first).
 * - 'full': All golfers keep their preference as-is (legacy behavior).
 */
function partitionByTeeTime(
  golfers: GroupingGolfer[],
  options: GroupingOptions
): TeeTimePools {
  const pools: TeeTimePools = { early: [], late: [], noPreference: [] };

  // In 'off' mode, everyone goes to noPreference
  if (options.teeTimePreferenceMode === 'off') {
    for (const g of golfers) {
      pools.noPreference.push(g.profileId);
    }
    return pools;
  }

  // First, do a basic partition
  for (const g of golfers) {
    switch (g.teeTimePreference) {
      case 'early':
        pools.early.push(g.profileId);
        break;
      case 'late':
        pools.late.push(g.profileId);
        break;
      default:
        pools.noPreference.push(g.profileId);
        break;
    }
  }

  // In 'full' mode, no further processing needed
  if (options.teeTimePreferenceMode === 'full') {
    return pools;
  }

  // For 'light' and 'moderate': calculate priority scores and sort/demote
  const history = options.teeTimeHistory;

  if (history.size > 0) {
    // Sort early pool by priority (infrequent requesters first)
    pools.early = sortByTeeTimePriority(pools.early, 'early', history);
    // Sort late pool by priority (infrequent requesters first)
    pools.late = sortByTeeTimePriority(pools.late, 'late', history);

    if (options.teeTimePreferenceMode === 'light') {
      // Demote bottom 50% of each pool to noPreference
      const earlyDemoteCount = Math.floor(pools.early.length / 2);
      if (earlyDemoteCount > 0) {
        const demoted = pools.early.splice(pools.early.length - earlyDemoteCount, earlyDemoteCount);
        pools.noPreference.push(...demoted);
      }

      const lateDemoteCount = Math.floor(pools.late.length / 2);
      if (lateDemoteCount > 0) {
        const demoted = pools.late.splice(pools.late.length - lateDemoteCount, lateDemoteCount);
        pools.noPreference.push(...demoted);
      }
    }
    // In 'moderate' mode, pools are sorted by priority but no one is demoted.
    // The sort order means infrequent requesters get placed first in the greedy
    // assignment, giving them priority for their preferred tee time slots.
  }

  return pools;
}

/**
 * Calculate a tee time priority score for a golfer.
 * Higher score = higher priority for getting their preferred tee time.
 *
 * Score = (weeks WITHOUT this preference) / totalWeeks
 * A golfer who picks 'early' every week scores 0.0 (lowest priority).
 * A golfer who picks 'early' 1 out of 8 weeks scores 0.875 (highest priority).
 * A golfer with no history scores 1.0 (benefit of the doubt — first-timers get priority).
 */
export function teeTimePriorityScore(
  profileId: string,
  preference: 'early' | 'late',
  history: Map<string, { earlyCount: number; lateCount: number; totalWeeks: number }>
): number {
  const entry = history.get(profileId);
  if (!entry || entry.totalWeeks === 0) {
    return 1.0; // No history — first-timer gets full priority
  }

  const sameCount = preference === 'early' ? entry.earlyCount : entry.lateCount;
  return (entry.totalWeeks - sameCount) / entry.totalWeeks;
}

/**
 * Sort a pool of golfer IDs by tee time priority (infrequent requesters first).
 * Returns a new sorted array.
 */
function sortByTeeTimePriority(
  pool: string[],
  preference: 'early' | 'late',
  history: Map<string, { earlyCount: number; lateCount: number; totalWeeks: number }>
): string[] {
  return [...pool].sort((a, b) => {
    const scoreA = teeTimePriorityScore(a, preference, history);
    const scoreB = teeTimePriorityScore(b, preference, history);
    return scoreB - scoreA; // Higher priority first
  });
}

// ============================================================
// Partner Preference Cap Tracking
// ============================================================

/**
 * Build a lookup of which golfers are on each other's preference list (confirmed only).
 * Used to enforce per-group partner caps.
 */
function buildPreferenceEdges(
  preferences: PartnerPreference[],
  confirmedIds: Set<string>
): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const pref of preferences) {
    if (!confirmedIds.has(pref.profileId) || !confirmedIds.has(pref.preferredPartnerId)) continue;
    if (!edges.has(pref.profileId)) edges.set(pref.profileId, new Set());
    edges.get(pref.profileId)!.add(pref.preferredPartnerId);
  }
  return edges;
}

/**
 * Count how many preferred partners a golfer already has in a group.
 * Counts from BOTH directions: if A lists B, and B is in the group, that counts.
 * Also if C in the group lists A, that counts for C (not A). We check from
 * the candidate's perspective: how many group members does the candidate list?
 */
function countPreferredPartnersInGroup(
  candidateId: string,
  groupGolfers: string[],
  preferenceEdges: Map<string, Set<string>>
): number {
  const candidatePrefs = preferenceEdges.get(candidateId);
  if (!candidatePrefs) return 0;
  let count = 0;
  for (const golferId of groupGolfers) {
    if (candidatePrefs.has(golferId)) count++;
  }
  return count;
}

// ============================================================
// Main Engine
// ============================================================

/**
 * Generate suggested foursome groupings.
 *
 * @param golfers     - Confirmed golfers with tee time preferences
 * @param preferences - All partner preferences for this event (engine filters to confirmed only)
 * @param options     - Grouping configuration (preference modes, historical data, shuffle).
 *                      If omitted, uses DEFAULT_GROUPING_OPTIONS (legacy full-weight behavior).
 * @returns GroupingResult with groups, assignments, and total harmony score
 */
export function generateGroupings(
  golfers: GroupingGolfer[],
  preferences: PartnerPreference[],
  options: GroupingOptions | boolean = DEFAULT_GROUPING_OPTIONS
): GroupingResult {
  // Backwards compatibility: if a boolean is passed, treat it as the old `shuffle` param
  const opts: GroupingOptions = typeof options === 'boolean'
    ? { ...DEFAULT_GROUPING_OPTIONS, shuffle: options }
    : options;

  const n = golfers.length;

  // Edge case: no golfers
  if (n === 0) {
    return { groups: [], assignments: [], totalHarmonyScore: 0 };
  }

  // Step 1: Calculate group sizes (Level 2)
  const groupSizes = calculateGroupSizes(n);

  // Step 2: Build pair scores from preferences, then apply modifiers
  const confirmedIds = new Set(golfers.map((g) => g.profileId));
  const rawPairScores = buildPairScores(preferences, confirmedIds);
  const pairScores = applyScoreModifiers(rawPairScores, opts);

  // Step 2b: Build preference edges for per-group cap enforcement
  const perGroupCap = PARTNER_PREF_MODE_CONFIG[opts.partnerPreferenceMode].perGroupCap;
  const preferenceEdges = perGroupCap < Infinity
    ? buildPreferenceEdges(preferences, confirmedIds)
    : new Map<string, Set<string>>();

  // Step 3: Partition golfers by tee time preference (Level 3)
  const pools = partitionByTeeTime(golfers, opts);

  // Step 3b: Shuffle pools for randomization
  if (opts.shuffle) {
    shuffleArray(pools.early);
    shuffleArray(pools.late);
    shuffleArray(pools.noPreference);

    // For tee time modes with priority sorting, shuffle within priority tiers
    // to avoid deterministic ordering among equal-priority golfers.
    // The sort in partitionByTeeTime already handled major ordering;
    // shuffle here adds variety among golfers with the same priority score.
  }

  // Step 4: Assign golfers to group slots
  const groupSlots: string[][] = groupSizes.map(() => []);

  // 4a: Assign "early" golfers to the lowest-numbered groups
  const earlyPool = [...pools.early];
  assignPoolToGroups(earlyPool, groupSlots, groupSizes, 'front', pairScores, perGroupCap, preferenceEdges);

  // 4b: Assign "late" golfers to the highest-numbered groups
  const latePool = [...pools.late];
  assignPoolToGroups(latePool, groupSlots, groupSizes, 'back', pairScores, perGroupCap, preferenceEdges);

  // 4c: Assign "no_preference" golfers to remaining slots
  const noPreferencePool = [...pools.noPreference];
  assignPoolToGroups(noPreferencePool, groupSlots, groupSizes, 'front', pairScores, perGroupCap, preferenceEdges);

  // Step 5: Build preliminary groups
  // Use RAW pair scores for final harmony display (not modified scores)
  // so admins see the actual preference satisfaction, not the penalized version
  const earlyIds = new Set(pools.early);
  const lateIds = new Set(pools.late);

  interface PrelimGroup {
    golfers: string[];
    harmony: number;
    priority: 'early' | 'late' | 'none';
  }

  const prelimGroups: PrelimGroup[] = groupSlots.map((slotGolfers) => {
    const harmony = groupHarmonyScore(slotGolfers, rawPairScores);
    const hasEarly = slotGolfers.some((id) => earlyIds.has(id));
    const hasLate = slotGolfers.some((id) => lateIds.has(id));
    const priority = hasEarly ? 'early' : hasLate ? 'late' : 'none';
    return { golfers: [...slotGolfers], harmony, priority };
  });

  // Step 6: Randomize group order while respecting tee-time tiers
  if (opts.shuffle) {
    const earlyGroups = prelimGroups.filter((g) => g.priority === 'early');
    const noneGroups = prelimGroups.filter((g) => g.priority === 'none');
    const lateGroups = prelimGroups.filter((g) => g.priority === 'late');
    shuffleArray(earlyGroups);
    shuffleArray(noneGroups);
    shuffleArray(lateGroups);
    prelimGroups.length = 0;
    prelimGroups.push(...earlyGroups, ...noneGroups, ...lateGroups);
  }

  // Step 7: Build final output with sequential numbering
  const groups: GroupResult[] = [];
  const assignments: GroupingAssignment[] = [];
  let totalHarmonyScore = 0;

  for (let i = 0; i < prelimGroups.length; i++) {
    const pg = prelimGroups[i];
    totalHarmonyScore += pg.harmony;
    const teeOrder = i + 1;

    groups.push({
      groupNumber: i + 1,
      teeOrder,
      golfers: pg.golfers,
      harmonyScore: pg.harmony,
    });

    for (const profileId of pg.golfers) {
      assignments.push({
        groupNumber: i + 1,
        teeOrder,
        profileId,
      });
    }
  }

  return { groups, assignments, totalHarmonyScore };
}

// ============================================================
// Greedy Pool Assignment
// ============================================================

/**
 * Assign golfers from a pool into group slots using a greedy strategy.
 *
 * @param pool            - Mutable array of profile IDs to assign (will be drained)
 * @param groupSlots      - The current group assignments (mutated in place)
 * @param groupSizes      - Target sizes for each group
 * @param direction       - 'front' fills lowest-numbered groups first; 'back' fills highest first
 * @param pairScores      - Pair harmony scores for greedy selection (already modified)
 * @param perGroupCap     - Max preferred partners allowed per group (Infinity = unlimited)
 * @param preferenceEdges - Who lists whom as a preferred partner (for cap checking)
 */
function assignPoolToGroups(
  pool: string[],
  groupSlots: string[][],
  groupSizes: number[],
  direction: 'front' | 'back',
  pairScores: Map<string, number>,
  perGroupCap: number,
  preferenceEdges: Map<string, Set<string>>
): void {
  if (pool.length === 0) return;

  // Determine group processing order
  const groupIndices = groupSizes.map((_, i) => i);
  if (direction === 'back') {
    groupIndices.reverse();
  }

  for (const gi of groupIndices) {
    if (pool.length === 0) break;

    const targetSize = groupSizes[gi];
    const currentGroup = groupSlots[gi];

    while (currentGroup.length < targetSize && pool.length > 0) {
      // Greedy: pick the golfer from the pool who adds the most harmony to this group
      // while respecting the per-group partner cap
      const bestIdx = findBestCandidate(pool, currentGroup, pairScores, perGroupCap, preferenceEdges);
      const chosen = pool.splice(bestIdx, 1)[0];
      currentGroup.push(chosen);
    }
  }
}

/**
 * Find the index in `candidates` of the golfer who adds the most harmony
 * to the existing group golfers, while respecting the per-group partner cap.
 *
 * If all scores are 0 (no preferences), returns 0 (first candidate — stable ordering).
 *
 * The per-group cap works as follows: if adding a candidate would give them
 * MORE than `perGroupCap` preferred partners in the group, that candidate's
 * effective score is zeroed out. They can still be placed if no better option
 * exists, but the preference pull is eliminated.
 */
function findBestCandidate(
  candidates: string[],
  currentGolfers: string[],
  pairScores: Map<string, number>,
  perGroupCap: number,
  preferenceEdges: Map<string, Set<string>>
): number {
  if (candidates.length === 1) return 0;
  if (currentGolfers.length === 0) {
    // No existing golfers to score against — pick first candidate (stable)
    return 0;
  }

  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    let score = 0;
    for (const golfer of currentGolfers) {
      const key = pairKey(candidates[i], golfer);
      score += pairScores.get(key) || 0;
    }

    // Enforce per-group partner cap
    if (perGroupCap < Infinity && preferenceEdges.size > 0) {
      const prefCount = countPreferredPartnersInGroup(
        candidates[i],
        currentGolfers,
        preferenceEdges
      );
      if (prefCount >= perGroupCap) {
        // This candidate already has enough preferred partners in this group.
        // Zero out their preference-based score to discourage further clustering.
        // Use 0 instead of their actual score, so non-preferred candidates are
        // competitive for this slot.
        score = 0;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ============================================================
// Fisher-Yates Shuffle (in-place)
// ============================================================

/** Shuffle an array in place using Fisher-Yates algorithm */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
