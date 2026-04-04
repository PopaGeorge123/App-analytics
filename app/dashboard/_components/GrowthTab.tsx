"use client";

import { useMemo, useState } from "react";
import type { Snapshot } from "./DashboardShell";
import { REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";

// ── Types ────────────────────────────────────────────────────────────────

interface GrowthTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  metaCurrency: string;
}

interface DayRow {
  date: string;
  revenue: number;   // cents
  sessions: number;
  spend: number;     // ad spend (full units)
  newCustomers: number;
  churned: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function connectedIn(connected: string[], group: string[]): string[] {
  return connected.filter((p) => group.includes(p));
}

function pickPrimaryAnalytics(snaps: Snapshot[], providers: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const s of snaps) {
    if (!providers.includes(s.provider)) continue;
    const d = s.data as Record<string, number>;
    const hasData = Object.values(d).some((v) => typeof v === "number" && v > 0);
    if (hasData) counts[s.provider] = (counts[s.provider] ?? 0) + 1;
  }
  const sorted = Object.keys(counts).sort((a, b) => {
    const diff = (counts[b] ?? 0) - (counts[a] ?? 0);
    if (diff !== 0) return diff;
    return providers.indexOf(a) - providers.indexOf(b);
  });
  return sorted[0] ?? null;
}

function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Linear regression slope over an array of values (y[0], y[1], ...) → cents/day
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── Colours ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  stripe:          "#635bff",
  "lemon-squeezy": "#FFC233",
  gumroad:         "#ff90e8",
  paddle:          "#3ddc97",
  paypal:          "#003087",
  shopify:         "#96bf48",
  woocommerce:     "#7f54b3",
  etsy:            "#F56400",
  bigcommerce:     "#34313F",
  "amazon-seller": "#FF9900",
};

function platformColor(id: string): string {
  return PLATFORM_COLORS[id] ?? "#8585aa";
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-mono text-sm font-bold text-[#f8f8fc] tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
    </div>
  );
}

// ── Ratio Card ────────────────────────────────────────────────────────────

