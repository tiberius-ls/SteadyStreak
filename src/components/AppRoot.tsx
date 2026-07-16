"use client";

import { AppProvider, useApp } from "@/context/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { Setup } from "@/components/Setup";
import { Home } from "@/components/Home";
import { Leaderboard } from "@/components/Leaderboard";
import { Payout } from "@/components/Payout";

function Router() {
  const { ready, screen } = useApp();

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="app-frame center-load">
          <div className="loader" />
          <p className="muted">Loading SteadyStreak…</p>
        </div>
      </div>
    );
  }

  switch (screen) {
    case "setup":
      return <Setup />;
    case "home":
      return <Home />;
    case "leaderboard":
      return <Leaderboard />;
    case "payout":
      return <Payout />;
    case "onboarding":
    default:
      return <Onboarding />;
  }
}

export function AppRoot() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
