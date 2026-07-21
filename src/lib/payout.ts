import type {
  Checkin,
  Cycle,
  PayoutBreakdown,
  StakePool,
} from "./types";
import { stakeMultiplier } from "./streak";

export interface SurvivorShareInput {
  cycle: Cycle;
  checkins: Checkin[];
  /** Total forfeited stakes in the shared pool (Luna) */
  totalForfeitedLuna: number;
  /**
   * All full-streak survivors in the same pool (including self).
   * Used to weight the forfeited pool split.
   */
  survivors: Array<{
    cycle: Cycle;
    checkins: Checkin[];
  }>;
}

/**
 * Realized return for this cycle only (not a product APR).
 * contributed = all save + stake check-ins
 * payout = what the user is owed at settlement
 */
export function computeEffectiveReturn(params: {
  totalContributedLuna: number;
  totalPayoutLuna: number;
  cycleDays: number;
}): Pick<
  PayoutBreakdown,
  | "totalContributedLuna"
  | "netProfitLuna"
  | "effectiveReturnPct"
  | "illustrativeAprPct"
  | "cycleDays"
> {
  const cycleDays = Math.max(1, Math.floor(params.cycleDays));
  const totalContributedLuna = Math.max(0, params.totalContributedLuna);
  const netProfitLuna = params.totalPayoutLuna - totalContributedLuna;
  const effectiveReturnPct =
    totalContributedLuna > 0
      ? (netProfitLuna / totalContributedLuna) * 100
      : 0;
  // Simple (non-compound) annualization for comparison only
  const illustrativeAprPct = effectiveReturnPct * (365 / cycleDays);

  return {
    totalContributedLuna,
    netProfitLuna,
    effectiveReturnPct,
    illustrativeAprPct,
    cycleDays,
  };
}

/**
 * At cycle end:
 * - Broken users: savings principal only (stake moves to forfeited pool)
 * - Survivors: savings principal + own stake + weighted share of forfeited pool
 *
 * Weight = own_stake * multiplier
 * multiplier = min(3, streak_days / cycle_length * 3)
 */
export function calculatePayout(input: SurvivorShareInput): PayoutBreakdown {
  const { cycle, checkins, totalForfeitedLuna, survivors } = input;

  const savingsPrincipalLuna = checkins.reduce((s, c) => s + c.saveLuna, 0);
  const stakeContributedLuna = checkins.reduce((s, c) => s + c.stakeLuna, 0);
  const totalContributedLuna = savingsPrincipalLuna + stakeContributedLuna;
  const streakDays = checkins.length;
  const multiplier = stakeMultiplier(streakDays, cycle.length);
  const cycleDays = Math.max(1, streakDays || cycle.length);

  const completed =
    cycle.status === "completed" ||
    cycle.status === "paid_out" ||
    (streakDays === cycle.length && cycle.status !== "broken");

  const broken = cycle.status === "broken" || (!completed && cycle.status !== "active");

  if (broken || !completed) {
    const totalLuna = savingsPrincipalLuna;
    return {
      savingsPrincipalLuna,
      ownStakeLuna: 0,
      bonusFromPoolLuna: 0,
      totalLuna,
      multiplier: 0,
      totalForfeitedLuna,
      survivorCount: survivors.length,
      completed: false,
      broken: true,
      ...computeEffectiveReturn({
        totalContributedLuna,
        totalPayoutLuna: totalLuna,
        cycleDays,
      }),
    };
  }

  // Weight each survivor by stake * multiplier
  const weights = survivors.map(({ cycle: c, checkins: ch }) => {
    const stake = ch.reduce((s, x) => s + x.stakeLuna, 0);
    const mult = stakeMultiplier(ch.length, c.length);
    return Math.max(0, stake * mult);
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const ownStakeLuna = stakeContributedLuna;
  const selfWeight = ownStakeLuna * multiplier;
  const bonusFromPoolLuna =
    totalWeight > 0
      ? Math.floor((totalForfeitedLuna * selfWeight) / totalWeight)
      : 0;

  const totalLuna =
    savingsPrincipalLuna + ownStakeLuna + bonusFromPoolLuna;

  return {
    savingsPrincipalLuna,
    ownStakeLuna,
    bonusFromPoolLuna,
    totalLuna,
    multiplier,
    totalForfeitedLuna,
    survivorCount: survivors.length,
    completed: true,
    broken: false,
    ...computeEffectiveReturn({
      totalContributedLuna,
      totalPayoutLuna: totalLuna,
      cycleDays,
    }),
  };
}

/** Stake amount a broken user contributes to the pool. */
export function forfeitedStakeLuna(checkins: Checkin[]): number {
  return checkins.reduce((s, c) => s + c.stakeLuna, 0);
}

export function applyForfeit(
  pool: StakePool,
  amountLuna: number
): StakePool {
  return {
    ...pool,
    totalForfeitedLuna: pool.totalForfeitedLuna + amountLuna,
    updatedAt: new Date().toISOString(),
  };
}
