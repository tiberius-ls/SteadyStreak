"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet,
  isMockWalletAddress,
  shortAddress,
  type NimiqClient,
} from "@/lib/nimiq";
import { newId } from "@/lib/id";
import {
  addCheckin,
  addCycle,
  addPayout,
  checkinsForCycle,
  getActiveCycle,
  getLatestCycle,
  loadState,
  saveState,
  updateCycle,
} from "@/lib/store";
import {
  dayNumberForDate,
  evaluateStreak,
  formatNim,
  localDateString,
  makePoolId,
  nimToLuna,
  tierForStreak,
} from "@/lib/streak";
import { calculatePayout, forfeitedStakeLuna } from "@/lib/payout";
import type {
  AppState,
  Checkin,
  Cycle,
  CycleLength,
  Payout,
  PayoutBreakdown,
  User,
} from "@/lib/types";

export type Screen =
  | "onboarding"
  | "setup"
  | "home"
  | "leaderboard"
  | "payout";

interface AppContextValue {
  ready: boolean;
  state: AppState;
  client: NimiqClient | null;
  screen: Screen;
  setScreen: (s: Screen) => void;
  error: string | null;
  clearError: () => void;
  busy: boolean;

  // Wallet
  connect: (forceMock?: boolean) => Promise<void>;
  disconnect: () => void;

  // Onboarding draft
  draftHabit: string;
  setDraftHabit: (h: string) => void;
  draftLength: CycleLength;
  setDraftLength: (l: CycleLength) => void;
  customHabit: string;
  setCustomHabit: (h: string) => void;

  // Setup
  dailySaveNim: string;
  setDailySaveNim: (v: string) => void;
  dailyStakeNim: string;
  setDailyStakeNim: (v: string) => void;
  confirmSetup: () => Promise<void>;

  // Active cycle helpers
  activeCycle: Cycle | null;
  latestCycle: Cycle | null;
  checkins: Checkin[];
  streakInfo: ReturnType<typeof evaluateStreak> | null;
  privateSavingsLuna: number;
  privateStakeLuna: number;
  /** Shared forfeited stake pot for this cycle's pool cohort (luna) */
  poolForfeitLuna: number;
  /** Survivors registered in this pool cohort */
  poolSurvivorCount: number;
  rank: number | null;

  // Actions
  markDone: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  leaderboard: Array<{
    walletAddress: string;
    habit: string;
    streak: number;
    cycleLength: number;
    tier: string;
    status: string;
  }>;
  payoutBreakdown: PayoutBreakdown | null;
  claimPayout: () => Promise<void>;
  startNewCycle: () => void;
  /** Demo only: shift cycle start back one day so another check-in is available */
  demoAdvanceDay: () => void;
  shortAddress: typeof shortAddress;
  formatNim: typeof formatNim;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(() => ({
    user: null,
    cycles: [],
    checkins: [],
    payouts: [],
    onboardingComplete: false,
  }));
  const [client, setClient] = useState<NimiqClient | null>(null);
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [draftHabit, setDraftHabit] = useState("Exercise / workout");
  const [customHabit, setCustomHabit] = useState("");
  const [draftLength, setDraftLength] = useState<CycleLength>(30);
  const [dailySaveNim, setDailySaveNim] = useState("1");
  const [dailyStakeNim, setDailyStakeNim] = useState("0.5");
  const [leaderboard, setLeaderboard] = useState<
    AppContextValue["leaderboard"]
  >([]);
  const [poolForfeit, setPoolForfeit] = useState(0);
  const [poolSurvivors, setPoolSurvivors] = useState<
    Array<{ cycle: Cycle; checkins: Checkin[] }>
  >([]);

