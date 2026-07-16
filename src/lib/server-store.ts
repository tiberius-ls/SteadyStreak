/**
 * Shared server-side store for leaderboard + stake pools.
 * Uses globalThis so state survives hot reloads in dev and is shared
 * across concurrent requests within the same serverless instance.
 *
 * For production multi-region durability, swap to Redis / Postgres.
 */

import type {
  CycleLength,
  LeaderboardEntry,
  StakePool,
} from "./types";

export interface ServerDb {
  leaderboard: Record<string, LeaderboardEntry>;
  pools: Record<string, StakePool>;
  /** cycleId -> forfeited amount already counted */
  forfeits: Record<string, number>;
  /** cycleId -> survivor payload for payout math */
  survivors: Record<
    string,
    {
      cycleId: string;
      poolId: string;
      walletAddress: string;
      length: CycleLength;
      stakeLuna: number;
      streakDays: number;
      completed: boolean;
    }
  >;
}

const GLOBAL_KEY = "__steadystreak_db__";

function emptyDb(): ServerDb {
  return {
    leaderboard: {},
    pools: {},
    forfeits: {},
    survivors: {},
  };
}

export function getDb(): ServerDb {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ServerDb;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = emptyDb();
  }
  return g[GLOBAL_KEY]!;
}

export function upsertLeaderboard(entry: LeaderboardEntry): LeaderboardEntry {
  const db = getDb();
  db.leaderboard[entry.walletAddress] = entry;
  return entry;
}

export function listLeaderboard(): LeaderboardEntry[] {
  const db = getDb();
  return Object.values(db.leaderboard).sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    return a.walletAddress.localeCompare(b.walletAddress);
  });
}

export function getOrCreatePool(
  poolId: string,
  cycleLength: CycleLength
): StakePool {
  const db = getDb();
  if (!db.pools[poolId]) {
    db.pools[poolId] = {
      poolId,
      cycleLength,
      totalForfeitedLuna: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return db.pools[poolId];
}

export function addForfeit(
  poolId: string,
  cycleLength: CycleLength,
  cycleId: string,
  amountLuna: number
): StakePool {
  const db = getDb();
  if (db.forfeits[cycleId]) {
    return getOrCreatePool(poolId, cycleLength);
  }
  const pool = getOrCreatePool(poolId, cycleLength);
  pool.totalForfeitedLuna += amountLuna;
  pool.updatedAt = new Date().toISOString();
  db.forfeits[cycleId] = amountLuna;
  return pool;
}

export function registerSurvivor(payload: {
  cycleId: string;
  poolId: string;
  walletAddress: string;
  length: CycleLength;
  stakeLuna: number;
  streakDays: number;
  completed: boolean;
}) {
  const db = getDb();
  db.survivors[payload.cycleId] = payload;
  getOrCreatePool(payload.poolId, payload.length);
}

export function getPool(poolId: string): StakePool | null {
  return getDb().pools[poolId] ?? null;
}

export function getSurvivorsForPool(poolId: string) {
  const db = getDb();
  return Object.values(db.survivors).filter(
    (s) => s.poolId === poolId && s.completed
  );
}
