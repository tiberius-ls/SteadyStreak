"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { Tier } from "@/lib/types";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden />
      <div className="app-frame">{children}</div>
    </div>
  );
}

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">SteadyStreak</p>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="linkish" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function TierBadge({ tier }: { tier: Tier | string }) {
  const t = (tier || "none") as Tier;
  const label =
    t === "gold"
      ? "Gold"
      : t === "silver"
        ? "Silver"
        : t === "bronze"
          ? "Bronze"
          : "Starter";
  return <span className={`tier-badge tier-${t}`}>{label}</span>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export function NavBar({
  active,
  onNavigate,
  showPayout,
}: {
  active: string;
  onNavigate: (s: "home" | "leaderboard" | "payout") => void;
  showPayout?: boolean;
}) {
  return (
    <nav className="nav-bar" aria-label="Main">
      <button
        type="button"
        className={active === "home" ? "active" : ""}
        onClick={() => onNavigate("home")}
      >
        Home
      </button>
      <button
        type="button"
        className={active === "leaderboard" ? "active" : ""}
        onClick={() => onNavigate("leaderboard")}
      >
        Ranks
      </button>
      {showPayout ? (
        <button
          type="button"
          className={active === "payout" ? "active" : ""}
          onClick={() => onNavigate("payout")}
        >
          Payout
        </button>
      ) : null}
    </nav>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" aria-valuenow={value} aria-valuemax={max}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
