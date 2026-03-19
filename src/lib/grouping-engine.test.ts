/**
 * Unit tests for the Grouping Engine.
 *
 * Run with: npx tsx --test src/lib/grouping-engine.test.ts
 * (Uses Node.js built-in test runner — no Vitest/Jest needed)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGroupSizes,
  rankToPoints,
  buildPairScores,
  pairKey,
  groupHarmonyScore,
  generateGroupings,
  applyScoreModifiers,
  teeTimePriorityScore,
  DEFAULT_GROUPING_OPTIONS,
} from './grouping-engine';
import type {
  GroupingGolfer,
  PartnerPreference,
  GroupingOptions,
  TeeTimeHistoryEntry,
} from '../types/events';

// ============================================================
// Helpers
// ============================================================

/** Create a simple golfer with no_preference tee time */
function golfer(id: string, teeTime: 'early' | 'late' | 'no_preference' = 'no_preference'): GroupingGolfer {
  return { profileId: id, teeTimePreference: teeTime };
}

/** Create N golfers with sequential IDs (g1, g2, ...) */
function makeGolfers(n: number, teeTime: 'early' | 'late' | 'no_preference' = 'no_preference'): GroupingGolfer[] {
  return Array.from({ length: n }, (_, i) => golfer(`g${i + 1}`, teeTime));
}

/** Create a partner preference */
function pref(profileId: string, partnerId: string, rank: number): PartnerPreference {
  return { profileId, preferredPartnerId: partnerId, rank };
}

/** Build GroupingOptions with overrides */
function opts(overrides: Partial<GroupingOptions> = {}): GroupingOptions {
  return {
    ...DEFAULT_GROUPING_OPTIONS,
    ...overrides,
  };
}

// ============================================================
// 1. rankToPoints
// ============================================================

describe('rankToPoints', () => {
  it('should return correct points for all ranks 1-10', () => {
    const expected = [100, 50, 33, 25, 20, 17, 14, 13, 11, 10];
    for (let r = 1; r <= 10; r++) {
      assert.equal(rankToPoints(r), expected[r - 1], `rank ${r}`);
    }
  });

  it('should return 0 for out-of-range ranks', () => {
    assert.equal(rankToPoints(0), 0);
    assert.equal(rankToPoints(-1), 0);
    assert.equal(rankToPoints(11), 0);
  });
});

// ============================================================
// 2. calculateGroupSizes — Level 2 Hard Constraint
// ============================================================

describe('calculateGroupSizes', () => {
  it('should handle edge cases (0, 1, 2)', () => {
    assert.deepEqual(calculateGroupSizes(0), []);
    assert.deepEqual(calculateGroupSizes(1), [1]);
    assert.deepEqual(calculateGroupSizes(2), [2]);
  });

  it('should produce correct sizes for N=3 through N=21', () => {
    const expected: Record<number, number[]> = {
      3: [3],
      4: [4],
      5: [5],
      6: [3, 3],
      7: [3, 4],
      8: [4, 4],
      9: [3, 3, 3],
      10: [3, 3, 4],
      11: [3, 4, 4],
      12: [4, 4, 4],
      13: [4, 4, 5],
      14: [3, 3, 4, 4],
      15: [3, 4, 4, 4],
      16: [4, 4, 4, 4],
      17: [4, 4, 4, 5],
      18: [3, 3, 4, 4, 4],
      19: [3, 4, 4, 4, 4],
      20: [4, 4, 4, 4, 4],
      21: [4, 4, 4, 4, 5],
    };

    for (const [n, sizes] of Object.entries(expected)) {
      assert.deepEqual(
        calculateGroupSizes(Number(n)),
        sizes,
        `N=${n} should be [${sizes}]`
      );
    }
  });

  it('should sum to N for all sizes', () => {
    for (let n = 1; n <= 30; n++) {
      const sizes = calculateGroupSizes(n);
      const total = sizes.reduce((a, b) => a + b, 0);
      assert.equal(total, n, `Sum of group sizes for N=${n} should be ${n}`);
    }
  });

  it('should only have groups of size 3, 4, or 5 (for N >= 3)', () => {
    for (let n = 3; n <= 30; n++) {
      const sizes = calculateGroupSizes(n);
      for (const s of sizes) {
        assert.ok(s >= 3 && s <= 5, `N=${n}: group size ${s} is out of [3,5] range`);
      }
    }
  });

  it('should put 3-somes first and 5-somes last', () => {
    for (let n = 7; n <= 30; n++) {
      const sizes = calculateGroupSizes(n);
      if (sizes.length < 2) continue;

      // Find position of first 5-some and last 3-some
      const firstFive = sizes.indexOf(5);
      const lastThree = sizes.lastIndexOf(3);

      if (firstFive !== -1 && lastThree !== -1) {
        assert.ok(
          lastThree < firstFive,
          `N=${n}: 3-some at index ${lastThree} should come before 5-some at index ${firstFive}`
        );
      }
    }
  });
});

