import { calculatePayout } from "./payout";
import {
  checkinsForCycle,
  getPastCycles,
  payoutForCycle,
} from "./store";
import type { AppState, Cycle, Payout, PayoutBreakdown } from "./types";

export type CycleHistoryEntry = {
  cycle: Cycle;
  checkinCount: number;
  payout: Payout | null;
  breakdown: PayoutBreakdown;
};

/**
 * Summaries for finished cycles, newest first.
 * Uses stored payout totals when claimed; otherwise local breakdown
 * (pool bonus may be 0 without live pool state).
 */
export function buildCycleHistory(state: AppState): CycleHistoryEntry[] {
  return getPastCycles(state).map((cycle) => {
    const checkins = checkinsForCycle(state, cycle.id);
    const payout = payoutForCycle(state, cycle.id);
    const breakdown = calculatePayout({
      cycle,
      checkins,
      totalForfeitedLuna: 0,
      survivors:
        cycle.status === "broken"
          ? []
          : [{ cycle, checkins }],
    });

    // Prefer recorded claim amounts when present
    if (payout) {
      const totalContributedLuna = checkins.reduce(
        (s, c) => s + c.saveLuna + c.stakeLuna,
        0
      );
      const netProfitLuna = payout.totalLuna - totalContributedLuna;
      const cycleDays = Math.max(1, checkins.length || cycle.length);
      const effectiveReturnPct =
        totalContributedLuna > 0
          ? (netProfitLuna / totalContributedLuna) * 100
          : 0;
      return {
        cycle,
        checkinCount: checkins.length,
        payout,
        breakdown: {
          ...breakdown,
          savingsPrincipalLuna: payout.savingsPrincipalLuna,
          ownStakeLuna: payout.stakeReturnedLuna,
          bonusFromPoolLuna: payout.bonusFromPoolLuna,
          totalLuna: payout.totalLuna,
          multiplier: payout.multiplier,
          totalContributedLuna,
          netProfitLuna,
          effectiveReturnPct,
          illustrativeAprPct: effectiveReturnPct * (365 / cycleDays),
          cycleDays,
        },
      };
    }

    return {
      cycle,
      checkinCount: checkins.length,
      payout,
      breakdown,
    };
  });
}

export function statusLabel(status: Cycle["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "broken":
      return "Broken";
    case "paid_out":
      return "Claimed";
    case "active":
      return "Active";
    default:
      return status;
  }
}
