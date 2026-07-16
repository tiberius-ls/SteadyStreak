"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  Card,
  Header,
  NavBar,
  Shell,
  TierBadge,
} from "@/components/ui";
import type { Tier } from "@/lib/types";

export function Leaderboard() {
  const {
    leaderboard,
    refreshLeaderboard,
    state,
    shortAddress,
    setScreen,
    latestCycle,
  } = useApp();

  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);

  const showPayout =
    latestCycle?.status === "completed" ||
    latestCycle?.status === "broken" ||
    latestCycle?.status === "paid_out";

  return (
    <Shell>
      <Header
        title="Leaderboard"
        subtitle="Ranked by current streak only — savings stay private."
      />

      <Card>
        <div className="tier-legend">
          <TierBadge tier="bronze" /> <span className="tiny">7+ days</span>
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
            const isYou =
              state.user?.walletAddress === entry.walletAddress;
            return (
              <li
                key={entry.walletAddress}
                className={`rank-row ${isYou ? "you" : ""}`}
              >
                <span className="rank-pos">#{i + 1}</span>
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
                  <strong>{entry.streak}</strong>
                  <span className="tiny">days</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NavBar
        active="leaderboard"
        onNavigate={setScreen}
        showPayout={showPayout}
      />
    </Shell>
  );
}