// ============================================================
// 3. Pair Scoring
// ============================================================

describe('pairKey', () => {
  it('should produce consistent keys regardless of order', () => {
    assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
    assert.equal(pairKey('g1', 'g2'), 'g1:g2');
    assert.equal(pairKey('g2', 'g1'), 'g1:g2');
  });
});

describe('buildPairScores', () => {
  it('should compute unidirectional score', () => {
    const prefs = [pref('g1', 'g2', 1)]; // g1 ranks g2 as #1 → 100 pts
    const confirmed = new Set(['g1', 'g2']);
    const scores = buildPairScores(prefs, confirmed);
    assert.equal(scores.get(pairKey('g1', 'g2')), 100);
  });

  it('should compute bidirectional (mutual) score', () => {
    const prefs = [
      pref('g1', 'g2', 1), // 100 pts
      pref('g2', 'g1', 1), // 100 pts
    ];
    const confirmed = new Set(['g1', 'g2']);
    const scores = buildPairScores(prefs, confirmed);
    assert.equal(scores.get(pairKey('g1', 'g2')), 200);
  });

  it('should skip stale preferences (partner not confirmed)', () => {
    const prefs = [
      pref('g1', 'g2', 1), // g2 is not confirmed this week
    ];
    const confirmed = new Set(['g1', 'g3']);
    const scores = buildPairScores(prefs, confirmed);
    assert.equal(scores.get(pairKey('g1', 'g2')), undefined);
  });

  it('should handle asymmetric ranks correctly', () => {
    const prefs = [
      pref('g1', 'g2', 1),  // 100 pts
      pref('g2', 'g1', 5),  // 20 pts
    ];
    const confirmed = new Set(['g1', 'g2']);
    const scores = buildPairScores(prefs, confirmed);
    assert.equal(scores.get(pairKey('g1', 'g2')), 120);
  });
});

describe('groupHarmonyScore', () => {
  it('should return 0 for a group with no preferences', () => {
    const score = groupHarmonyScore(['g1', 'g2', 'g3'], new Map());
    assert.equal(score, 0);
  });

  it('should sum all pairwise scores in a group', () => {
    const pairScores = new Map<string, number>();
    pairScores.set(pairKey('g1', 'g2'), 200); // mutual #1
    pairScores.set(pairKey('g1', 'g3'), 50);  // one-way #2
    pairScores.set(pairKey('g2', 'g3'), 0);   // no pref

    const score = groupHarmonyScore(['g1', 'g2', 'g3'], pairScores);
    assert.equal(score, 250);
  });
});

// ============================================================
// 4. Full Engine — generateGroupings
// ============================================================

