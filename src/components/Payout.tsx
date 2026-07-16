"use client";

import { useApp } from "@/context/AppContext";
import {
  Button,
  Card,
  ErrorBanner,
  Header,
  NavBar,
  Shell,
  Stat,
} from "@/components/ui";

export function Payout() {
  const {
    latestCycle,
    payoutBreakdown,
    claimPayout,
    startNewCycle,
    busy,
    error,
    clearError,
    formatNim,
    setScreen,
    state,
  } = useApp();

  const cycle = latestCycle;
  if (!cycle) {
    return (
      <Shell>
        <Header title="No cycle to settle" />
        <Button className="full" onClick={() => setScreen("onboarding")}>
          Start a cycle
        </Button>
      </Shell>
    );
  }

  const broken = cycle.status === "broken";
  const completed =
    cycle.status === "completed" || cycle.status === "paid_out";
  const paid = cycle.status === "paid_out";
  const payout = state.payouts.find((p) => p.cycleId === cycle.id);

  return (
    <Shell>
      <Header
        title={broken ? "Streak broken" : completed ? "Cycle complete!" : "Payout"}
        subtitle={
          broken
            ? `Missed day ${cycle.brokenAtDay ?? "—"}. Savings stay yours; stake goes to the pool.`
            : "Your savings return. Survivors split the forfeited stake pool."
        }
      />
      <ErrorBanner message={error} onDismiss={clearError} />

      {payoutBreakdown ? (
        <>
          <Card className="highlight">
            <h2 className="card-title">Payout breakdown</h2>
            <div className="stat-grid">
              <Stat
                label="Savings principal"
                value={`${formatNim(payoutBreakdown.savingsPrincipalLuna)} NIM`}
                hint="Zero risk — always returned"
              />
              <Stat
                label="Stake returned"
                value={`${formatNim(payoutBreakdown.ownStakeLuna)} NIM`}
                hint={broken ? "Forfeited to pool" : "You kept your streak"}
              />
              <Stat
                label="Pool bonus"
                value={`${formatNim(payoutBreakdown.bonusFromPoolLuna)} NIM`}
                hint={
                  completed
                    ? `×${payoutBreakdown.multiplier.toFixed(2)} multiplier share`
                    : "Survivors only"
                }
              />
              <Stat
                label="Total payout"
                value={`${formatNim(payoutBreakdown.totalLuna)} NIM`}
              />
            </div>
          </Card>

          <Card>
            <h2 className="card-title">Stake pool</h2>
            <p className="muted small">
              Forfeited pool total:{" "}
              <strong>
                {formatNim(payoutBreakdown.totalForfeitedLuna)} NIM
              </strong>
            </p>
            <p className="muted small">
              Survivors in cohort:{" "}
              <strong>{payoutBreakdown.survivorCount}</strong>
            </p>
            <p className="muted tiny">
              Formula:{" "}
              <code>multiplier = min(3, streak_days / cycle_length × 3)</code>
              . Applied only to each survivor&apos;s share of the stake pool —
              never to savings.
            </p>
          </Card>

          <Card className="compact">
            <h2 className="card-title">How payouts work</h2>
            <p className="muted small">
              Daily check-ins send NIM to the <strong>escrow</strong> wallet.
              This screen calculates what you&apos;re owed.{" "}
              <strong>Claim</strong> records that amount in the app — it does
              not move coins by itself.
            </p>
            <p className="muted small">
              The <strong>pool operator</strong> (escrow owner) then sends the
              total from escrow to your Nimiq Pay wallet:
            </p>
            <ul className="muted small payout-rules">
              <li>
                <strong>Broken streak</strong> — savings principal only; stake
                stays in the shared pool
              </li>
              <li>
                <strong>Completed cycle</strong> — savings + your stake + pool
                bonus share
              </li>
            </ul>
            <p className="muted tiny">
              Escrow private keys never live in this mini app. Releases are
              manual on purpose.
            </p>
          </Card>
        </>
      ) : (
        <Card>
          <p className="muted">
            Finish or break a cycle to see payout details.
          </p>
        </Card>
      )}

      {payout ? (
        <Card>
          <p className="small">
            Claim recorded · <span className="mono">{payout.txHash}</span>
          </p>
          <p className="muted tiny">
            Operator should release{" "}
            <strong>{formatNim(payout.totalLuna)} NIM</strong> from escrow to{" "}
            <span className="mono">
              {cycle.walletAddress}
            </span>
            . Demo mode only stores the claim on-device.
          </p>
        </Card>
      ) : null}

      <div className="stack-sm">
        {!paid && payoutBreakdown ? (
          <Button className="full" onClick={() => claimPayout()} disabled={busy}>
            {busy
              ? "Recording claim…"
              : `Record claim · ${formatNim(payoutBreakdown.totalLuna)} NIM`}
          </Button>
        ) : null}
        <Button
          className="full"
          variant={paid ? "primary" : "secondary"}
          onClick={() => startNewCycle()}
        >
          Start a new cycle
        </Button>
      </div>

      <NavBar active="payout" onNavigate={setScreen} showPayout />
    </Shell>
  );
}
