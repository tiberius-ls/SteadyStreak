import { NextResponse } from "next/server";
import {
  assertDurableStore,
  enforceRateLimit,
  jsonError,
} from "@/lib/api-guard";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  removeLeaderboardEntry,
  upsertLeaderboard,
} from "@/lib/server-store";
import { tierForStreak } from "@/lib/streak";
import {
  isValidNimiqAddress,
  parseCycleLength,
  parseCycleStatus,
  parseStreak,
  sanitizeHabit,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Records a confirmed check-in on the public leaderboard (streak only).
 * Savings amounts are never accepted or stored here.
 */
export async function POST(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "checkin", 40);
  if (limited) return limited;

  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "").trim();
    const streak = parseStreak(body.streak);
    const demo = body.demo === true;

    if (!walletAddress || streak === null) {
      return jsonError("walletAddress and streak required", 400);
    }

    if (demo || isMockWalletAddress(walletAddress)) {
      await removeLeaderboardEntry(walletAddress).catch(() => {});
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "demo_wallet",
      });
    }

    if (!isValidNimiqAddress(walletAddress)) {
      return jsonError("Invalid Nimiq wallet address", 400);
    }

    const entry = await upsertLeaderboard({
      walletAddress,
      habit: sanitizeHabit(body.habit),
      streak,
      cycleLength: parseCycleLength(body.cycleLength),
      tier: tierForStreak(streak),
      status: parseCycleStatus(body.status),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error("[api/checkin]", err);
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}