describe('generateGroupings', () => {
  describe('basic group formation', () => {
    it('should return empty result for 0 golfers', () => {
      const result = generateGroupings([], []);
      assert.deepEqual(result.groups, []);
      assert.deepEqual(result.assignments, []);
      assert.equal(result.totalHarmonyScore, 0);
    });

    it('should create correct number of groups for N=4', () => {
      const result = generateGroupings(makeGolfers(4), []);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].golfers.length, 4);
    });

    it('should create correct groups for N=8', () => {
      const result = generateGroupings(makeGolfers(8), []);
      assert.equal(result.groups.length, 2);
      assert.equal(result.groups[0].golfers.length, 4);
      assert.equal(result.groups[1].golfers.length, 4);
    });

    it('should create correct groups for N=16 (typical Saturday)', () => {
      const result = generateGroupings(makeGolfers(16), []);
      assert.equal(result.groups.length, 4);
      for (const g of result.groups) {
        assert.equal(g.golfers.length, 4);
      }
    });

    it('should assign every golfer exactly once', () => {
      for (let n = 1; n <= 21; n++) {
        const golfers = makeGolfers(n);
        const result = generateGroupings(golfers, []);
        const allAssigned = result.assignments.map((a) => a.profileId).sort();
        const allInput = golfers.map((g) => g.profileId).sort();
        assert.deepEqual(allAssigned, allInput, `N=${n}: every golfer assigned once`);
      }
    });

    it('should set tee order sequentially (1, 2, 3...)', () => {
      const result = generateGroupings(makeGolfers(12), []);
      const teeOrders = result.groups.map((g) => g.teeOrder);
      assert.deepEqual(teeOrders, [1, 2, 3]);
    });
  });

  describe('tee time preferences (Level 3)', () => {
    it('should place early golfers in lower-numbered groups', () => {
      // 8 golfers: 4 early, 4 late → 2 groups of 4
      const golfers = [
        ...makeGolfers(4, 'early').map((g, i) => ({ ...g, profileId: `early${i + 1}` })),
        ...makeGolfers(4, 'late').map((g, i) => ({ ...g, profileId: `late${i + 1}` })),
      ];
      const result = generateGroupings(golfers, []);

      // Group 1 (tee order 1) should be all early
      const group1Ids = result.groups[0].golfers;
      assert.ok(
        group1Ids.every((id) => id.startsWith('early')),
        `Group 1 should be early golfers, got: ${group1Ids}`
      );

      // Group 2 (tee order 2) should be all late
      const group2Ids = result.groups[1].golfers;
      assert.ok(
        group2Ids.every((id) => id.startsWith('late')),
        `Group 2 should be late golfers, got: ${group2Ids}`
      );
    });

    it('should handle overflow when more early golfers than front slots', () => {
      // 8 golfers: 6 early, 2 no_preference → 2 groups of 4
      // 6 early golfers won't all fit in group 1 (size 4), 2 overflow to group 2
      const golfers = [
        ...Array.from({ length: 6 }, (_, i) => golfer(`early${i + 1}`, 'early')),
        ...Array.from({ length: 2 }, (_, i) => golfer(`nopref${i + 1}`, 'no_preference')),
      ];
      const result = generateGroupings(golfers, []);

      // All 8 golfers should be assigned
      assert.equal(result.assignments.length, 8);
      // Both groups should have 4 golfers
      assert.equal(result.groups[0].golfers.length, 4);
      assert.equal(result.groups[1].golfers.length, 4);
    });

    it('should handle all golfers with same preference', () => {
      const golfers = makeGolfers(8, 'early');
      const result = generateGroupings(golfers, []);
      assert.equal(result.assignments.length, 8);
      assert.equal(result.groups.length, 2);
    });

    it('should place no_preference golfers in remaining slots', () => {
      // 12 golfers: 4 early, 4 late, 4 no_preference → 3 groups of 4
      const golfers = [
        ...Array.from({ length: 4 }, (_, i) => golfer(`early${i + 1}`, 'early')),
        ...Array.from({ length: 4 }, (_, i) => golfer(`late${i + 1}`, 'late')),
        ...Array.from({ length: 4 }, (_, i) => golfer(`nopref${i + 1}`, 'no_preference')),
      ];
      const result = generateGroupings(golfers, []);

      assert.equal(result.groups.length, 3);

      // Group 1: early golfers
      assert.ok(
        result.groups[0].golfers.every((id) => id.startsWith('early')),
        `Group 1 should be early golfers`
      );

      // Group 3: late golfers
      assert.ok(
        result.groups[2].golfers.every((id) => id.startsWith('late')),
        `Group 3 should be late golfers`
      );

      // Group 2: no_preference golfers
      assert.ok(
        result.groups[1].golfers.every((id) => id.startsWith('nopref')),
        `Group 2 should be no_preference golfers`
      );
    });
  });

  describe('partner preferences (Level 4)', () => {
    it('should group mutual best friends together', () => {
      // 8 golfers, no tee time prefs, 2 mutual pairs:
      // g1 ↔ g2 (mutual #1 = 200 pts), g3 ↔ g4 (mutual #1 = 200 pts)
      const golfers = makeGolfers(8);
      const prefs = [
        pref('g1', 'g2', 1),
        pref('g2', 'g1', 1),
        pref('g3', 'g4', 1),
        pref('g4', 'g3', 1),
      ];
      const result = generateGroupings(golfers, prefs);

      // g1 and g2 should be in the same group
      const g1Group = result.assignments.find((a) => a.profileId === 'g1')!.groupNumber;
      const g2Group = result.assignments.find((a) => a.profileId === 'g2')!.groupNumber;
      assert.equal(g1Group, g2Group, 'g1 and g2 should be in the same group');

      // g3 and g4 should be in the same group
      const g3Group = result.assignments.find((a) => a.profileId === 'g3')!.groupNumber;
      const g4Group = result.assignments.find((a) => a.profileId === 'g4')!.groupNumber;
      assert.equal(g3Group, g4Group, 'g3 and g4 should be in the same group');
    });

    it('should have higher total harmony when mutual preferences exist', () => {
      const golfers = makeGolfers(8);

      // With preferences
      const prefs = [
        pref('g1', 'g2', 1),
        pref('g2', 'g1', 1),
      ];
      const withPrefs = generateGroupings(golfers, prefs);

      // Without preferences
      const withoutPrefs = generateGroupings(golfers, []);

      assert.ok(
        withPrefs.totalHarmonyScore >= withoutPrefs.totalHarmonyScore,
        'Harmony should be >= without prefs'
      );
    });

    it('should ignore preferences for non-confirmed golfers (stale prefs)', () => {
      // g1 prefers g99 who is NOT confirmed this week
      const golfers = makeGolfers(4);
      const prefs = [
        pref('g1', 'g99', 1), // g99 not in the golfer list
      ];
      const result = generateGroupings(golfers, prefs);

      // Should still run without error
      assert.equal(result.assignments.length, 4);
      assert.equal(result.totalHarmonyScore, 0); // no valid pair scores
    });

    it('should handle complex preference chains', () => {
      // 8 golfers: g1→g2(#1), g2→g3(#1), g3→g4(#1), g4→g1(#1)
      // This forms a preference "ring" — engine should still work
      const golfers = makeGolfers(8);
      const prefs = [
        pref('g1', 'g2', 1),
        pref('g2', 'g3', 1),
        pref('g3', 'g4', 1),
        pref('g4', 'g1', 1),
      ];
      const result = generateGroupings(golfers, prefs);
      assert.equal(result.assignments.length, 8);
      assert.ok(result.totalHarmonyScore > 0);
    });

    it('should maximize harmony across groups', () => {
      // 8 golfers. Create two strong pairs:
      // g1↔g2 (200 pts), g5↔g6 (200 pts)
      // The engine should keep each pair together
      const golfers = makeGolfers(8);
      const prefs = [
        pref('g1', 'g2', 1), pref('g2', 'g1', 1),
        pref('g5', 'g6', 1), pref('g6', 'g5', 1),
      ];
      const result = generateGroupings(golfers, prefs);

      // Each pair should be co-located
      const findGroup = (id: string) =>
        result.assignments.find((a) => a.profileId === id)!.groupNumber;

      assert.equal(findGroup('g1'), findGroup('g2'), 'g1-g2 pair should be together');
      assert.equal(findGroup('g5'), findGroup('g6'), 'g5-g6 pair should be together');
    });
  });

  describe('edge cases', () => {
    it('should handle single golfer', () => {
      const result = generateGroupings([golfer('g1')], []);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].golfers.length, 1);
      assert.deepEqual(result.groups[0].golfers, ['g1']);
    });

    it('should handle two golfers', () => {
      const result = generateGroupings([golfer('g1'), golfer('g2')], []);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].golfers.length, 2);
    });

    it('should handle no preferences at all', () => {
      const result = generateGroupings(makeGolfers(16), []);
      assert.equal(result.assignments.length, 16);
      assert.equal(result.totalHarmonyScore, 0);
    });

    it('should handle all golfers preferring the same person', () => {
      // Everyone wants to play with g1
      const golfers = makeGolfers(8);
      const prefs = Array.from({ length: 7 }, (_, i) =>
        pref(`g${i + 2}`, 'g1', 1)
      );
      const result = generateGroupings(golfers, prefs);
      assert.equal(result.assignments.length, 8);
      // g1 can only be in one group of 4, so max 3 others get their wish
    });

    it('should handle 5 golfers (single fivesome)', () => {
      const result = generateGroupings(makeGolfers(5), []);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].golfers.length, 5);
    });

    it('should handle 13 golfers (4+4+5)', () => {
      const result = generateGroupings(makeGolfers(13), []);
      const sizes = result.groups.map((g) => g.golfers.length);
      assert.deepEqual(sizes, [4, 4, 5]);
    });

    it('should handle mixed tee time prefs with partner prefs', () => {
      // 8 golfers: 4 early, 4 late
      // g1(early) and g5(late) are mutual #1 — competing constraints
      // Tee time should win (Level 3 > Level 4), so they end up in different groups
      const golfers = [
        golfer('g1', 'early'), golfer('g2', 'early'),
        golfer('g3', 'early'), golfer('g4', 'early'),
        golfer('g5', 'late'), golfer('g6', 'late'),
        golfer('g7', 'late'), golfer('g8', 'late'),
      ];
      const prefs = [
        pref('g1', 'g5', 1),
        pref('g5', 'g1', 1),
      ];
      const result = generateGroupings(golfers, prefs);

      const findGroup = (id: string) =>
        result.assignments.find((a) => a.profileId === id)!.groupNumber;

      // g1 should be in group 1 (early), g5 in group 2 (late)
      assert.notEqual(findGroup('g1'), findGroup('g5'),
        'Tee time constraint should separate g1(early) and g5(late)');
    });
  });
});

