/**
 * Shared server-side store for leaderboard + stake pools.
 *
 * - With DATABASE_URL: durable Postgres (Neon / Vercel Postgres / etc.)
 * - Without: in-memory via globalThis (survives hot reload in one process only)
 */

import { ensureSchema, getSql, hasDatabaseUrl } from "./db";
import type {
  CycleLength,
  CycleStatus,
  LeaderboardEntry,
  StakePool,
  Tier,
} from "./types";

export type SurvivorRecord = {
  cycleId: string;
  poolId: string;
  walletAddress: string;
  length: CycleLength;
  stakeLuna: number;
  streakDays: number;
  completed: boolean;
};

export interface ServerDb {
  leaderboard: Record<string, LeaderboardEntry>;
  pools: Record<string, StakePool>;
  forfeits: Record<string, number>;
  survivors: Record<string, SurvivorRecord>;
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

function getMemoryDb(): ServerDb {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ServerDb;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = emptyDb();
  }
  return g[GLOBAL_KEY]!;
}

export function storeBackend(): "postgres" | "memory" {
  return hasDatabaseUrl() ? "postgres" : "memory";
}

// ——— Leaderboard ———

export async function upsertLeaderboard(
  entry: LeaderboardEntry
): Promise<LeaderboardEntry> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    db.leaderboard[entry.walletAddress] = entry;
    return entry;
  }

  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO leaderboard (
      wallet_address, habit, streak, cycle_length, tier, status, updated_at
    ) VALUES (
      ${entry.walletAddress},
      ${entry.habit},
      ${entry.streak},
      ${entry.cycleLength},
      ${entry.tier},
      ${entry.status},
      ${entry.updatedAt}
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      habit = EXCLUDED.habit,
      streak = EXCLUDED.streak,
      cycle_length = EXCLUDED.cycle_length,
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  `;
  return entry;
}

export async function listLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    return Object.values(db.leaderboard).sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.walletAddress.localeCompare(b.walletAddress);
    });
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      wallet_address AS "walletAddress",
      habit,
      streak,
      cycle_length AS "cycleLength",
      tier,
      status,
      updated_at AS "updatedAt"
    FROM leaderboard
    ORDER BY streak DESC, wallet_address ASC
  `;

  return rows.map((row) => ({
    walletAddress: String(row.walletAddress),
    habit: String(row.habit),
    streak: Number(row.streak),
    cycleLength: Number(row.cycleLength) as CycleLength,
    tier: row.tier as Tier,
    status: row.status as CycleStatus,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  }));
}

