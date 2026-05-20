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
import { DEFAULT_ALERTS, type AlertRules } from "./DataSourcesTab";
import { LIVE_INTEGRATIONS, REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";

// ── Types ─────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
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

function fmt(n: number, type: "currency" | "number" | "percent" = "number", currency = "USD"): string {
  if (type === "currency") {
    const amount = n / 100;
    if (n >= 100_000) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount);
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function getMetaCurrency(snaps: Snapshot[]): string {
  const found = [...snaps]
    .reverse()
    .find((s) => s.provider === "meta" && (s.data as Record<string, unknown>)?.currency);
  return ((found?.data as Record<string, unknown>)?.currency as string) ?? "USD";
}

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

function sumProviders(snaps: Snapshot[], providers: string[], field: string): number {
  return snaps
    .filter((s) => providers.includes(s.provider))
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

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

function pickPrimaryAnalyticsProvider(snaps: Snapshot[], providers: string[]): string | null {
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

// ── Trend Badge ─────────────────────────────────────────────────────────

function TrendBadge({ current, prev, size = "md" }: { current: number; prev: number; size?: "sm" | "md" }) {
  const pct = trendPct(current, prev);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono font-bold rounded-full tabular-nums
      ${size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"}
      ${up ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}
    >
      {up ? "↑" : "↓"}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 80, height = 32, fill = true }: {
  data: number[]; color: string; width?: number; height?: number; fill?: boolean;
}) {
  const valid = data.filter((v) => v > 0);
  if (valid.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible">
      {fill && (
        <polygon
          points={`0,${height} ${pts} ${width},${height}`}
          fill={color}
          fillOpacity={0.1}
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  );
}

// ── Full-bleed background sparkline ──────────────────────────────────────

function BgSparkline({ data, color }: { data: number[]; color: string }) {
  const valid = data.filter((v) => v > 0);
  if (valid.length < 2) return null;
  const w = 400; const h = 120;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="bgSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.12} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#bgSparkGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity={0.3} />
    </svg>
  );
}

// ── Compact stat row ─────────────────────────────────────────────────────

function CompactStat({
  label, value, trend, spark, accent, connect, connectHref, border = true,
}: {
  label: string;
  value: string | null;
  trend?: { current: number; prev: number } | null;
  spark?: number[];
  accent: string;
  connect?: string;
  connectHref?: string;
  border?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-3 ${border ? "border-b border-black/8" : ""}`}>
      {/* Color dot */}
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent + "60" }} />
      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[9px] font-medium uppercase tracking-widest text-[#4a4a6a] mb-0.5">{label}</p>
        {value !== null ? (
          <p className="font-mono text-[17px] font-bold text-[#1a1a2e] tabular-nums leading-none">{value}</p>
        ) : (
          <div className="flex items-center gap-2">
            <p className="font-mono text-[17px] font-bold text-[#ebebf8] leading-none">—</p>
            {connect && connectHref && (
              <a href={connectHref} className="font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full border border-black/10 text-[#4a4a6a] hover:text-[#00d4aa] hover:border-[#00d4aa]/30 transition-colors">
                + {connect}
              </a>
            )}
          </div>
        )}
      </div>
      {/* Sparkline */}
      {value !== null && spark && spark.length > 1 && (
        <Sparkline data={spark} color={accent} width={52} height={26} />
      )}
      {/* Trend */}
      {value !== null && trend && (
        <TrendBadge current={trend.current} prev={trend.prev} size="sm" />
      )}
    </div>
  );
}

// ── Goals Widget ─────────────────────────────────────────────────────────

interface Goals {
  revenueTarget: number;
  sessionsTarget: number;
}

function projectMonthEnd(runningTotal: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 0;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return (runningTotal / elapsedDays) * daysInMonth;
}

function GoalBar({ actual, target, color }: { actual: number; target: number; color: string }) {
  const pct = Math.min((actual / Math.max(target, 1)) * 100, 100);
  return (
    <div className="relative h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function GoalsWidget({
  revenueMonth, sessionsMonth, stripeConn, ga4Conn, currency = "USD",
}: {
  revenueMonth: number; sessionsMonth: number; stripeConn: boolean; ga4Conn: boolean; currency?: string;
}) {
  const [goals, setGoals] = useState<Goals>({ revenueTarget: 0, sessionsTarget: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ revenue: "", sessions: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => { if (d.goals) setGoals(d.goals); }).catch(() => {});
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
    setGoals(updated); setEditing(false); setSaving(true);
    try { await fetch("/api/user/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals: updated }) }); }
    finally { setSaving(false); }
  }

  const today = new Date();
  const elapsedDays = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - elapsedDays;
  const revProjected = projectMonthEnd(revenueMonth, elapsedDays);
  const sessProjected = projectMonthEnd(sessionsMonth, elapsedDays);
  const hasGoals = goals.revenueTarget > 0 || goals.sessionsTarget > 0;

  if (!editing && !hasGoals) {
    return (
      <button onClick={openEdit} className="group flex items-center gap-3 w-full text-left">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-dashed border-black/15 text-[#3a3a5a] group-hover:border-[#00d4aa]/40 group-hover:text-[#00d4aa] transition-colors">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
          </svg>
        </div>
        <div>
          <p className="font-mono text-[11px] font-semibold text-[#4a4a6a] group-hover:text-[#00d4aa] transition-colors">Set monthly goals</p>
          <p className="font-mono text-[9px] text-[#414141]">Track revenue + sessions against targets</p>
        </div>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#00d4aa] font-semibold">Monthly Goals</p>
        {stripeConn && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#5a5a7a] w-24 shrink-0">Revenue ({currency})</span>
            <input type="number" placeholder="e.g. 10000" value={draft.revenue}
              onChange={(e) => setDraft((d) => ({ ...d, revenue: e.target.value }))}
              className="flex-1 bg-[#ffffff] border border-black/12 rounded-lg px-3 py-1.5 font-mono text-xs text-[#1a1a2e] placeholder:text-[#ebebf8] focus:outline-none focus:border-[#00d4aa]/40" />
          </div>
        )}
        {ga4Conn && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#5a5a7a] w-24 shrink-0">Sessions</span>
            <input type="number" placeholder="e.g. 20000" value={draft.sessions}
              onChange={(e) => setDraft((d) => ({ ...d, sessions: e.target.value }))}
              className="flex-1 bg-[#ffffff] border border-black/12 rounded-lg px-3 py-1.5 font-mono text-xs text-[#1a1a2e] placeholder:text-[#ebebf8] focus:outline-none focus:border-[#00d4aa]/40" />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={saveGoals} disabled={saving} className="flex-1 rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-xs font-bold text-[#f4efff] hover:bg-[#00bfa0] transition disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => setEditing(false)} className="rounded-lg border border-black/12 px-3 py-1.5 font-mono text-xs text-[#5a5a7a] hover:text-[#4a4a6a] transition">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#3a3a5a]">{daysLeft}d remaining</p>
        <button onClick={openEdit} className="font-mono text-[9px] text-[#3a3a5a] hover:text-[#00d4aa] transition">Edit</button>
      </div>
      {stripeConn && goals.revenueTarget > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#7575a0]">Revenue</span>
            <span className="font-mono text-[10px] font-bold text-[#1a1a2e] tabular-nums">{fmt(revenueMonth, "currency", currency)} <span className="text-[#eaeaf5] font-normal">/ {fmt(goals.revenueTarget, "currency", currency)}</span></span>
          </div>
          <GoalBar actual={revenueMonth} target={goals.revenueTarget} color="#635bff" />
          <p className={`font-mono text-[9px] font-semibold ${revProjected >= goals.revenueTarget * 0.9 ? "text-emerald-400" : "text-amber-400"}`}>
            {revProjected >= goals.revenueTarget * 0.9 ? "✓ On track" : "⚠ Below pace"} · proj {fmt(revProjected, "currency", currency)}
          </p>
        </div>
      )}
      {ga4Conn && goals.sessionsTarget > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#7575a0]">Sessions</span>
            <span className="font-mono text-[10px] font-bold text-[#1a1a2e] tabular-nums">{fmt(sessionsMonth)} <span className="text-[#eaeaf5] font-normal">/ {fmt(goals.sessionsTarget)}</span></span>
          </div>
          <GoalBar actual={sessionsMonth} target={goals.sessionsTarget} color="#f59e0b" />
          <p className={`font-mono text-[9px] font-semibold ${sessProjected >= goals.sessionsTarget * 0.9 ? "text-emerald-400" : "text-amber-400"}`}>
            {sessProjected >= goals.sessionsTarget * 0.9 ? "✓ On track" : "⚠ Below pace"} · proj {fmt(sessProjected)}
          </p>
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

function RevenueOverTimeChart({ snapshots, connectedRevenueProviders, currency = "USD", onNavigate }: {
  snapshots: Snapshot[]; connectedRevenueProviders: string[]; currency?: string; onNavigate: (tab: Tab) => void;
}) {
  const [range, setRange] = useState<RevRange>("30d");

  const chartData = useMemo(() => {
    const days = REV_RANGES.find((r) => r.id === range)!.days;
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const dayMap: Record<string, number> = {};
    for (const snap of snapshots) {
      if (!connectedRevenueProviders.includes(snap.provider)) continue;
      if (snap.date < cutoffStr) continue;
      dayMap[snap.date] = (dayMap[snap.date] ?? 0) + ((snap.data as Record<string, number>).revenue ?? 0);
    }
    const result: { date: string; label: string; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      result.push({ date: key, label, revenue: dayMap[key] ?? 0 });
    }
    return result;
  }, [snapshots, connectedRevenueProviders, range]);

  const total = chartData.reduce((a, d) => a + d.revenue, 0);
  const hasData = chartData.some((d) => d.revenue > 0);
  const tickInterval = range === "7d" ? 0 : range === "30d" ? 4 : 13;
  const fmtTick = (v: number) => {
    const d = v / 100;
    if (d >= 1000) return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 }).format(d);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(d);
  };

  return (
    <div className="space-y-3">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold text-[#5a5a7a] uppercase tracking-widest">Revenue over time</span>
          {hasData && (
            <span className="font-mono text-sm font-bold text-[#1a1a2e] tabular-nums">
              {(total / 100).toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-black/8 bg-black/4 p-0.5">
            {REV_RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${range === r.id ? "bg-black/15 text-[#1a1a2e]" : "text-[#4a4a6a] hover:text-[#5a5a7a]"}`}
              >{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-40 rounded-2xl border border-black/6 bg-[#ffffff]">
          <p className="font-mono text-[11px] text-[#ebebf8]">No revenue data in range</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200} style={{ outline: "none" }}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#635bff" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#635bff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#3a3a5a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={tickInterval} tickMargin={8} />
            <YAxis tickFormatter={fmtTick} tick={{ fill: "#3a3a5a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const val = (payload[0].value as number / 100).toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2 });
              return (
                <div className="rounded-xl border border-black/12 bg-[#f4f4f8] px-3 py-2 shadow-2xl">
                  <p className="font-mono text-[9px] text-[#4a4a6a] mb-1">{label}</p>
                  <p className="font-mono text-sm font-bold text-[#1a1a2e]">{val}</p>
                </div>
              );
            }} />
            <Area type="monotone" dataKey="revenue" stroke="#635bff" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 3, fill: "#635bff", strokeWidth: 0 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────

const SETUP_STEPS = LIVE_INTEGRATIONS.map((i) => ({
  id: i.id, title: i.name, description: i.description,
  connectUrl: i.connectUrl!, color: i.color,
  icon: <img src={i.icon} alt={i.name} width={16} height={16} className="object-contain" />,
}));

function OnboardingWizard({ onNavigate, connectedPlatforms }: { onNavigate: (tab: Tab) => void; connectedPlatforms: string[] }) {
  const done = connectedPlatforms.length;
  const total = SETUP_STEPS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="rounded-2xl border border-black/8 bg-[#ffffff] overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-black/8">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00d4aa]/10 text-[#00d4aa]">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-[#1a1a2e]">Connect your data sources</p>
            <p className="font-mono text-[10px] text-[#3a3a5a]">{done}/{total} connected · takes ~30 seconds each</p>
          </div>
        </div>
        {/* Progress ring */}
        <div className="relative h-10 w-10 shrink-0">
          <svg className="-rotate-90" viewBox="0 0 40 40" width={40} height={40}>
            <circle cx="20" cy="20" r="16" fill="none" stroke="#e4e4f4" strokeWidth="4" />
            <circle cx="20" cy="20" r="16" fill="none" stroke="#00d4aa" strokeWidth="4"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct / 100)}`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold text-[#00d4aa]">{done}/{total}</span>
        </div>
      </div>

      <div className="divide-y divide-black/8">
        {SETUP_STEPS.map((step) => {
          const isConnected = connectedPlatforms.includes(step.id);
          return (
            <div key={step.id} className={`flex items-center gap-4 px-5 py-3.5 ${isConnected ? "opacity-50" : ""}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${step.color}12` }}>
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[12px] font-semibold text-[#1a1a2e] leading-tight">{step.title}</p>
                <p className="font-mono text-[9px] text-[#3a3a5a] truncate">{step.description}</p>
              </div>
              {isConnected ? (
                <span className="shrink-0 font-mono text-[9px] font-semibold text-[#00d4aa]">✓ Connected</span>
              ) : (
                <a href={step.connectUrl}
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-mono text-[10px] font-semibold transition-all"
                  style={{ color: step.color, backgroundColor: `${step.color}12`, border: `1px solid ${step.color}25` }}
                >
                  Connect →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewTab({
  email, isPremium, connectedPlatforms, snapshots, currencies = {}, onNavigate,
}: {
  email: string; isPremium: boolean; connectedPlatforms: string[];
  snapshots: Snapshot[]; currencies: Record<string, string>; onNavigate: (tab: Tab) => void;
}) {
  const router = useRouter();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [alertRules, setAlertRules] = useState<AlertRules>(DEFAULT_ALERTS);

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => { if (d.alertRules) setAlertRules(d.alertRules); }).catch(() => {});
  }, []);

  async function handleUpgrade() {
    setUpgradeLoading(true); setUpgradeError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setUpgradeError(data.error ?? "Something went wrong."); setUpgradeLoading(false); return; }
      router.push(data.url);
    } catch { setUpgradeError("Network error. Please try again."); setUpgradeLoading(false); }
  }

  const isDemoMode = isPremium && connectedPlatforms.length === 0;
  const effectiveSnapshots = isDemoMode ? DEMO_SNAPSHOTS : snapshots;
  const effectivePlatforms = isDemoMode ? DEMO_CONNECTED_PLATFORMS : connectedPlatforms;

  const { kpis, narrative, crossInsights, metrics7, revenueMonth, sessionsMonth, primaryRevCurrency, glanceSignals } = useMemo(() => {
    const snaps7 = filterDays(effectiveSnapshots, 7);
    const snaps14 = filterDays(effectiveSnapshots, 14);
    const snapsPrev7 = snaps14.filter((s) => !snaps7.find((x) => x.id === s.id));

    const connRevenue   = connectedIn(effectivePlatforms, REVENUE_PROVIDERS);
    const connAnalytics = connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS);
    const connAds       = connectedIn(effectivePlatforms, ADS_PROVIDERS);
    const primaryAdCurrency: string = connAds.length > 0 ? (currencies[connAds[0]] ?? "USD") : "USD";
    const primaryRevCurrency: string = connRevenue.length > 0 ? (currencies[connRevenue[0]] ?? "USD") : "USD";
    const primaryAnalytics = pickPrimaryAnalyticsProvider(snaps7, connAnalytics) ?? pickPrimaryAnalyticsProvider(effectiveSnapshots, connAnalytics);

    const revenue7     = sumProviders(snaps7, connRevenue, "revenue");
    const revenuePrev  = sumProviders(snapsPrev7, connRevenue, "revenue");
    const newCustomers7    = sumProviders(snaps7, connRevenue, "newCustomers");
    const newCustomersPrev = sumProviders(snapsPrev7, connRevenue, "newCustomers");
    const sessions7    = primaryAnalytics ? sumField(snaps7, primaryAnalytics, "sessions") : 0;
    const sessionsPrev = primaryAnalytics ? sumField(snapsPrev7, primaryAnalytics, "sessions") : 0;
    const conversions7 = primaryAnalytics ? sumField(snaps7, primaryAnalytics, "conversions") : 0;
    const bounceRate7  = primaryAnalytics ? avgField(snaps7, primaryAnalytics, "bounceRate") : 0;
    const spend7    = sumProviders(snaps7, connAds, "spend");
    const spendPrev = sumProviders(snapsPrev7, connAds, "spend");
    const metaClicks7 = sumField(snaps7, "meta", "clicks");

    const hasRevenue   = connRevenue.length > 0;
    const hasAnalytics = connAnalytics.length > 0;
    const hasAds       = connAds.length > 0;
    const cac7 = newCustomers7 > 0 && spend7 > 0 ? spend7 / newCustomers7 : null;

    // Yesterday narrative
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const snapsYday = effectiveSnapshots.filter((s) => s.date === yesterdayStr);
    const revenueYday  = sumProviders(snapsYday, connRevenue, "revenue");
    const sessionsYday = primaryAnalytics ? sumField(snapsYday, primaryAnalytics, "sessions") : 0;
    const txYday       = sumField(snapsYday, "stripe", "transactions");
    const newCxYday    = sumProviders(snapsYday, connRevenue, "newCustomers");
    const spendYday    = sumProviders(snapsYday, connAds, "spend");
    const bounceYday   = primaryAnalytics ? avgField(snapsYday, primaryAnalytics, "bounceRate") : 0;
    const parts: string[] = [];
    if (hasRevenue && revenueYday > 0) parts.push(`${fmt(revenueYday, "currency", primaryRevCurrency)} revenue${txYday > 0 ? ` (${txYday} txns)` : ""}`);
    if (hasAnalytics && sessionsYday > 0) parts.push(`${fmt(sessionsYday)} sessions`);
    if (hasRevenue && newCxYday > 0) parts.push(`${newCxYday} new customer${newCxYday !== 1 ? "s" : ""}`);
    if (hasAds && spendYday > 0) parts.push(`${fmtMetaSpend(spendYday, primaryAdCurrency)} ad spend`);
    const narrative = { hasData: snapsYday.length > 0 && parts.length > 0, text: parts.join(" · "), bounceAlert: hasAnalytics && bounceYday > 65, bounceRate: bounceYday, date: yesterdayStr };

    const crossInsights: { icon: string; color: string; message: string; action: string }[] = [];
    if (hasAnalytics && bounceRate7 > 65) crossInsights.push({ icon: "↑", color: "#f87171", message: `Bounce rate is elevated at ${fmt(bounceRate7, "percent")}. Review landing page copy and load speed.`, action: "View analytics →" });

    // 7-day sparklines
    function spark(providers: string[], field: string): number[] {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setUTCDate(d.getUTCDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        return effectiveSnapshots.filter((s) => providers.includes(s.provider) && s.date === key)
          .reduce((a, s) => a + ((s.data as Record<string, number>)[field] ?? 0), 0);
      });
    }

    const glanceSignals: { label: string; color: string }[] = [];
    if (hasRevenue && revenue7 > 0) {
      const p = revenuePrev > 0 ? ((revenue7 - revenuePrev) / revenuePrev) * 100 : null;
      if (p === null) glanceSignals.push({ color: "#00d4aa", label: "↑ Revenue active" });
      else if (p >= 0) glanceSignals.push({ color: "#00d4aa", label: `↑ Rev +${p.toFixed(0)}%` });
      else if (p >= -10) glanceSignals.push({ color: "#f59e0b", label: `↘ Rev ${p.toFixed(0)}%` });
      else glanceSignals.push({ color: "#f87171", label: `↓ Rev ${p.toFixed(0)}%` });
    }
    if (hasAnalytics && sessions7 > 0 && sessionsPrev > 0) {
      const p = ((sessions7 - sessionsPrev) / sessionsPrev) * 100;
      if (p >= 10) glanceSignals.push({ color: "#00d4aa", label: `↑ Sessions +${p.toFixed(0)}%` });
      else if (p <= -10) glanceSignals.push({ color: "#f59e0b", label: `⚠ Sessions ${p.toFixed(0)}%` });
    }

    const today = new Date();
    const snapsThisMonth = filterDays(effectiveSnapshots, today.getDate());

    return {
      kpis: {
        revenue: { value: hasRevenue ? fmt(revenue7, "currency", primaryRevCurrency) : null, trend: hasRevenue ? { current: revenue7, prev: revenuePrev } : null, spark: hasRevenue ? spark(connRevenue, "revenue") : [], connect: "Connect Stripe", connectHref: "/dashboard?tab=data-sources" },
        sessions: { value: hasAnalytics ? fmt(sessions7) : null, trend: hasAnalytics ? { current: sessions7, prev: sessionsPrev } : null, spark: hasAnalytics && primaryAnalytics ? spark([primaryAnalytics], "sessions") : [], connect: "Connect GA4", connectHref: "/dashboard?tab=data-sources" },
        adSpend: { value: hasAds ? fmtMetaSpend(spend7, primaryAdCurrency) : null, trend: hasAds ? { current: spend7, prev: spendPrev } : null, spark: hasAds ? spark(connAds, "spend") : [], connect: "Connect Meta Ads", connectHref: "/dashboard?tab=data-sources" },
        customers: { value: hasRevenue ? fmt(newCustomers7) : null, trend: hasRevenue ? { current: newCustomers7, prev: newCustomersPrev } : null, spark: hasRevenue ? spark(connRevenue, "newCustomers") : [], connect: "Connect Stripe", connectHref: "/dashboard?tab=data-sources" },
        cac: { value: (hasAds && hasRevenue && cac7 !== null) ? fmtMetaSpend(cac7, primaryAdCurrency) : null, connect: "Needs Ads + Stripe", connectHref: "/dashboard?tab=data-sources" },
        bounce: { value: hasAnalytics ? fmt(bounceRate7, "percent") : null, connect: "Connect GA4", connectHref: "/dashboard?tab=data-sources" },
        conversions: conversions7,
      },
      narrative,
      crossInsights,
      metrics7: { revenue7, sessions7, bounceRate7, spend7, revenuePrev },
      revenueMonth: sumProviders(snapsThisMonth, connRevenue, "revenue"),
      sessionsMonth: primaryAnalytics ? sumField(snapsThisMonth, primaryAnalytics, "sessions") : 0,
      primaryRevCurrency,
      glanceSignals,
      hasRevenue, hasAnalytics, hasAds,
      connRevenue, connAnalytics, connAds,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSnapshots, effectivePlatforms, currencies]);

  const { hasRevenue, hasAnalytics, hasAds, connRevenue, connAnalytics, connAds } = kpis as unknown as {
    hasRevenue: boolean; hasAnalytics: boolean; hasAds: boolean;
    connRevenue: string[]; connAnalytics: string[]; connAds: string[];
  };

  const hasAllIntegrations = LIVE_INTEGRATIONS.every((i) => connectedPlatforms.includes(i.id));
  const missingIntegrations = LIVE_INTEGRATIONS.filter((i) => !connectedPlatforms.includes(i.id));

  const activeAlerts: { color: string; message: string }[] = [];
  if (alertRules.revenueDropPct > 0 && metrics7.revenuePrev > 0) {
    const dropPct = ((metrics7.revenuePrev - metrics7.revenue7) / metrics7.revenuePrev) * 100;
    if (dropPct >= alertRules.revenueDropPct) activeAlerts.push({ color: "#f87171", message: `🚨 Revenue is down ${dropPct.toFixed(1)}% vs last week (threshold: ${alertRules.revenueDropPct}%)` });
  }
  if (alertRules.bounceSpikeThreshold > 0 && metrics7.bounceRate7 > alertRules.bounceSpikeThreshold)
    activeAlerts.push({ color: "#f59e0b", message: `⚠ Bounce rate ${fmt(metrics7.bounceRate7, "percent")} exceeds your ${alertRules.bounceSpikeThreshold}% threshold` });
  if (alertRules.spendSpikeThreshold > 0 && metrics7.spend7 > 0) {
    const avg = metrics7.spend7 / 7;
    if (avg > alertRules.spendSpikeThreshold) activeAlerts.push({ color: "#1877f2", message: `💸 Avg daily ad spend (${fmt(avg, "currency")}) exceeds your $${alertRules.spendSpikeThreshold} cap` });
  }

  const anomalies = useMemo(() => {
    const results: { color: string; message: string }[] = [];
    if (!isPremium || effectiveSnapshots.length < 14) return results;
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
    function stats(values: number[]) {
      if (!values.length) return { mean: 0, std: 0 };
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return { mean, std: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) };
    }
    function dailyValues(provider: string, field: string) {
      return effectiveSnapshots.filter((s) => s.provider === provider && s.date < yesterdayStr)
        .sort((a, b) => a.date.localeCompare(b.date)).slice(-28)
        .map((s) => (s.data as Record<string, number>)[field] ?? 0).filter((v) => v > 0);
    }
    function yday(provider: string, field: string) {
      const snap = effectiveSnapshots.find((s) => s.provider === provider && s.date === yesterdayStr);
      return snap ? ((snap.data as Record<string, number>)[field] ?? 0) : 0;
    }
    const cRA = connectedIn(effectivePlatforms, REVENUE_PROVIDERS);
    const cAA = connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS);
    const cAdA = connectedIn(effectivePlatforms, ADS_PROVIDERS);
    const pA = pickPrimaryAnalyticsProvider(effectiveSnapshots, cAA);
    if (cRA.length > 0) {
      const dayMap: Record<string, number> = {};
      for (const s of effectiveSnapshots) { if (!cRA.includes(s.provider) || s.date >= yesterdayStr) continue; const v = (s.data as Record<string, number>).revenue ?? 0; dayMap[s.date] = (dayMap[s.date] ?? 0) + v; }
      const vals = Object.values(dayMap).filter((v) => v > 0).slice(-30);
      const revY = cRA.reduce((sum, p) => { const s = effectiveSnapshots.find((x) => x.provider === p && x.date === yesterdayStr); return sum + ((s?.data as Record<string, number>)?.revenue ?? 0); }, 0);
      const { mean, std } = stats(vals);
      if (mean > 0 && std > 0 && revY > 0) {
        const z = (revY - mean) / std;
        if (z < -2) results.push({ color: "#f87171", message: `📉 Revenue yesterday was ${fmt(revY, "currency")} — ${Math.round(((mean - revY) / mean) * 100)}% below 30-day avg (unusual for a ${dayOfWeek})` });
        else if (z > 2.5) results.push({ color: "#00d4aa", message: `🚀 Revenue yesterday was ${fmt(revY, "currency")} — ${Math.round(((revY - mean) / mean) * 100)}% above 30-day avg! Best ${dayOfWeek} in a month.` });
      }
    }
    if (pA) {
      const { mean, std } = stats(dailyValues(pA, "sessions")); const sY = yday(pA, "sessions");
      if (mean > 0 && std > 0 && sY > 0 && (sY - mean) / std < -2) results.push({ color: "#f59e0b", message: `👻 Traffic dropped ${Math.round(((mean - sY) / mean) * 100)}% yesterday. Check indexing or ads.` });
      const { mean: bm, std: bs } = stats(dailyValues(pA, "bounceRate")); const bY = yday(pA, "bounceRate");
      if (bm > 0 && bs > 0 && bY > 0 && (bY - bm) / bs > 2) results.push({ color: "#f59e0b", message: `⚠ Bounce rate spiked to ${fmt(bY, "percent")} yesterday — ${Math.round(bY - bm)}pp above 30-day avg.` });
    }
    if (cAdA.length > 0) {
      const dayMap: Record<string, number> = {};
      for (const s of effectiveSnapshots) { if (!cAdA.includes(s.provider) || s.date >= yesterdayStr) continue; const v = (s.data as Record<string, number>).spend ?? 0; dayMap[s.date] = (dayMap[s.date] ?? 0) + v; }
      const vals = Object.values(dayMap).filter((v) => v > 0).slice(-30);
      const spY = cAdA.reduce((sum, p) => { const s = effectiveSnapshots.find((x) => x.provider === p && x.date === yesterdayStr); return sum + ((s?.data as Record<string, number>)?.spend ?? 0); }, 0);
      const { mean, std } = stats(vals);
      if (mean > 0 && std > 0 && spY > 0 && (spY - mean) / std > 2) {
        const note = cAdA.length > 1 ? `across ${cAdA.join(" + ")}` : `on ${cAdA[0]}`;
        results.push({ color: "#1877f2", message: `💸 Ad spend was ${Math.round(((spY - mean) / mean) * 100)}% above avg yesterday (${note}).` });
      }
    }
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSnapshots, effectivePlatforms, isPremium]);

  const pushedAlertsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of [...activeAlerts, ...anomalies]) {
      if (!pushedAlertsRef.current.has(a.message)) { pushedAlertsRef.current.add(a.message); pushNotification(a.message, a.color); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlerts.map((a) => a.message).join("|"), anomalies.map((a) => a.message).join("|")]);

  const firstName = email.split("@")[0].split(/[._-]/)[0];
  const capitalFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const allAlerts = [...activeAlerts.map((a) => ({ ...a, auto: false })), ...anomalies.map((a) => ({ ...a, auto: true }))];

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-0">

      {/* ═══════════════════════════════════════════════════════
          PULSE BAR — slim inline status line, no card
      ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#3a3a5a]">{formatDate()}</span>
          <span className="text-[#2a2a3e]">·</span>
          <span className="font-mono text-[11px] font-semibold text-[#7070a0]">{greetingTime()}, {capitalFirst}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {glanceSignals.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold border"
              style={{ color: s.color, borderColor: s.color + "30", backgroundColor: s.color + "0c" }}>
              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
          {!isPremium && (
            <button onClick={handleUpgrade} disabled={upgradeLoading}
              className="inline-flex items-center gap-1 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-2.5 py-0.5 font-mono text-[9px] font-bold text-[#00d4aa] hover:bg-[#00d4aa]/15 transition disabled:opacity-50">
              {upgradeLoading ? "…" : "↑ Upgrade"}
            </button>
          )}
        </div>
      </div>

      {upgradeError && <p className="font-mono text-xs text-red-400 pb-4">{upgradeError}</p>}

      {/* ═══════════════════════════════════════════════════════
          ONBOARDING — show only when no platforms connected
      ═══════════════════════════════════════════════════════ */}
      {!isDemoMode && connectedPlatforms.length === 0 && (
        <div className="mb-6">
          <OnboardingWizard onNavigate={onNavigate} connectedPlatforms={connectedPlatforms} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEMO / FREE PLAN BANNERS
      ═══════════════════════════════════════════════════════ */}
      {isDemoMode && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#a78bfa]/15 bg-[#a78bfa]/4 px-4 py-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#a78bfa]">Demo</span>
          <span className="text-[#d0d0e8]">·</span>
          <p className="flex-1 font-mono text-[11px] text-[#6070a0]">Viewing sample data. Connect real integrations to see live metrics.</p>
          <button onClick={() => onNavigate("data-sources")} className="font-mono text-[10px] font-bold text-[#a78bfa] hover:underline shrink-0">Connect →</button>
        </div>
      )}
      {!isPremium && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#635bff]/15 bg-[#635bff]/4 px-4 py-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#635bff]">Syncing</span>
          <span className="text-[#d0d0e8]">·</span>
          <p className="flex-1 font-mono text-[11px] text-[#6070a0]">First sync takes up to 24 hours. No action needed.</p>
          <button onClick={handleUpgrade} disabled={upgradeLoading} className="font-mono text-[10px] font-bold text-[#635bff] hover:underline shrink-0 disabled:opacity-50">{upgradeLoading ? "…" : "Upgrade →"}</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          ALERTS RAIL — compact top-of-page alert strip
      ═══════════════════════════════════════════════════════ */}
      {isPremium && allAlerts.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {allAlerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
              style={{ borderColor: a.color + "20", backgroundColor: a.color + "06" }}>
              <span className="font-mono text-[10px]" style={{ color: a.color }}>●</span>
              <p className="flex-1 font-mono text-[11px] leading-relaxed" style={{ color: a.color }}>{a.message}</p>
              {a.auto && <span className="font-mono text-[8px] text-[#eaeaf5] shrink-0">AI</span>}
              <button onClick={() => onNavigate("data-sources")} className="font-mono text-[9px] font-bold hover:underline shrink-0" style={{ color: a.color }}>Fix →</button>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MAIN METRICS LAYOUT
          Left (55%): Featured revenue panel
          Right (45%): 2×2 compact stat grid
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 mb-3">

        {/* ── Featured Revenue Panel ── */}
        <div className="lg:col-span-5 relative overflow-hidden rounded-2xl bg-[#ffffff] border border-black/8 p-6 flex flex-col justify-between min-h-50">
          {/* Background sparkline overlay */}
          {kpis.revenue.spark.length > 1 && (
            <div className="absolute inset-0 opacity-100 pointer-events-none">
              <BgSparkline data={kpis.revenue.spark} color="#635bff" />
            </div>
          )}
          {/* Purple glow top-right */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[#635bff]/12 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#635bff]/15">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">Revenue · 7 days</span>
            </div>

            {kpis.revenue.value ? (
              <>
                <p className="font-mono text-[44px] sm:text-[52px] font-bold text-[#1a1a2e] leading-none tabular-nums mb-3">
                  {kpis.revenue.value}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {kpis.revenue.trend && <TrendBadge current={kpis.revenue.trend.current} prev={kpis.revenue.trend.prev} />}
                  <span className="font-mono text-[10px] text-[#3a3a5a]">vs prev 7 days</span>
                </div>
              </>
            ) : (
              <div>
                <p className="font-mono text-[52px] font-bold text-[#1a1a2e] leading-none mb-3">—</p>
                <a href="/dashboard?tab=data-sources" className="inline-flex items-center gap-2 rounded-xl border border-[#635bff]/20 bg-[#635bff]/8 px-4 py-2 font-mono text-[11px] font-semibold text-[#635bff] hover:bg-[#635bff]/14 transition">
                  Connect Stripe →
                </a>
              </div>
            )}
          </div>

          {/* Month-to-date footnote */}
          {revenueMonth > 0 && (
            <div className="relative mt-4 pt-4 border-t border-black/6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#3a3a5a] uppercase tracking-widest">Month to date</span>
                <span className="font-mono text-[12px] font-bold text-[#7070a0] tabular-nums">
                  {fmt(revenueMonth, "currency", primaryRevCurrency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: 2×2 compact stat panels ── */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-3">

          {/* Sessions */}
          <div className="rounded-2xl bg-[#ffffff] border border-black/8 p-4 flex flex-col justify-between overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">Sessions</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#f59e0b]/10">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
            </div>
            {kpis.sessions.value ? (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] tabular-nums leading-none mb-2 break-all">{kpis.sessions.value}</p>
                <div className="flex items-center justify-between">
                  {kpis.sessions.trend && <TrendBadge current={kpis.sessions.trend.current} prev={kpis.sessions.trend.prev} size="sm" />}
                  {kpis.sessions.spark.length > 1 && <Sparkline data={kpis.sessions.spark} color="#f59e0b" width={64} height={22} />}
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] leading-none mb-2">—</p>
                <a href="/dashboard?tab=data-sources" className="font-mono text-[9px] text-[#4a4a6a] hover:text-[#f59e0b] transition">+ Connect GA4</a>
              </>
            )}
          </div>

          {/* Ad Spend */}
          <div className="rounded-2xl bg-[#ffffff] border border-black/8 p-4 flex flex-col justify-between overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">Ad Spend</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#1877f2]/10">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#1877f2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>
            {kpis.adSpend.value ? (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] tabular-nums leading-none mb-2 break-all">{kpis.adSpend.value}</p>
                <div className="flex items-center justify-between">
                  {kpis.adSpend.trend && <TrendBadge current={kpis.adSpend.trend.current} prev={kpis.adSpend.trend.prev} size="sm" />}
                  {kpis.adSpend.spark.length > 1 && <Sparkline data={kpis.adSpend.spark} color="#1877f2" width={64} height={22} />}
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] leading-none mb-2">—</p>
                <a href="/dashboard?tab=data-sources" className="font-mono text-[9px] text-[#4a4a6a] hover:text-[#1877f2] transition">+ Connect Meta Ads</a>
              </>
            )}
          </div>

          {/* New Customers */}
          <div className="rounded-2xl bg-[#ffffff] border border-black/8 p-4 flex flex-col justify-between overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">New Customers</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#00d4aa]/10">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
            </div>
            {kpis.customers.value ? (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] tabular-nums leading-none mb-2 break-all">{kpis.customers.value}</p>
                <div className="flex items-center justify-between">
                  {kpis.customers.trend && <TrendBadge current={kpis.customers.trend.current} prev={kpis.customers.trend.prev} size="sm" />}
                  {kpis.customers.spark.length > 1 && <Sparkline data={kpis.customers.spark} color="#00d4aa" width={64} height={22} />}
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-3xl font-bold text-[#1a1a2e] leading-none mb-2">—</p>
                <a href="/dashboard?tab=data-sources" className="font-mono text-[9px] text-[#4a4a6a] hover:text-[#00d4aa] transition">+ Connect Stripe</a>
              </>
            )}
          </div>

          {/* CAC + Bounce stacked */}
          <div className="rounded-2xl bg-[#ffffff] border border-black/8 p-4 flex flex-col gap-0 justify-between overflow-hidden min-w-0">
            {/* CAC */}
            <div className="pb-3 border-b border-black/8">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">CAC</span>
              </div>
              {kpis.cac.value ? (
                <p className="font-mono text-xl font-bold text-[#1a1a2e] tabular-nums break-all">{kpis.cac.value}</p>
              ) : (
                <p className="font-mono text-xl font-bold text-[#1a1a2e]">—</p>
              )}
            </div>
            {/* Bounce Rate */}
            <div className="pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">Bounce</span>
              </div>
              {kpis.bounce.value ? (
                <p className={`font-mono text-xl font-bold tabular-nums break-all ${parseFloat(kpis.bounce.value) > 65 ? "text-amber-400" : "text-[#1a1a2e]"}`}>
                  {kpis.bounce.value}
                </p>
              ) : (
                <p className="font-mono text-xl font-bold text-[#1a1a2e]">—</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          YESTERDAY NARRATIVE — slim inline callout
      ═══════════════════════════════════════════════════════ */}
      {isPremium && narrative.hasData && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-black/6 bg-white px-4 py-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#00d4aa] shrink-0 mt-0.5">Yesterday</span>
          <p className="flex-1 font-mono text-[11px] text-[#7070a0] leading-relaxed">{narrative.text}</p>
          {narrative.bounceAlert && (
            <span className="shrink-0 font-mono text-[9px] font-semibold text-amber-400">⚠ High bounce</span>
          )}
        </div>
      )}

      {/* Cross-insight */}
      {isPremium && crossInsights.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#f87171]/12 bg-[#f87171]/4 px-4 py-2.5">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#f87171]">Insight</span>
          <p className="flex-1 font-mono text-[11px] text-[#f87171]/80 leading-relaxed">{crossInsights[0].message}</p>
          <button onClick={() => onNavigate("analytics")} className="font-mono text-[9px] font-bold text-[#f87171] hover:underline shrink-0">View →</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          REVENUE CHART — full bleed, no outer card
      ═══════════════════════════════════════════════════════ */}
      {connectedIn(effectivePlatforms, REVENUE_PROVIDERS).length > 0 && (
        <div className="mb-3 rounded-2xl border border-black/8 bg-[#ffffff] p-5">
          <RevenueOverTimeChart
            snapshots={effectiveSnapshots}
            connectedRevenueProviders={connectedIn(effectivePlatforms, REVENUE_PROVIDERS)}
            currency={primaryRevCurrency}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          BOTTOM TRIPTYCH — 3 equal columns
          [Goals & Forecast] [Health Signals] [Quick Access]
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">

        {/* Goals & Forecast */}
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#4a4a6a]">Goals</span>
            <button onClick={() => onNavigate("analytics")} className="font-mono text-[9px] text-[#eaeaf5] hover:text-[#00d4aa] transition">Details →</button>
          </div>
          <GoalsWidget
            revenueMonth={revenueMonth} sessionsMonth={sessionsMonth}
            stripeConn={connectedIn(effectivePlatforms, REVENUE_PROVIDERS).length > 0}
            ga4Conn={connectedIn(effectivePlatforms, ANALYTICS_PROVIDERS).length > 0}
            currency={primaryRevCurrency}
          />
        </div>

        {/* Health Signals */}
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] p-4 space-y-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#4a4a6a] block mb-3">Health · 7d</span>
          <CompactStat label="Sessions" value={kpis.sessions.value} trend={kpis.sessions.trend} spark={kpis.sessions.spark} accent="#f59e0b" connect="Connect GA4" connectHref="/dashboard?tab=data-sources" />
          <CompactStat label="Bounce Rate" value={kpis.bounce.value} accent={kpis.bounce.value && parseFloat(kpis.bounce.value) > 65 ? "#f59e0b" : "#00d4aa"} connect="Connect GA4" connectHref="/dashboard?tab=data-sources" border />
          <CompactStat label="Ad Spend" value={kpis.adSpend.value} trend={kpis.adSpend.trend} spark={kpis.adSpend.spark} accent="#1877f2" connect="Connect Meta Ads" connectHref="/dashboard?tab=data-sources" border />
          <CompactStat label="CAC" value={kpis.cac.value} accent="#f87171" connect="Needs Ads + Revenue" connectHref="/dashboard?tab=data-sources" border={false} />
        </div>

        {/* Quick Access */}
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] p-4 flex flex-col gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#4a4a6a] block mb-1">Quick Access</span>
          {[
            { label: "Analytics", desc: "Sessions, conversions, funnel", icon: "M3 17l5-5 4 4 9-9", tab: "analytics" as Tab, color: "#f59e0b" },
            { label: "Integrations", desc: `${connectedPlatforms.length}/${LIVE_INTEGRATIONS.length} connected`, icon: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71", tab: "settings" as Tab, color: "#635bff" },
            { label: "Alerts", desc: allAlerts.length > 0 ? `${allAlerts.length} active alert${allAlerts.length !== 1 ? "s" : ""}` : "No active alerts", icon: "M13 10V3L4 14h7v7l9-11h-7z", tab: "settings" as Tab, color: allAlerts.length > 0 ? "#f87171" : "#3a3a5a" },
          ].map((item) => (
            <button key={item.label} onClick={() => onNavigate(item.tab)}
              className="group flex items-center gap-3 rounded-xl border border-black/6 bg-black/3 px-3 py-2.5 text-left hover:border-black/12 hover:bg-black/6 transition-all">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: item.color + "12" }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={item.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[11px] font-semibold text-[#5a5a7a] group-hover:text-[#1a1a2e] transition leading-tight">{item.label}</p>
                <p className="font-mono text-[9px] text-[#4a4a4a] truncate">{item.desc}</p>
              </div>
              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#eaeaf5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover:stroke-[#5050a0] transition">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ))}

          {!isPremium && (
            <button onClick={handleUpgrade} disabled={upgradeLoading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-[#635bff]/20 bg-[#635bff]/7 px-3 py-2.5 font-mono text-[11px] font-semibold text-[#635bff] hover:bg-[#635bff]/12 transition disabled:opacity-50">
              {upgradeLoading ? "…" : "↑ Upgrade to Premium"}
            </button>
          )}
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════
          INTEGRATION RAIL — thin row at bottom
      ═══════════════════════════════════════════════════════ */}
      {!hasAllIntegrations && (
        <div className="rounded-2xl border border-black/6 bg-white px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#464646] shrink-0">
              {connectedPlatforms.length}/{LIVE_INTEGRATIONS.length} Connected
            </span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {LIVE_INTEGRATIONS.map((intg) => {
                const connected = connectedPlatforms.includes(intg.id);
                return connected ? (
                  <span key={intg.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/15 bg-[#00d4aa]/5 px-2.5 py-1 font-mono text-[9px] font-semibold text-[#00d4aa]">
                    <img src={intg.icon} alt={intg.name} width={10} height={10} className="object-contain" />
                    {intg.name}
                  </span>
                ) : (
                  <a key={intg.id} href={intg.connectUrl}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-black/3 px-2.5 py-1 font-mono text-[9px] font-semibold text-[#3a3a5a] hover:border-black/15 hover:text-[#5a5a7a] transition-all">
                    <img src={intg.icon} alt={intg.name} width={10} height={10} className="object-contain opacity-40" />
                    {intg.name} +
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
