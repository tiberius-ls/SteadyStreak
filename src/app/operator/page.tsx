"use client";

import { useCallback, useState } from "react";
import { Button, Card, ErrorBanner, Shell } from "@/components/ui";
import { shortAddress } from "@/lib/nimiq";
import { formatNim } from "@/lib/streak";

type Claim = {
  id: string;
  cycleId: string;
  walletAddress: string;
  poolId: string;
  savingsPrincipalLuna: number;
  stakeReturnedLuna: number;
  bonusFromPoolLuna: number;
  totalLuna: number;
  status: "pending" | "paid";
  claimRef: string;
  releaseTxHash?: string;
  claimedAt: string;
  paidAt?: string;
};

export default function OperatorPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [txById, setTxById] = useState<Record<string, string>>({});

  const load = useCallback(async (sec: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/claims?status=pending&secret=${encodeURIComponent(sec)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load claims");
      setClaims(data.claims ?? []);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setUnlocked(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const markPaid = async (claim: Claim) => {
    const releaseTxHash = (txById[claim.id] || "").trim();
    if (!releaseTxHash) {
      setError("Enter the release tx hash from Nimiq before marking paid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          action: "mark-paid",
          claimId: claim.id,
          releaseTxHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mark paid failed");
      await load(secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark paid failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <header className="app-header">
        <div>
          <p className="eyebrow">SteadyStreak</p>
          <h1>Operator desk</h1>
          <p className="muted">
            Pending escrow releases. Set OPERATOR_SECRET on Vercel. Pay from
            escrow, then mark paid with the tx hash.
          </p>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {!unlocked ? (
        <Card>
          <label className="field">
            <span>Operator secret</span>
            <input
              className="input"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Button
            className="full"
            disabled={busy || !secret}
            onClick={() => load(secret)}
          >
            {busy ? "Loading…" : "Unlock queue"}
          </Button>
        </Card>
      ) : (
        <>
          <Button
            className="full"
            variant="secondary"
            disabled={busy}
            onClick={() => load(secret)}
          >
            Refresh pending
          </Button>
          {claims.length === 0 ? (
            <Card>
              <p className="muted center">No pending claims.</p>
            </Card>
          ) : (
            claims.map((c) => (
              <Card key={c.id} className="operator-claim">
                <p className="small">
                  <strong>{formatNim(c.totalLuna)} NIM</strong> →{" "}
                  <span className="mono">
                    {shortAddress(c.walletAddress, 5)}
                  </span>
                </p>
                <p className="muted tiny">
                  save {formatNim(c.savingsPrincipalLuna)} · stake{" "}
                  {formatNim(c.stakeReturnedLuna)} · bonus{" "}
                  {formatNim(c.bonusFromPoolLuna)}
                </p>
                <p className="muted tiny mono">{c.claimRef}</p>
                <p className="muted tiny">{c.claimedAt}</p>
                <label className="field">
                  <span>Release tx hash</span>
                  <input
                    className="input"
                    placeholder="Paste Nimiq tx hash"
                    value={txById[c.id] ?? ""}
                    onChange={(e) =>
                      setTxById((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                  />
                </label>
                <Button
                  className="full"
                  disabled={busy}
                  onClick={() => markPaid(c)}
                >
                  Mark paid
                </Button>
              </Card>
            ))
          )}
        </>
      )}
    </Shell>
  );
}
