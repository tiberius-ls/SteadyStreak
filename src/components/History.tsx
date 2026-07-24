"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  BrandBar,
  Button,
  Card,
  NavBar,
  Shell,
  Stat,
} from "@/components/ui";
import { statusLabel } from "@/lib/history";

export function History() {
  const {
    cycleHistory,
    activeCycle,
    latestCycle,
    setScreen,
    formatNim,
    startNewCycle,
  } = useApp();

  const [openId, setOpenId] = useState<string | null>(null);

  const showPayout =
    latestCycle?.status === "completed" ||
    latestCycle?.status === "broken" ||
    latestCycle?.status === "paid_out";

  const totals = useMemo(() => {
    let putIn = 0;
    let gotBack = 0;
    for (const h of cycleHistory) {
      putIn += h.breakdown.totalContributedLuna;
      gotBack += h.breakdown.totalLuna;
    }
    return { putIn, gotBack, net: gotBack - putIn };
  }, [cycleHistory]);

  return (
    <Shell>
      <BrandBar />
      <header className="app-header">
        <div>
          <h1>History</h1>
          <p className="muted header-sub">
            Past cycles stay on this device. Start a new run anytime — nothing
            is wiped.
          </p>
        </div>
      </header>

      {cycleHistory.length > 0 ? (
        <Card className="compact glass">
          <div className="stat-grid two history-totals">
            <Stat
              label="All-time put in"
              value={`${formatNim(totals.putIn)} NIM`}
            />
            <Stat
              label="All-time back"
              value={`${formatNim(totals.gotBack)} NIM`}
            />
          </div>
          <p className="muted tiny center" style={{ marginTop: 8 }}>
            Net{" "}
            <strong>
              {totals.net >= 0 ? "+" : ""}
              {formatNim(totals.net)} NIM
            </strong>{" "}
            across {cycleHistory.length} cycle
            {cycleHistory.length === 1 ? "" : "s"}
          </p>
        </Card>
      ) : null}

      {!activeCycle ? (
        <Button className="full" onClick={() => startNewCycle()}>
          Start a new cycle
        </Button>
      ) : (
        <Button
          className="full"
          variant="secondary"
          onClick={() => setScreen("home")}
        >
          Back to active cycle
        </Button>
      )}

      {cycleHistory.length === 0 ? (
        <Card>
          <p className="muted center">
            No finished cycles yet. Complete or break a streak to build history.
          </p>
        </Card>
      ) : (
        <ul className="history-list">
          {cycleHistory.map((entry) => {
            const { cycle, breakdown, checkinCount, payout } = entry;
            const open = openId === cycle.id;
            return (
              <li key={cycle.id}>
                <button
                  type="button"
                  className={`history-row ${open ? "open" : ""}`}
                  onClick={() =>
                    setOpenId((id) => (id === cycle.id ? null : cycle.id))
                  }
                >
                  <div className="history-main">
                    <div className="history-top">
                      <strong>{cycle.habit}</strong>
                      <span
                        className={`history-status status-${cycle.status}`}
                      >
                        {statusLabel(cycle.status)}
                      </span>
                    </div>
                    <p className="muted tiny">
                      {cycle.length} days · started {cycle.startDate} ·{" "}
                      {checkinCount} check-in
                      {checkinCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="history-return">
                    <strong
                      className={
                        breakdown.effectiveReturnPct >= 0 ? "pos" : "neg"
                      }
                    >
                      {breakdown.effectiveReturnPct >= 0 ? "+" : ""}
                      {breakdown.effectiveReturnPct.toFixed(1)}%
                    </strong>
                    <span className="tiny">cycle</span>
                  </div>
                </button>
                {open ? (
                  <Card className="history-detail">
                    <div className="stat-grid two">
                      <Stat
                        label="Put in"
                        value={`${formatNim(breakdown.totalContributedLuna)} NIM`}
                      />
                      <Stat
                        label="Got back"
                        value={`${formatNim(breakdown.totalLuna)} NIM`}
                      />
                      <Stat
                        label="Savings"
                        value={`${formatNim(breakdown.savingsPrincipalLuna)} NIM`}
                      />
                      <Stat
                        label="Stake returned"
                        value={`${formatNim(breakdown.ownStakeLuna)} NIM`}
                      />
                      <Stat
                        label="Pool bonus"
                        value={`${formatNim(breakdown.bonusFromPoolLuna)} NIM`}
                      />
                      <Stat
                        label="Net"
                        value={`${breakdown.netProfitLuna >= 0 ? "+" : ""}${formatNim(
                          breakdown.netProfitLuna
                        )} NIM`}
                      />
                    </div>
                    {payout ? (
                      <p className="muted tiny" style={{ marginTop: 10 }}>
                        Claimed {new Date(payout.claimedAt).toLocaleString()} ·{" "}
                        <span className="mono">{payout.txHash}</span>
                      </p>
                    ) : (
                      <p className="muted tiny" style={{ marginTop: 10 }}>
                        No claim recorded yet
                        {showPayout && latestCycle?.id === cycle.id
                          ? " — open Payout to record."
                          : "."}
                      </p>
                    )}
                    {showPayout && latestCycle?.id === cycle.id ? (
                      <Button
                        className="full"
                        variant="secondary"
                        style={{ marginTop: 10 }}
                        onClick={() => setScreen("payout")}
                      >
                        Open payout
                      </Button>
                    ) : null}
                  </Card>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <NavBar
        active="history"
        onNavigate={setScreen}
        showPayout={showPayout}
      />
    </Shell>
  );
}
