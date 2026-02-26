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
} from './grouping-engine';
import type {
  GroupingGolfer,
  PartnerPreference,
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
      assert.equal(result.groups[0].members.length, 4);
    });

    it('should create correct groups for N=8', () => {
      const result = generateGroupings(makeGolfers(8), []);
      assert.equal(result.groups.length, 2);
      assert.equal(result.groups[0].members.length, 4);
      assert.equal(result.groups[1].members.length, 4);
    });

    it('should create correct groups for N=16 (typical Saturday)', () => {
      const result = generateGroupings(makeGolfers(16), []);
      assert.equal(result.groups.length, 4);
      for (const g of result.groups) {
        assert.equal(g.members.length, 4);
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
      const group1Ids = result.groups[0].members;
      assert.ok(
        group1Ids.every((id) => id.startsWith('early')),
        `Group 1 should be early golfers, got: ${group1Ids}`
      );

      // Group 2 (tee order 2) should be all late
      const group2Ids = result.groups[1].members;
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
      // Both groups should have 4 members
      assert.equal(result.groups[0].members.length, 4);
      assert.equal(result.groups[1].members.length, 4);
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
        result.groups[0].members.every((id) => id.startsWith('early')),
        `Group 1 should be early golfers`
      );

      // Group 3: late golfers
      assert.ok(
        result.groups[2].members.every((id) => id.startsWith('late')),
        `Group 3 should be late golfers`
      );

      // Group 2: no_preference golfers
      assert.ok(
        result.groups[1].members.every((id) => id.startsWith('nopref')),
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
      assert.equal(result.groups[0].members.length, 1);
      assert.deepEqual(result.groups[0].members, ['g1']);
    });

    it('should handle two golfers', () => {
      const result = generateGroupings([golfer('g1'), golfer('g2')], []);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].members.length, 2);
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
      assert.equal(result.groups[0].members.length, 5);
    });

    it('should handle 13 golfers (4+4+5)', () => {
      const result = generateGroupings(makeGolfers(13), []);
      const sizes = result.groups.map((g) => g.members.length);
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
