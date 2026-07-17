/** Runtime environment helpers for production safety. */

export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isNodeProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True on Vercel production deploys (or NODE_ENV=production when not on Vercel). */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

/**
 * Demo wallet is allowed only when explicitly enabled, or outside production.
 * Set NEXT_PUBLIC_ALLOW_DEMO=true to enable demo on a production deploy (not recommended).
 */
export function allowDemoWallet(): boolean {
  const flag = process.env.NEXT_PUBLIC_ALLOW_DEMO?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return !isProductionRuntime();
}

/** Production must use durable Postgres. */
export function requireDurableStore(): boolean {
  return isProductionRuntime();
}

export function operatorSecretConfigured(): boolean {
  return Boolean(process.env.OPERATOR_SECRET?.trim());
}

export function getOperatorSecret(): string | null {
  return process.env.OPERATOR_SECRET?.trim() || null;
}