export async function removeLeaderboardEntry(
  walletAddress: string
): Promise<void> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    delete db.leaderboard[walletAddress];
    return;
  }
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM leaderboard WHERE wallet_address = ${walletAddress}`;
}

// ——— Pools ———

export async function getOrCreatePool(
  poolId: string,
  cycleLength: CycleLength
): Promise<StakePool> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
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

  await ensureSchema();
  const sql = getSql();
  const updatedAt = new Date().toISOString();
  await sql`
    INSERT INTO pools (pool_id, cycle_length, total_forfeited_luna, updated_at)
    VALUES (${poolId}, ${cycleLength}, 0, ${updatedAt})
    ON CONFLICT (pool_id) DO NOTHING
  `;
  const pool = await getPool(poolId);
  if (!pool) {
    // Should not happen after insert; return a safe default
    return {
      poolId,
      cycleLength,
      totalForfeitedLuna: 0,
      updatedAt,
    };
  }
  return pool;
}

export async function getPool(poolId: string): Promise<StakePool | null> {
  if (!hasDatabaseUrl()) {
    return getMemoryDb().pools[poolId] ?? null;
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      pool_id AS "poolId",
      cycle_length AS "cycleLength",
      total_forfeited_luna AS "totalForfeitedLuna",
      updated_at AS "updatedAt"
    FROM pools
    WHERE pool_id = ${poolId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    poolId: String(row.poolId),
    cycleLength: Number(row.cycleLength) as CycleLength,
    totalForfeitedLuna: Number(row.totalForfeitedLuna),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export async function addForfeit(
  poolId: string,
  cycleLength: CycleLength,
  cycleId: string,
  amountLuna: number
): Promise<StakePool> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    if (db.forfeits[cycleId]) {
      return getOrCreatePool(poolId, cycleLength);
    }
    const pool = await getOrCreatePool(poolId, cycleLength);
    pool.totalForfeitedLuna += amountLuna;
    pool.updatedAt = new Date().toISOString();
    db.forfeits[cycleId] = amountLuna;
    return pool;
  }

  await ensureSchema();
  const sql = getSql();
  await getOrCreatePool(poolId, cycleLength);

  // Idempotent: only first forfeit for a cycleId counts
  const inserted = await sql`
    INSERT INTO forfeits (cycle_id, pool_id, amount_luna)
    VALUES (${cycleId}, ${poolId}, ${amountLuna})
    ON CONFLICT (cycle_id) DO NOTHING
    RETURNING cycle_id
  `;

  if (inserted.length > 0) {
    const updatedAt = new Date().toISOString();
    await sql`
      UPDATE pools
      SET
        total_forfeited_luna = total_forfeited_luna + ${amountLuna},
        updated_at = ${updatedAt}
      WHERE pool_id = ${poolId}
    `;
  }

  return (await getPool(poolId)) ?? (await getOrCreatePool(poolId, cycleLength));
}

export async function registerSurvivor(payload: SurvivorRecord): Promise<void> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    db.survivors[payload.cycleId] = payload;
    await getOrCreatePool(payload.poolId, payload.length);
    return;
  }

  await ensureSchema();
  const sql = getSql();
  await getOrCreatePool(payload.poolId, payload.length);
  await sql`
    INSERT INTO survivors (
      cycle_id, pool_id, wallet_address, length,
      stake_luna, streak_days, completed
    ) VALUES (
      ${payload.cycleId},
      ${payload.poolId},
      ${payload.walletAddress},
      ${payload.length},
      ${payload.stakeLuna},
      ${payload.streakDays},
      ${payload.completed}
    )
    ON CONFLICT (cycle_id) DO UPDATE SET
      pool_id = EXCLUDED.pool_id,
      wallet_address = EXCLUDED.wallet_address,
      length = EXCLUDED.length,
      stake_luna = EXCLUDED.stake_luna,
      streak_days = EXCLUDED.streak_days,
      completed = EXCLUDED.completed
  `;
}

export async function getSurvivorsForPool(
  poolId: string
): Promise<SurvivorRecord[]> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb();
    return Object.values(db.survivors).filter(
      (s) => s.poolId === poolId && s.completed
    );
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      cycle_id AS "cycleId",
      pool_id AS "poolId",
      wallet_address AS "walletAddress",
      length,
      stake_luna AS "stakeLuna",
      streak_days AS "streakDays",
      completed
    FROM survivors
    WHERE pool_id = ${poolId} AND completed = true
  `;

  return rows.map((row) => ({
    cycleId: String(row.cycleId),
    poolId: String(row.poolId),
    walletAddress: String(row.walletAddress),
    length: Number(row.length) as CycleLength,
    stakeLuna: Number(row.stakeLuna),
    streakDays: Number(row.streakDays),
    completed: Boolean(row.completed),
  }));
}

// ——— Operator claims (pending escrow releases) ———

export type ClaimStatus = "pending" | "paid";

export type ClaimRecord = {
  id: string;
  cycleId: string;
  walletAddress: string;
  poolId: string;
  savingsPrincipalLuna: number;
  stakeReturnedLuna: number;
  bonusFromPoolLuna: number;
  totalLuna: number;
  multiplier: number;
  status: ClaimStatus;
  claimRef: string;
  releaseTxHash?: string;
  claimedAt: string;
  paidAt?: string;
};