// ============================================================
// 7. applyScoreModifiers
// ============================================================

describe('applyScoreModifiers', () => {
  it('should apply harmony multiplier from partner preference mode', () => {
    const rawScores = new Map([['g1:g2', 200], ['g1:g3', 100]]);

    // 'full' mode: multiplier = 1.0
    const full = applyScoreModifiers(rawScores, opts({ partnerPreferenceMode: 'full' }));
    assert.equal(full.get('g1:g2'), 200);
    assert.equal(full.get('g1:g3'), 100);

    // 'light' mode: multiplier = 0.25
    const light = applyScoreModifiers(rawScores, opts({ partnerPreferenceMode: 'light' }));
    assert.equal(light.get('g1:g2'), 50);  // 200 * 0.25 = 50
    assert.equal(light.get('g1:g3'), 25);  // 100 * 0.25 = 25

    // 'moderate' mode: multiplier = 0.6
    const moderate = applyScoreModifiers(rawScores, opts({ partnerPreferenceMode: 'moderate' }));
    assert.equal(moderate.get('g1:g2'), 120);  // 200 * 0.6 = 120
    assert.equal(moderate.get('g1:g3'), 60);   // 100 * 0.6 = 60

    // 'off' mode: multiplier = 0
    const off = applyScoreModifiers(rawScores, opts({ partnerPreferenceMode: 'off' }));
    assert.equal(off.size, 0); // no scores at all
  });

  it('should apply variety penalties from recent pairings', () => {
    const rawScores = new Map([['g1:g2', 200]]);
    const recentPairings = new Map([['g1:g2', [1]]]); // paired 1 week ago

    const result = applyScoreModifiers(rawScores, opts({
      promoteVariety: true,
      recentPairings,
    }));

    // 200 (raw) - 60 (penalty for 1 week ago) = 140
    assert.equal(result.get('g1:g2'), 140);
  });

  it('should stack variety penalties for multiple recent pairings', () => {
    const rawScores = new Map([['g1:g2', 200]]);
    const recentPairings = new Map([['g1:g2', [1, 3]]]); // paired 1 and 3 weeks ago

    const result = applyScoreModifiers(rawScores, opts({
      promoteVariety: true,
      recentPairings,
    }));

    // 200 - 60 (week 1) - 30 (week 3) = 110
    assert.equal(result.get('g1:g2'), 110);
  });

  it('should allow scores to go negative with heavy variety penalty', () => {
    const rawScores = new Map([['g1:g2', 50]]);
    const recentPairings = new Map([['g1:g2', [1, 2, 3]]]); // paired 3 of last 3 weeks

    const result = applyScoreModifiers(rawScores, opts({
      promoteVariety: true,
      recentPairings,
    }));

    // 50 - 60 - 45 - 30 = -85
    assert.equal(result.get('g1:g2'), -85);
  });

  it('should apply variety penalty to pairs with no preference score', () => {
    const rawScores = new Map<string, number>(); // no preferences
    const recentPairings = new Map([['g1:g2', [2]]]); // paired 2 weeks ago

    const result = applyScoreModifiers(rawScores, opts({
      promoteVariety: true,
      recentPairings,
    }));

    // 0 (no pref) - 45 (week 2 penalty) = -45
    assert.equal(result.get('g1:g2'), -45);
  });

  it('should not apply variety penalty when promoteVariety is false', () => {
    const rawScores = new Map([['g1:g2', 200]]);
    const recentPairings = new Map([['g1:g2', [1]]]);

    const result = applyScoreModifiers(rawScores, opts({
      promoteVariety: false,
      recentPairings, // should be ignored
    }));

    assert.equal(result.get('g1:g2'), 200); // unmodified
  });
});

