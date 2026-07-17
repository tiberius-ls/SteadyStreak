/**
 * Optional Postgres (Neon / Vercel Postgres / any DATABASE_URL).
 * When unset, the app falls back to in-memory store (dev / first deploy).
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let sql: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS leaderboard (
    wallet_address TEXT PRIMARY KEY,
    habit TEXT NOT NULL,
    streak INTEGER NOT NULL,
    cycle_length INTEGER NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pools (
    pool_id TEXT PRIMARY KEY,
    cycle_length INTEGER NOT NULL,
    total_forfeited_luna BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS forfeits (
    cycle_id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    amount_luna BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS survivors (
    cycle_id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    length INTEGER NOT NULL,
    stake_luna BIGINT NOT NULL,
    streak_days INTEGER NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE INDEX IF NOT EXISTS survivors_pool_id_idx ON survivors (pool_id)`,
  `CREATE INDEX IF NOT EXISTS leaderboard_streak_idx ON leaderboard (streak DESC)`,
  `CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    savings_principal_luna BIGINT NOT NULL,
    stake_returned_luna BIGINT NOT NULL,
    bonus_from_pool_luna BIGINT NOT NULL,
    total_luna BIGINT NOT NULL,
    multiplier DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    claim_ref TEXT NOT NULL,
    release_tx_hash TEXT,
    claimed_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS claims_status_idx ON claims (status)`,
  `CREATE INDEX IF NOT EXISTS claims_wallet_idx ON claims (wallet_address)`,
];

/** Idempotent schema bootstrap (safe to call on every request). */
export async function ensureSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = getSql();
      for (const statement of STATEMENTS) {
        await client.query(statement);
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}
