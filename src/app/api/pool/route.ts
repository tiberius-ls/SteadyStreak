import { NextResponse } from "next/server";
import {
  assertDurableStore,
  enforceRateLimit,
  jsonError,
} from "@/lib/api-guard";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  addForfeit,
  getOrCreatePool,
  getPool,
  getSurvivorsForPool,
  registerSurvivor,
  storeBackend,
} from "@/lib/server-store";
import { stakeMultiplier } from "@/lib/streak";
import {
  isNonEmptyString,
  isValidNimiqAddress,
  parseCycleLength,
  parseLunaAmount,
  parseStreak,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "pool-get", 120);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("poolId");
    if (!poolId || !isNonEmptyString(poolId, 80)) {
      return jsonError("poolId required", 400);
    }
    const pool = await getPool(poolId);
    const survivors = await getSurvivorsForPool(poolId);
    return NextResponse.json({
      pool: pool ?? {
        poolId,
        cycleLength: Number(poolId.split("d:")[0]) || 30,
        totalForfeitedLuna: 0,
        updatedAt: new Date().toISOString(),
      },
      survivors,
      store: storeBackend(),
    });
  } catch (err) {
    console.error("[api/pool GET]", err);
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}

export async function POST(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "pool-post", 40);
  if (limited) return limited;

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "forfeit") {
      const poolId = String(body.poolId || "").trim();
      const cycleId = String(body.cycleId || "").trim();
      const amountLuna = parseLunaAmount(body.amountLuna);
      if (
        !isNonEmptyString(poolId, 80) ||
        !isNonEmptyString(cycleId, 80) ||
        amountLuna === null ||
        amountLuna <= 0
      ) {
        return jsonError("poolId, cycleId, amountLuna required", 400);
      }
      if (body.demo === true || isMockWalletAddress(body.walletAddress)) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "demo_wallet",
        });
      }
      const pool = await addForfeit(
        poolId,
        parseCycleLength(body.cycleLength),
        cycleId,
        amountLuna
      );
      return NextResponse.json({ ok: true, pool, store: storeBackend() });
    }

    if (action === "survivor") {
      const cycleId = String(body.cycleId || "").trim();
      const poolId = String(body.poolId || "").trim();
      const walletAddress = String(body.walletAddress || "").trim();
      if (
        !isNonEmptyString(cycleId, 80) ||
        !isNonEmptyString(poolId, 80) ||
        !walletAddress
      ) {
        return jsonError("cycleId, poolId, walletAddress required", 400);
      }
      if (body.demo === true || isMockWalletAddress(walletAddress)) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "demo_wallet",
        });
      }
      if (!isValidNimiqAddress(walletAddress)) {
        return jsonError("Invalid Nimiq wallet address", 400);
      }
      const length = parseCycleLength(body.length);
      const stakeLuna = parseLunaAmount(body.stakeLuna) ?? 0;
      const streakDays = parseStreak(body.streakDays) ?? 0;
      await registerSurvivor({
        cycleId,
        poolId,
        walletAddress,
        length,
        stakeLuna,
        streakDays,
        completed: true,
      });
      const pool = await getOrCreatePool(poolId, length);
      return NextResponse.json({ ok: true, pool, store: storeBackend() });
    }

    if (action === "payout-preview") {
      const poolId = String(body.poolId || "").trim();
      if (!isNonEmptyString(poolId, 80)) {
        return jsonError("poolId required", 400);
      }
      const stakeLuna = parseLunaAmount(body.stakeLuna) ?? 0;
      const streakDays = parseStreak(body.streakDays) ?? 0;
      const length = parseCycleLength(body.length);
      const pool = await getPool(poolId);
      const survivors = await getSurvivorsForPool(poolId);
      const totalForfeited = pool?.totalForfeitedLuna ?? 0;
      const mult = stakeMultiplier(streakDays, length);
      const selfWeight = stakeLuna * mult;

      let totalWeight = survivors.reduce((sum, s) => {
        return sum + s.stakeLuna * stakeMultiplier(s.streakDays, s.length);
      }, 0);
      const already = survivors.some(
        (s) => s.walletAddress === body.walletAddress
      );
      if (!already) totalWeight += selfWeight;

      const bonus =
        totalWeight > 0
          ? Math.floor((totalForfeited * selfWeight) / totalWeight)
          : 0;

      return NextResponse.json({
        totalForfeitedLuna: totalForfeited,
        multiplier: mult,
        bonusFromPoolLuna: bonus,
        survivorCount: survivors.length + (already ? 0 : 1),
        store: storeBackend(),
      });
    }

    return jsonError("Unknown action", 400);
  } catch (err) {
    console.error("[api/pool POST]", err);
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}
