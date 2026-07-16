/** Escrow receives combined daily save + stake NIM. Configure for production. */
export const ESCROW_ADDRESS =
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS ??
  "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";

export const APP_NAME = "SteadyStreak";
export const STORAGE_KEY = "steadystreak:v1";
export const MOCK_MODE_KEY = "steadystreak:mock";

/** Tier thresholds by current streak length (days). */
export const TIER_THRESHOLDS = {
  bronze: 7,
  silver: 21,
  gold: 45,
} as const;

export const DEEPLINK_BASE = "nimiqpay://miniapp?url=";
