"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  BrandBar,
  Card,
  NavBar,
  Shell,
  TierBadge,
} from "@/components/ui";
import type { Tier } from "@/lib/types";

function medalClass(rank: number): string {
  if (rank === 1) return "medal gold";
  if (rank === 2) return "medal silver";
  if (rank === 3) return "medal bronze";
  return "medal plain";
}

export function Leaderboard() {
  const {
    leaderboard,
    refreshLeaderboard,
    state,
    shortAddress,
    setScreen,
    latestCycle,
    rank,
  } = useApp();

  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);

  const showPayout =
    latestCycle?.status === "completed" ||
    latestCycle?.status === "broken" ||
    latestCycle?.status === "paid_out";

  const youStreak =
    leaderboard.find((e) => e.walletAddress === state.user?.walletAddress)
      ?.streak ?? 0;

  return (
    <Shell>
      <BrandBar />
      <header className="app-header">
        <div>
          <h1>
            Leaderboard <span aria-hidden>🔥</span>
          </h1>
          <p className="muted header-sub">
            Ranked by current streak · savings stay private
          </p>
        </div>
      </header>

      <Card className="compact glass">
        <div className="tier-legend">
          <TierBadge tier="bronze" /> <span className="tiny">7+</span>
          <TierBadge tier="silver" /> <span className="tiny">21+</span>
          <TierBadge tier="gold" /> <span className="tiny">45+</span>
        </div>
      </Card>

      {leaderboard.length === 0 ? (
        <Card>
          <p className="muted center">
            No public streaks yet. Check in to appear here.
          </p>
        </Card>
      ) : (
        <ul className="rank-list">
          {leaderboard.map((entry, i) => {
            const pos = i + 1;
            const isYou =
              state.user?.walletAddress === entry.walletAddress;
            return (
              <li
                key={entry.walletAddress}
                className={`rank-row ${isYou ? "you" : ""} ${
                  pos <= 3 ? "podium" : ""
                }`}
              >
                <span className={medalClass(pos)}>
                  {pos <= 3 ? (
                    <span className="medal-num">{pos}</span>
                  ) : (
                    <span className="rank-pos">#{pos}</span>
                  )}
                </span>
                <div className="rank-main">
                  <div className="rank-top">
                    <strong>
                      {isYou
                        ? "You"
                        : shortAddress(entry.walletAddress, 4)}
                    </strong>
                    <TierBadge tier={entry.tier as Tier} />
                  </div>
                  <p className="muted small">{entry.habit}</p>
                </div>
                <div className="rank-streak">
                  <strong>
                    {entry.streak}
                    <span className="streak-flame" aria-hidden>
                      {" "}
                      🔥
                    </span>
                  </strong>
                  <span className="tiny">days</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rank ? (
        <div className="you-chip">
          You are #{rank}
          {youStreak ? ` · ${youStreak} days` : ""}
        </div>
      ) : null}

      <NavBar
        active="leaderboard"
        onNavigate={setScreen}
        showPayout={showPayout}
      />
    </Shell>
  );
}
