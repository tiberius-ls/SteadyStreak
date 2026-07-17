import type { CycleLength, CycleStatus } from "./types";
import { CYCLE_LENGTHS } from "./types";

/** Loose Nimiq user-friendly address check (spaces optional). */
export function isValidNimiqAddress(address: string): boolean {
  const compact = address.replace(/\s+/g, "").toUpperCase();
  // NQ + 2 check digits + 32 base32-ish chars (0-9 A-Z, excluding some)
  if (!/^NQ[0-9]{2}[0-9A-Z]{32}$/.test(compact)) return false;
  return true;
}

export function normalizeNimiqAddress(address: string): string {
  const compact = address.replace(/\s+/g, "").toUpperCase();
  if (compact.length !== 36) return address.trim();
  // NQ## + 8 groups of 4
  const body = compact.slice(2);
  const groups = body.match(/.{1,4}/g) ?? [];
  return `NQ${groups.join(" ")}`;
}

export function sanitizeHabit(habit: unknown, max = 80): string {
  if (typeof habit !== "string") return "Habit";
  const cleaned = habit.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return "Habit";
  return cleaned.slice(0, max);
}

export function parseCycleLength(value: unknown): CycleLength {
  const n = Number(value);
  if ((CYCLE_LENGTHS as number[]).includes(n)) return n as CycleLength;
  return 30;
}

export function parseStreak(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 0 || n > 365) return null;
  return n;
}

export function parseLunaAmount(value: unknown, max = 1e15): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 0 || n > max) return null;
  return n;
}

const STATUSES: CycleStatus[] = [
  "active",
  "completed",
  "broken",
  "paid_out",
];

export function parseCycleStatus(value: unknown): CycleStatus {
  if (typeof value === "string" && (STATUSES as string[]).includes(value)) {
    return value as CycleStatus;
  }
  return "active";
}

export function isNonEmptyString(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
