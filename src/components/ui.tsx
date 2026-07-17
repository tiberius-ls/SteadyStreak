"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { Tier } from "@/lib/types";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden />
      <div className="app-mesh" aria-hidden />
      <div className="app-frame">{children}</div>
    </div>
  );
}

export function BrandBar({ right }: { right?: ReactNode }) {
  return (
    <div className="brand-bar">
      <div className="brand-mark">
        <span className="brand-flame" aria-hidden>
          🔥
        </span>
        <div>
          <p className="brand-name">
            Steady<span>Streak</span>
          </p>
          <p className="brand-sub">Nimiq Pay mini app</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export function Header({
  title,
  subtitle,
  right,
  showBrand = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  showBrand?: boolean;
}) {
  return (
    <>
      {showBrand ? <BrandBar right={right} /> : null}
      <header className="app-header">
        <div>
          {!showBrand ? <p className="eyebrow">SteadyStreak</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="muted header-sub">{subtitle}</p> : null}
        </div>
        {!showBrand ? right : null}
      </header>
    </>
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
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
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
        <span className="nav-ico" aria-hidden>
          🔥
        </span>
        Home
      </button>
      <button
        type="button"
        className={active === "leaderboard" ? "active" : ""}
        onClick={() => onNavigate("leaderboard")}
      >
        <span className="nav-ico" aria-hidden>
          🏆
        </span>
        Ranks
      </button>
      {showPayout ? (
        <button
          type="button"
          className={active === "payout" ? "active" : ""}
          onClick={() => onNavigate("payout")}
        >
          <span className="nav-ico" aria-hidden>
            💎
          </span>
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

/** Day dots for cycle progress (visual only; data from real check-ins). */
export function DayStrip({
  length,
  checkedDays,
  todayDay,
}: {
  length: number;
  checkedDays: number[];
  todayDay: number | null;
}) {
  const checked = new Set(checkedDays);
  // Show a window of up to 7 days around today, or first 7 of cycle
  const windowSize = Math.min(7, length);
  let start = 1;
  if (todayDay != null && length > 7) {
    start = Math.max(1, Math.min(todayDay - 3, length - 6));
  }
  const days = Array.from({ length: windowSize }, (_, i) => start + i).filter(
    (d) => d <= length
  );

  return (
    <div className="day-strip" aria-label="Cycle day progress">
      {days.map((d) => {
        const done = checked.has(d);
        const isToday = todayDay === d;
        return (
          <div
            key={d}
            className={`day-dot ${done ? "done" : ""} ${isToday ? "today" : ""}`}
            title={`Day ${d}`}
          >
            <span className="day-dot-num">{d}</span>
            <span className="day-dot-mark">{done ? "✓" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
