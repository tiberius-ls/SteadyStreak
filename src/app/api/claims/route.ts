import { NextResponse } from "next/server";
import {
  assertDurableStore,
  enforceRateLimit,
  jsonError,
} from "@/lib/api-guard";
import { getOperatorSecret } from "@/lib/env";
import { isMockWalletAddress } from "@/lib/mock-wallet";
import {
  listClaims,
  markClaimPaid,
  upsertClaim,
  type ClaimRecord,
} from "@/lib/server-store";
import { newId } from "@/lib/id";
import {
  isNonEmptyString,
  isValidNimiqAddress,
  parseLunaAmount,
  sanitizeHabit,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

function authorizedOperator(request: Request): boolean {
  const secret = getOperatorSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

/** List claims — operator only. */
export async function GET(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  if (!authorizedOperator(request)) {
    return jsonError("Unauthorized. Operator secret required.", 401);
  }

  const status = new URL(request.url).searchParams.get("status");
  const filter =
    status === "pending" || status === "paid"
      ? { status: status as "pending" | "paid" }
      : undefined;

  const claims = await listClaims(filter);
  return NextResponse.json({ claims });
}

/**
 * POST actions:
 * - default / action=claim — user records a claim (public, validated)
 * - action=mark-paid — operator marks escrow release complete
 */
export async function POST(request: Request) {
  const storeErr = assertDurableStore();
  if (storeErr) return storeErr;

  const limited = enforceRateLimit(request, "claims-post", 30);
  if (limited) return limited;

  try {
    const body = await request.json();
    const action = (body.action as string) || "claim";

    if (action === "mark-paid") {
      if (!authorizedOperator(request)) {
        return jsonError("Unauthorized. Operator secret required.", 401);
      }
      const claimId = body.claimId as string;
      const releaseTxHash = String(body.releaseTxHash || "").trim();
      if (!isNonEmptyString(claimId, 80) || !isNonEmptyString(releaseTxHash, 128)) {
        return jsonError("claimId and releaseTxHash required", 400);
      }
      const paid = await markClaimPaid(claimId, releaseTxHash);
      if (!paid) return jsonError("Claim not found", 404);
      return NextResponse.json({ ok: true, claim: paid });
    }

    // User claim
    if (body.demo === true || isMockWalletAddress(body.walletAddress)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "demo_wallet",
      });
    }

    const walletAddress = String(body.walletAddress || "").trim();
    const cycleId = String(body.cycleId || "").trim();
    const poolId = String(body.poolId || "").trim();

    if (!isValidNimiqAddress(walletAddress)) {
      return jsonError("Invalid wallet address", 400);
    }
    if (!isNonEmptyString(cycleId, 80) || !isNonEmptyString(poolId, 80)) {
      return jsonError("cycleId and poolId required", 400);
    }

    const savings = parseLunaAmount(body.savingsPrincipalLuna);
    const stake = parseLunaAmount(body.stakeReturnedLuna);
    const bonus = parseLunaAmount(body.bonusFromPoolLuna);
    const total = parseLunaAmount(body.totalLuna);
    if (
      savings === null ||
      stake === null ||
      bonus === null ||
      total === null
    ) {
      return jsonError("Invalid payout amounts", 400);
    }
    if (total !== savings + stake + bonus) {
      return jsonError("totalLuna must equal savings + stake + bonus", 400);
    }

    const claim: ClaimRecord = {
      id: newId(),
      cycleId,
      walletAddress,
      poolId,
      savingsPrincipalLuna: savings,
      stakeReturnedLuna: stake,
      bonusFromPoolLuna: bonus,
      totalLuna: total,
      multiplier:
        typeof body.multiplier === "number" && Number.isFinite(body.multiplier)
          ? body.multiplier
          : 0,
      status: "pending",
      claimRef:
        typeof body.claimRef === "string" && body.claimRef
          ? sanitizeHabit(body.claimRef, 120)
          : `claim-${cycleId.slice(0, 8)}`,
      claimedAt: new Date().toISOString(),
    };

    const saved = await upsertClaim(claim);
    return NextResponse.json({ ok: true, claim: saved });
  } catch (err) {
    console.error("[api/claims]", err);
    return jsonError(
      err instanceof Error ? err.message : "Server error",
      500
    );
  }
}
