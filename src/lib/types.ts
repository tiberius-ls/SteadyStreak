export type CycleLength = 30 | 60 | 90;

export type CycleStatus = "active" | "completed" | "broken" | "paid_out";

export type Tier = "bronze" | "silver" | "gold" | "none";

export interface User {
  id: string;
  walletAddress: string;
  displayName?: string;
  createdAt: string;
}

export interface Cycle {
  id: string;
  userId: string;
  walletAddress: string;
  habit: string;
  length: CycleLength;
  /** Local calendar date YYYY-MM-DD when the cycle started */
  startDate: string;
  dailySaveLuna: number;
  dailyStakeLuna: number;
  status: CycleStatus;
  /** Day number (1-based) when streak broke, if broken */
  brokenAtDay?: number;
  /** Shared pool cohort: length + startDate */
  poolId: string;
  timezone: string;
  createdAt: string;
}

export interface Checkin {
  id: string;
  userId: string;
  cycleId: string;
  dayNumber: number;
  txHash: string;
  timestamp: string;
  saveLuna: number;
  stakeLuna: number;
}

export interface StakePool {
  poolId: string;
  cycleLength: CycleLength;
  totalForfeitedLuna: number;
  updatedAt: string;
}

export interface Payout {
  id: string;
  userId: string;
  cycleId: string;
  walletAddress: string;
  savingsPrincipalLuna: number;
  stakeReturnedLuna: number;
  bonusFromPoolLuna: number;
  totalLuna: number;
  multiplier: number;
  txHash?: string;
  claimedAt: string;
}

export interface LeaderboardEntry {
  walletAddress: string;
  habit: string;
  streak: number;
  cycleLength: CycleLength;
  tier: Tier;
  status: CycleStatus;
  updatedAt: string;
}

export interface AppState {
  user: User | null;
  cycles: Cycle[];
  checkins: Checkin[];
  payouts: Payout[];
  onboardingComplete: boolean;
}

export interface PayoutBreakdown {
  savingsPrincipalLuna: number;
  ownStakeLuna: number;
  bonusFromPoolLuna: number;
  totalLuna: number;
  multiplier: number;
  totalForfeitedLuna: number;
  survivorCount: number;
  completed: boolean;
  broken: boolean;
}

export const PRESET_HABITS = [
  "Exercise / workout",
  "Meditate",
  "Read 20 minutes",
  "No social media before noon",
  "Drink 2L of water",
  "Journal",
  "Learn a language",
  "Sleep before 11pm",
] as const;

export const CYCLE_LENGTHS: CycleLength[] = [30, 60, 90];

export const LUNA_PER_NIM = 100_000;