function RatioCard({
  label,
  value,
  sub,
  color,
  icon,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5 flex flex-col gap-3 transition-all hover:border-[#454560]"
      style={{ boxShadow: `inset 3px 0 0 ${color}30` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</span>
        <span style={{ color: color + "99" }}>{icon}</span>
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-[#f8f8fc] leading-none">{value}</p>
        {sub  && <p className="mt-1.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
        {note && <p className="mt-1   font-mono text-[9px]  text-[#58588a]">{note}</p>}
      </div>
    </div>
  );
}

// ── Milestone pill ────────────────────────────────────────────────────────

function MilestonePill({
  label,
  reached,
  date,
  active,
}: {
  label: string;
  reached: boolean;
  date?: string;
  active?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${!reached && !active ? "opacity-40" : ""}`}>
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
          reached
            ? "border-[#00d4aa] bg-[#00d4aa]/15 text-[#00d4aa]"
            : active
            ? "border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b] animate-pulse"
            : "border-[#363650] bg-[#1c1c2a] text-[#8585aa]"
        }`}
      >
        {reached ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : active ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ) : (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>
      <p className={`font-mono text-[9px] font-semibold text-center ${reached ? "text-[#00d4aa]" : active ? "text-[#f59e0b]" : "text-[#8585aa]"}`}>
        {label}
      </p>
      {date && (
        <p className="font-mono text-[8px] text-[#58588a] text-center">{date}</p>
      )}
    </div>
  );
}

// ── Mini bar chart (inline, no canvas) ───────────────────────────────────

function MiniBar({ values, color, height = 48 }: { values: number[]; color: string; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${clamp((v / max) * 100, 2, 100)}%`,
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : 0.45 + (i / values.length) * 0.55,
          }}
        />
      ))}
    </div>
  );
}

// ── Donut (SVG, no library) ───────────────────────────────────────────────

function Donut({ segments, size = 120 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size * 0.35} fill="none" stroke="#363650" strokeWidth={size * 0.13} />
      </svg>
    );
  }
  const cx = size / 2, cy = size / 2, r = size * 0.35;
  const strokeW = size * 0.13;
  const circum = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const arc = { frac, offset, color: seg.color };
    offset += frac;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#363650" strokeWidth={strokeW} />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeW}
          strokeDasharray={circum}
          strokeDashoffset={circum * (1 - arc.frac)}
          strokeLinecap="butt"
          style={{
            transform: `rotate(${arc.offset * 360}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />
      ))}
    </svg>
  );
}

// ── Goal editor modal ─────────────────────────────────────────────────────

function GoalModal({
  currentGoal,
  onSave,
  onClose,
}: {
  currentGoal: number;
  onSave: (v: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(currentGoal / 100)));
  const parsed = parseInt(raw.replace(/\D/g, ""), 10) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-[#363650] bg-[#1c1c2a] p-6 shadow-2xl">
        <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-1">Set Monthly Revenue Goal</h3>
        <p className="font-mono text-[10px] text-[#8585aa] mb-5">Enter your target revenue for this calendar month.</p>
        <label className="block font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-1.5">
          Goal Amount (USD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#8585aa]">$</span>
          <input
            className="w-full rounded-xl border border-[#363650] bg-[#0f0f18] pl-7 pr-4 py-2.5 font-mono text-sm text-[#f8f8fc] focus:border-[#00d4aa] focus:outline-none"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
            autoFocus
          />
        </div>
        {parsed > 0 && (
          <p className="mt-2 font-mono text-[10px] text-[#8585aa]">
            = ~{fmtCents(Math.round(parsed / new Date().getDate()) * 100)}/day needed
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#363650] bg-transparent py-2 font-mono text-xs text-[#8585aa] hover:border-[#454560] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(parsed * 100); onClose(); }}
            className="flex-1 rounded-xl bg-[#00d4aa] py-2 font-mono text-xs font-bold text-[#0f0f18] hover:bg-[#00e6ba] transition-colors"
          >
            Save Goal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const GOAL_KEY = "fold_monthly_revenue_goal";

export default function GrowthTab({ isPremium, connectedPlatforms, snapshots, metaCurrency }: GrowthTabProps) {
  // ── Goal state (persisted in localStorage) ──────────────────────────────
  const [goalCents, setGoalCents] = useState<number>(() => {
    if (typeof window === "undefined") return 1000 * 100; // $1k default SSR
    const saved = localStorage.getItem(GOAL_KEY);
    return saved ? parseInt(saved, 10) : 1000 * 100;
  });
  const [showGoalModal, setShowGoalModal] = useState(false);

  function saveGoal(cents: number) {
    setGoalCents(cents);
    if (typeof window !== "undefined") localStorage.setItem(GOAL_KEY, String(cents));
  }

  // ── Provider groups ──────────────────────────────────────────────────────
  const connRevenue   = connectedIn(connectedPlatforms, REVENUE_PROVIDERS);
  const connAnalytics = connectedIn(connectedPlatforms, ANALYTICS_PROVIDERS);
  const connAds       = connectedIn(connectedPlatforms, ADS_PROVIDERS);
  const primaryAn     = useMemo(() => pickPrimaryAnalytics(snapshots, connAnalytics), [snapshots, connAnalytics]);

  // ── Build daily rows ─────────────────────────────────────────────────────
  const days = useMemo<DayRow[]>(() => {
    const map: Record<string, DayRow> = {};
    for (const s of snapshots) {
      if (!map[s.date]) map[s.date] = { date: s.date, revenue: 0, sessions: 0, spend: 0, newCustomers: 0, churned: 0 };
      const d = s.data as Record<string, number>;
      if (connRevenue.includes(s.provider)) {
        map[s.date].revenue     += d.revenue      ?? 0;
        map[s.date].newCustomers += d.newCustomers ?? 0;
        map[s.date].churned     += d.churnedToday ?? 0;
      }
      if (s.provider === primaryAn) {
        map[s.date].sessions    += d.sessions     ?? 0;
      }
      if (connAds.includes(s.provider)) {
        map[s.date].spend       += d.spend        ?? 0;
      }
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots, connRevenue, connAds, primaryAn]);

  // ── Derived date helpers ─────────────────────────────────────────────────
  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const todayD     = new Date();
  const daysInMonth = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate();
  const dayOfMonth  = todayD.getDate();
  const daysLeft    = daysInMonth - dayOfMonth;

  // Last month
  const lmDate      = new Date(todayD.getFullYear(), todayD.getMonth() - 1, 1);
  const lastMonthStart = lmDate.toISOString().slice(0, 10).slice(0, 8) + "01";
  const lastMonthEnd   = new Date(todayD.getFullYear(), todayD.getMonth(), 0).toISOString().slice(0, 10);

  function daysInRange(from: string, to: string) {
    return days.filter((r) => r.date >= from && r.date <= to);
  }

  // ── Section 1: Monthly goal ───────────────────────────────────────────────
  const thisMonthDays  = daysInRange(monthStart, today);
  const revThisMonth   = thisMonthDays.reduce((a, r) => a + r.revenue, 0);
  const goalPct        = goalCents > 0 ? clamp((revThisMonth / goalCents) * 100, 0, 100) : 0;
  // Run-rate: if we have at least 1 full day, extrapolate
  const dailyRate      = dayOfMonth > 0 ? revThisMonth / dayOfMonth : 0;
  const runRate        = dailyRate * daysInMonth;
  const runRateStatus  = runRate >= goalCents ? "on-track" : runRate >= goalCents * 0.8 ? "close" : "behind";
  const dailyNeeded    = daysLeft > 0 && goalCents > revThisMonth ? (goalCents - revThisMonth) / daysLeft : 0;

  // ── Section 2: Revenue forecast ──────────────────────────────────────────
  // Take last 90 days of daily revenue for trend line
  const cutoff90 = new Date(todayD);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const last90Days  = days.filter((r) => r.date >= cutoff90.toISOString().slice(0, 10));
  const last30Days  = days.filter((r) => {
    const c = new Date(todayD); c.setDate(c.getDate() - 30);
    return r.date >= c.toISOString().slice(0, 10);
  });
  const last7Days   = days.filter((r) => {
    const c = new Date(todayD); c.setDate(c.getDate() - 7);
    return r.date >= c.toISOString().slice(0, 10);
  });

  const avgDaily30  = last30Days.length ? last30Days.reduce((a, r) => a + r.revenue, 0) / last30Days.length : 0;
  const avgDaily7   = last7Days.length  ? last7Days.reduce((a, r)  => a + r.revenue, 0) / last7Days.length  : 0;

  // Momentum slope from last 30 days
  const revenueSlope30 = slope(last30Days.map((r) => r.revenue));

  const forecast30base = avgDaily30 * 30;
  // Best case: 7-day momentum (higher of 7d avg vs trend projected)
  const forecast30best = Math.max(avgDaily7 * 30, forecast30base * 1.15);
  // Worst case: 10% haircut on 30d avg
  const forecast30worst = forecast30base * 0.9;

  // 60d and 90d using slope continuation
  const forecast60base  = avgDaily30 * 60 + revenueSlope30 * (60 * 61) / 2;
  const forecast90base  = avgDaily30 * 90 + revenueSlope30 * (90 * 91) / 2;

  // Last month revenue for comparison
  const lastMonthRev = daysInRange(lastMonthStart, lastMonthEnd).reduce((a, r) => a + r.revenue, 0);
  const momGrowth    = lastMonthRev > 0 ? ((revThisMonth - lastMonthRev) / lastMonthRev) * 100 : null;

  // ── Section 3: Revenue breakdown ─────────────────────────────────────────
  const rev30ByPlatform: { id: string; rev: number }[] = connRevenue.map((p) => ({
    id: p,
    rev: last30Days
      .map((r) => {
        // Re-read from raw snaps for per-platform split
        return snapshots
          .filter((s) => s.provider === p && s.date === r.date)
          .reduce((a, s) => a + ((s.data as Record<string, number>).revenue ?? 0), 0);
      })
      .reduce((a, b) => a + b, 0),
  })).filter((p) => p.rev > 0);

  const totalRev30 = rev30ByPlatform.reduce((a, p) => a + p.rev, 0);

  // Sub/one-time split from Stripe latest snapshot
  const latestStripe = [...snapshots].reverse().find((s) => s.provider === "stripe");
  const activeSubs   = latestStripe ? ((latestStripe.data as Record<string, number>).activeSubscriptions ?? 0) : 0;
  const currentMRR   = latestStripe ? ((latestStripe.data as Record<string, number>).mrr ?? 0) : 0;
  const churnedTotal = last30Days.reduce((a, r) => a + r.churned, 0);
  const newCx30      = last30Days.reduce((a, r) => a + r.newCustomers, 0);

  // ── Section 4: Key ratios ─────────────────────────────────────────────────
  const totalSessions30 = last30Days.reduce((a, r) => a + r.sessions, 0);
  const totalSpend30    = last30Days.reduce((a, r) => a + r.spend, 0);
  const revPerSession   = totalSessions30 > 0 ? totalRev30 / totalSessions30 : 0; // cents/session

  const cac = newCx30 > 0 && totalSpend30 > 0 ? totalSpend30 / newCx30 : 0;
  // Simple LTV: ARPU × (1 / monthly churn rate). Fallback: ARPU × 12 if no churn data.
  const monthlyChurnRate = activeSubs > 0 ? churnedTotal / activeSubs : 0;
  const arpuMonth        = latestStripe ? ((latestStripe.data as Record<string, number>).arpu ?? 0) : 0;
  const ltv = monthlyChurnRate > 0
    ? arpuMonth / monthlyChurnRate
    : arpuMonth > 0 ? arpuMonth * 12 : 0;
  const ltvcac = cac > 0 && ltv > 0 ? ltv / cac : null;

  // MoM revenue growth (already have momGrowth above)
  // Net Revenue Retention: (rev this month from existing customers) / last month MRR
  // Approximated as: (MRR + expansion - churn) / prev MRR
  const nrr = lastMonthRev > 0
    ? clamp(((lastMonthRev - churnedTotal * (currentMRR / Math.max(activeSubs, 1))) / Math.max(lastMonthRev, 1)) * 100, 0, 999)
    : null;

  // ── Section 5: Milestones ─────────────────────────────────────────────────
  // Derive all-time revenue from all snapshots
  const allTimeRev = days.reduce((a, r) => a + r.revenue, 0);
  const MILESTONES = [
    { label: "$100",     cents: 100     * 100 },
    { label: "$500",     cents: 500     * 100 },
    { label: "$1k",      cents: 1_000   * 100 },
    { label: "$5k",      cents: 5_000   * 100 },
    { label: "$10k",     cents: 10_000  * 100 },
    { label: "$25k",     cents: 25_000  * 100 },
    { label: "$50k",     cents: 50_000  * 100 },
    { label: "$100k",    cents: 100_000 * 100 },
    { label: "$1M",      cents: 1_000_000 * 100 },
  ];
  const nextMilestoneIdx = MILESTONES.findIndex((m) => allTimeRev < m.cents);
  const nextMilestone    = nextMilestoneIdx >= 0 ? MILESTONES[nextMilestoneIdx] : null;
  const prevMilestone    = nextMilestoneIdx > 0 ? MILESTONES[nextMilestoneIdx - 1] : null;
  const milestoneProgress = nextMilestone && prevMilestone
    ? clamp(((allTimeRev - prevMilestone.cents) / (nextMilestone.cents - prevMilestone.cents)) * 100, 0, 100)
    : nextMilestone ? clamp((allTimeRev / nextMilestone.cents) * 100, 0, 100) : 100;
  // ETA to next milestone using 30d avg daily rate
  const remaining        = nextMilestone ? nextMilestone.cents - allTimeRev : 0;
  const milestoneEtaDays = avgDaily30 > 0 && remaining > 0 ? Math.ceil(remaining / avgDaily30) : null;

  // Mini chart — last 30 days daily revenue
  const miniChartValues = last30Days.map((r) => r.revenue);

  const hasRevenue = connRevenue.length > 0;
  const hasData    = days.length > 0;

  // No-data state
  if (!hasRevenue) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#222235] text-[#58588a]">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-bold text-[#f8f8fc]">Connect a revenue platform</h3>
        <p className="mt-1 font-mono text-[10px] text-[#8585aa] max-w-xs">
          Connect Stripe, Paddle, Shopify, or any revenue integration to unlock goal tracking, forecasting, and growth analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono text-lg font-bold text-[#f8f8fc] tracking-tight">Growth</h1>
          <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">
            Goal tracking · Revenue forecast · Ratio intelligence · Milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connRevenue.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold"
              style={{ borderColor: platformColor(p) + "50", color: platformColor(p) }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformColor(p) }} />
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* ══ 1. MONTHLY GOAL TRACKER ══════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Monthly Goal"
          sub={`${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()} · ${daysLeft} days remaining`}
        />
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-6">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-1">Revenue this month</p>
              <p className="font-mono text-3xl font-bold text-[#f8f8fc]">{fmtCents(revThisMonth)}</p>
              <p className="mt-1 font-mono text-[10px] text-[#8585aa]">
                of <span className="text-[#f8f8fc]">{fmtCents(goalCents)}</span> goal
                {momGrowth !== null && (
                  <span className={`ml-2 font-bold ${momGrowth >= 0 ? "text-[#00d4aa]" : "text-red-400"}`}>
                    {fmtPct(momGrowth)} vs last month
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#363650] px-3 py-2 font-mono text-[10px] text-[#8585aa] hover:border-[#454560] hover:text-[#bcbcd8] transition-colors"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Set goal
            </button>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full bg-[#222235] overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${goalPct}%`,
                background: goalPct >= 100
                  ? "linear-gradient(90deg,#00d4aa,#00e6ba)"
                  : goalPct >= 66
                  ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                  : "linear-gradient(90deg,#635bff,#a78bfa)",
              }}
            />
            {/* Run-rate marker */}
            {runRate > 0 && goalCents > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                style={{ left: `${clamp((runRate / goalCents) * 100, 0, 100)}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] text-[#8585aa]">
            <span>{goalPct.toFixed(1)}% complete</span>
            <span>{fmtCents(goalCents - revThisMonth > 0 ? goalCents - revThisMonth : 0)} to go</span>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#363650] bg-[#0f0f18] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Daily rate</p>
              <p className="mt-1 font-mono text-sm font-bold text-[#f8f8fc]">{fmtCents(dailyRate)}</p>
              <p className="font-mono text-[9px] text-[#58588a]">avg/day so far</p>
            </div>
            <div className="rounded-xl border border-[#363650] bg-[#0f0f18] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Run-rate</p>
              <p className={`mt-1 font-mono text-sm font-bold ${runRateStatus === "on-track" ? "text-[#00d4aa]" : runRateStatus === "close" ? "text-[#f59e0b]" : "text-red-400"}`}>
                {fmtCents(runRate)}
              </p>
              <p className="font-mono text-[9px] text-[#58588a]">
                {runRateStatus === "on-track" ? "✓ on track" : runRateStatus === "close" ? "close — push it" : "behind pace"}
              </p>
            </div>
            <div className="rounded-xl border border-[#363650] bg-[#0f0f18] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Need/day</p>
              <p className="mt-1 font-mono text-sm font-bold text-[#f8f8fc]">
                {daysLeft > 0 && dailyNeeded > 0 ? fmtCents(dailyNeeded) : "—"}
              </p>
              <p className="font-mono text-[9px] text-[#58588a]">to hit goal</p>
            </div>
            <div className="rounded-xl border border-[#363650] bg-[#0f0f18] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Days left</p>
              <p className="mt-1 font-mono text-sm font-bold text-[#f8f8fc]">{daysLeft}</p>
              <p className="font-mono text-[9px] text-[#58588a]">in this month</p>
            </div>
          </div>

          {/* Mini bar chart */}
          {miniChartValues.length > 1 && (
            <div className="mt-5">
              <p className="font-mono text-[9px] text-[#58588a] mb-1.5">Daily revenue — last 30 days</p>
              <MiniBar values={miniChartValues} color="#635bff" height={52} />
            </div>
          )}
        </div>
      </section>

      {/* ══ 2. REVENUE FORECAST ══════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Revenue Forecast"
          sub="Based on your actual velocity — 7-day pace vs 30-day average"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* 30-day */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Next 30 days</p>
            <div className="space-y-2.5">
              <div>
                <p className="font-mono text-[8px] text-[#00d4aa] mb-0.5">Best case</p>
                <p className="font-mono text-xl font-bold text-[#f8f8fc]">{fmtCents(forecast30best)}</p>
                <p className="font-mono text-[9px] text-[#58588a]">7-day pace holds</p>
              </div>
              <div className="border-t border-[#363650] pt-2.5">
                <p className="font-mono text-[8px] text-[#f59e0b] mb-0.5">Base case</p>
                <p className="font-mono text-xl font-bold text-[#f8f8fc]">{fmtCents(Math.max(forecast30base, 0))}</p>
                <p className="font-mono text-[9px] text-[#58588a]">30-day avg holds</p>
              </div>
              <div className="border-t border-[#363650] pt-2.5">
                <p className="font-mono text-[8px] text-red-400 mb-0.5">Worst case</p>
                <p className="font-mono text-xl font-bold text-[#f8f8fc]">{fmtCents(Math.max(forecast30worst, 0))}</p>
                <p className="font-mono text-[9px] text-[#58588a]">10% below avg</p>
              </div>
            </div>
          </div>

          {/* 60-day */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Next 60 days</p>
            <div className="space-y-2.5">
              <div>
                <p className="font-mono text-[8px] text-[#8585aa] mb-0.5">Trend projection</p>
                <p className="font-mono text-2xl font-bold text-[#f8f8fc]">{fmtCents(Math.max(forecast60base, 0))}</p>
                <p className="font-mono text-[9px] text-[#58588a]">momentum extended</p>
              </div>
              <div className="border-t border-[#363650] pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] text-[#8585aa]">Trend direction</p>
                  <span className={`font-mono text-[9px] font-bold ${revenueSlope30 >= 0 ? "text-[#00d4aa]" : "text-red-400"}`}>
                    {revenueSlope30 >= 0 ? "▲ Growing" : "▼ Declining"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="font-mono text-[9px] text-[#8585aa]">Daily momentum</p>
                  <span className={`font-mono text-[9px] font-bold ${revenueSlope30 >= 0 ? "text-[#00d4aa]" : "text-red-400"}`}>
                    {revenueSlope30 >= 0 ? "+" : ""}{fmtCents(Math.abs(revenueSlope30))}/day
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 90-day */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Next 90 days</p>
            <div className="space-y-2.5">
              <div>
                <p className="font-mono text-[8px] text-[#8585aa] mb-0.5">Quarter projection</p>
                <p className="font-mono text-2xl font-bold text-[#f8f8fc]">{fmtCents(Math.max(forecast90base, 0))}</p>
                <p className="font-mono text-[9px] text-[#58588a]">trend-adjusted</p>
              </div>
              <div className="border-t border-[#363650] pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] text-[#8585aa]">Annualised run-rate</p>
                  <span className="font-mono text-[9px] font-bold text-[#a78bfa]">
                    {fmtCents(avgDaily30 * 365)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="font-mono text-[9px] text-[#8585aa]">Last month</p>
                  <span className="font-mono text-[9px] text-[#8585aa]">
                    {fmtCents(lastMonthRev)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[9px] text-[#58588a]">
          Forecasts use your actual daily snapshot data — the more history you have, the more accurate these become.
        </p>
      </section>

      {/* ══ 3. REVENUE BREAKDOWN ════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Revenue Breakdown"
          sub={`Last 30 days · ${hasData ? fmtCents(totalRev30) : "No data"} total`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Platform split */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-4">By platform</p>
            {rev30ByPlatform.length === 0 ? (
              <p className="font-mono text-[10px] text-[#58588a]">No revenue data in the last 30 days.</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <Donut
                    size={120}
                    segments={rev30ByPlatform.map((p) => ({
                      value: p.rev,
                      color: platformColor(p.id),
                      label: p.id,
                    }))}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  {rev30ByPlatform.map((p) => {
                    const pct = totalRev30 > 0 ? (p.rev / totalRev30) * 100 : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: platformColor(p.id) }} />
                            <span className="font-mono text-[10px] text-[#bcbcd8] capitalize">{p.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-[#f8f8fc]">{fmtCents(p.rev)}</span>
                            <span className="font-mono text-[9px] text-[#8585aa]">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-[#222235] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: platformColor(p.id) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Churn & acquisition */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-4">Acquisition vs churn</p>
            <div className="space-y-4">
              {/* New revenue */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#8585aa]">New customers (30d)</span>
                  <span className="font-mono text-sm font-bold text-[#00d4aa]">+{newCx30}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#222235] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00d4aa]"
                    style={{ width: newCx30 + churnedTotal > 0 ? `${(newCx30 / (newCx30 + churnedTotal)) * 100}%` : "0%" }}
                  />
                </div>
              </div>
              {/* Churn */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#8585aa]">Cancellations (30d)</span>
                  <span className="font-mono text-sm font-bold text-red-400">-{churnedTotal}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#222235] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: newCx30 + churnedTotal > 0 ? `${(churnedTotal / (newCx30 + churnedTotal)) * 100}%` : "0%" }}
                  />
                </div>
              </div>
              {/* Net */}
              <div className="border-t border-[#363650] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#8585aa]">Net new customers</span>
                  <span className={`font-mono text-sm font-bold ${newCx30 - churnedTotal >= 0 ? "text-[#00d4aa]" : "text-red-400"}`}>
                    {newCx30 - churnedTotal >= 0 ? "+" : ""}{newCx30 - churnedTotal}
                  </span>
                </div>
              </div>
              {/* MRR */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl bg-[#0f0f18] px-3 py-2.5">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">MRR</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#f8f8fc]">{fmtCents(currentMRR)}</p>
                </div>
                <div className="rounded-xl bg-[#0f0f18] px-3 py-2.5">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Active subs</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#f8f8fc]">{fmtNum(activeSubs)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 4. KEY GROWTH RATIOS ════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Key Growth Ratios"
          sub="The four numbers every $1M founder watches weekly"
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Revenue per session */}
          <RatioCard
            label="Rev / Session"
            value={totalSessions30 > 0 ? fmtCents(revPerSession) : "—"}
            sub="per visitor (30d)"
            note={totalSessions30 > 0 ? `${fmtNum(totalSessions30)} sessions · ${fmtCents(totalRev30)} revenue` : "Connect analytics to unlock"}
            color="#635bff"
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
          />
          {/* LTV:CAC */}
          <RatioCard
            label="LTV : CAC"
            value={ltvcac !== null ? `${ltvcac.toFixed(1)}x` : cac > 0 ? `CAC ${fmtNum(cac)}` : "—"}
            sub={ltvcac !== null ? (ltvcac >= 3 ? "Excellent (≥3x)" : ltvcac >= 1 ? "Acceptable (≥1x)" : "⚠ Unprofitable") : "Connect ads + revenue"}
            note={ltv > 0 ? `LTV ${fmtCents(ltv)} · CAC ${cac > 0 ? fmtNum(cac) : "N/A"}` : undefined}
            color={ltvcac !== null ? (ltvcac >= 3 ? "#00d4aa" : ltvcac >= 1 ? "#f59e0b" : "#f87171") : "#8585aa"}
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
              </svg>
            }
          />
          {/* MoM Growth */}
          <RatioCard
            label="MoM Revenue"
            value={momGrowth !== null ? fmtPct(momGrowth) : "—"}
            sub={momGrowth !== null ? (momGrowth >= 10 ? "Strong growth 🚀" : momGrowth >= 0 ? "Positive" : "Revenue declined") : "Need 2+ months of data"}
            note={momGrowth !== null ? `This month ${fmtCents(revThisMonth)} · Last ${fmtCents(lastMonthRev)}` : undefined}
            color={momGrowth !== null ? (momGrowth >= 10 ? "#00d4aa" : momGrowth >= 0 ? "#f59e0b" : "#f87171") : "#8585aa"}
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
          />
          {/* NRR */}
          <RatioCard
            label="Net Rev Retention"
            value={nrr !== null ? `${nrr.toFixed(0)}%` : "—"}
            sub={nrr !== null ? (nrr >= 100 ? "Expansion 🎯" : nrr >= 80 ? "Healthy" : "⚠ Contracting") : "Need subscription data"}
            note={nrr !== null ? `${churnedTotal} cancellations this month` : undefined}
            color={nrr !== null ? (nrr >= 100 ? "#00d4aa" : nrr >= 80 ? "#f59e0b" : "#f87171") : "#8585aa"}
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ══ 5. MILESTONE TIMELINE ════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Revenue Milestones"
          sub={`All-time revenue · ${fmtCents(allTimeRev)} earned`}
        />
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-6">
          {/* Progress to next milestone */}
          {nextMilestone && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Next milestone</p>
                  <p className="font-mono text-lg font-bold text-[#f8f8fc]">{nextMilestone.label}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-[#8585aa]">ETA at current pace</p>
                  <p className="font-mono text-sm font-bold text-[#f59e0b]">
                    {milestoneEtaDays !== null
                      ? milestoneEtaDays <= 365
                        ? `~${milestoneEtaDays} days`
                        : `~${(milestoneEtaDays / 365).toFixed(1)} yrs`
                      : "Connect revenue"}
                  </p>
                </div>
              </div>
              <div className="relative h-2.5 rounded-full bg-[#222235] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${milestoneProgress}%`,
                    background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 font-mono text-[9px] text-[#8585aa]">
                <span>{prevMilestone?.label ?? "$0"}</span>
                <span className="font-bold text-[#f8f8fc]">{milestoneProgress.toFixed(1)}%</span>
                <span>{nextMilestone.label}</span>
              </div>
              <p className="mt-2 font-mono text-[10px] text-[#8585aa]">
                {fmtCents(allTimeRev)} earned · {fmtCents(Math.max(nextMilestone.cents - allTimeRev, 0))} to go
              </p>
            </div>
          )}

          {/* Milestone pills */}
          <div className="flex items-start justify-between gap-2 overflow-x-auto pb-2">
            {MILESTONES.slice(0, 8).map((m, i) => {
              const reached   = allTimeRev >= m.cents;
              const isActive  = nextMilestoneIdx === i;
              // Find approximate date reached (first day cumulative rev crosses threshold)
              let reachedDate: string | undefined;
              if (reached) {
                let cum = 0;
                for (const row of days) {
                  cum += row.revenue;
                  if (cum >= m.cents) {
                    reachedDate = new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                    break;
                  }
                }
              }
              return (
                <MilestonePill
                  key={m.label}
                  label={m.label}
                  reached={reached}
                  active={isActive}
                  date={reachedDate}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Goal modal */}
      {showGoalModal && (
        <GoalModal
          currentGoal={goalCents}
          onSave={saveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </div>
  );
}
