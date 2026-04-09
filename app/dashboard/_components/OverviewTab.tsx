"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { pushNotification } from "./DashboardShell";
import type { Tab } from "./DashboardShell";
import { DEMO_SNAPSHOTS, DEMO_CONNECTED_PLATFORMS } from "./demoData";
import { DEFAULT_ALERTS, type AlertRules } from "./SettingsTab";
import { LIVE_INTEGRATIONS, REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";

// ── Types ─────────────────────────────────────────────────────────────────

interface WebsiteData {
  url: string | null;
  score: number;
  status: "idle" | "analyzing" | "done" | "error";
  summary: string | null;
  lastScanned: string | null;
  tasks: {
    id: string;
    title: string;
    description: string;
    category: string;
    impact_score: number;
    completed: boolean;
    completed_at?: string | null;
  }[];
}

interface OverviewTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  websiteData: WebsiteData;
  /** platform → ISO currency code. e.g. { stripe: "EUR", meta: "USD" } */
  currencies: Record<string, string>;
  onNavigate: (tab: Tab) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function filterDays(snaps: Snapshot[], days: number): Snapshot[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snaps.filter((s) => s.date >= cutoffStr);
}

function sumField(snaps: Snapshot[], provider: string, field: string): number {
  return snaps
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

function avgField(snaps: Snapshot[], provider: string, field: string): number {
  const rows = snaps.filter((s) => s.provider === provider);
  if (!rows.length) return 0;
  const total = rows.reduce((acc, s) => {
    const d = s.data as Record<string, number>;
    return acc + (d[field] ?? 0);
  }, 0);
  return total / rows.length;
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") {
    if (n >= 100000) return `$${(n / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `$${(n / 100).toFixed(2)}`;
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Extract the Meta ad account currency from snapshots (stored in data.currency) */
function getMetaCurrency(snaps: Snapshot[]): string {
  const found = [...snaps]
    .reverse()
    .find((s) => s.provider === "meta" && (s.data as Record<string, unknown>)?.currency);
  return ((found?.data as Record<string, unknown>)?.currency as string) ?? "USD";
}

/** Format Meta spend using the real account currency (NOT /100 — Meta stores full units) */
function fmtMetaSpend(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function trendPct(current: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

// ── Multi-provider aggregation helpers ──────────────────────────────────────

/**
 * SUM a field across MULTIPLE providers.
 * Use for revenue (Stripe + Paddle + Shopify = total revenue) and
 * ad spend (Meta + Google Ads + TikTok = total spend). These are additive.
 */
function sumProviders(snaps: Snapshot[], providers: string[], field: string): number {
  return snaps
    .filter((s) => providers.includes(s.provider))
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

/**
 * AVG a field across MULTIPLE providers (picks the provider with most data points,
 * then averages within it — avoids double-averaging the same day across two tools).
 */
function avgProviders(snaps: Snapshot[], providers: string[], field: string): number {
  const primary = pickPrimaryAnalyticsProvider(snaps, providers);
  if (!primary) return 0;
  const rows = snaps.filter((s) => s.provider === primary);
  if (!rows.length) return 0;
  const total = rows.reduce((acc, s) => {
    const d = s.data as Record<string, number>;
    return acc + (d[field] ?? 0);
  }, 0);
  return total / rows.length;
}

/**
 * Returns the analytics provider with the most non-zero data points.
 * Tie-break: prefer the order in ANALYTICS_PROVIDERS (GA4 first).
 * Used to pick a single authoritative source for traffic metrics to avoid
 * double-counting the same visitor across GA4 + Plausible + PostHog.
 */
function pickPrimaryAnalyticsProvider(snaps: Snapshot[], providers: string[]): string | null {
  // Map provider → count of days with any data
  const counts: Record<string, number> = {};
  for (const s of snaps) {
    if (!providers.includes(s.provider)) continue;
    const d = s.data as Record<string, number>;
    const hasData = Object.values(d).some((v) => typeof v === "number" && v > 0);
    if (hasData) counts[s.provider] = (counts[s.provider] ?? 0) + 1;
  }
  // Sort by count desc, tie-break by position in the providers list
  const sorted = Object.keys(counts).sort((a, b) => {
    const diff = (counts[b] ?? 0) - (counts[a] ?? 0);
    if (diff !== 0) return diff;
    return providers.indexOf(a) - providers.indexOf(b);
  });
  return sorted[0] ?? null;
}

/**
 * Collect all connected providers that belong to a given group.
 */
function connectedIn(connected: string[], group: string[]): string[] {
  return connected.filter((p) => group.includes(p));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#00d4aa";
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#fb923c";
  return "#f87171";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  if (score >= 30) return "Needs Work";
  return "Poor";
}

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ── Trend Badge ───────────────────────────────────────────────────────────

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = trendPct(current, prev);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
        up ? "text-[#00d4aa] bg-[#00d4aa]/10" : "text-red-400 bg-red-400/10"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── KPI Icons ─────────────────────────────────────────────────────────────

const KPI_ICONS: Record<string, React.ReactNode> = {
  revenue: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  sessions: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  adspend: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  customers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  cac: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  bounce: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  ),
};

// ── KPI Card ──────────────────────────────────────────────────────────────

const KPI_ACCENT_COLORS: Record<string, string> = {
  revenue: "#635bff",
  sessions: "#f59e0b",
  adspend: "#1877f2",
  customers: "#00d4aa",
  cac: "#f87171",
  bounce: "#a78bfa",
};

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
}: {
  label: string;
  value: string | null;
  sub?: string | null;
  trend?: { current: number; prev: number } | null;
  icon: string;
}) {
  const accent = KPI_ACCENT_COLORS[icon] ?? "#00d4aa";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5 flex flex-col gap-3 transition-all hover:border-[#454560] hover:bg-[#0f0f18]"
      style={{ boxShadow: "inset 3px 0 0 " + accent + "30" }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</span>
        <span style={{ color: accent + "99" }}>{KPI_ICONS[icon]}</span>
      </div>
      {value === null ? (
        <div>
          <p className="font-mono text-2xl font-bold text-[#8585aa]">—</p>
          <p className="mt-1 font-mono text-[10px] text-[#58588a]">Not connected</p>
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <p className="font-mono text-2xl font-bold text-[#f8f8fc] leading-none">{value}</p>
            {trend && <TrendBadge current={trend.current} prev={trend.prev} />}
          </div>
          {sub && <p className="mt-1.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
          {trend && trendPct(trend.current, trend.prev) !== null && (
            <p className="mt-1 font-mono text-[9px] text-[#58588a]">vs prev 7 days</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini Score Ring ───────────────────────────────────────────────────────

function MiniScoreRing({ score }: { score: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const color = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#363650" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Goals Widget ─────────────────────────────────────────────────────────

interface Goals {
  revenueTarget: number;  // cents per MONTH
  sessionsTarget: number; // per month
}

/** Given the N-day running total and elapsed days in current month, project month-end value */
function projectMonthEnd(runningTotal: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 0;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return (runningTotal / elapsedDays) * daysInMonth;
}

/** Mini forecast trajectory bar: shows actual so far + projected remainder */
function TrajectoryBar({
  actual, projected, target, color,
}: {
  actual: number; projected: number; target: number; color: string;
}) {
  const max = Math.max(target, projected, actual, 1);
  const actualPct  = Math.min((actual / max) * 100, 100);
  const projPct    = Math.min((projected / max) * 100, 100);
  const targetPct  = Math.min((target / max) * 100, 100);
  const onTrack    = projected >= target * 0.9;

  return (
    <div className="relative h-2 w-full rounded-full bg-[#363650] overflow-visible">
      {/* projected (faded) */}
      <div
        className="absolute left-0 top-0 h-full rounded-full opacity-25 transition-all duration-700"
        style={{ width: `${projPct}%`, backgroundColor: onTrack ? "#00d4aa" : "#f59e0b" }}
      />
      {/* actual (solid) */}
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${actualPct}%`, backgroundColor: color }}
      />
      {/* target tick */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
        style={{ left: `${targetPct}%`, backgroundColor: "#f8f8fc", opacity: 0.35 }}
      />
    </div>
  );
}

