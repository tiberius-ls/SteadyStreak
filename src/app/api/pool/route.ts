import { NextResponse } from "next/server";
import {
  addForfeit,
  getOrCreatePool,
  getPool,
  getSurvivorsForPool,
  registerSurvivor,
  storeBackend,
} from "@/lib/server-store";
import type { CycleLength } from "@/lib/types";
import { stakeMultiplier } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("poolId");
    if (!poolId) {
      return NextResponse.json({ error: "poolId required" }, { status: 400 });
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "forfeit") {
      const {
        poolId,
        cycleLength,
        cycleId,
        amountLuna,
      }: {
        poolId: string;
        cycleLength: CycleLength;
        cycleId: string;
        amountLuna: number;
      } = body;
      if (!poolId || !cycleId || !amountLuna) {
        return NextResponse.json(
          { error: "poolId, cycleId, amountLuna required" },
          { status: 400 }
        );
      }
      const pool = await addForfeit(
        poolId,
        cycleLength ?? 30,
        cycleId,
        Math.floor(amountLuna)
      );
      return NextResponse.json({ ok: true, pool, store: storeBackend() });
    }

    if (action === "survivor") {
      const {
        cycleId,
        poolId,
        walletAddress,
        length,
        stakeLuna,
        streakDays,
      } = body as {
        cycleId: string;
        poolId: string;
        walletAddress: string;
        length: CycleLength;
        stakeLuna: number;
        streakDays: number;
      };
      if (!cycleId || !poolId || !walletAddress) {
        return NextResponse.json(
          { error: "cycleId, poolId, walletAddress required" },
          { status: 400 }
        );
      }
      await registerSurvivor({
        cycleId,
        poolId,
        walletAddress,
        length: length ?? 30,
        stakeLuna: Math.floor(stakeLuna ?? 0),
        streakDays: Math.floor(streakDays ?? 0),
        completed: true,
      });
      const pool = await getOrCreatePool(poolId, length ?? 30);
      return NextResponse.json({ ok: true, pool, store: storeBackend() });
    }

    if (action === "payout-preview") {
      const { poolId, stakeLuna, streakDays, length } = body as {
        poolId: string;
        stakeLuna: number;
        streakDays: number;
        length: CycleLength;
      };
      const pool = await getPool(poolId);
      const survivors = await getSurvivorsForPool(poolId);
      const totalForfeited = pool?.totalForfeitedLuna ?? 0;
      const mult = stakeMultiplier(streakDays, length ?? 30);
      const selfWeight = stakeLuna * mult;

      // Include self if not yet registered
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/pool POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
