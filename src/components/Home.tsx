"use client";

import { useApp } from "@/context/AppContext";
import {
  Button,
  Card,
  DayStrip,
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
    startNewCycle,
    cycleHistory,
  } = useApp();

  const showPayout =
    latestCycle?.status === "completed" ||
    latestCycle?.status === "broken" ||
    latestCycle?.status === "paid_out";

  // No active run — prompt to start; history is preserved
  if (!activeCycle) {
    return (
      <Shell>
        <Header
          title="Ready for the next streak?"
          subtitle={
            cycleHistory.length
              ? `${cycleHistory.length} past cycle${
                  cycleHistory.length === 1 ? "" : "s"
                } saved on this device.`
              : "Connect, set amounts, and Mark done every day."
          }
        />
        <Card className="hero-card">
          <p className="muted small center">
            Starting a new cycle does <strong>not</strong> erase history.
            Open History anytime to review returns.
          </p>
          <Button className="full mark-done" onClick={() => startNewCycle()}>
            Start a new cycle
          </Button>
          {cycleHistory.length > 0 ? (
            <Button
              className="full"
              variant="secondary"
              onClick={() => setScreen("history")}
            >
              View history
            </Button>
          ) : null}
          {showPayout ? (
            <Button
              className="full"
              variant="ghost"
              onClick={() => setScreen("payout")}
            >
              Open last payout
            </Button>
          ) : null}
        </Card>
        <NavBar
          active="home"
          onNavigate={setScreen}
          showPayout={showPayout}
        />
      </Shell>
    );
  }

  const cycle = activeCycle;
  const streak = streakInfo?.currentStreak ?? 0;
  const remaining = daysRemaining(cycle);
  const checkedIn = streakInfo?.checkedInToday ?? false;
  const canCheckIn =
    cycle.status === "active" &&
    !checkedIn &&
    streakInfo?.todayDayNumber != null;
  const tier = tierForStreak(streak);
  const flameCount = Math.min(5, Math.max(1, streak || 1));

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
          <div className="streak-row">
            <span className="streak-num">{streak}</span>
            <div className="streak-meta">
              <span className="streak-label">day streak</span>
              <span className="flame-row" aria-hidden>
                {Array.from({ length: flameCount }, (_, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src="/icon.svg"
                    alt=""
                    width={18}
                    height={18}
                    className="streak-mini-icon"
                  />
                ))}
              </span>
            </div>
          </div>
        </div>

        <DayStrip
          length={cycle.length}
          checkedDays={checkins.map((c) => c.dayNumber)}
          todayDay={streakInfo?.todayDayNumber ?? null}
        />

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
                : "Mark done ✓"}
        </Button>
        <p className="muted tiny center">
          {canCheckIn
            ? "Tap to claim today’s streak"
            : checkedIn
              ? "You’re good until tomorrow"
              : "Check-ins send save + stake to escrow"}
          {client?.isMock ? " · demo mode" : ""}
        </p>
        <p className="muted tiny center amount-line">
          <strong>
            {formatNim(cycle.dailySaveLuna + cycle.dailyStakeLuna)} NIM
          </strong>{" "}
          (save {formatNim(cycle.dailySaveLuna)} + stake{" "}
          {formatNim(cycle.dailyStakeLuna)})
        </p>
        {cycle.status === "active" && !checkedIn ? (
          <p className="reminder">
            Check in before <strong>midnight local time</strong> or your streak
            breaks and stake goes to the pool.
          </p>
        ) : null}
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
        <Card className="stat-card">
          <Stat
            label="Private savings"
            value={`${formatNim(privateSavingsLuna)} NIM`}
            hint="Always returned to you"
          />
        </Card>
        <Card className="stat-card">
          <Stat
            label="Your stake"
            value={`${formatNim(privateStakeLuna)} NIM`}
            hint="At risk if streak breaks"
          />
        </Card>
        <Card className="stat-card pool-card">
          <Stat
            label="Pool pot"
            value={`${formatNim(poolForfeitLuna)} NIM`}
            hint={
              poolForfeitLuna > 0
                ? `Forfeits · ${poolSurvivorCount} survivor${
                    poolSurvivorCount === 1 ? "" : "s"
                  }`
                : "Grows when others break"
            }
          />
        </Card>
        <Card className="stat-card">
          <Stat
            label="Pool rank"
            value={rank ? `#${rank}` : "—"}
            hint="By streak only"
          />
        </Card>
      </div>

      <Card className="compact glass">
        <p className="muted tiny">
          Escrow · {shortAddress(ESCROW_ADDRESS, 5)}
          <br />
          Wallet · {shortAddress(state.user?.walletAddress ?? "", 5)}
          <br />
          Pool · {cycle.poolId} · {checkins.length}/{cycle.length} check-ins
          {cycleHistory.length > 0
            ? ` · ${cycleHistory.length} past cycle${
                cycleHistory.length === 1 ? "" : "s"
              }`
            : ""}
        </p>
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

      <NavBar active="home" onNavigate={setScreen} showPayout={showPayout} />
    </Shell>
  );
}
