"use client";

import { useApp } from "@/context/AppContext";
import {
  Button,
  Card,
  ErrorBanner,
  Header,
  NavBar,
  ProgressBar,
  Shell,
  Stat,
  TierBadge,
} from "@/components/ui";
import { daysRemaining, tierForStreak } from "@/lib/streak";
import { ESCROW_ADDRESS } from "@/lib/constants";

export function Home() {
  const {
    activeCycle,
    latestCycle,
    streakInfo,
    privateSavingsLuna,
    privateStakeLuna,
    poolForfeitLuna,
    poolSurvivorCount,
    rank,
    markDone,
    busy,
    error,
    clearError,
    setScreen,
    formatNim,
    shortAddress,
    client,
    state,
    checkins,
    demoAdvanceDay,
  } = useApp();

  const cycle = activeCycle ?? latestCycle;
  if (!cycle) {
    return (
      <Shell>
        <Header title="No active cycle" />
        <Button className="full" onClick={() => setScreen("onboarding")}>
          Start a cycle
        </Button>
      </Shell>
    );
  }

  const streak = streakInfo?.currentStreak ?? 0;
  const remaining = daysRemaining(cycle);
  const checkedIn = streakInfo?.checkedInToday ?? false;
  const canCheckIn =
    cycle.status === "active" &&
    !checkedIn &&
    streakInfo?.todayDayNumber != null;
  const tier = tierForStreak(streak);
  const showPayout =
    cycle.status === "completed" ||
    cycle.status === "broken" ||
    cycle.status === "paid_out";

  return (
    <Shell>
      <Header
        title={cycle.habit}
        subtitle={`${cycle.length}-day cycle · day ${
          streakInfo?.todayDayNumber ?? "—"
        } of ${cycle.length}`}
        right={<TierBadge tier={tier} />}
      />
      <ErrorBanner message={error} onDismiss={clearError} />

      <Card className="hero-card">
        <div className="streak-hero">
          <span className="streak-num">{streak}</span>
          <span className="streak-label">day streak</span>
        </div>
        <ProgressBar value={streak} max={cycle.length} />
        <p className="muted small center">
          {remaining > 0
            ? `${remaining} day${remaining === 1 ? "" : "s"} remaining`
            : "Cycle complete"}
        </p>

        <Button
          className="full mark-done"
          onClick={() => markDone()}
          disabled={!canCheckIn || busy}
        >
          {busy
            ? "Confirming in Nimiq Pay…"
            : checkedIn
              ? "Done for today ✓"
              : cycle.status !== "active"
                ? "Cycle ended"
                : "Mark done"}
        </Button>
        <p className="muted tiny center">
          Sends{" "}
          <strong>
            {formatNim(cycle.dailySaveLuna + cycle.dailyStakeLuna)} NIM
          </strong>{" "}
          (save {formatNim(cycle.dailySaveLuna)} + stake{" "}
          {formatNim(cycle.dailyStakeLuna)}) to escrow in one tx.
          {client?.isMock
            ? " · demo mode (simulated)"
            : " · needs enough NIM in this wallet"}
        </p>
        {client?.isMock && cycle.status === "active" ? (
          <Button
            variant="ghost"
            className="full"
            onClick={() => demoAdvanceDay()}
            disabled={busy}
          >
            Demo: advance to next day
          </Button>
        ) : null}
      </Card>

      <div className="stat-grid two">
        <Card>
          <Stat
            label="Private savings"
            value={`${formatNim(privateSavingsLuna)} NIM`}
            hint="Always returned to you"
          />
        </Card>
        <Card>
          <Stat
            label="Your stake in"
            value={`${formatNim(privateStakeLuna)} NIM`}
            hint="At risk if streak breaks"
          />
        </Card>
        <Card>
          <Stat
            label="Pool pot"
            value={`${formatNim(poolForfeitLuna)} NIM`}
            hint={
              poolForfeitLuna > 0
                ? `Forfeits from broken streaks · ${poolSurvivorCount} survivor${
                    poolSurvivorCount === 1 ? "" : "s"
                  }`
                : "Grows when others break · survivors split it"
            }
          />
        </Card>
        <Card>
          <Stat
            label="Pool rank"
            value={rank ? `#${rank}` : "—"}
            hint="By streak only"
          />
        </Card>
        <Card>
          <Stat
            label="Check-ins"
            value={`${checkins.length}/${cycle.length}`}
            hint="Confirmed txs"
          />
        </Card>
      </div>

      <Card className="compact">
        <h2 className="card-title">Your pool cohort</h2>
        <p className="muted small">
          Shared stake pot for{" "}
          <strong>{cycle.length}-day</strong> cycles that started{" "}
          <strong>{cycle.startDate}</strong>. Broken stakes feed the pot;
          survivors split it at cycle end (see Payout).
        </p>
        <p className="muted tiny mono">pool · {cycle.poolId}</p>
      </Card>

      {checkins.length > 0 ? (
        <Card>
          <h2 className="card-title">Recent check-ins</h2>
          <ul className="tx-list">
            {[...checkins]
              .reverse()
              .slice(0, 5)
              .map((c) => (
                <li key={c.id}>
                  <span>Day {c.dayNumber}</span>
                  <span className="mono tiny">
                    {shortAddress(c.txHash, 6)}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <Card className="compact">
        <p className="muted tiny">
          Escrow · {shortAddress(ESCROW_ADDRESS, 5)}
          <br />
          Wallet · {shortAddress(state.user?.walletAddress ?? "", 5)}
        </p>
      </Card>

      <NavBar
        active="home"
        onNavigate={setScreen}
        showPayout={showPayout}
      />
    </Shell>
  );
}