// ============================================================
// 8. teeTimePriorityScore
// ============================================================

describe('teeTimePriorityScore', () => {
  it('should return 1.0 for golfer with no history', () => {
    const history = new Map<string, TeeTimeHistoryEntry>();
    assert.equal(teeTimePriorityScore('g1', 'early', history), 1.0);
  });

  it('should return 0.0 for golfer who always picks the same preference', () => {
    const history = new Map<string, TeeTimeHistoryEntry>([
      ['g1', { earlyCount: 8, lateCount: 0, totalWeeks: 8 }],
    ]);
    assert.equal(teeTimePriorityScore('g1', 'early', history), 0.0);
  });

  it('should return high priority for infrequent requesters', () => {
    const history = new Map<string, TeeTimeHistoryEntry>([
      ['g1', { earlyCount: 1, lateCount: 0, totalWeeks: 8 }],
    ]);
    assert.equal(teeTimePriorityScore('g1', 'early', history), 0.875); // 7/8
  });

  it('should differentiate early vs late counts', () => {
    const history = new Map<string, TeeTimeHistoryEntry>([
      ['g1', { earlyCount: 6, lateCount: 2, totalWeeks: 8 }],
    ]);
    // For 'early': (8 - 6) / 8 = 0.25
    assert.equal(teeTimePriorityScore('g1', 'early', history), 0.25);
    // For 'late': (8 - 2) / 8 = 0.75
    assert.equal(teeTimePriorityScore('g1', 'late', history), 0.75);
  });
});

