import { NextResponse } from "next/server";
import {
  assertDurableStore,
  enforceRateLimit,
  jsonError,
} from "@/lib/api-guard";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  listLeaderboard,
  removeLeaderboardEntry,
  storeBackend,
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

export async function GET(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "leaderboard-get", 120);
  if (limited) return limited;

  try {
    const entries = await listLeaderboard();
    const real = [];
    for (const e of entries) {
      if (isMockWalletAddress(e.walletAddress)) {
        await removeLeaderboardEntry(e.walletAddress).catch(() => {});
        continue;
      }
      real.push(e);
    }

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
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}

export async function POST(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "leaderboard-post", 40);
  if (limited) return limited;

  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "").trim();
    const streak = parseStreak(body.streak);

    if (!walletAddress || streak === null) {
      return jsonError("walletAddress and streak are required", 400);
    }

    if (body.demo === true || isMockWalletAddress(walletAddress)) {
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

    const entry = {
      walletAddress,
      habit: sanitizeHabit(body.habit),
      streak,
      cycleLength: parseCycleLength(body.cycleLength),
      tier: body.tier ?? tierForStreak(streak),
      status: parseCycleStatus(body.status),
      updatedAt: new Date().toISOString(),
    };

    await upsertLeaderboard(entry);
    return NextResponse.json({ ok: true, entry, store: storeBackend() });
  } catch (err) {
    console.error("[api/leaderboard POST]", err);
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}
