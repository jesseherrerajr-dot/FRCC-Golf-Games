/**
 * Unit tests for schedule generation date math.
 *
 * Run with: npx tsx --test src/lib/schedule-gen.test.ts
 * (Uses Node.js built-in test runner — no Vitest/Jest needed)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateEventEndDate, generateGameDates } from "./schedule-gen";
import type { Event } from "@/types/events";

function makeEvent(overrides: Partial<Event>): Event {
  return {
    duration_mode: "indefinite",
    start_date: null,
    duration_weeks: null,
    end_date: null,
    day_of_week: 4,
    frequency: "weekly",
    ...overrides,
  } as Event;
}

describe("calculateEventEndDate", () => {
  it("returns null for indefinite events", () => {
    assert.equal(calculateEventEndDate(makeEvent({ duration_mode: "indefinite" })), null);
  });

  it("returns the stored end_date for end_date mode", () => {
    const e = makeEvent({ duration_mode: "end_date", end_date: "2026-07-09" });
    assert.equal(calculateEventEndDate(e), "2026-07-09");
  });

  it("fixed_weeks: 10 weeks from May 7 ends on the 10th game (July 9, NOT July 16)", () => {
    const e = makeEvent({
      duration_mode: "fixed_weeks",
      start_date: "2026-05-07",
      duration_weeks: 10,
    });
    // Regression test for the off-by-one that sent an 11th invite (July 16).
    assert.equal(calculateEventEndDate(e), "2026-07-09");
  });

  it("fixed_weeks: a 1-week season ends on its start date", () => {
    const e = makeEvent({
      duration_mode: "fixed_weeks",
      start_date: "2026-05-07",
      duration_weeks: 1,
    });
    assert.equal(calculateEventEndDate(e), "2026-05-07");
  });

  it("fixed_weeks end date yields exactly duration_weeks game dates", () => {
    const e = makeEvent({
      duration_mode: "fixed_weeks",
      start_date: "2026-05-07",
      duration_weeks: 10,
    });
    const end = calculateEventEndDate(e)!;
    const dates = generateGameDates(4, "weekly", "2026-05-07", end);
    assert.equal(dates.length, 10);
    assert.equal(dates[0], "2026-05-07");
    assert.equal(dates[9], "2026-07-09");
    assert.ok(!dates.includes("2026-07-16"));
  });
});