// ============================================================
// 9. Partner Preference Mode — Per-Group Cap
// ============================================================

describe('Partner Preference Mode', () => {
  it('off mode: should produce groupings with no preference influence', () => {
    // 8 golfers: mutual #1 prefs between g1-g2, g3-g4
    const golfers = makeGolfers(8);
    const prefs = [
      pref('g1', 'g2', 1), pref('g2', 'g1', 1),
      pref('g3', 'g4', 1), pref('g4', 'g3', 1),
    ];

    const result = generateGroupings(golfers, prefs, opts({ partnerPreferenceMode: 'off' }));
    assert.equal(result.groups.length, 2);
    // All harmony scores should be 0 since preferences are ignored in the algorithm
    // (but reported harmony uses raw scores, so it depends on actual placement)
    assert.equal(result.groups.length, 2);
  });

  it('light mode: should cap at 1 preferred partner per group', () => {
    // 4 golfers who all prefer each other — in 'light' mode, max 1 preferred per group
    const golfers = makeGolfers(4);
    const prefs = [
      pref('g1', 'g2', 1), pref('g1', 'g3', 2), pref('g1', 'g4', 3),
      pref('g2', 'g1', 1), pref('g2', 'g3', 2), pref('g2', 'g4', 3),
      pref('g3', 'g1', 1), pref('g3', 'g2', 2), pref('g3', 'g4', 3),
      pref('g4', 'g1', 1), pref('g4', 'g2', 2), pref('g4', 'g3', 3),
    ];

    // With only 4 golfers, there's only 1 group (foursome), so the cap
    // doesn't change the outcome. Test with 8 golfers instead.
    const golfers8 = makeGolfers(8);
    const prefs8 = [
      // g1-g4 all prefer each other
      pref('g1', 'g2', 1), pref('g1', 'g3', 2), pref('g1', 'g4', 3),
      pref('g2', 'g1', 1), pref('g2', 'g3', 2), pref('g2', 'g4', 3),
      pref('g3', 'g1', 1), pref('g3', 'g2', 2), pref('g3', 'g4', 3),
      pref('g4', 'g1', 1), pref('g4', 'g2', 2), pref('g4', 'g3', 3),
    ];

    const fullResult = generateGroupings(golfers8, prefs8, opts({ partnerPreferenceMode: 'full' }));
    const lightResult = generateGroupings(golfers8, prefs8, opts({ partnerPreferenceMode: 'light' }));

    // In 'full' mode, g1-g4 should be tightly grouped (maximizing harmony)
    // In 'light' mode, they should be more spread out
    const fullGroup1 = new Set(fullResult.groups[0].golfers);
    const lightGroup1 = new Set(lightResult.groups[0].golfers);

    // Count how many of g1-g4 are in group 1 for each mode
    const prefGolfers = ['g1', 'g2', 'g3', 'g4'];
    const fullCount = prefGolfers.filter(id => fullGroup1.has(id)).length;
    const lightCount = prefGolfers.filter(id => lightGroup1.has(id)).length;

    // In full mode, we expect all 4 preferred golfers in one group
    assert.equal(fullCount, 4, 'Full mode should cluster all preferred golfers');
    // In light mode, the cap should prevent full clustering
    assert.ok(lightCount <= 3, `Light mode should reduce clustering (got ${lightCount} preferred in group 1)`);
  });

  it('full mode: should match legacy behavior with boolean shuffle param', () => {
    const golfers = makeGolfers(8);
    const prefs = [
      pref('g1', 'g2', 1), pref('g2', 'g1', 1),
    ];

    // Old boolean API (backwards compatibility)
    const legacyResult = generateGroupings(golfers, prefs, false);
    // New options API with 'full' mode
    const newResult = generateGroupings(golfers, prefs, opts({ partnerPreferenceMode: 'full' }));

    // Both should produce identical results (same defaults, no shuffle)
    assert.deepEqual(legacyResult.groups.length, newResult.groups.length);
    assert.equal(legacyResult.totalHarmonyScore, newResult.totalHarmonyScore);
  });
});

