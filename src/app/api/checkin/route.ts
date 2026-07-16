import { NextResponse } from "next/server";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  removeLeaderboardEntry,
  upsertLeaderboard,
} from "@/lib/server-store";
import { tierForStreak } from "@/lib/streak";
import type { CycleLength, CycleStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Records a confirmed check-in on the public leaderboard (streak only).
 * Savings amounts are never accepted or stored here.
 * Demo / mock wallets are rejected so they never pollute the public board.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      habit,
      streak,
      cycleLength,
      status,
      demo,
    }: {
      walletAddress: string;
      habit: string;
      streak: number;
      cycleLength: CycleLength;
      status: CycleStatus;
      demo?: boolean;
    } = body;

    if (!walletAddress || typeof streak !== "number") {
      return NextResponse.json(
        { error: "walletAddress and streak required" },
        { status: 400 }
      );
    }

    if (demo === true || isMockWalletAddress(walletAddress)) {
      // Drop any prior pollution for this address
      await removeLeaderboardEntry(walletAddress).catch(() => {});
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "demo_wallet",
      });
    }

    const entry = await upsertLeaderboard({
      walletAddress,
      habit: habit ?? "Habit",
      streak: Math.max(0, Math.floor(streak)),
      cycleLength: cycleLength ?? 30,
      tier: tierForStreak(streak),
      status: status ?? "active",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error("[api/checkin]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
