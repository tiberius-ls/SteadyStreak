import { describe, expect, it } from "vitest";
import { calculatePayout, forfeitedStakeLuna } from "./payout";
import type { Checkin, Cycle } from "./types";

function makeCycle(
  status: Cycle["status"],
  length: Cycle["length"] = 30
): Cycle {
  return {
    id: "c1",
    userId: "u1",
    walletAddress: "NQ01 USER",
    habit: "Meditate",
    length,
    startDate: "2026-07-01",
    dailySaveLuna: 100_000,
    dailyStakeLuna: 50_000,
    status,
    poolId: `${length}d:2026-07-01`,
    timezone: "UTC",
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function days(n: number, save = 100_000, stake = 50_000): Checkin[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ch-${i + 1}`,
    userId: "u1",
    cycleId: "c1",
    dayNumber: i + 1,
    txHash: `h${i + 1}`,
    timestamp: "2026-07-01T12:00:00.000Z",
    saveLuna: save,
    stakeLuna: stake,
  }));
}

describe("calculatePayout", () => {
  it("returns savings only when streak is broken", () => {
    const checkins = days(5);
    const result = calculatePayout({
      cycle: makeCycle("broken"),
      checkins,
      totalForfeitedLuna: 1_000_000,
      survivors: [],
    });

    expect(result.broken).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.savingsPrincipalLuna).toBe(5 * 100_000);
    expect(result.ownStakeLuna).toBe(0);
    expect(result.bonusFromPoolLuna).toBe(0);
    expect(result.totalLuna).toBe(5 * 100_000);
  });

  it("returns savings + stake + weighted bonus for a sole survivor", () => {
    const length = 3 as const;
    const checkins = days(length);
    const c = makeCycle("completed", length);
    const result = calculatePayout({
      cycle: c,
      checkins,
      totalForfeitedLuna: 300_000,
      survivors: [{ cycle: c, checkins }],
    });

    expect(result.completed).toBe(true);
    expect(result.broken).toBe(false);
    expect(result.savingsPrincipalLuna).toBe(3 * 100_000);
    expect(result.ownStakeLuna).toBe(3 * 50_000);
    // Sole survivor takes the whole forfeited pool
    expect(result.bonusFromPoolLuna).toBe(300_000);
    expect(result.totalLuna).toBe(3 * 100_000 + 3 * 50_000 + 300_000);
    expect(result.multiplier).toBe(3);
  });

  it("splits forfeited pool by stake * multiplier weights", () => {
    const length = 2 as const;
    const aCheckins = days(length, 100_000, 100_000); // stake total 200k
    const bCheckins = days(length, 100_000, 50_000); // stake total 100k
    const a = { ...makeCycle("completed", length), id: "a", walletAddress: "A" };
    const b = { ...makeCycle("completed", length), id: "b", walletAddress: "B" };

    const totalForfeited = 300_000;
    const resultA = calculatePayout({
      cycle: a,
      checkins: aCheckins,
      totalForfeitedLuna: totalForfeited,
      survivors: [
        { cycle: a, checkins: aCheckins },
        { cycle: b, checkins: bCheckins },
      ],
    });

    // Both full cycle → mult 3; weights 200k*3 : 100k*3 = 2:1
    expect(resultA.bonusFromPoolLuna).toBe(200_000);
    expect(resultA.ownStakeLuna).toBe(200_000);
  });
});

describe("forfeitedStakeLuna", () => {
  it("sums stake portion of check-ins", () => {
    expect(forfeitedStakeLuna(days(4, 10, 25_000))).toBe(100_000);
  });
});