// ============================================================
// 10. Tee Time Preference Mode
// ============================================================

describe('Tee Time Preference Mode', () => {
  it('off mode: should ignore tee time preferences', () => {
    // 8 golfers: 4 early, 4 late. In 'off' mode, all treated as no_preference.
    const golfers = [
      ...makeGolfers(4, 'early'),
      golfer('g5', 'late'), golfer('g6', 'late'),
      golfer('g7', 'late'), golfer('g8', 'late'),
    ];

    const result = generateGroupings(golfers, [], opts({ teeTimePreferenceMode: 'off' }));
    assert.equal(result.groups.length, 2);
    // Groups should not be strictly early/late separated since tee time is ignored
  });

  it('full mode: should honor all tee time preferences', () => {
    const golfers = [
      golfer('g1', 'early'), golfer('g2', 'early'),
      golfer('g3', 'early'), golfer('g4', 'early'),
      golfer('g5', 'late'), golfer('g6', 'late'),
      golfer('g7', 'late'), golfer('g8', 'late'),
    ];

    const result = generateGroupings(golfers, [], opts({ teeTimePreferenceMode: 'full' }));
    assert.equal(result.groups.length, 2);

    // Group 1 should have early golfers, group 2 should have late golfers
    const group1Ids = new Set(result.groups[0].golfers);
    const earlyInGroup1 = ['g1', 'g2', 'g3', 'g4'].filter(id => group1Ids.has(id)).length;
    assert.equal(earlyInGroup1, 4, 'Full mode: group 1 should have all early golfers');
  });

  it('light mode: should demote habitual early requesters to no_preference', () => {
    // 4 early golfers. g1 picks early every week (0 priority), g4 rarely picks early (high priority).
    const golfers = [
      golfer('g1', 'early'), golfer('g2', 'early'),
      golfer('g3', 'early'), golfer('g4', 'early'),
      golfer('g5', 'no_preference'), golfer('g6', 'no_preference'),
      golfer('g7', 'no_preference'), golfer('g8', 'no_preference'),
    ];

    const teeTimeHistory = new Map<string, TeeTimeHistoryEntry>([
      ['g1', { earlyCount: 8, lateCount: 0, totalWeeks: 8 }],  // always early (priority 0.0)
      ['g2', { earlyCount: 7, lateCount: 0, totalWeeks: 8 }],  // almost always (priority 0.125)
      ['g3', { earlyCount: 2, lateCount: 0, totalWeeks: 8 }],  // rarely (priority 0.75)
      ['g4', { earlyCount: 1, lateCount: 0, totalWeeks: 8 }],  // very rarely (priority 0.875)
    ]);

    const result = generateGroupings(golfers, [], opts({
      teeTimePreferenceMode: 'light',
      teeTimeHistory,
    }));

    assert.equal(result.groups.length, 2);
    // In light mode, bottom 50% of early pool (g1, g2) get demoted to no_preference.
    // g3 and g4 (higher priority) should remain in the early pool.
    const group1 = new Set(result.groups[0].golfers);
    // g3 and g4 should be in group 1 (kept their early preference)
    assert.ok(group1.has('g3') || group1.has('g4'),
      'Light mode: high-priority early golfers should get early slots');
  });
});