function GoalsWidget({
  revenueMonth,
  sessionsMonth,
  stripeConn,
  ga4Conn,
}: {
  revenueMonth: number;
  sessionsMonth: number;
  stripeConn: boolean;
  ga4Conn: boolean;
}) {
  const [goals, setGoals] = useState<Goals>({ revenueTarget: 0, sessionsTarget: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ revenue: "", sessions: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.goals) setGoals(d.goals);
      })
      .catch(() => {});
  }, []);

  function openEdit() {
    setDraft({
      revenue: goals.revenueTarget ? (goals.revenueTarget / 100).toFixed(0) : "",
      sessions: goals.sessionsTarget ? String(goals.sessionsTarget) : "",
    });
    setEditing(true);
  }

  async function saveGoals() {
    const updated: Goals = {
      revenueTarget: draft.revenue ? Math.round(parseFloat(draft.revenue) * 100) : 0,
      sessionsTarget: draft.sessions ? parseInt(draft.sessions) : 0,
    };
    setGoals(updated);
    setEditing(false);
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: updated }),
      });
    } finally {
      setSaving(false);
    }
  }

  // Days elapsed in this calendar month
  const today = new Date();
  const elapsedDays = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - elapsedDays;

  const revProjected  = projectMonthEnd(revenueMonth, elapsedDays);
  const sessProjected = projectMonthEnd(sessionsMonth, elapsedDays);

  const hasGoals = goals.revenueTarget > 0 || goals.sessionsTarget > 0;

  if (!editing && !hasGoals) {
    return (
      <button
        onClick={openEdit}
        className="w-full flex items-center gap-2 rounded-xl border border-dashed border-[#363650] bg-transparent px-4 py-3 text-left text-[#8585aa] hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-colors group"
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
        </svg>
        <span className="font-mono text-[11px]">Set monthly goals + forecast →</span>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-4 py-3 space-y-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#00d4aa]">Monthly goals</p>
        {stripeConn && (
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#bcbcd8] w-28 shrink-0">Revenue / mo ($)</label>
            <input
              type="number"
              placeholder="e.g. 10000"
              value={draft.revenue}
              onChange={(e) => setDraft((d) => ({ ...d, revenue: e.target.value }))}
              className="flex-1 bg-[#222235] border border-[#363650] rounded-lg px-3 py-1.5 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
          </div>
        )}
        {ga4Conn && (
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#bcbcd8] w-28 shrink-0">Sessions / mo</label>
            <input
              type="number"
              placeholder="e.g. 20000"
              value={draft.sessions}
              onChange={(e) => setDraft((d) => ({ ...d, sessions: e.target.value }))}
              className="flex-1 bg-[#222235] border border-[#363650] rounded-lg px-3 py-1.5 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={saveGoals} disabled={saving} className="flex-1 rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-xs font-bold text-[#13131f] hover:bg-[#00bfa0] transition disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => setEditing(false)} className="rounded-lg border border-[#363650] px-3 py-1.5 font-mono text-xs text-[#8585aa] hover:text-[#bcbcd8] transition">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Monthly goals</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-[#58588a]">{daysLeft}d left</span>
          <button onClick={openEdit} className="font-mono text-[9px] text-[#8585aa] hover:text-[#00d4aa] transition">Edit</button>
        </div>
      </div>

      {stripeConn && goals.revenueTarget > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#bcbcd8]">Revenue</span>
            <span className="font-mono text-[10px]">
              <span className="text-[#f8f8fc]">{fmt(revenueMonth, "currency")}</span>
              <span className="text-[#58588a]"> / {fmt(goals.revenueTarget, "currency")}</span>
            </span>
          </div>
          <TrajectoryBar actual={revenueMonth} projected={revProjected} target={goals.revenueTarget} color="#635bff" />
          <div className="flex items-center justify-between">
            {revenueMonth >= goals.revenueTarget ? (
              <span className="font-mono text-[9px] text-[#00d4aa]">🎉 Goal reached!</span>
            ) : (
              <span className="font-mono text-[9px]" style={{ color: revProjected >= goals.revenueTarget * 0.9 ? "#00d4aa" : "#f59e0b" }}>
                {revProjected >= goals.revenueTarget * 0.9 ? "✓ On track" : "⚠ Below pace"} · projected {fmt(revProjected, "currency")}
              </span>
            )}
            <span className="font-mono text-[9px] text-[#58588a]">{Math.round((revenueMonth / goals.revenueTarget) * 100)}%</span>
          </div>
        </div>
      )}

      {ga4Conn && goals.sessionsTarget > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#bcbcd8]">Sessions</span>
            <span className="font-mono text-[10px]">
              <span className="text-[#f8f8fc]">{fmt(sessionsMonth)}</span>
              <span className="text-[#58588a]"> / {fmt(goals.sessionsTarget)}</span>
            </span>
          </div>
          <TrajectoryBar actual={sessionsMonth} projected={sessProjected} target={goals.sessionsTarget} color="#f59e0b" />
          <div className="flex items-center justify-between">
            {sessionsMonth >= goals.sessionsTarget ? (
              <span className="font-mono text-[9px] text-[#00d4aa]">🎉 Goal reached!</span>
            ) : (
              <span className="font-mono text-[9px]" style={{ color: sessProjected >= goals.sessionsTarget * 0.9 ? "#00d4aa" : "#f59e0b" }}>
                {sessProjected >= goals.sessionsTarget * 0.9 ? "✓ On track" : "⚠ Below pace"} · projected {fmt(sessProjected)}
              </span>
            )}
            <span className="font-mono text-[9px] text-[#58588a]">{Math.round((sessionsMonth / goals.sessionsTarget) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Revenue Over Time Chart ───────────────────────────────────────────────

type RevRange = "7d" | "30d" | "90d";
const REV_RANGES: { id: RevRange; label: string; days: number }[] = [
  { id: "7d",  label: "7D",  days: 7  },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
];

interface RevenueChartTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function RevenueChartTooltip({ active, payload, label }: RevenueChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const dollars = (payload[0].value / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  return (
    <div className="rounded-xl border border-[#363650] bg-[#13131f] px-3 py-2 shadow-2xl">
      <p className="font-mono text-[9px] text-[#8585aa] mb-0.5">{label}</p>
      <p className="font-mono text-sm font-bold text-[#635bff]">{dollars}</p>
    </div>
  );
}

function RevenueOverTimeChart({
  snapshots,
  connectedRevenueProviders,
  onNavigate,
}: {
  snapshots: Snapshot[];
  connectedRevenueProviders: string[];
  onNavigate: (tab: Tab) => void;
}) {
  const [range, setRange] = useState<RevRange>("30d");

  const chartData = useMemo(() => {
    const days = REV_RANGES.find((r) => r.id === range)!.days;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Sum revenue across all revenue providers per day
    const dayMap: Record<string, number> = {};
    for (const snap of snapshots) {
      if (!connectedRevenueProviders.includes(snap.provider)) continue;
      if (snap.date < cutoffStr) continue;
      const rev = ((snap.data as Record<string, number>).revenue ?? 0);
      dayMap[snap.date] = (dayMap[snap.date] ?? 0) + rev;
    }

    // Fill every day in the range (zero for missing days)
    const result: { date: string; label: string; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      result.push({ date: key, label, revenue: dayMap[key] ?? 0 });
    }
    return result;
  }, [snapshots, connectedRevenueProviders, range]);

  const totalRevenue = chartData.reduce((a, d) => a + d.revenue, 0);
  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);
  const hasData = chartData.some((d) => d.revenue > 0);

  // X-axis tick: show every N-th label depending on range
  const tickInterval = range === "7d" ? 0 : range === "30d" ? 4 : 13;

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Revenue over time</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-[#f8f8fc]">
            {(totalRevenue / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 })}
            <span className="ml-2 font-mono text-[10px] font-normal text-[#8585aa]">
              {REV_RANGES.find((r) => r.id === range)!.label} total
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Range toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-[#363650] bg-[#13131f] p-1">
            {REV_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${
                  range === r.id
                    ? "bg-[#363650] text-[#f8f8fc]"
                    : "text-[#8585aa] hover:text-[#bcbcd8]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate("analytics")}
            className="ml-2 font-mono text-[10px] text-[#8585aa] hover:text-[#00d4aa] transition"
          >
            Details →
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-36 rounded-xl border border-dashed border-[#363650]">
          <p className="font-mono text-[11px] text-[#58588a]">No revenue data in this range</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#635bff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#635bff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#363650" strokeOpacity={0.6} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#58588a", fontFamily: "monospace", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={(v: number) => {
                const d = v / 100;
                if (d >= 1000) return `$${(d / 1000).toFixed(0)}k`;
                return `$${d.toFixed(0)}`;
              }}
              tick={{ fill: "#58588a", fontFamily: "monospace", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={[0, maxRevenue * 1.15]}
            />
            <Tooltip content={<RevenueChartTooltip />} cursor={{ stroke: "#635bff40", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#635bff"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#635bff", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Integration icons ─────────────────────────────────────────────────────
// Sourced from the shared catalog — LIVE_INTEGRATIONS contains stripe, ga4, meta

// ── Onboarding Wizard ─────────────────────────────────────────────────────

const SETUP_STEPS = LIVE_INTEGRATIONS.map((i, idx) => ({
  id: i.id,
  num: idx + 1,
  title: `Connect ${i.name}`,
  description: i.description,
  connectUrl: i.connectUrl!,
  color: i.color,
  icon: (
    <img src={i.icon} alt={i.name} width={20} height={20} className="object-contain" />
  ),
}));

function OnboardingWizard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const completedCount = 0; // no platforms yet — this component only renders when count === 0

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#363650]">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              Get started — {completedCount}/3 complete
            </p>
            <h2 className="font-mono text-base font-bold text-[#f8f8fc]">Connect your data sources</h2>
          </div>
        </div>
        <p className="font-mono text-[11px] text-[#8585aa] mt-1">
          Your dashboard populates automatically once connected. Each integration takes about 30 seconds.
        </p>
        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full rounded-full bg-[#363650]">
          <div
            className="h-full rounded-full bg-[#00d4aa] transition-all duration-700"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#363650]">
        {SETUP_STEPS.map((step) => (
          <div key={step.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#222235]/40 transition-colors">
            {/* Step number / check */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${step.color}18`, color: step.color }}
            >
              {step.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-semibold text-[#f8f8fc]">{step.title}</p>
              <p className="font-mono text-[10px] text-[#8585aa] mt-0.5">{step.description}</p>
            </div>

            {/* CTA */}
            <a
              href={step.connectUrl}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 font-mono text-[11px] font-semibold transition-all hover:opacity-80"
              style={{ borderColor: `${step.color}40`, color: step.color, backgroundColor: `${step.color}10` }}
            >
              Connect
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
              </svg>
            </a>
          </div>
        ))}
      </div>

      {/* Footer tip */}
      <div className="px-6 py-3 bg-[#13131f]/40 border-t border-[#363650]">
        <p className="font-mono text-[10px] text-[#58588a]">
          💡 Tip: Start with Stripe for the fastest time-to-value. Revenue data backfills automatically up to 18 months.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewTab({
  email,
  isPremium,
  connectedPlatforms,
  snapshots,
  websiteData,
  currencies = {},
  onNavigate,
}: OverviewTabProps) {
  const router = useRouter();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [alertRules, setAlertRules] = useState<AlertRules>(DEFAULT_ALERTS);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.alertRules) setAlertRules(d.alertRules);
      })
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setUpgradeError(data.error ?? "Something went wrong.");
        setUpgradeLoading(false);
        return;
      }
      router.push(data.url);
    } catch {
      setUpgradeError("Network error. Please try again.");
      setUpgradeLoading(false);
    }
  }

  // ── Metrics: 7d vs previous 7d for trend ───────────────────────────────
  // Demo mode: show sample data when no platforms are connected
  const isDemoMode = isPremium && connectedPlatforms.length === 0;
  const effectiveSnapshots = isDemoMode ? DEMO_SNAPSHOTS : snapshots;
  const effectivePlatforms = isDemoMode ? DEMO_CONNECTED_PLATFORMS : connectedPlatforms;

  const { kpis, activity, narrative, crossInsights, metrics7, revenueMonth, sessionsMonth } = useMemo(() => {
    const snaps7 = filterDays(effectiveSnapshots, 7);
    const snaps14 = filterDays(effectiveSnapshots, 14);
    const snapsPrev7 = snaps14.filter((s) => !snaps7.find((x) => x.id === s.id));

    // ── Multi-provider groups ───────────────────────────────────────────
    const connRevenue  = connectedIn(effectivePlatforms, REVENUE_PROVIDERS);
    const connAnalytics = connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS);
    const connAds      = connectedIn(effectivePlatforms, ADS_PROVIDERS);

    // For CAC display, use the primary ad platform's currency
    const primaryAdCurrency: string = connAds.length > 0
      ? (currencies[connAds[0]] ?? "USD")
      : "USD";

    const primaryAnalytics = pickPrimaryAnalyticsProvider(snaps7, connAnalytics)
      ?? pickPrimaryAnalyticsProvider(effectiveSnapshots, connAnalytics);

    // Revenue — SUM across all connected revenue providers
    const revenue7     = sumProviders(snaps7, connRevenue, "revenue");
    const revenuePrev  = sumProviders(snapsPrev7, connRevenue, "revenue");

    // New customers — SUM across revenue providers (each platform owns its own customer)
    const newCustomers7    = sumProviders(snaps7, connRevenue, "newCustomers");
    const newCustomersPrev = sumProviders(snapsPrev7, connRevenue, "newCustomers");

    // Transactions from Stripe (for narrative detail)

    const sessions7    = primaryAnalytics ? sumField(snaps7, primaryAnalytics, "sessions") : 0;
    const sessionsPrev = primaryAnalytics ? sumField(snapsPrev7, primaryAnalytics, "sessions") : 0;

    // Conversions from primary analytics
    const conversions7 = primaryAnalytics ? sumField(snaps7, primaryAnalytics, "conversions") : 0;

    // Bounce rate from primary analytics
    const bounceRate7  = primaryAnalytics ? avgField(snaps7, primaryAnalytics, "bounceRate") : 0;

    // Ad spend — SUM across all connected ad platforms
    const spend7    = sumProviders(snaps7, connAds, "spend");
    const spendPrev = sumProviders(snapsPrev7, connAds, "spend");

    // Clicks from Meta specifically (for display in Meta-related cards)
    const metaClicks7 = sumField(snaps7, "meta", "clicks");

    const hasRevenue  = connRevenue.length > 0;
    const hasAnalytics = connAnalytics.length > 0;
    const hasAds      = connAds.length > 0;
    const metaConn    = effectivePlatforms.includes("meta");

    // CAC: total ad spend ÷ total new customers
    const cac7 = newCustomers7 > 0 && spend7 > 0 ? spend7 / newCustomers7 : null;

    // Multi-source labels
    const revSourceLabel = connRevenue.length > 1
      ? `${connRevenue.length} platforms · ${newCustomers7} new customers`
      : connRevenue.length === 1 ? `${newCustomers7} new customers` : null;

    const analyticsSourceLabel = connAnalytics.length > 1 && primaryAnalytics
      ? `${fmt(conversions7)} conv · via ${primaryAnalytics}`
      : connAnalytics.length === 1 ? `${fmt(conversions7)} conversions` : null;

    const adsSourceLabel = connAds.length > 1
      ? `${connAds.length} platforms · ${fmt(metaClicks7)} Meta clicks`
      : connAds.length === 1 ? `${fmt(metaClicks7)} clicks` : null;

    // ── Yesterday's metrics for daily narrative ─────────────────────────
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const snapsYesterday = effectiveSnapshots.filter((s) => s.date === yesterdayStr);
    const revenueYday    = sumProviders(snapsYesterday, connRevenue, "revenue");
    const sessionsYday   = primaryAnalytics ? sumField(snapsYesterday, primaryAnalytics, "sessions") : 0;
    const txYday         = sumField(snapsYesterday, "stripe", "transactions");
    const newCxYday      = sumProviders(snapsYesterday, connRevenue, "newCustomers");
    const spendYday      = sumProviders(snapsYesterday, connAds, "spend");
    const bounceYday     = primaryAnalytics ? avgField(snapsYesterday, primaryAnalytics, "bounceRate") : 0;
    const hasYesterdayData = snapsYesterday.length > 0;

    // Build narrative sentence
    const narrativeParts: string[] = [];
    if (hasRevenue && revenueYday > 0) narrativeParts.push(`${fmt(revenueYday, "currency")} revenue${txYday > 0 ? ` (${txYday} txns)` : ""}`);
    if (hasAnalytics && sessionsYday > 0) narrativeParts.push(`${fmt(sessionsYday)} sessions`);
    if (hasRevenue && newCxYday > 0) narrativeParts.push(`${newCxYday} new customer${newCxYday !== 1 ? "s" : ""}`);
    if (hasAds && spendYday > 0) narrativeParts.push(`${fmtMetaSpend(spendYday, primaryAdCurrency)} ad spend`);

    const narrative = {
      hasData: hasYesterdayData && narrativeParts.length > 0,
      text: narrativeParts.join(" · "),
      bounceAlert: hasAnalytics && bounceYday > 65,
      bounceRate: bounceYday,
      date: yesterdayStr,
    };

    // ── Cross-insight: website + analytics ──────────────────────────────
    const crossInsights: { icon: string; color: string; message: string; action: string }[] = [];
    if (hasAnalytics && bounceRate7 > 65 && websiteData.score > 0 && websiteData.score < 60) {
      crossInsights.push({
        icon: "⚠",
        color: "#f59e0b",
        message: `High bounce rate (${fmt(bounceRate7, "percent")}) combined with a low website score (${websiteData.score}/100) suggests UX issues are driving visitors away.`,
        action: "Fix website →",
      });
    }
    if (hasAnalytics && bounceRate7 > 65 && websiteData.score >= 60) {
      crossInsights.push({
        icon: "↑",
        color: "#f87171",
        message: `Bounce rate is elevated at ${fmt(bounceRate7, "percent")}. Despite a decent website score, consider reviewing your landing page copy and load speed.`,
        action: "View website →",
      });
    }
    if (hasRevenue && hasAds && newCustomers7 > 0 && spend7 > 0 && websiteData.score > 0 && websiteData.score < 55) {
      crossInsights.push({
        icon: "💡",
        color: "#a78bfa",
        message: `You're spending on ads but your website health score is ${websiteData.score}/100. Fixing website issues could significantly improve your ad-to-customer conversion rate.`,
        action: "Improve website →",
      });
    }

    const kpis = [
      {
        label: "Revenue (7d)",
        value: hasRevenue ? fmt(revenue7, "currency") : null,
        sub: hasRevenue ? revSourceLabel : null,
        trend: hasRevenue ? { current: revenue7, prev: revenuePrev } : null,
        icon: "revenue",
      },
      {
        label: "Sessions (7d)",
        value: hasAnalytics ? fmt(sessions7) : null,
        sub: hasAnalytics ? analyticsSourceLabel : null,
        trend: hasAnalytics ? { current: sessions7, prev: sessionsPrev } : null,
        icon: "sessions",
      },
      {
        label: "Ad Spend (7d)",
        value: hasAds ? fmtMetaSpend(spend7, primaryAdCurrency) : null,
        sub: hasAds ? adsSourceLabel : null,
        trend: hasAds ? { current: spend7, prev: spendPrev } : null,
        icon: "adspend",
      },
      {
        label: "New Customers (7d)",
        value: hasRevenue ? fmt(newCustomers7) : null,
        sub: hasRevenue
          ? bounceRate7 > 0 && hasAnalytics
            ? `Bounce rate ${fmt(bounceRate7, "percent")}`
            : connRevenue.length > 1 ? `across ${connRevenue.length} platforms` : "from revenue"
          : null,
        trend: hasRevenue ? { current: newCustomers7, prev: newCustomersPrev } : null,
        icon: "customers",
      },
      {
        label: "CAC",
        value: hasAds && hasRevenue && cac7 !== null ? fmtMetaSpend(cac7, primaryAdCurrency) : null,
        sub: hasAds && hasRevenue && cac7 !== null
          ? primaryAdCurrency !== (currencies[connRevenue[0]] ?? "USD")
            ? `${primaryAdCurrency} spend ÷ new customers`
            : "ad spend ÷ new customers"
          : null,
        trend: null,
        icon: "cac",
      },
      {
        label: "Bounce Rate (7d)",
        value: hasAnalytics ? fmt(bounceRate7, "percent") : null,
        sub: hasAnalytics
          ? connAnalytics.length > 1 && primaryAnalytics
            ? `via ${primaryAnalytics} (primary)`
            : "avg across 7 days"
          : null,
        trend: null,
        icon: "bounce",
      },
    ];

    // Activity feed from completed tasks + last scan
    const activityItems: { type: string; label: string; time: string; color: string }[] = [];

    websiteData.tasks
      .filter((t) => t.completed && t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 4)
      .forEach((t) => {
        activityItems.push({
          type: "task",
          label: `Completed: ${t.title}`,
          time: timeAgo(t.completed_at!),
          color: "#00d4aa",
        });
      });

    if (websiteData.lastScanned) {
      activityItems.push({
        type: "scan",
        label: `Website analyzed — score ${websiteData.score}/100`,
        time: timeAgo(websiteData.lastScanned),
        color: "#a78bfa",
      });
    }

    const today = new Date();
    const snapsThisMonth = filterDays(effectiveSnapshots, today.getDate());

    return {
      kpis,
      activity: activityItems.slice(0, 5),
      narrative,
      crossInsights,
      metrics7: { revenue7, sessions7, bounceRate7, spend7, revenuePrev },
      revenueMonth: sumProviders(snapsThisMonth, connRevenue, "revenue"),
      sessionsMonth: primaryAnalytics ? sumField(snapsThisMonth, primaryAnalytics, "sessions") : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSnapshots, effectivePlatforms, websiteData, currencies]);

  const pendingTasks = websiteData.tasks.filter((t) => !t.completed);
  const completedTasks = websiteData.tasks.filter((t) => t.completed);
  const hasAllIntegrations = LIVE_INTEGRATIONS.every((i) => connectedPlatforms.includes(i.id));
  const missingIntegrations = LIVE_INTEGRATIONS.filter((i) => !connectedPlatforms.includes(i.id));

  // ── Active alerts based on user-configured thresholds ─────────────────
  const activeAlerts: { color: string; message: string }[] = [];
  if (alertRules.revenueDropPct > 0 && metrics7.revenuePrev > 0) {
    const dropPct = ((metrics7.revenuePrev - metrics7.revenue7) / metrics7.revenuePrev) * 100;
    if (dropPct >= alertRules.revenueDropPct) {
      activeAlerts.push({ color: "#f87171", message: `🚨 Revenue is down ${dropPct.toFixed(1)}% vs last week (threshold: ${alertRules.revenueDropPct}%)` });
    }
  }
  if (alertRules.bounceSpikeThreshold > 0 && metrics7.bounceRate7 > alertRules.bounceSpikeThreshold) {
    activeAlerts.push({ color: "#f59e0b", message: `⚠ Bounce rate ${fmt(metrics7.bounceRate7, "percent")} exceeds your ${alertRules.bounceSpikeThreshold}% threshold` });
  }
  if (alertRules.spendSpikeThreshold > 0 && metrics7.spend7 > 0) {
    const avgDailySpend = metrics7.spend7 / 7;
    if (avgDailySpend > alertRules.spendSpikeThreshold * 100) {
      activeAlerts.push({ color: "#1877f2", message: `💸 Average daily ad spend (${fmt(avgDailySpend, "currency")}) exceeds your $${alertRules.spendSpikeThreshold} cap` });
    }
  }

  // ── Statistical anomaly detection (auto, no threshold required) ────────
  const anomalies = useMemo(() => {
    const results: { color: string; message: string }[] = [];
    if (!isPremium || effectiveSnapshots.length < 14) return results;

    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    /** Compute mean + stddev for a daily series */
    function stats(values: number[]): { mean: number; std: number } {
      if (values.length === 0) return { mean: 0, std: 0 };
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      return { mean, std: Math.sqrt(variance) };
    }

    /** Get daily values for a metric over the last N days (excluding today/yesterday) */
    function dailyValues(provider: string, field: string, excludeDays = 2): number[] {
      return effectiveSnapshots
        .filter((s) => s.provider === provider && s.date < yesterdayStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30)
        .slice(0, -excludeDays + (excludeDays > 0 ? 0 : undefined as unknown as number))
        .map((s) => (s.data as Record<string, number>)[field] ?? 0)
        .filter((v) => v > 0); // exclude zero days (no data)
    }

    /** Get yesterday's value */
    function yesterday(provider: string, field: string): number {
      const snap = effectiveSnapshots.find((s) => s.provider === provider && s.date === yesterdayStr);
      return snap ? ((snap.data as Record<string, number>)[field] ?? 0) : 0;
    }

    const connRevAnom   = connectedIn(effectivePlatforms, REVENUE_PROVIDERS);
    const connAnAnom    = connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS);
    const connAdsAnom   = connectedIn(effectivePlatforms, ADS_PROVIDERS);
    const primaryAnAnom = pickPrimaryAnalyticsProvider(effectiveSnapshots, connAnAnom);

    // Revenue anomaly — sum all revenue providers
    if (connRevAnom.length > 0) {
      // Build daily revenue series by summing across all revenue providers per day
      const dayRevMap: Record<string, number> = {};
      for (const s of effectiveSnapshots) {
        if (!connRevAnom.includes(s.provider) || s.date >= yesterdayStr) continue;
        const v = (s.data as Record<string, number>).revenue ?? 0;
        dayRevMap[s.date] = (dayRevMap[s.date] ?? 0) + v;
      }
      const revValues = Object.values(dayRevMap).filter((v) => v > 0).slice(-30);
      const revYday = connRevAnom.reduce((sum, p) => {
        const snap = effectiveSnapshots.find((s) => s.provider === p && s.date === yesterdayStr);
        return sum + ((snap?.data as Record<string, number>)?.revenue ?? 0);
      }, 0);
      const { mean, std } = stats(revValues);
      if (mean > 0 && std > 0 && revYday > 0) {
        const zScore = (revYday - mean) / std;
        if (zScore < -2) {
          const dropPct = Math.round(((mean - revYday) / mean) * 100);
          results.push({
            color: "#f87171",
            message: `📉 Revenue yesterday was ${fmt(revYday, "currency")} — ${dropPct}% below your 30-day average${std > 0 ? ` (unusual for a ${dayOfWeek})` : ""}`,
          });
        } else if (zScore > 2.5) {
          const gainPct = Math.round(((revYday - mean) / mean) * 100);
          results.push({
            color: "#00d4aa",
            message: `🚀 Revenue yesterday was ${fmt(revYday, "currency")} — ${gainPct}% above your 30-day average! Best ${dayOfWeek} in a month.`,
          });
        }
      }
    }

    // Sessions anomaly — primary analytics provider only
    if (primaryAnAnom) {
      const sessValues = dailyValues(primaryAnAnom, "sessions");
      const sessYday   = yesterday(primaryAnAnom, "sessions");
      const { mean, std } = stats(sessValues);
      if (mean > 0 && std > 0 && sessYday > 0) {
        const zScore = (sessYday - mean) / std;
        if (zScore < -2) {
          const dropPct = Math.round(((mean - sessYday) / mean) * 100);
          results.push({
            color: "#f59e0b",
            message: `👻 Traffic dropped ${dropPct}% yesterday (${fmt(sessYday)} sessions vs ${fmt(Math.round(mean))} avg). Check for indexing or ad issues.`,
          });
        }
      }
    }

    // Bounce rate spike — primary analytics provider only
    if (primaryAnAnom) {
      const bounceValues = dailyValues(primaryAnAnom, "bounceRate");
      const bounceYday   = yesterday(primaryAnAnom, "bounceRate");
      const { mean, std } = stats(bounceValues);
      if (mean > 0 && std > 0 && bounceYday > 0) {
        const zScore = (bounceYday - mean) / std;
        if (zScore > 2) {
          results.push({
            color: "#f59e0b",
            message: `⚠ Bounce rate spiked to ${fmt(bounceYday, "percent")} yesterday — ${Math.round(bounceYday - mean)}pp above your 30-day average. Something may have broken.`,
          });
        }
      }
    }

    // Ad spend anomaly — sum across all ad platforms
    if (connAdsAnom.length > 0) {
      const daySpendMap: Record<string, number> = {};
      for (const s of effectiveSnapshots) {
        if (!connAdsAnom.includes(s.provider) || s.date >= yesterdayStr) continue;
        const v = (s.data as Record<string, number>).spend ?? 0;
        daySpendMap[s.date] = (daySpendMap[s.date] ?? 0) + v;
      }
      const spendValues = Object.values(daySpendMap).filter((v) => v > 0).slice(-30);
      const spendYday = connAdsAnom.reduce((sum, p) => {
        const snap = effectiveSnapshots.find((s) => s.provider === p && s.date === yesterdayStr);
        return sum + ((snap?.data as Record<string, number>)?.spend ?? 0);
      }, 0);
      const { mean, std } = stats(spendValues);
      if (mean > 0 && std > 0 && spendYday > 0) {
        const zScore = (spendYday - mean) / std;
        if (zScore > 2) {
          const pct = Math.round(((spendYday - mean) / mean) * 100);
          const platformNote = connAdsAnom.length > 1 ? `across ${connAdsAnom.join(" + ")}` : `on ${connAdsAnom[0]}`;
          results.push({
            color: "#1877f2",
            message: `💸 Ad spend was ${pct}% above average yesterday (${platformNote}). Check your campaigns for runaway spend.`,
          });
        }
      }
    }

    return results;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSnapshots, effectivePlatforms, isPremium]);

  // Push triggered alerts + anomalies to the in-app notification bell (once per session)
  const pushedAlertsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const alert of [...activeAlerts, ...anomalies]) {
      if (!pushedAlertsRef.current.has(alert.message)) {
        pushedAlertsRef.current.add(alert.message);
        pushNotification(alert.message, alert.color);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlerts.map((a) => a.message).join("|"), anomalies.map((a) => a.message).join("|")]);

  const firstName = email.split("@")[0].split(/[._-]/)[0];
  const capitalFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="w-full space-y-8">

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">
            {greetingTime()}, {capitalFirst}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[#8585aa]">{formatDate()}</p>
        </div>
        {isPremium ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/8 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              Premium Active
            </span>
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/5 px-4 py-1.5 font-mono text-[10px] font-semibold text-[#00d4aa] hover:bg-[#00d4aa]/10 transition disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Upgrade to Premium
          </button>
        )}
      </div>

      {upgradeError && <p className="font-mono text-xs text-red-400">{upgradeError}</p>}

      {/* ── Demo mode banner ──────────────────────────────────── */}
      {isDemoMode && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#a78bfa]/25 bg-[#a78bfa]/8 px-5 py-4">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/15 text-[#a78bfa]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-0.5">Demo Mode</p>
            <p className="font-mono text-[11px] text-[#e0e0f0]">
              You&apos;re viewing sample data for a fictional SaaS business. Connect Stripe, GA4, or Meta Ads in Settings to see your real metrics.
            </p>
          </div>
          <button
            onClick={() => onNavigate("settings")}
            className="shrink-0 font-mono text-[10px] font-semibold text-[#a78bfa] hover:underline"
          >
            Connect →
          </button>
        </div>
      )}

      {/* ── Onboarding wizard — shown when no platforms connected ── */}
      {!isDemoMode && connectedPlatforms.length === 0 && (
        <OnboardingWizard onNavigate={onNavigate} />
      )}

      {/* ── Yesterday at a glance ─────────────────────────────── */}
      {isPremium && narrative.hasData && (
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">Yesterday</p>
                <span className="font-mono text-[9px] text-[#58588a]">
                  {new Date(narrative.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="font-mono text-sm text-[#e0e0f0] leading-relaxed">{narrative.text}</p>
              {narrative.bounceAlert && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="font-mono text-[10px] font-semibold text-amber-400">
                    Bounce rate {fmt(narrative.bounceRate, "percent")} — high, consider checking landing pages
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Free-plan: data-sync awareness banner ────────────── */}
      {!isPremium && (
        <div className="flex items-start gap-4 rounded-2xl border border-[#a78bfa]/25 bg-[#a78bfa]/8 px-5 py-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/15 text-[#a78bfa]">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-1">Data syncing in progress</p>
            <p className="font-mono text-[11px] text-[#e0e0f0] leading-relaxed">
              Your dashboard will populate automatically as each integration syncs. First-time data collection can take up to <span className="text-[#f8f8fc] font-semibold">24 hours</span> — check back soon and your KPIs, trends, and insights will appear here.
            </p>
            <p className="mt-2 font-mono text-[10px] text-[#8585aa]">
              No action needed · syncing happens in the background
            </p>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#a78bfa] px-3 py-1.5 font-mono text-[10px] font-bold text-[#13131f] hover:bg-[#9168f0] transition disabled:opacity-50"
          >
            {upgradeLoading ? "…" : "Upgrade →"}
          </button>
        </div>
      )}

      {/* ── Insights & alerts (premium only) ─────────────────── */}

      {/* ── Active alert banners ──────────────────────────── */}
      {isPremium && activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: alert.color + "35", backgroundColor: alert.color + "0d" }}>
              <p className="flex-1 font-mono text-[11px]" style={{ color: alert.color }}>{alert.message}</p>
              <button
                onClick={() => onNavigate("settings")}
                className="shrink-0 font-mono text-[10px] hover:underline"
                style={{ color: alert.color }}
              >
                Adjust →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Statistical anomaly banners (auto-detected) ───── */}
      {isPremium && anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: a.color + "35", backgroundColor: a.color + "0d" }}>
              <div className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: a.color + "20", color: a.color }}>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="flex-1 font-mono text-[11px] leading-relaxed" style={{ color: a.color }}>{a.message}</p>
              <span className="shrink-0 font-mono text-[9px] text-[#58588a] whitespace-nowrap">Auto-detected</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cross-insights (website + analytics) ──────────────── */}
      {isPremium && crossInsights.length > 0 && (
        <div className="space-y-2">
          {crossInsights.slice(0, 1).map((ci, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border px-5 py-3.5" style={{ borderColor: ci.color + "30", backgroundColor: ci.color + "08" }}>
              <span className="mt-0.5 font-mono text-sm shrink-0" style={{ color: ci.color }}>{ci.icon}</span>
              <p className="flex-1 font-mono text-[11px] text-[#e0e0f0] leading-relaxed">{ci.message}</p>
              <button
                onClick={() => onNavigate("website")}
                className="shrink-0 font-mono text-[10px] font-semibold hover:underline"
                style={{ color: ci.color }}
              >
                {ci.action}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Last 7 days</p>
          <span className="font-mono text-[8px] text-[#58588a] border border-[#363650] rounded px-1.5 py-0.5">▲▼ vs prev 7 days</span>
          <div className="flex-1 border-t border-[#363650]" />
          <button
            onClick={() => onNavigate("analytics")}
            className="font-mono text-[9px] text-[#8585aa] hover:text-[#00d4aa] transition"
          >
            Full analytics →
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              sub={k.sub}
              trend={k.trend}
              icon={k.icon}
            />
          ))}
        </div>
      </section>

      {/* ── Revenue Over Time Chart ───────────────────────────── */}
      {connectedIn(effectivePlatforms, REVENUE_PROVIDERS).length > 0 && (
        <RevenueOverTimeChart
          snapshots={effectiveSnapshots}
          connectedRevenueProviders={connectedIn(effectivePlatforms, REVENUE_PROVIDERS)}
          onNavigate={onNavigate}
        />
      )}

      {/* ── Bottom grid: Website score + Quick Actions + Activity ─ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Website Health card (2/3 width) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Website Health</p>
              {websiteData.url && (
                <p className="mt-0.5 font-mono text-[11px] text-[#bcbcd8] truncate max-w-60">
                  {websiteData.url.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate("website")}
              className="font-mono text-[10px] font-semibold text-[#00d4aa] hover:underline"
            >
              Manage →
            </button>
          </div>

          {!websiteData.url ? (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-[#363650] p-4">
              <span className="text-[#2e2e4e]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </span>
              <div>
                <p className="font-mono text-sm font-semibold text-[#8585aa]">No website added yet</p>
                <button
                  onClick={() => onNavigate("website")}
                  className="mt-1 font-mono text-[11px] font-semibold text-[#00d4aa] hover:underline"
                >
                  Add your website →
                </button>
              </div>
            </div>
          ) : websiteData.status === "analyzing" ? (
            <div className="flex items-center gap-4 rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/5 p-4">
              <svg className="animate-spin h-5 w-5 text-[#a78bfa] shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="font-mono text-sm text-[#a78bfa]">Analysis in progress…</p>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <MiniScoreRing score={websiteData.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-lg font-bold text-[#f8f8fc]">{websiteData.score}/100</span>
                  <span
                    className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{
                      color: scoreColor(websiteData.score),
                      backgroundColor: `${scoreColor(websiteData.score)}18`,
                    }}
                  >
                    {scoreLabel(websiteData.score)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#363650] mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${websiteData.score}%`,
                      backgroundColor: scoreColor(websiteData.score),
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[#8585aa]">
                  <span>
                    <span className="text-[#f59e0b] font-bold">{pendingTasks.length}</span> tasks pending
                  </span>
                  <span>
                    <span className="text-[#00d4aa] font-bold">{completedTasks.length}</span> completed
                  </span>
                  {websiteData.lastScanned && (
                    <span>Scanned {timeAgo(websiteData.lastScanned)}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top 2 pending tasks preview */}
          {pendingTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Top improvements</p>
              {pendingTasks.slice(0, 2).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <p className="flex-1 min-w-0 font-mono text-[11px] text-[#e0e0f0] truncate">{t.title}</p>
                  <span className="font-mono text-[10px] font-bold text-[#f59e0b] shrink-0">
                    +{t.impact_score} pts
                  </span>
                </div>
              ))}
              {pendingTasks.length > 2 && (
                <button
                  onClick={() => onNavigate("website")}
                  className="font-mono text-[10px] text-[#8585aa] hover:text-[#00d4aa] transition"
                >
                  +{pendingTasks.length - 2} more tasks →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column: Quick Actions + Recent Activity */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Quick Actions</p>
            <div className="space-y-2">
              <GoalsWidget
                revenueMonth={revenueMonth}
                sessionsMonth={sessionsMonth}
                stripeConn={connectedIn(effectivePlatforms, REVENUE_PROVIDERS).length > 0}
                ga4Conn={connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS).length > 0}
              />
              <button
                onClick={() => onNavigate("website")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  {websiteData.url ? "Re-analyze website" : "Add website"}
                </span>
              </button>
              <button
                onClick={() => onNavigate("analytics")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  View analytics
                </span>
              </button>
              <button
                onClick={() => onNavigate("settings")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  Manage integrations
                </span>
              </button>
              {!isPremium && (
                <button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="w-full flex items-center gap-3 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-2.5 text-left transition hover:bg-[#00d4aa]/10 group disabled:opacity-50"
                >
                  <span className="text-[#00d4aa]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#00d4aa]">
                    Upgrade to Premium
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Recent Activity</p>
            {activity.length === 0 ? (
              <div className="py-4 text-center">
                <p className="font-mono text-[11px] text-[#58588a]">No activity yet</p>
                <p className="mt-1 font-mono text-[10px] text-[#58588a]">
                  Analyze your website to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: a.color + "18", color: a.color }}
                    >
                      {a.type === "task" ? (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : a.type === "scan" ? (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[#e0e0f0] leading-snug">{a.label}</p>
                      <p className="font-mono text-[9px] text-[#8585aa] mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Integrations (only if not all connected) ──────────── */}
      {!hasAllIntegrations && (
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Integrations</p>
              <p className="mt-1 text-sm text-[#bcbcd8]">Connect your tools to unlock real data.</p>
            </div>
            <span className="font-mono text-[10px] text-[#8585aa]">
              {connectedPlatforms.length}/3 connected
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {missingIntegrations.map((intg) => (
              <a
                key={intg.id}
                href={intg.connectUrl}
                className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${intg.color}18`, color: intg.color }}
                >
                  <img
                    src={intg.icon}
                    alt={intg.name}
                    width={16}
                    height={16}
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                    {intg.name}
                  </p>
                  <p className="font-mono text-[9px] text-[#8585aa]">{intg.description}</p>
                </div>
                <span className="ml-auto font-mono text-[9px] text-[#8585aa] group-hover:text-[#00d4aa] shrink-0">
                  Connect →
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
