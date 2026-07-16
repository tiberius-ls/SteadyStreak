"use client";

import { STORAGE_KEY } from "./constants";
import type {
  AppState,
  Checkin,
  Cycle,
  Payout,
  User,
} from "./types";

const emptyState = (): AppState => ({
  user: null,
  cycles: [],
  checkins: [],
  payouts: [],
  onboardingComplete: false,
});

export function loadState(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...emptyState(),
      ...parsed,
      cycles: parsed.cycles ?? [],
      checkins: parsed.checkins ?? [],
      payouts: parsed.payouts ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getActiveCycle(state: AppState): Cycle | null {
  return (
    state.cycles.find((c) => c.status === "active") ??
    state.cycles.find((c) => c.status === "completed") ??
    null
  );
}

export function getLatestCycle(state: AppState): Cycle | null {
  if (!state.cycles.length) return null;
  return [...state.cycles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

export function checkinsForCycle(
  state: AppState,
  cycleId: string
): Checkin[] {
  return state.checkins
    .filter((c) => c.cycleId === cycleId)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

export function upsertUser(state: AppState, user: User): AppState {
  return { ...state, user };
}

export function addCycle(state: AppState, cycle: Cycle): AppState {
  return {
    ...state,
    cycles: [...state.cycles, cycle],
    onboardingComplete: true,
  };
}

export function updateCycle(
  state: AppState,
  cycleId: string,
  patch: Partial<Cycle>
): AppState {
  return {
    ...state,
    cycles: state.cycles.map((c) =>
      c.id === cycleId ? { ...c, ...patch } : c
    ),
  };
}

export function addCheckin(state: AppState, checkin: Checkin): AppState {
  // Prevent duplicate day check-ins
  if (
    state.checkins.some(
      (c) => c.cycleId === checkin.cycleId && c.dayNumber === checkin.dayNumber
    )
  ) {
    return state;
  }
  return { ...state, checkins: [...state.checkins, checkin] };
}

export function addPayout(state: AppState, payout: Payout): AppState {
  return { ...state, payouts: [...state.payouts, payout] };
}
