"use client";

import { useApp } from "@/context/AppContext";
import {
  Button,
  Card,
  Chip,
  ErrorBanner,
  Header,
  Shell,
} from "@/components/ui";
import { CYCLE_LENGTHS, PRESET_HABITS } from "@/lib/types";
import { allowDemoWalletClient, isNimiqPayEnvironment } from "@/lib/nimiq";
import { DEEPLINK_BASE } from "@/lib/constants";
import { useEffect, useState } from "react";

export function Onboarding() {
  const {
    state,
    client,
    connect,
    busy,
    error,
    clearError,
    draftHabit,
    setDraftHabit,
    draftLength,
    setDraftLength,
    customHabit,
    setCustomHabit,
    setScreen,
    shortAddress,
  } = useApp();

  const [inPay, setInPay] = useState(false);
  const [demoAllowed, setDemoAllowed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setInPay(isNimiqPayEnvironment());
    setDemoAllowed(allowDemoWalletClient());
  }, []);

  const connected = Boolean(state.user && (client || state.user.walletAddress));
  const liveUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://steadystreak.vercel.app";
  const deeplink = `${DEEPLINK_BASE}${liveUrl}`;

  return (
    <Shell>
      <Header
        title="Build habits. Keep your NIM."
        subtitle="Save safely every day. Stake only what you're willing to risk if the streak breaks."
      />
      <ErrorBanner message={error} onDismiss={clearError} />

      <Card>
        <h2 className="card-title">1. Connect Nimiq wallet</h2>
        <p className="muted small">
          SteadyStreak runs inside{" "}
          <strong>Nimiq Pay</strong> and uses real NIM for daily check-ins
          (save + stake in one transaction).
        </p>
        {connected ? (
          <div className="wallet-pill">
            <span className="dot online" />
            <div>
              <strong>
                {client?.isMock ? "Demo wallet" : "Nimiq Pay"}
              </strong>
              <p className="mono small">
                {shortAddress(state.user!.walletAddress, 6)}
              </p>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <Button onClick={() => connect(false)} disabled={busy}>
              {busy ? "Connecting…" : "Connect with Nimiq Pay"}
            </Button>
            {!inPay && demoAllowed ? (
              <Button
                variant="secondary"
                onClick={() => connect(true)}
                disabled={busy}
              >
                Continue with demo wallet
              </Button>
            ) : null}
            {!inPay ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(deeplink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? "Deeplink copied" : "Copy Nimiq Pay deeplink"}
              </Button>
            ) : null}
            <p className="muted tiny">
              {inPay
                ? "Nimiq Pay detected — wallet confirmations stay native."
                : demoAllowed
                  ? "Not inside Nimiq Pay? Use demo mode locally, or open via deeplink on your phone."
                  : "Production builds require Nimiq Pay. Copy the deeplink and open it on your device."}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="card-title">2. Choose a habit</h2>
        <div className="chip-grid">
          {PRESET_HABITS.map((h) => (
            <Chip
              key={h}
              selected={draftHabit === h}
              onClick={() => setDraftHabit(h)}
            >
              {h}
            </Chip>
          ))}
          <Chip
            selected={draftHabit === "__custom__"}
            onClick={() => setDraftHabit("__custom__")}
          >
            Custom…
          </Chip>
        </div>
        {draftHabit === "__custom__" ? (
          <input
            className="input"
            placeholder="Your habit"
            value={customHabit}
            onChange={(e) => setCustomHabit(e.target.value)}
            maxLength={60}
          />
        ) : null}
      </Card>

      <Card>
        <h2 className="card-title">3. Cycle length</h2>
        <div className="chip-row">
          {CYCLE_LENGTHS.map((len) => (
            <Chip
              key={len}
              selected={draftLength === len}
              onClick={() => setDraftLength(len)}
            >
              {len} days
            </Chip>
          ))}
        </div>
        <p className="muted small">
          Miss a day (no confirmed tx before midnight local time) and your
          stake for this cycle goes to the shared pool. Savings always return
          to you.
        </p>
        <p className="reminder">
          Soft rule: open the app each day and <strong>Mark done</strong> before
          local midnight — that&apos;s the whole game.
        </p>
      </Card>

      <Button
        className="full"
        disabled={!connected || busy}
        onClick={() => setScreen("setup")}
      >
        Continue to amounts
      </Button>
    </Shell>
  );
}
