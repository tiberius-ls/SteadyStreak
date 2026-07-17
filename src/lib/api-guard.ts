import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "./db";
import { requireDurableStore } from "./env";
import { clientKey, rateLimit } from "./rate-limit";

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Reject production traffic if durable DB is missing. */
export function assertDurableStore() {
  if (requireDurableStore() && !hasDatabaseUrl()) {
    return jsonError(
      "DATABASE_URL is required in production. Configure Postgres (Neon) on Vercel.",
      503,
      { code: "STORE_UNAVAILABLE" }
    );
  }
  return null;
}

export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit = 60,
  windowMs = 60_000
) {
  const result = rateLimit({
    key: clientKey(request, bucket),
    limit,
    windowMs,
  });
  if (!result.ok) {
    return jsonError("Too many requests. Try again shortly.", 429, {
      retryAfterSec: result.retryAfterSec,
    });
  }
  return null;
}