export async function upsertClaim(
  claim: ClaimRecord
): Promise<ClaimRecord> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb() as ServerDb & {
      claims?: Record<string, ClaimRecord>;
    };
    if (!db.claims) db.claims = {};
    // Idempotent by cycleId
    const existing = Object.values(db.claims).find(
      (c) => c.cycleId === claim.cycleId
    );
    if (existing) return existing;
    db.claims[claim.id] = claim;
    return claim;
  }

  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO claims (
      id, cycle_id, wallet_address, pool_id,
      savings_principal_luna, stake_returned_luna, bonus_from_pool_luna,
      total_luna, multiplier, status, claim_ref, claimed_at
    ) VALUES (
      ${claim.id},
      ${claim.cycleId},
      ${claim.walletAddress},
      ${claim.poolId},
      ${claim.savingsPrincipalLuna},
      ${claim.stakeReturnedLuna},
      ${claim.bonusFromPoolLuna},
      ${claim.totalLuna},
      ${claim.multiplier},
      ${claim.status},
      ${claim.claimRef},
      ${claim.claimedAt}
    )
    ON CONFLICT (cycle_id) DO NOTHING
  `;
  const existing = await getClaimByCycleId(claim.cycleId);
  return existing ?? claim;
}

export async function getClaimByCycleId(
  cycleId: string
): Promise<ClaimRecord | null> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb() as ServerDb & {
      claims?: Record<string, ClaimRecord>;
    };
    return (
      Object.values(db.claims ?? {}).find((c) => c.cycleId === cycleId) ?? null
    );
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      cycle_id AS "cycleId",
      wallet_address AS "walletAddress",
      pool_id AS "poolId",
      savings_principal_luna AS "savingsPrincipalLuna",
      stake_returned_luna AS "stakeReturnedLuna",
      bonus_from_pool_luna AS "bonusFromPoolLuna",
      total_luna AS "totalLuna",
      multiplier,
      status,
      claim_ref AS "claimRef",
      release_tx_hash AS "releaseTxHash",
      claimed_at AS "claimedAt",
      paid_at AS "paidAt"
    FROM claims
    WHERE cycle_id = ${cycleId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return mapClaimRow(rows[0]);
}

export async function listClaims(filter?: {
  status?: ClaimStatus;
}): Promise<ClaimRecord[]> {
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb() as ServerDb & {
      claims?: Record<string, ClaimRecord>;
    };
    let list = Object.values(db.claims ?? {});
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    return list.sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
  }

  await ensureSchema();
  const sql = getSql();
  const rows = filter?.status
    ? await sql`
        SELECT
          id,
          cycle_id AS "cycleId",
          wallet_address AS "walletAddress",
          pool_id AS "poolId",
          savings_principal_luna AS "savingsPrincipalLuna",
          stake_returned_luna AS "stakeReturnedLuna",
          bonus_from_pool_luna AS "bonusFromPoolLuna",
          total_luna AS "totalLuna",
          multiplier,
          status,
          claim_ref AS "claimRef",
          release_tx_hash AS "releaseTxHash",
          claimed_at AS "claimedAt",
          paid_at AS "paidAt"
        FROM claims
        WHERE status = ${filter.status}
        ORDER BY claimed_at DESC
      `
    : await sql`
        SELECT
          id,
          cycle_id AS "cycleId",
          wallet_address AS "walletAddress",
          pool_id AS "poolId",
          savings_principal_luna AS "savingsPrincipalLuna",
          stake_returned_luna AS "stakeReturnedLuna",
          bonus_from_pool_luna AS "bonusFromPoolLuna",
          total_luna AS "totalLuna",
          multiplier,
          status,
          claim_ref AS "claimRef",
          release_tx_hash AS "releaseTxHash",
          claimed_at AS "claimedAt",
          paid_at AS "paidAt"
        FROM claims
        ORDER BY claimed_at DESC
      `;

  return rows.map(mapClaimRow);
}

export async function markClaimPaid(
  claimId: string,
  releaseTxHash: string
): Promise<ClaimRecord | null> {
  const paidAt = new Date().toISOString();
  if (!hasDatabaseUrl()) {
    const db = getMemoryDb() as ServerDb & {
      claims?: Record<string, ClaimRecord>;
    };
    const claim = db.claims?.[claimId];
    if (!claim) return null;
    claim.status = "paid";
    claim.releaseTxHash = releaseTxHash;
    claim.paidAt = paidAt;
    return claim;
  }

  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE claims
    SET
      status = 'paid',
      release_tx_hash = ${releaseTxHash},
      paid_at = ${paidAt}
    WHERE id = ${claimId}
  `;
  const rows = await sql`
    SELECT
      id,
      cycle_id AS "cycleId",
      wallet_address AS "walletAddress",
      pool_id AS "poolId",
      savings_principal_luna AS "savingsPrincipalLuna",
      stake_returned_luna AS "stakeReturnedLuna",
      bonus_from_pool_luna AS "bonusFromPoolLuna",
      total_luna AS "totalLuna",
      multiplier,
      status,
      claim_ref AS "claimRef",
      release_tx_hash AS "releaseTxHash",
      claimed_at AS "claimedAt",
      paid_at AS "paidAt"
    FROM claims
    WHERE id = ${claimId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return mapClaimRow(rows[0]);
}

function mapClaimRow(row: Record<string, unknown>): ClaimRecord {
  return {
    id: String(row.id),
    cycleId: String(row.cycleId),
    walletAddress: String(row.walletAddress),
    poolId: String(row.poolId),
    savingsPrincipalLuna: Number(row.savingsPrincipalLuna),
    stakeReturnedLuna: Number(row.stakeReturnedLuna),
    bonusFromPoolLuna: Number(row.bonusFromPoolLuna),
    totalLuna: Number(row.totalLuna),
    multiplier: Number(row.multiplier),
    status: row.status as ClaimStatus,
    claimRef: String(row.claimRef),
    releaseTxHash: row.releaseTxHash
      ? String(row.releaseTxHash)
      : undefined,
    claimedAt:
      row.claimedAt instanceof Date
        ? row.claimedAt.toISOString()
        : String(row.claimedAt),
    paidAt: row.paidAt
      ? row.paidAt instanceof Date
        ? row.paidAt.toISOString()
        : String(row.paidAt)
      : undefined,
  };
}
