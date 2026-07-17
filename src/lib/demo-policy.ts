/**
 * Client-safe demo policy (uses NEXT_PUBLIC_* / NODE_ENV only).
 * Server also has allowDemoWallet() in env.ts for health checks.
 */

export function allowDemoWalletClient(): boolean {
  const flag = process.env.NEXT_PUBLIC_ALLOW_DEMO?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Production builds hide demo by default
  return process.env.NODE_ENV !== "production";
}
