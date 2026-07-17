import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import {
  allowDemoWallet,
  isProductionRuntime,
  operatorSecretConfigured,
} from "@/lib/env";
import { ESCROW_ADDRESS } from "@/lib/constants";
import { storeBackend } from "@/lib/server-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const production = isProductionRuntime();
  const durable = hasDatabaseUrl();
  const backend = storeBackend();
  const escrowConfigured =
    Boolean(ESCROW_ADDRESS?.trim()) &&
    !/0000 0000 0000 0000 0000 0000 0000 0000/.test(ESCROW_ADDRESS);

  const checks = {
    production,
    store: backend,
    durableDatabase: durable,
    escrowConfigured,
    demoAllowed: allowDemoWallet(),
    operatorSecret: operatorSecretConfigured(),
  };

  const ok =
    (!production || durable) &&
    escrowConfigured &&
    (!production || backend === "postgres");

  return NextResponse.json(
    {
      ok,
      service: "steadystreak",
      checks,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
