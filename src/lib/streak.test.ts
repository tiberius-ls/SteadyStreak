import { describe, expect, it } from "vitest";
import {
  dayNumberForDate,
  evaluateStreak,
  stakeMultiplier,
  tierForStreak,
} from "./streak";
import type { Checkin, Cycle } from "./types";

function cycle(partial: Partial<Cycle> & Pick<Cycle, "startDate" | "length">): Cycle {
  return {
    id: "c1",
    userId: "u1",
    walletAddress: "NQ01 TEST",
    habit: "Meditate",
    dailySaveLuna: 100_000,
    dailyStakeLuna: 50_000,
    status: "active",
    poolId: "30d:2026-07-01",
    timezone: "UTC",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...partial,
  };
}

function checkin(dayNumber: number, overrides: Partial<Checkin> = {}): Checkin {
  return {
    id: `ch-${dayNumber}`,
    userId: "u1",
    cycleId: "c1",
    dayNumber,
    txHash: `hash-${dayNumber}`,
    timestamp: "2026-07-01T12:00:00.000Z",
    saveLuna: 100_000,
    stakeLuna: 50_000,
    ...overrides,
  };
}

/** Local date at noon so dayNumber is stable. */
function noonOn(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

describe("dayNumberForDate", () => {
  it("maps start date to day 1", () => {
    const c = cycle({ startDate: "2026-07-01", length: 30 });
    expect(dayNumberForDate(c, noonOn("2026-07-01"))).toBe(1);
  });

  it("returns null before start and after end", () => {
    const c = cycle({ startDate: "2026-07-01", length: 30 });
    expect(dayNumberForDate(c, noonOn("2026-06-30"))).toBeNull();
    expect(dayNumberForDate(c, noonOn("2026-07-31"))).toBeNull();
  });
});

describe("evaluateStreak — break on missed day", () => {
  it("stays active when all prior days are checked in", () => {
    const c = cycle({ startDate: "2026-07-01", length: 30 });
    const checkins = [checkin(1), checkin(2)];
    const result = evaluateStreak(c, checkins, noonOn("2026-07-03"));
    expect(result.status).toBe("active");
    expect(result.currentStreak).toBe(2);
    expect(result.checkedInToday).toBe(false);
    expect(result.todayDayNumber).toBe(3);
  });

  it("breaks when a prior calendar day has no check-in", () => {
    const c = cycle({ startDate: "2026-07-01", length: 30 });
    // Day 1 only — skipped day 2; now day 3
    const result = evaluateStreak(c, [checkin(1)], noonOn("2026-07-03"));
    expect(result.status).toBe("broken");
    expect(result.missedDay).toBe(2);
    expect(result.brokenAtDay).toBe(2);
    expect(result.currentStreak).toBe(0);
  });

  it("completes when every day including last is checked in", () => {
    const c = cycle({ startDate: "2026-07-01", length: 3 });
    const checkins = [checkin(1), checkin(2), checkin(3)];
    const result = evaluateStreak(c, checkins, noonOn("2026-07-03"));
    expect(result.status).toBe("completed");
    expect(result.currentStreak).toBe(3);
    expect(result.checkedInToday).toBe(true);
  });

  it("breaks after cycle end if any day was missed", () => {
    const c = cycle({ startDate: "2026-07-01", length: 3 });
    // Missing day 2
    const result = evaluateStreak(c, [checkin(1), checkin(3)], noonOn("2026-07-05"));
    expect(result.status).toBe("broken");
    expect(result.missedDay).toBe(2);
  });
});

describe("stakeMultiplier", () => {
  it("is 0 at zero streak and 3 at full cycle", () => {
    expect(stakeMultiplier(0, 30)).toBe(0);
    expect(stakeMultiplier(30, 30)).toBe(3);
  });

  it("caps at 3", () => {
    expect(stakeMultiplier(90, 30)).toBe(3);
  });
});

describe("tierForStreak", () => {
  it("maps bronze / silver / gold thresholds", () => {
    expect(tierForStreak(0)).toBe("none");
    expect(tierForStreak(7)).toBe("bronze");
    expect(tierForStreak(21)).toBe("silver");
    expect(tierForStreak(45)).toBe("gold");
  });
});
