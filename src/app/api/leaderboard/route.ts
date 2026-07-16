import { NextResponse } from "next/server";
import { listLeaderboard, upsertLeaderboard } from "@/lib/server-store";
import type { CycleLength, CycleStatus, LeaderboardEntry } from "@/lib/types";
import { tierForStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = listLeaderboard();
  // Never expose savings — leaderboard only ranks by streak
  const safe = entries.map((e) => ({
    walletAddress: e.walletAddress,
    habit: e.habit,
    streak: e.streak,
    cycleLength: e.cycleLength,
    tier: e.tier,
    status: e.status,
    updatedAt: e.updatedAt,
  }));
  return NextResponse.json({ leaderboard: safe });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LeaderboardEntry>;
    if (!body.walletAddress || typeof body.streak !== "number") {
      return NextResponse.json(
        { error: "walletAddress and streak are required" },
        { status: 400 }
      );
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

    upsertLeaderboard(entry);
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
