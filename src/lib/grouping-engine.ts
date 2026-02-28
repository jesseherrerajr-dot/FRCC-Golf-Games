/**
 * Grouping Engine — Pure algorithm for generating suggested foursome groupings.
 *
 * This module has ZERO dependencies on Supabase, Next.js, or any external service.
 * It takes structured input and returns structured output, making it fully testable
 * in isolation.
 *
 * Constraint Hierarchy:
 *   Level 1 — Guest-Host Pairing (hard, future — not implemented)
 *   Level 2 — Group Math (hard — correct group sizes of 3/4/5)
 *   Level 3 — Tee Time Preferences (soft — early golfers first, late golfers last)
 *   Level 4 — Weighted Partner Preferences (soft — maximize harmony score)
 */

import type {
  GroupingGolfer,
  PartnerPreference,
  GroupingAssignment,
  GroupResult,
  GroupingResult,
  TeeTimePreference,
} from '../types/events';

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
    // (3 even groups vs 2 uneven groups). For larger N, the fivesome approach
    // keeps groups closer to the ideal size of 4.
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

/** Create a consistent key for a pair of golfer IDs (order-independent) */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Calculate the harmony score for a group of golfer IDs */
export function groupHarmonyScore(
  members: string[],
  pairScores: Map<string, number>
): number {
  let score = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const key = pairKey(members[i], members[j]);
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

function partitionByTeeTime(golfers: GroupingGolfer[]): TeeTimePools {
  const pools: TeeTimePools = { early: [], late: [], noPreference: [] };
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
  return pools;
}

// ============================================================
// Main Engine
// ============================================================

/**
 * Generate suggested foursome groupings.
 *
 * @param golfers   - Confirmed golfers with tee time preferences
 * @param preferences - All partner preferences for this event (engine filters to confirmed only)
 * @param shuffle - If true, randomize golfers who have no preference data before grouping.
 *                  This prevents the same no-preference players from always landing together.
 *                  Default: false (for test determinism). Production callers should pass true.
 * @returns GroupingResult with groups, assignments, and total harmony score
 */
export function generateGroupings(
  golfers: GroupingGolfer[],
  preferences: PartnerPreference[],
  shuffle: boolean = false
): GroupingResult {
  const n = golfers.length;

  // Edge case: no golfers
  if (n === 0) {
    return { groups: [], assignments: [], totalHarmonyScore: 0 };
  }

  // Step 1: Calculate group sizes (Level 2)
  const groupSizes = calculateGroupSizes(n);

  // Step 2: Build pair scores from preferences
  const confirmedIds = new Set(golfers.map((g) => g.profileId));
  const pairScores = buildPairScores(preferences, confirmedIds);

  // Step 3: Partition golfers by tee time preference (Level 3)
  const pools = partitionByTeeTime(golfers);

  // Step 3b: Shuffle pools to randomize no-preference players
  if (shuffle) {
    shuffleArray(pools.early);
    shuffleArray(pools.late);
    shuffleArray(pools.noPreference);
  }

  // Step 4: Assign golfers to group slots
  // Strategy: Fill groups front-to-back.
  //   - Early pool fills from the front
  //   - Late pool fills from the back
  //   - No-preference fills remaining slots
  // Within each assignment step, use greedy partner scoring (Level 4)

  const totalSlots = groupSizes.reduce((sum, s) => sum + s, 0);
  const groupSlots: string[][] = groupSizes.map(() => []);

  // 4a: Assign "early" golfers to the lowest-numbered groups
  const earlyPool = [...pools.early];
  assignPoolToGroups(earlyPool, groupSlots, groupSizes, 'front', pairScores);

  // 4b: Assign "late" golfers to the highest-numbered groups
  const latePool = [...pools.late];
  assignPoolToGroups(latePool, groupSlots, groupSizes, 'back', pairScores);

  // 4c: Assign "no_preference" golfers to remaining slots
  const noPreferencePool = [...pools.noPreference];
  assignPoolToGroups(noPreferencePool, groupSlots, groupSizes, 'front', pairScores);

  // Step 5: Build preliminary groups
  const earlyIds = new Set(pools.early);
  const lateIds = new Set(pools.late);

  interface PrelimGroup {
    members: string[];
    harmony: number;
    priority: 'early' | 'late' | 'none'; // tee-time tier
  }

  const prelimGroups: PrelimGroup[] = groupSlots.map((members) => {
    const harmony = groupHarmonyScore(members, pairScores);
    const hasEarly = members.some((id) => earlyIds.has(id));
    const hasLate = members.some((id) => lateIds.has(id));
    const priority = hasEarly ? 'early' : hasLate ? 'late' : 'none';
    return { members: [...members], harmony, priority };
  });

  // Step 6: Randomize group order while respecting tee-time tiers.
  // Early groups stay at the front, late groups stay at the back,
  // no-preference groups shuffle freely in the middle.
  if (shuffle) {
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
      members: pg.members,
      harmonyScore: pg.harmony,
    });

    for (const profileId of pg.members) {
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
 * @param pool       - Mutable array of profile IDs to assign (will be drained)
 * @param groupSlots - The current group assignments (mutated in place)
 * @param groupSizes - Target sizes for each group
 * @param direction  - 'front' fills lowest-numbered groups first; 'back' fills highest first
 * @param pairScores - Pair harmony scores for greedy selection
 */
function assignPoolToGroups(
  pool: string[],
  groupSlots: string[][],
  groupSizes: number[],
  direction: 'front' | 'back',
  pairScores: Map<string, number>
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
      const bestIdx = findBestCandidate(pool, currentGroup, pairScores);
      const chosen = pool.splice(bestIdx, 1)[0];
      currentGroup.push(chosen);
    }
  }
}

/**
 * Find the index in `candidates` of the golfer who adds the most harmony
 * to the existing group members.
 *
 * If all scores are 0 (no preferences), returns 0 (first candidate — stable ordering).
 */
function findBestCandidate(
  candidates: string[],
  currentMembers: string[],
  pairScores: Map<string, number>
): number {
  if (candidates.length === 1) return 0;
  if (currentMembers.length === 0) {
    // No existing members to score against — pick first candidate (stable)
    return 0;
  }

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    let score = 0;
    for (const member of currentMembers) {
      const key = pairKey(candidates[i], member);
      score += pairScores.get(key) || 0;
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
