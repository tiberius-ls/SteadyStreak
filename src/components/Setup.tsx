"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  Button,
  Card,
  ErrorBanner,
  Header,
  Shell,
  Stat,
} from "@/components/ui";
import { formatNim, nimToLuna } from "@/lib/streak";

export function Setup() {
  const {
    draftHabit,
    customHabit,
    draftLength,
    dailySaveNim,
    setDailySaveNim,
    dailyStakeNim,
    setDailyStakeNim,
    confirmSetup,
    busy,
    error,
    clearError,
    setScreen,
    state,
  } = useApp();

  const habit =
    draftHabit === "__custom__" ? customHabit.trim() || "Custom habit" : draftHabit;

  const totals = useMemo(() => {
    const save = Number(dailySaveNim) || 0;
    const stake = Number(dailyStakeNim) || 0;
    const daily = save + stake;
    return {
      save,
      stake,
      daily,
      totalSave: save * draftLength,
      totalStake: stake * draftLength,
      totalCommit: daily * draftLength,
      dailyLuna: nimToLuna(daily),
    };
  }, [dailySaveNim, dailyStakeNim, draftLength]);

  return (
    <Shell>
      <Header
        title="Set your commitment"
        subtitle={`${habit} · ${draftLength}-day cycle`}
        right={
          <Button variant="ghost" onClick={() => setScreen("onboarding")}>
            Back
          </Button>
        }
      />
      <ErrorBanner message={error} onDismiss={clearError} />

      <Card>
        <label className="field">
          <span>Daily save (NIM) — always returned</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={dailySaveNim}
            onChange={(e) => setDailySaveNim(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Daily stake (NIM) — at risk if streak breaks</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={dailyStakeNim}
            onChange={(e) => setDailyStakeNim(e.target.value)}
          />
        </label>
        <p className="muted small">
          Each check-in sends one combined NIM transaction to escrow via Nimiq
          Pay: save + stake, tagged with your cycle ID and day number.
        </p>
      </Card>

      <Card className="highlight">
        <h2 className="card-title">Full-cycle commitment</h2>
        <div className="stat-grid">
          <Stat
            label="Per day"
            value={`${formatNim(totals.dailyLuna)} NIM`}
          />
          <Stat
            label="Safe savings"
            value={`${totals.totalSave.toFixed(2)} NIM`}
            hint={`${draftLength} × save`}
          />
          <Stat
            label="At-risk stake"
            value={`${totals.totalStake.toFixed(2)} NIM`}
            hint={`${draftLength} × stake`}
          />
          <Stat
            label="Total locked"
            value={`${totals.totalCommit.toFixed(2)} NIM`}
          />
        </div>
      </Card>

      <div className="info-box">
        <strong>Wallet</strong>
        <p className="mono small">{state.user?.walletAddress}</p>
      </div>

      <Button className="full" onClick={() => confirmSetup()} disabled={busy}>
        {busy ? "Starting…" : "Start cycle & lock plan"}
      </Button>
    </Shell>
  );
}