  // Hydrate from localStorage
  useEffect(() => {
    const s = loadState();
    setState(s);
    if (s.user) {
      const latest = getLatestCycle(s);
      if (latest?.status === "completed" || latest?.status === "broken") {
        setScreen("payout");
      } else if (latest) {
        setScreen("home");
      } else if (s.onboardingComplete) {
        setScreen("setup");
      }
    }
    setReady(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!ready) return;
    saveState(state);
  }, [state, ready]);

  const isDemoSession = useCallback(
    (walletAddress?: string | null) => {
      if (client?.isMock) return true;
      if (isMockWalletAddress(walletAddress ?? state.user?.walletAddress)) {
        return true;
      }
      return false;
    },
    [client, state.user?.walletAddress]
  );

  // Re-evaluate streak breakage when cycle is active
  useEffect(() => {
    if (!ready) return;
    const cycle = getActiveCycle(state);
    if (!cycle || cycle.status !== "active") return;

    const ch = checkinsForCycle(state, cycle.id);
    const info = evaluateStreak(cycle, ch);
    const demo = isMockWalletAddress(cycle.walletAddress) || client?.isMock;
    if (info.status === "broken" && cycle.status === "active") {
      setState((prev) => {
        const next = updateCycle(prev, cycle.id, {
          status: "broken",
          brokenAtDay: info.brokenAtDay,
        });
        // Forfeit stakes to shared pool — never publish demo wallets
        if (!demo) {
          const stake = forfeitedStakeLuna(ch);
          void fetch("/api/pool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "forfeit",
              poolId: cycle.poolId,
              cycleLength: cycle.length,
              cycleId: cycle.id,
              amountLuna: stake,
            }),
          }).catch(() => {});
          void fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: cycle.walletAddress,
              habit: cycle.habit,
              streak: 0,
              cycleLength: cycle.length,
              status: "broken",
            }),
          }).catch(() => {});
        }
        return next;
      });
      setScreen("payout");
    } else if (info.status === "completed" && cycle.status === "active") {
      setState((prev) =>
        updateCycle(prev, cycle.id, { status: "completed" })
      );
      if (!demo) {
        const stake = ch.reduce((s, c) => s + c.stakeLuna, 0);
        void fetch("/api/pool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "survivor",
            cycleId: cycle.id,
            poolId: cycle.poolId,
            walletAddress: cycle.walletAddress,
            length: cycle.length,
            stakeLuna: stake,
            streakDays: ch.length,
          }),
        }).catch(() => {});
      }
    }
  }, [ready, state, client?.isMock]);

  const activeCycle = useMemo(() => getActiveCycle(state), [state]);
  const latestCycle = useMemo(() => getLatestCycle(state), [state]);
  const focusCycle = activeCycle ?? latestCycle;
  const checkins = useMemo(
    () => (focusCycle ? checkinsForCycle(state, focusCycle.id) : []),
    [state, focusCycle]
  );
  const streakInfo = useMemo(() => {
    if (!focusCycle) return null;
    return evaluateStreak(focusCycle, checkins);
  }, [focusCycle, checkins]);

  const privateSavingsLuna = useMemo(
    () => checkins.reduce((s, c) => s + c.saveLuna, 0),
    [checkins]
  );
  const privateStakeLuna = useMemo(
    () => checkins.reduce((s, c) => s + c.stakeLuna, 0),
    [checkins]
  );

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      setLeaderboard(data.leaderboard ?? []);
    } catch {
      // ignore network errors offline
    }
  }, []);

  const refreshPool = useCallback(async (poolId: string) => {
    try {
      const res = await fetch(`/api/pool?poolId=${encodeURIComponent(poolId)}`);
      const data = await res.json();
      setPoolForfeit(data.pool?.totalForfeitedLuna ?? 0);
      // Map survivors into minimal shape for payout calc
      const survivors = (data.survivors ?? []).map(
        (s: {
          cycleId: string;
          walletAddress: string;
          length: CycleLength;
          stakeLuna: number;
          streakDays: number;
        }) => {
          const syntheticCycle: Cycle = {
            id: s.cycleId,
            userId: s.walletAddress,
            walletAddress: s.walletAddress,
            habit: "",
            length: s.length,
            startDate: localDateString(),
            dailySaveLuna: 0,
            dailyStakeLuna: 0,
            status: "completed",
            poolId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            createdAt: new Date().toISOString(),
          };
          const syntheticCheckins: Checkin[] = Array.from(
            { length: s.streakDays },
            (_, i) => ({
              id: `${s.cycleId}-${i}`,
              userId: s.walletAddress,
              cycleId: s.cycleId,
              dayNumber: i + 1,
              txHash: "",
              timestamp: new Date().toISOString(),
              saveLuna: 0,
              stakeLuna: Math.floor(s.stakeLuna / Math.max(1, s.streakDays)),
            })
          );
          // Fix last checkin to absorb remainder
          if (syntheticCheckins.length) {
            const sum = syntheticCheckins.reduce((a, c) => a + c.stakeLuna, 0);
            syntheticCheckins[syntheticCheckins.length - 1].stakeLuna +=
              s.stakeLuna - sum;
          }
          return { cycle: syntheticCycle, checkins: syntheticCheckins };
        }
      );
      setPoolSurvivors(survivors);
    } catch {
      setPoolForfeit(0);
    }
  }, []);

  useEffect(() => {
    if (screen === "leaderboard" || screen === "home") {
      void refreshLeaderboard();
    }
    if (focusCycle && (screen === "payout" || screen === "home")) {
      void refreshPool(focusCycle.poolId);
    }
  }, [screen, focusCycle, refreshLeaderboard, refreshPool]);

  const rank = useMemo(() => {
    if (!state.user) return null;
    const idx = leaderboard.findIndex(
      (e) => e.walletAddress === state.user!.walletAddress
    );
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, state.user]);

  const payoutBreakdown = useMemo((): PayoutBreakdown | null => {
    if (!focusCycle) return null;
    if (
      focusCycle.status !== "completed" &&
      focusCycle.status !== "broken" &&
      focusCycle.status !== "paid_out"
    ) {
      // Still show preview near end
      if (streakInfo?.status !== "completed") return null;
    }

    const survivors =
      focusCycle.status === "broken"
        ? poolSurvivors
        : [
            ...poolSurvivors.filter(
              (s) => s.cycle.walletAddress !== focusCycle.walletAddress
            ),
            { cycle: focusCycle, checkins },
          ];

    return calculatePayout({
      cycle: focusCycle,
      checkins,
      totalForfeitedLuna: poolForfeit,
      survivors:
        focusCycle.status === "broken"
          ? []
          : survivors.length
            ? survivors
            : [{ cycle: focusCycle, checkins }],
    });
  }, [focusCycle, checkins, poolForfeit, poolSurvivors, streakInfo]);

  const connect = useCallback(async (forceMock = false) => {
    setBusy(true);
    setError(null);
    try {
      const c = await connectWallet({ forceMock });
      setClient(c);
      const address = c.address!;
      setState((prev) => {
        const user: User = prev.user?.walletAddress === address
          ? prev.user
          : {
              id: prev.user?.id ?? newId(),
              walletAddress: address,
              createdAt: new Date().toISOString(),
            };
        return { ...prev, user };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setClient(null);
  }, []);

  const confirmSetup = useCallback(async () => {
    if (!state.user) {
      setError("Connect your wallet first");
      return;
    }
    const save = Number(dailySaveNim);
    const stake = Number(dailyStakeNim);
    if (!Number.isFinite(save) || save < 0) {
      setError("Enter a valid daily save amount (NIM)");
      return;
    }
    if (!Number.isFinite(stake) || stake < 0) {
      setError("Enter a valid daily stake amount (NIM)");
      return;
    }
    if (save + stake <= 0) {
      setError("Daily total (save + stake) must be greater than 0");
      return;
    }

    const habit =
      draftHabit === "__custom__" ? customHabit.trim() : draftHabit;
    if (!habit) {
      setError("Choose or enter a habit");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const startDate = localDateString();
      const cycle: Cycle = {
        id: newId(),
        userId: state.user.id,
        walletAddress: state.user.walletAddress,
        habit,
        length: draftLength,
        startDate,
        dailySaveLuna: nimToLuna(save),
        dailyStakeLuna: nimToLuna(stake),
        status: "active",
        poolId: makePoolId(draftLength, startDate),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => addCycle(prev, cycle));

      // Demo wallets stay local only — never pollute the public leaderboard
      if (!isDemoSession(cycle.walletAddress)) {
        await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: cycle.walletAddress,
            habit: cycle.habit,
            streak: 0,
            cycleLength: cycle.length,
            status: "active",
          }),
        }).catch(() => {});
      }

      setScreen("home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start cycle");
    } finally {
      setBusy(false);
    }
  }, [
    state.user,
    dailySaveNim,
    dailyStakeNim,
    draftHabit,
    customHabit,
    draftLength,
    isDemoSession,
  ]);

  const markDone = useCallback(async () => {
    if (!focusCycle || focusCycle.status !== "active") {
      setError("No active cycle");
      return;
    }
    let wallet = client;
    if (!wallet) {
      wallet = await connectWallet();
      setClient(wallet);
    }

    const day = dayNumberForDate(focusCycle);
    if (day === null) {
      setError("Outside of cycle window");
      return;
    }
    if (checkins.some((c) => c.dayNumber === day)) {
      setError("Already checked in today");
      return;
    }

    // Ensure previous days exist (missed day breaks streak)
    const info = evaluateStreak(focusCycle, checkins);
    if (info.status === "broken") {
      setError(
        `Streak broken — missed day ${info.missedDay}. Your stake goes to the pool; savings stay yours.`
      );
      setState((prev) =>
        updateCycle(prev, focusCycle.id, {
          status: "broken",
          brokenAtDay: info.brokenAtDay,
        })
      );
      setScreen("payout");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const txHash = await wallet.sendCheckinTransaction({
        saveLuna: focusCycle.dailySaveLuna,
        stakeLuna: focusCycle.dailyStakeLuna,
        cycleId: focusCycle.id,
        dayNumber: day,
      });

      const checkin: Checkin = {
        id: newId(),
        userId: focusCycle.userId,
        cycleId: focusCycle.id,
        dayNumber: day,
        txHash,
        timestamp: new Date().toISOString(),
        saveLuna: focusCycle.dailySaveLuna,
        stakeLuna: focusCycle.dailyStakeLuna,
      };

      setState((prev) => {
        let next = addCheckin(prev, checkin);
        const all = checkinsForCycle(next, focusCycle.id);
        const after = evaluateStreak(
          { ...focusCycle, status: "active" },
          all
        );
        if (after.status === "completed") {
          next = updateCycle(next, focusCycle.id, { status: "completed" });
        }
        return next;
      });

      const newStreak = day;
      const demo = wallet.isMock || isDemoSession(focusCycle.walletAddress);

      if (!demo) {
        await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: focusCycle.walletAddress,
            habit: focusCycle.habit,
            streak: newStreak,
            cycleLength: focusCycle.length,
            status: day === focusCycle.length ? "completed" : "active",
          }),
        }).catch(() => {});
      }

      if (day === focusCycle.length) {
        if (!demo) {
          const stake =
            (checkins.length + 1) * focusCycle.dailyStakeLuna;
          await fetch("/api/pool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "survivor",
              cycleId: focusCycle.id,
              poolId: focusCycle.poolId,
              walletAddress: focusCycle.walletAddress,
              length: focusCycle.length,
              stakeLuna: stake,
              streakDays: day,
            }),
          }).catch(() => {});
        }
        setScreen("payout");
      }

      if (!demo) await refreshLeaderboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in transaction failed");
    } finally {
      setBusy(false);
    }
  }, [focusCycle, client, checkins, refreshLeaderboard, isDemoSession]);

  const claimPayout = useCallback(async () => {
    if (!focusCycle || !payoutBreakdown) return;
    if (focusCycle.status === "paid_out") {
      setError("Already claimed");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Local record + server pending claim for the escrow operator queue.
      const claimRef = `claim-${focusCycle.id.slice(0, 8)}-${Date.now().toString(36)}`;
      const payout: Payout = {
        id: newId(),
        userId: focusCycle.userId,
        cycleId: focusCycle.id,
        walletAddress: focusCycle.walletAddress,
        savingsPrincipalLuna: payoutBreakdown.savingsPrincipalLuna,
        stakeReturnedLuna: payoutBreakdown.ownStakeLuna,
        bonusFromPoolLuna: payoutBreakdown.bonusFromPoolLuna,
        totalLuna: payoutBreakdown.totalLuna,
        multiplier: payoutBreakdown.multiplier,
        txHash: claimRef,
        claimedAt: new Date().toISOString(),
      };

      if (!isDemoSession(focusCycle.walletAddress)) {
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "claim",
            cycleId: focusCycle.id,
            poolId: focusCycle.poolId,
            walletAddress: focusCycle.walletAddress,
            savingsPrincipalLuna: payoutBreakdown.savingsPrincipalLuna,
            stakeReturnedLuna: payoutBreakdown.ownStakeLuna,
            bonusFromPoolLuna: payoutBreakdown.bonusFromPoolLuna,
            totalLuna: payoutBreakdown.totalLuna,
            multiplier: payoutBreakdown.multiplier,
            claimRef,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Failed to register claim with server");
        }
      }

      setState((prev) => {
        let next = addPayout(prev, payout);
        next = updateCycle(next, focusCycle.id, { status: "paid_out" });
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payout failed");
    } finally {
      setBusy(false);
    }
  }, [focusCycle, payoutBreakdown, isDemoSession]);

  const startNewCycle = useCallback(() => {
    setDraftHabit("Exercise / workout");
    setCustomHabit("");
    setDraftLength(30);
    setDailySaveNim("1");
    setDailyStakeNim("0.5");
    setScreen("onboarding");
  }, []);

  /**
   * Demo helper: move startDate one day earlier so "today" maps to the next
   * day number without waiting for midnight. Mock mode only.
   */
  const demoAdvanceDay = useCallback(() => {
    if (!client?.isMock) return;
    const cycle = getActiveCycle(state);
    if (!cycle || cycle.status !== "active") return;
    const [y, m, d] = cycle.startDate.split("-").map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    const nextStart = localDateString(prev);
    setState((s) =>
      updateCycle(s, cycle.id, {
        startDate: nextStart,
        poolId: makePoolId(cycle.length, nextStart),
      })
    );
  }, [client, state]);

  const value: AppContextValue = {
    ready,
    state,
    client,
    screen,
    setScreen,
    error,
    clearError: () => setError(null),
    busy,
    connect,
    disconnect,
    draftHabit,
    setDraftHabit,
    draftLength,
    setDraftLength,
    customHabit,
    setCustomHabit,
    dailySaveNim,
    setDailySaveNim,
    dailyStakeNim,
    setDailyStakeNim,
    confirmSetup,
    activeCycle,
    latestCycle,
    checkins,
    streakInfo,
    privateSavingsLuna,
    privateStakeLuna,
    poolForfeitLuna: poolForfeit,
    poolSurvivorCount: poolSurvivors.length,
    rank,
    markDone,
    refreshLeaderboard,
    leaderboard,
    payoutBreakdown,
    claimPayout,
    startNewCycle,
    demoAdvanceDay,
    shortAddress,
    formatNim,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Re-export tier helper for UI
export { tierForStreak };
