import { NextResponse } from "next/server";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  listLeaderboard,
  removeLeaderboardEntry,
  storeBackend,
  upsertLeaderboard,
} from "@/lib/server-store";
import type { CycleLength, CycleStatus, LeaderboardEntry } from "@/lib/types";
import { tierForStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await listLeaderboard();
    const real: typeof entries = [];
    for (const e of entries) {
      if (isMockWalletAddress(e.walletAddress)) {
        // Purge leftover demo rows
        await removeLeaderboardEntry(e.walletAddress).catch(() => {});
        continue;
      }
      real.push(e);
    }

    // Never expose savings — leaderboard only ranks by streak
    const safe = real.map((e) => ({
      walletAddress: e.walletAddress,
      habit: e.habit,
      streak: e.streak,
      cycleLength: e.cycleLength,
      tier: e.tier,
      status: e.status,
      updatedAt: e.updatedAt,
    }));
    return NextResponse.json({
      leaderboard: safe,
      store: storeBackend(),
    });
  } catch (err) {
    console.error("[api/leaderboard GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LeaderboardEntry> & {
      demo?: boolean;
    };
    if (!body.walletAddress || typeof body.streak !== "number") {
      return NextResponse.json(
        { error: "walletAddress and streak are required" },
        { status: 400 }
      );
    }

    if (body.demo === true || isMockWalletAddress(body.walletAddress)) {
      await removeLeaderboardEntry(body.walletAddress).catch(() => {});
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "demo_wallet",
      });
    }

    const entry: LeaderboardEntry = {
      walletAddress: body.walletAddress,
      habit: body.habit ?? "Habit",
      streak: Math.max(0, Math.floor(body.streak)),
      cycleLength: (body.cycleLength as CycleLength) ?? 30,
      tier: body.tier ?? tierForStreak(body.streak ?? 0),
      status: (body.status as CycleStatus) ?? "active",
      updatedAt: new Date().toISOString(),
    };

    await upsertLeaderboard(entry);
    return NextResponse.json({ ok: true, entry, store: storeBackend() });
  } catch (err) {
    console.error("[api/leaderboard POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
