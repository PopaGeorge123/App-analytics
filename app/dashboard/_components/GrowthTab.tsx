"use client";

import { useMemo, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";

// ── Types ────────────────────────────────────────────────────────────────

interface GrowthTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  /** platform → ISO currency code. e.g. { stripe: "EUR", meta: "USD" } */
  currencies: Record<string, string>;
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

function fmtCentsWithCurrency(cents: number, currency = "USD"): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount >= 1000 ? 0 : 2,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
    notation: amount >= 1_000_000 ? "compact" : "standard",
  }).format(amount);
}

// Legacy alias — used in places that don't have currency context yet
function fmtCents(cents: number, cur = "USD"): string {
  const amount = cents / 100;
  if (amount >= 1_000_000) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 1_000_000) + "M";
  }
  if (amount >= 1_000) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount / 1_000) + "k";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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
  paypal:          "#0060c7",
  shopify:         "#96bf48",
  woocommerce:     "#7f54b3",
  etsy:            "#F56400",
  bigcommerce:     "#efeff5",
  "amazon-seller": "#FF9900",
};

function platformColor(id: string): string {
  return PLATFORM_COLORS[id] ?? "#6a6a90";
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-mono text-sm font-bold text-[#1a1a2e] tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-[#6a6a90]">{sub}</p>}
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
  verdict,
  benchmarkPct,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  note?: string;
  verdict?: string;
  benchmarkPct?: number; // 0-100 fill on benchmark bar
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] p-5 flex flex-col gap-3 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
      style={{
        borderColor: color + "40",
        boxShadow: `0 0 18px ${color}18, inset 3px 0 0 ${color}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#6a6a90]">{label}</span>
        <span style={{ color: color + "bb" }}>{icon}</span>
      </div>
      <div>
        <p className="font-mono text-2xl font-bold leading-none" style={{ color }}>{value}</p>
        {verdict && <p className="mt-1.5 font-mono text-[10px] font-semibold" style={{ color }}>{verdict}</p>}
        {sub  && <p className="mt-1 font-mono text-[10px] text-[#6a6a90]">{sub}</p>}
        {note && <p className="mt-1 font-mono text-[9px] text-[#7575a0]">{note}</p>}
      </div>
      {benchmarkPct !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[8px] text-[#7575a0] uppercase tracking-widest">Benchmark</span>
            <span className="font-mono text-[8px] text-[#7575a0]">{benchmarkPct.toFixed(0)}%</span>
          </div>
          <div className="h-1 rounded-full bg-[#e8e8f4] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(benchmarkPct, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestone pill ────────────────────────────────────────────────────────

function MilestonePill({
  label,
  reached,
  date,
  active,
  etaDays,
}: {
  label: string;
  reached: boolean;
  date?: string;
  active?: boolean;
  etaDays?: number | null;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${!reached && !active ? "opacity-45" : ""}`}>
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
          reached
            ? "border-[#10b981] bg-[#10b981]/15 text-[#10b981]"
            : active
            ? "border-[#eab308] bg-[#eab308]/15 text-[#eab308] animate-pulse"
            : "border-[#e8e8f4] bg-[#f5f5fa] text-[#6a6a90]"
        }`}
        style={
          reached
            ? { boxShadow: "0 0 12px #10b98155" }
            : active
            ? { boxShadow: "0 0 14px #eab30855" }
            : undefined
        }
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
      <p className={`font-mono text-[9px] font-semibold text-center ${reached ? "text-[#10b981]" : active ? "text-[#eab308]" : "text-[#6a6a90]"}`}>
        {label}
      </p>
      {date && <p className="font-mono text-[8px] text-[#7575a0] text-center">{date}</p>}
      {!reached && !date && active && etaDays !== null && etaDays !== undefined && (
        <p className="font-mono text-[8px] text-[#eab308]/70 text-center">~{etaDays}d</p>
      )}
    </div>
  );
}

// ── Mini bar chart (inline, no canvas) ───────────────────────────────────

function MiniBar({ values, color, height = 48 }: { values: number[]; color: string; height?: number }) {
  const max = Math.max(...values, 1);
  const todayIdx = values.length - 1;
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all relative"
          style={{
            height: `${clamp((v / max) * 100, 2, 100)}%`,
            backgroundColor: i === todayIdx ? "#2a2a3e" : color,
            opacity: i === todayIdx ? 1 : 0.3 + (i / values.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ── Donut (SVG, no library) ───────────────────────────────────────────────

function Donut({
  segments,
  size = 120,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size * 0.35} fill="none" stroke="#e8e8f4" strokeWidth={size * 0.13} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em" fill="#6a6a90" fontSize={size * 0.09} fontFamily="monospace">—</text>
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g className="-rotate-90" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8f4" strokeWidth={strokeW} />
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
      </g>
      {centerLabel && (
        <text x={cx} y={cy - (centerSub ? size * 0.05 : 0)} textAnchor="middle" dy="0.35em" fill="#1a1a2e" fontSize={size * 0.1} fontFamily="monospace" fontWeight="bold">
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fill="#6a6a90" fontSize={size * 0.075} fontFamily="monospace">
          {centerSub}
        </text>
      )}
    </svg>
  );
}

// ── Goal editor modal ─────────────────────────────────────────────────────

function GoalModal({
  currentGoal,
  currency = "USD",
  onSave,
  onClose,
}: {
  currentGoal: number;
  currency?: string;
  onSave: (v: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(currentGoal / 100)));
  const parsed = parseInt(raw.replace(/\D/g, ""), 10) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-[#d4d4e8] bg-[#f2f2f8] p-6 shadow-2xl">
        <h3 className="font-mono text-sm font-bold text-[#1a1a2e] mb-1">Set Monthly Revenue Goal</h3>
        <p className="font-mono text-[10px] text-[#6a6a90] mb-5">Enter your target revenue for this calendar month.</p>
        <label className="block font-mono text-[9px] uppercase tracking-widest text-[#6a6a90] mb-1.5">
          Goal Amount ({currency})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#6a6a90]">
            {new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(0).replace(/[\d,]/g, "").trim()}
          </span>
          <input
            className="w-full rounded-xl border border-[#d4d4e8] bg-[#f3f3fb] pl-7 pr-4 py-2.5 font-mono text-sm text-[#1a1a2e] focus:border-[#00d4aa] focus:outline-none"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
            autoFocus
          />
        </div>
        {parsed > 0 && (
          <p className="mt-2 font-mono text-[10px] text-[#6a6a90]">
            = ~{fmtCents(Math.round(parsed / new Date().getDate()) * 100, currency)}/day needed
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#d4d4e8] bg-transparent py-2 font-mono text-xs text-[#6a6a90] hover:border-[#c8c8e8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(parsed * 100); onClose(); }}
            className="flex-1 rounded-xl bg-[#00d4aa] py-2 font-mono text-xs font-bold text-[#2a2a3e] hover:bg-[#00e6ba] transition-colors"
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

export default function GrowthTab({ isPremium, connectedPlatforms, snapshots, currencies = {} }: GrowthTabProps) {
  // Currency-aware revenue formatter — prefer Stripe currency, then first revenue platform, then USD
  const REVENUE_PROVIDERS_LOCAL = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
  const primaryRevCurrency = REVENUE_PROVIDERS_LOCAL.map(p => currencies[p]).find(Boolean) ?? "USD";
  const fmtRev = (cents: number) => fmtCentsWithCurrency(cents, primaryRevCurrency);

  // Refresh (sync now) state
  const router = useRouter();
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRouterRefreshing, startRouterRefresh] = useTransition();

  async function handleRefresh() {
    if (refreshState === "loading" || isRouterRefreshing) return;
    setRefreshState("loading");
    try {
      const res = await fetch("/api/sync/now", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        console.warn("Sync daemon:", d.error);
      }
      await new Promise<void>((resolve) => {
        startRouterRefresh(() => { router.refresh(); resolve(); });
      });
      setRefreshState("done");
    } catch {
      setRefreshState("error");
    } finally {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => setRefreshState("idle"), 3000);
    }
  }

  // ── Goal state (persisted in localStorage) ──────────────────────────────
  const [goalCents, setGoalCents] = useState<number>(() => {
    if (typeof window === "undefined") return 1000 * 100; // $1k default SSR
    const saved = localStorage.getItem(GOAL_KEY);
    return saved ? parseInt(saved, 10) : 1000 * 100;
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [forecastTab, setForecastTab] = useState<"30d" | "60d" | "90d">("30d");

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

  // ── Bar chart data for recharts ──────────────────────────────────────────
  const barChartData = last30Days.map((r) => ({
    label: new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: r.revenue,
    isPace: false,
  }));
  const todayLabel = barChartData.length > 0 ? barChartData[barChartData.length - 1].label : "";

  // ── Forecast tab state ───────────────────────────────────────────────────
  const forecast60best = forecast60base * 1.1;

  const hasRevenue = connRevenue.length > 0;
  const hasData    = days.length > 0;

  // No-data state
  if (!hasRevenue) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8e8f4] text-[#7575a0]">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-bold text-[#1a1a2e]">Connect a revenue platform</h3>
        <p className="mt-1 font-mono text-[10px] text-[#6a6a90] max-w-xs">
          Connect Stripe, Paddle, Shopify, or any revenue integration to unlock goal tracking, forecasting, and growth analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* ══ PAGE HEADER — MOMENTUM BANNER ══════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
        style={{ minHeight: 100 }}
      >
        {/* indigo gradient on left */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-72"
          style={{ background: "linear-gradient(90deg,#6366f120 0%,transparent 100%)" }}
        />
        <div className="relative flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left */}
          <div>
            <h1 className="font-mono text-xl font-bold text-[#1a1a2e] tracking-tight">Growth</h1>
            <p className="mt-0.5 font-mono text-[10px] text-[#6a6a90]">Your trajectory to $1M ARR</p>
          </div>

          {/* Center pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f8] border border-[rgba(0,0,0,0.07)] px-3 py-1 font-mono text-[10px] text-[#4a4a6a]">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              <span className="font-bold text-[#1a1a2e]">{daysLeft}</span> days left
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f8] border border-[rgba(0,0,0,0.07)] px-3 py-1 font-mono text-[10px] text-[#4a4a6a]">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-bold text-[#1a1a2e]">{fmtRev(allTimeRev)}</span> all-time
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f8] border border-[rgba(0,0,0,0.07)] px-3 py-1 font-mono text-[10px] text-[#4a4a6a]">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 0V3m0 18v-1.5M12 12l4.5-4.5" /></svg>
              <span className={`font-bold ${goalPct >= 80 ? "text-[#10b981]" : goalPct >= 40 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>{goalPct.toFixed(0)}%</span> to goal
            </span>
          </div>

          {/* Right — refresh + connected platforms */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh button */}
            {connRevenue.length > 0 && (
              <button
                onClick={handleRefresh}
                disabled={refreshState === "loading" || isRouterRefreshing}
                title="Sync latest data now"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d4d4e8] bg-[#f2f2f8] px-3 py-2 font-mono text-xs font-semibold transition-all hover:border-[#00d4aa]/40 hover:text-[#00d4aa] disabled:opacity-50"
                style={{
                  color: refreshState === "done" ? "#00d4aa" : refreshState === "error" ? "#f87171" : "#4a4a6a",
                  borderColor: refreshState === "done" ? "#00d4aa40" : refreshState === "error" ? "#f8717140" : undefined,
                }}
              >
                {(refreshState === "loading" || isRouterRefreshing) ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                ) : refreshState === "done" ? (
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : refreshState === "error" ? (
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                ) : (
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
                  </svg>
                )}
              </button>
            )}
            {connRevenue.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[9px] font-semibold"
                style={{ borderColor: platformColor(p) + "50", color: platformColor(p), background: platformColor(p) + "12" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformColor(p) }} />
                {p}
              </span>
            ))}
            {/* <button className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.06)] px-2.5 py-1 font-mono text-[9px] text-[#6a6a90] hover:border-[#6366f1] hover:text-[#6366f1] transition-colors">
              + Add integration
            </button> */}
          </div>
        </div>

        {/* Month completion progress bar at bottom */}
        <div className="h-0.5 w-full bg-[#e8e8f4]">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${Math.round((dayOfMonth / daysInMonth) * 100)}%`,
              background: "linear-gradient(90deg,#6366f1,#a78bfa)",
            }}
          />
        </div>
      </div>

      {/* ══ 1. MONTHLY GOAL ══════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Monthly Goal"
          sub={`${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()} · ${daysLeft} days remaining`}
        />
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#6a6a90] mb-1">Revenue this month</p>
              <p className="font-mono text-3xl font-bold text-[#1a1a2e]">{fmtRev(revThisMonth)}</p>
              <p className="mt-1 font-mono text-[10px] text-[#6a6a90]">
                of <span className="text-[#1a1a2e]">{fmtRev(goalCents)}</span> goal
                {momGrowth !== null && (
                  <span className={`ml-2 font-bold ${momGrowth >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                    {fmtPct(momGrowth)} vs last month
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f2f2f8] px-3 py-2 font-mono text-[10px] text-[#6a6a90] hover:border-[#6366f1] hover:text-[#6366f1] transition-colors"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Set goal
            </button>
          </div>

          {/* Progress bar — 16px, colored by pace, expected-pace marker */}
          <div className="relative h-4 rounded-full bg-[#e8e8f4] overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${goalPct}%`,
                background:
                  goalPct >= 100
                    ? "linear-gradient(90deg,#10b981,#34d399)"
                    : runRateStatus === "on-track"
                    ? "linear-gradient(90deg,#10b981,#6366f1)"
                    : runRateStatus === "close"
                    ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                    : "linear-gradient(90deg,#ef4444,#f87171)",
              }}
            />
            {/* Expected pace line */}
            {goalCents > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                style={{ left: `${clamp((dayOfMonth / daysInMonth) * 100, 0, 100)}%` }}
                title="Expected pace"
              />
            )}
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] text-[#6a6a90] mb-1">
            <span>{fmtRev(revThisMonth)} earned · {fmtRev(Math.max(goalCents - revThisMonth, 0))} to go · {goalPct.toFixed(0)}% complete</span>
          </div>

          {/* AI pace note */}
          {runRateStatus !== "on-track" && goalCents > 0 && (
            <p className="mt-1 font-mono text-[10px] italic text-[#f59e0b]/80">
              {runRateStatus === "close"
                ? `Close — you need ${fmtRev(dailyNeeded)}/day to finish strong.`
                : `Behind pace — need ${fmtRev(dailyNeeded)}/day for the rest of the month.`}
            </p>
          )}

          {/* 4 sub-metric cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Daily rate",
                value: fmtRev(dailyRate),
                sub: "avg/day so far",
                border: "#6366f1",
              },
              {
                label: "Run-rate",
                value: fmtRev(runRate),
                sub: runRateStatus === "on-track" ? "on track" : runRateStatus === "close" ? "close — push it" : "behind pace",
                border: runRateStatus === "on-track" ? "#10b981" : runRateStatus === "close" ? "#f59e0b" : "#ef4444",
              },
              {
                label: "Need/day",
                value: daysLeft > 0 && dailyNeeded > 0 ? fmtRev(dailyNeeded) : "—",
                sub: "to hit goal",
                border: dailyNeeded > dailyRate ? "#ef4444" : "#f59e0b",
              },
              {
                label: "Days left",
                value: String(daysLeft),
                sub: "in this month",
                border: daysLeft <= 5 ? "#ef4444" : daysLeft <= 10 ? "#f59e0b" : "#6366f1",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl bg-[#f5f5f7] px-3 py-2.5 border"
                style={{ borderColor: c.border + "40", borderLeftColor: c.border, borderLeftWidth: 3 }}
              >
                <p className="font-mono text-[8px] uppercase tracking-widest text-[#6a6a90]">{c.label}</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#1a1a2e]">{c.value}</p>
                <p className="font-mono text-[9px] text-[#7575a0]">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Daily revenue bar chart */}
          {miniChartValues.length > 1 && (
            <div className="mt-6">
              <p className="font-mono text-[9px] text-[#7575a0] mb-2">Daily revenue — last 30 days</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={barChartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#5a5a80", fontSize: 8, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#5a5a80", fontSize: 8, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(v: number) => fmtRev(v).replace(/\.00$/, "")}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.08)" }}
                    contentStyle={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                    labelStyle={{ color: "#1a1a2e", marginBottom: 2 }}
                    formatter={(v) => [fmtRev(Number(v ?? 0)), "Revenue"]}
                  />
                  <ReferenceLine x={todayLabel} stroke="rgba(0,0,0,0.12)" strokeDasharray="3 3" label={{ value: "TODAY", fill: "#6a6a90", fontSize: 8, fontFamily: "monospace", position: "top" }} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {barChartData.map((entry, i) => (
                      <Cell key={i} fill={i === barChartData.length - 1 ? "#1a1a2e" : entry.isPace ? "#f59e0b" : "#6366f1"} fillOpacity={i === barChartData.length - 1 ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          {/* Scenario tabs */}
          <div className="flex gap-1 mb-5 rounded-xl bg-[#f5f5f7] p-1 w-fit">
            {(["30d", "60d", "90d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForecastTab(t)}
                className={`px-4 py-1.5 rounded-lg font-mono text-[10px] font-semibold transition-all ${
                  forecastTab === t
                    ? "bg-[#6366f1] text-[#1a1a2e] shadow"
                    : "text-[#6a6a90] hover:text-[#4a4a6a]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 3-column layout */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: "Best case",
                color: "#10b981",
                value: forecastTab === "30d" ? forecast30best : forecastTab === "60d" ? forecast60best * 1.1 : forecast90base * 1.15,
                sub: forecastTab === "30d" ? "7-day pace holds" : "momentum accelerates",
              },
              {
                label: "Base case",
                color: "#f59e0b",
                value: forecastTab === "30d" ? forecast30base : forecastTab === "60d" ? forecast60base : forecast90base,
                sub: forecastTab === "30d" ? "30-day avg holds" : "trend-adjusted",
              },
              {
                label: "Worst case",
                color: "#ef4444",
                value: forecastTab === "30d" ? forecast30worst : forecastTab === "60d" ? Math.max(forecast60base * 0.85, 0) : Math.max(forecast90base * 0.8, 0),
                sub: forecastTab === "30d" ? "10% below avg" : "trend decelerates",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-[#f5f5f7] border p-4 flex flex-col gap-1"
                style={{ borderColor: s.color + "30" }}
              >
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="font-mono text-2xl font-bold text-[#1a1a2e]">{fmtRev(Math.max(s.value, 0))}</p>
                <p className="font-mono text-[9px] text-[#7575a0]">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Forecast range bar */}
          {forecast30base > 0 && (
            <div className="mt-5">
              <p className="font-mono text-[9px] text-[#7575a0] mb-2 uppercase tracking-widest">Confidence interval ({forecastTab})</p>
              <div className="relative h-3 rounded-full bg-[#e8e8f4] overflow-hidden">
                {(() => {
                  const worst = forecastTab === "30d" ? forecast30worst : forecastTab === "60d" ? forecast60base * 0.85 : forecast90base * 0.8;
                  const best = forecastTab === "30d" ? forecast30best : forecastTab === "60d" ? forecast60best * 1.1 : forecast90base * 1.15;
                  const base = forecastTab === "30d" ? forecast30base : forecastTab === "60d" ? forecast60base : forecast90base;
                  const span = best * 1.1;
                  const worstPct = clamp((worst / span) * 100, 0, 100);
                  const basePct = clamp((base / span) * 100, 0, 100);
                  const bestPct = clamp((best / span) * 100, 0, 100);
                  return (
                    <>
                      <div className="absolute h-full rounded-full bg-[#6366f1]/30" style={{ left: `${worstPct}%`, right: `${100 - bestPct}%` }} />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-[#f59e0b]" style={{ left: `${basePct}%` }} />
                    </>
                  );
                })()}
              </div>
              <div className="flex justify-between font-mono text-[8px] text-[#7575a0] mt-1">
                <span>Worst</span>
                <span style={{ color: "#f59e0b" }}>Base</span>
                <span>Best</span>
              </div>
            </div>
          )}

          {/* Trend signal */}
          <div className="mt-4 flex items-center gap-2">
            <span className={`font-mono text-[10px] font-bold ${revenueSlope30 >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
              {revenueSlope30 >= 0 ? "▲ Growing trend" : "▼ Declining trend"}
            </span>
            <span className="font-mono text-[9px] text-[#7575a0]">
              {revenueSlope30 >= 0 ? "+" : ""}{fmtRev(Math.abs(revenueSlope30))}/day momentum · ARR {fmtRev(avgDaily30 * 365)}
            </span>
          </div>

          <p className="mt-2 font-mono text-[9px] text-[#7575a0]">
            Forecasts use your actual daily snapshot data — the more history, the more accurate.
          </p>
        </div>
      </section>

      {/* ══ 3. REVENUE BREAKDOWN ════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Revenue Breakdown"
          sub={`Last 30 days · ${hasData ? fmtRev(totalRev30) : "No data"} total`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Platform donut */}
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#6a6a90] mb-4">By platform</p>
            {rev30ByPlatform.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <p className="font-mono text-[10px] text-[#7575a0]">No revenue in last 30 days</p>
                <button className="font-mono text-[9px] text-[#6366f1] hover:underline">+ Connect a platform</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6">
                  <div className="shrink-0">
                    <Donut
                      size={130}
                      segments={rev30ByPlatform.map((p) => ({ value: p.rev, color: platformColor(p.id), label: p.id }))}
                      centerLabel={rev30ByPlatform.length > 1 ? fmtRev(totalRev30).split(".")[0] : undefined}
                      centerSub={rev30ByPlatform.length > 1 ? "total" : undefined}
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
                              <span className="font-mono text-[10px] text-[#4a4a6a] capitalize">{p.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-[#1a1a2e]">{fmtRev(p.rev)}</span>
                              <span className="font-mono text-[9px] text-[#6a6a90]">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="h-1 rounded-full bg-[#e8e8f4] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: platformColor(p.id) }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Prior period compare */}
                {lastMonthRev > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-2.5">
                    <span className="font-mono text-[9px] text-[#6a6a90]">vs last month</span>
                    <span className={`font-mono text-[10px] font-bold ${totalRev30 >= lastMonthRev ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                      {totalRev30 >= lastMonthRev ? "+" : ""}{fmtPct(lastMonthRev > 0 ? ((totalRev30 - lastMonthRev) / lastMonthRev) * 100 : 0)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Acq vs churn + MRR metrics */}
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#6a6a90] mb-4">Acquisition vs churn</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#6a6a90]">New customers (30d)</span>
                  <span className="font-mono text-sm font-bold text-[#10b981]">
                    {newCx30 > 0 ? `+${newCx30}` : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#e8e8f4] overflow-hidden">
                  <div className="h-full rounded-full bg-[#10b981]"
                    style={{ width: newCx30 + churnedTotal > 0 ? `${(newCx30 / (newCx30 + churnedTotal)) * 100}%` : "0%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#6a6a90]">Cancellations (30d)</span>
                  <span className="font-mono text-sm font-bold text-[#ef4444]">
                    {churnedTotal > 0 ? `-${churnedTotal}` : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#e8e8f4] overflow-hidden">
                  <div className="h-full rounded-full bg-[#ef4444]"
                    style={{ width: newCx30 + churnedTotal > 0 ? `${(churnedTotal / (newCx30 + churnedTotal)) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="border-t border-[rgba(0,0,0,0.07)] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#6a6a90]">Net new customers</span>
                  <span className={`font-mono text-sm font-bold ${newCx30 - churnedTotal >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                    {newCx30 - churnedTotal >= 0 ? "+" : ""}{newCx30 - churnedTotal}
                  </span>
                </div>
              </div>

              {/* Full-width MRR / subs / ARPU / churn rate row */}
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                {[
                  { label: "MRR", value: fmtRev(currentMRR) },
                  { label: "Active subs", value: fmtNum(activeSubs) },
                  { label: "ARPU", value: arpuMonth > 0 ? fmtRev(arpuMonth) : "—" },
                  { label: "Churn rate", value: monthlyChurnRate > 0 ? fmtPct(monthlyChurnRate * 100) : "—" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-[#f5f5f7] px-3 py-2.5">
                    <p className="font-mono text-[8px] uppercase tracking-widest text-[#6a6a90]">{m.label}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-[#1a1a2e]">{m.value}</p>
                  </div>
                ))}
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
          {/* Rev / Session */}
          <RatioCard
            label="Rev / Session"
            value={totalSessions30 > 0 ? fmtRev(revPerSession) : "—"}
            sub={totalSessions30 > 0 ? `${fmtNum(totalSessions30)} sessions · 30d` : "Connect analytics"}
            note={totalSessions30 > 0 ? `${fmtRev(totalRev30)} / ${fmtNum(totalSessions30)} sessions` : undefined}
            verdict={totalSessions30 > 0 ? (revPerSession > 100 ? "Strong conversion" : revPerSession > 20 ? "Acceptable" : "Low conversion") : undefined}
            benchmarkPct={totalSessions30 > 0 ? clamp((revPerSession / 200) * 100, 0, 100) : undefined}
            color={totalSessions30 === 0 ? "#6a6a90" : revPerSession > 100 ? "#10b981" : revPerSession > 20 ? "#f59e0b" : "#ef4444"}
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
            sub={ltvcac !== null ? `LTV ${fmtRev(ltv)} · CAC ${cac > 0 ? fmtRev(cac) : "N/A"}` : "Connect ads + revenue"}
            verdict={ltvcac !== null ? (ltvcac >= 3 ? "Excellent ≥3x" : ltvcac >= 1 ? "Acceptable ≥1x" : "Unprofitable") : undefined}
            benchmarkPct={ltvcac !== null ? clamp((ltvcac / 5) * 100, 0, 100) : undefined}
            color={ltvcac !== null ? (ltvcac >= 3 ? "#10b981" : ltvcac >= 1 ? "#f59e0b" : "#ef4444") : "#6a6a90"}
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
            sub={momGrowth !== null ? `This month ${fmtRev(revThisMonth)} · Last ${fmtRev(lastMonthRev)}` : "Need 2+ months data"}
            verdict={momGrowth !== null ? (momGrowth >= 20 ? "Strong growth" : momGrowth >= 0 ? "Positive" : "Revenue declined") : undefined}
            benchmarkPct={momGrowth !== null ? clamp(((momGrowth + 20) / 40) * 100, 0, 100) : undefined}
            color={momGrowth !== null ? (momGrowth >= 10 ? "#10b981" : momGrowth >= 0 ? "#f59e0b" : "#ef4444") : "#6a6a90"}
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
            sub={nrr !== null ? `${churnedTotal} cancellations · 30d` : "Need subscription data"}
            verdict={nrr !== null ? (nrr >= 100 ? "Expansion" : nrr >= 80 ? "Healthy retention" : "Contracting") : undefined}
            benchmarkPct={nrr !== null ? clamp((nrr / 120) * 100, 0, 100) : undefined}
            color={nrr !== null ? (nrr >= 100 ? "#10b981" : nrr >= 80 ? "#f59e0b" : "#ef4444") : "#6a6a90"}
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
          sub={`All-time revenue · ${fmtRev(allTimeRev)} earned`}
        />
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          {/* Progress bar to next milestone */}
          {nextMilestone && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#6a6a90]">Next milestone</p>
                  <p className="font-mono text-lg font-bold text-[#1a1a2e]">{nextMilestone.label}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-[#6a6a90]">ETA at current pace</p>
                  <span className="inline-block mt-0.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#f59e0b]">
                    {milestoneEtaDays !== null
                      ? milestoneEtaDays <= 365
                        ? `~${milestoneEtaDays} days`
                        : `~${(milestoneEtaDays / 365).toFixed(1)} yrs`
                      : "Connect revenue"}
                  </span>
                </div>
              </div>

              {/* 16px bar with % label inside */}
              <div className="relative h-4 rounded-full bg-[#e8e8f4] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{
                    width: `${milestoneProgress}%`,
                    background: "linear-gradient(90deg,#eab308,#fbbf24)",
                    minWidth: milestoneProgress > 5 ? undefined : 0,
                  }}
                >
                  {milestoneProgress >= 8 && (
                    <span className="font-mono text-[9px] font-bold text-[#f0f0f8]">{milestoneProgress.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 font-mono text-[9px] text-[#6a6a90]">
                <span>{prevMilestone?.label ?? "$0"}</span>
                {milestoneProgress < 8 && <span className="font-bold text-[#eab308]">{milestoneProgress.toFixed(1)}%</span>}
                <span>{nextMilestone.label}</span>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-[#6a6a90]">
                {fmtRev(allTimeRev)} earned · {fmtRev(Math.max(nextMilestone.cents - allTimeRev, 0))} to go
              </p>
            </div>
          )}

          {/* Milestone pills */}
          <div className="flex items-start justify-between gap-2 overflow-x-auto pb-2">
            {MILESTONES.slice(0, 8).map((m, i) => {
              const reached = allTimeRev >= m.cents;
              const isActive = nextMilestoneIdx === i;
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
                  etaDays={isActive ? milestoneEtaDays : null}
                />
              );
            })}
          </div>

          {/* Motivational footer */}
          <div className="mt-6 rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/08 px-4 py-3" style={{ background: "#6366f108" }}>
            <p className="flex items-start gap-2 font-mono text-[10px] italic text-[#a5b4fc]">
              {allTimeRev === 0 ? (
                <>
                  <svg width="12" height="12" className="mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8-9h1M3 12H2m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Every $1M journey starts with dollar one. Ship, charge, learn.
                </>
              ) : nextMilestone && milestoneEtaDays !== null && milestoneEtaDays < 60 ? (
                <>
                  <svg width="12" height="12" className="mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                  {`You're ${milestoneProgress.toFixed(0)}% to ${nextMilestone.label} — at this pace you'll hit it in ~${milestoneEtaDays} days. Keep pushing.`}
                </>
              ) : nextMilestone ? (
                <>
                  <svg width="12" height="12" className="mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 0V3m0 18v-1.5M12 12l4.5-4.5" /></svg>
                  {`${fmtRev(allTimeRev)} down, ${fmtRev(Math.max(nextMilestone.cents - allTimeRev, 0))} to ${nextMilestone.label}. Focus on retention and distribution.`}
                </>
              ) : (
                <>
                  <svg width="12" height="12" className="mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>
                  You&apos;ve hit $100k+ in all-time revenue. Double down on what&apos;s working.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Goal modal */}
      {showGoalModal && (
        <GoalModal
          currentGoal={goalCents}
          currency={primaryRevCurrency}
          onSave={saveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </div>
  );
}