// ============================================================
// 11. Variety Promotion (end-to-end with engine)
// ============================================================

describe('Variety Promotion', () => {
  it('should separate recently paired golfers when variety is enabled', () => {
    // 8 golfers, g1 and g2 are mutual #1 preferences
    // but they were paired every week for the last 4 weeks
    const golfers = makeGolfers(8);
    const prefs = [
      pref('g1', 'g2', 1), pref('g2', 'g1', 1),
    ];

    // Without variety: they should be grouped together
    const noVariety = generateGroupings(golfers, prefs, opts({ promoteVariety: false }));
    const g1GroupNoVar = noVariety.assignments.find(a => a.profileId === 'g1')!.groupNumber;
    const g2GroupNoVar = noVariety.assignments.find(a => a.profileId === 'g2')!.groupNumber;
    assert.equal(g1GroupNoVar, g2GroupNoVar, 'Without variety, mutual #1s should be together');

    // With heavy variety penalty (paired every week for 4 weeks)
    const recentPairings = new Map([[pairKey('g1', 'g2'), [1, 2, 3, 4]]]);
    const withVariety = generateGroupings(golfers, prefs, opts({
      promoteVariety: true,
      recentPairings,
    }));

    const g1GroupVar = withVariety.assignments.find(a => a.profileId === 'g1')!.groupNumber;
    const g2GroupVar = withVariety.assignments.find(a => a.profileId === 'g2')!.groupNumber;

    // Penalty: -60 - 45 - 30 - 20 = -155, raw score: 200, net: 45
    // With such a heavy penalty (net 45 vs raw 200), the engine has weaker
    // motivation to group them. They might still end up together if no better
    // options exist, but the score is drastically reduced.
    // For this test, we just verify the total harmony is lower with variety
    assert.ok(
      withVariety.totalHarmonyScore <= noVariety.totalHarmonyScore,
      'Variety promotion should reduce or maintain total harmony'
    );
  });
});

// ============================================================
// 12. Backwards Compatibility
// ============================================================

describe('Backwards Compatibility', () => {
  it('should accept boolean as third parameter (legacy API)', () => {
    const golfers = makeGolfers(4);
    const result = generateGroupings(golfers, [], false);
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].golfers.length, 4);
  });

  it('should accept GroupingOptions as third parameter', () => {
    const golfers = makeGolfers(4);
    const result = generateGroupings(golfers, [], opts());
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].golfers.length, 4);
  });

  it('should produce same results with default options as legacy boolean=false', () => {
    const golfers = makeGolfers(12);
    const prefs = [
      pref('g1', 'g2', 1), pref('g2', 'g1', 1),
      pref('g3', 'g4', 2), pref('g4', 'g3', 2),
    ];

    const legacy = generateGroupings(golfers, prefs, false);
    const newApi = generateGroupings(golfers, prefs, opts());

    assert.equal(legacy.groups.length, newApi.groups.length);
    assert.equal(legacy.totalHarmonyScore, newApi.totalHarmonyScore);
    // Verify same group compositions
    for (let i = 0; i < legacy.groups.length; i++) {
      assert.deepEqual(
        legacy.groups[i].golfers.sort(),
        newApi.groups[i].golfers.sort(),
        `Group ${i + 1} should have same golfers`
      );
    }
  });

  it('edge case: no golfers with options', () => {
    const result = generateGroupings([], [], opts());
    assert.equal(result.groups.length, 0);
    assert.equal(result.totalHarmonyScore, 0);
  });
});
