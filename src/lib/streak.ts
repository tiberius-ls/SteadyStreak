import type {
  Checkin,
  Cycle,
  CycleLength,
  CycleStatus,
  Tier,
} from "./types";
import { TIER_THRESHOLDS } from "./constants";

/** Local calendar date YYYY-MM-DD */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as local midnight */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/**
 * Day number for a cycle (1-based).
 * Day 1 = startDate. Returns null if before start or after cycle end.
 */
export function dayNumberForDate(
  cycle: Pick<Cycle, "startDate" | "length">,
  date: Date = new Date()
): number | null {
  const today = localDateString(date);
  const start = cycle.startDate;
  if (today < start) return null;

  const startMs = parseLocalDate(start).getTime();
  const todayMs = parseLocalDate(today).getTime();
  const diff = Math.floor((todayMs - startMs) / 86_400_000) + 1;

  if (diff < 1 || diff > cycle.length) return null;
  return diff;
}

export function daysRemaining(
  cycle: Pick<Cycle, "startDate" | "length">,
  date: Date = new Date()
): number {
  const day = dayNumberForDate(cycle, date);
  if (day === null) {
    const today = localDateString(date);
    if (today < cycle.startDate) {
      return cycle.length;
    }
    return 0;
  }
  return Math.max(0, cycle.length - day);
}

export function cycleEndDate(cycle: Pick<Cycle, "startDate" | "length">): string {
  return addDays(cycle.startDate, cycle.length - 1);
}

export function isCycleEnded(
  cycle: Pick<Cycle, "startDate" | "length">,
  date: Date = new Date()
): boolean {
  return localDateString(date) > cycleEndDate(cycle);
}

/**
 * Expected consecutive day numbers that should have check-ins.
 * If any day before today is missing → streak is broken.
 * A check-in only counts for "today"; missing a prior local calendar day
 * breaks the streak (missed before midnight of that day).
 */
export function evaluateStreak(
  cycle: Cycle,
  checkins: Checkin[],
  now: Date = new Date()
): {
  currentStreak: number;
  status: CycleStatus;
  brokenAtDay?: number;
  missedDay?: number;
  checkedInToday: boolean;
  todayDayNumber: number | null;
} {
  if (cycle.status === "paid_out") {
    return {
      currentStreak: cycle.length,
      status: "paid_out",
      checkedInToday: true,
      todayDayNumber: cycle.length,
    };
  }
  if (cycle.status === "broken") {
    return {
      currentStreak: 0,
      status: "broken",
      brokenAtDay: cycle.brokenAtDay,
      checkedInToday: false,
      todayDayNumber: dayNumberForDate(cycle, now),
    };
  }
  if (cycle.status === "completed") {
    return {
      currentStreak: cycle.length,
      status: "completed",
      checkedInToday: true,
      todayDayNumber: cycle.length,
    };
  }

  const byDay = new Map(checkins.map((c) => [c.dayNumber, c]));
  const today = localDateString(now);
  const todayDay = dayNumberForDate(cycle, now);

  // Before start
  if (today < cycle.startDate) {
    return {
      currentStreak: 0,
      status: "active",
      checkedInToday: false,
      todayDayNumber: null,
    };
  }

  // Cycle calendar ended — check if all days present
  if (isCycleEnded(cycle, now) || todayDay === null) {
    for (let d = 1; d <= cycle.length; d++) {
      if (!byDay.has(d)) {
        return {
          currentStreak: 0,
          status: "broken",
          brokenAtDay: d,
          missedDay: d,
          checkedInToday: false,
          todayDayNumber: null,
        };
      }
    }
    return {
      currentStreak: cycle.length,
      status: "completed",
      checkedInToday: true,
      todayDayNumber: cycle.length,
    };
  }

  // Must have check-ins for every day before today
  for (let d = 1; d < todayDay; d++) {
    if (!byDay.has(d)) {
      return {
        currentStreak: 0,
        status: "broken",
        brokenAtDay: d,
        missedDay: d,
        checkedInToday: byDay.has(todayDay),
        todayDayNumber: todayDay,
      };
    }
  }

  const checkedInToday = byDay.has(todayDay);
  const currentStreak = checkedInToday ? todayDay : todayDay - 1;

  // Full cycle completed today
  if (checkedInToday && todayDay === cycle.length) {
    return {
      currentStreak: cycle.length,
      status: "completed",
      checkedInToday: true,
      todayDayNumber: todayDay,
    };
  }

  return {
    currentStreak: Math.max(0, currentStreak),
    status: "active",
    checkedInToday,
    todayDayNumber: todayDay,
  };
}

/**
 * Multiplier for stake-pool share.
 * formula: min(3, streak_days / cycle_length * 3)
 */
export function stakeMultiplier(
  streakDays: number,
  cycleLength: CycleLength
): number {
  if (cycleLength <= 0) return 0;
  return Math.min(3, (streakDays / cycleLength) * 3);
}

export function tierForStreak(streak: number): Tier {
  if (streak >= TIER_THRESHOLDS.gold) return "gold";
  if (streak >= TIER_THRESHOLDS.silver) return "silver";
  if (streak >= TIER_THRESHOLDS.bronze) return "bronze";
  return "none";
}

export function tierLabel(tier: Tier): string {
  switch (tier) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    default:
      return "Starter";
  }
}

export function makePoolId(length: CycleLength, startDate: string): string {
  return `${length}d:${startDate}`;
}

/** NIM helpers */
export function nimToLuna(nim: number): number {
  return Math.round(nim * 100_000);
}

export function lunaToNim(luna: number): number {
  return luna / 100_000;
}

export function formatNim(luna: number, digits = 2): string {
  return lunaToNim(luna).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
