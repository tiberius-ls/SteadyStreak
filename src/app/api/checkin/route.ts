import { NextResponse } from "next/server";
import { upsertLeaderboard } from "@/lib/server-store";
import { tierForStreak } from "@/lib/streak";
import type { CycleLength, CycleStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Records a confirmed check-in on the public leaderboard (streak only).
 * Savings amounts are never accepted or stored here.
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
    }: {
      walletAddress: string;
      habit: string;
      streak: number;
      cycleLength: CycleLength;
      status: CycleStatus;
    } = body;

    if (!walletAddress || typeof streak !== "number") {
      return NextResponse.json(
        { error: "walletAddress and streak required" },
        { status: 400 }
      );
    }

    const entry = upsertLeaderboard({
      walletAddress,
      habit: habit ?? "Habit",
      streak: Math.max(0, Math.floor(streak)),
      cycleLength: cycleLength ?? 30,
      tier: tierForStreak(streak),
      status: status ?? "active",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
