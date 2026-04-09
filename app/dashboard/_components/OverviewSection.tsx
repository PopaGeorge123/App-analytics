"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ReferenceLine,
  Brush,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { FunnelSection } from "./AnalyticsTab";

// ── Types ─────────────────────────────────────────────────────────────────

type Granularity = "day" | "week" | "month";

interface Props {
  snapshots: Snapshot[];
  connectedPlatforms: string[];
  timeRange?: TimeRange;
  granularity?: Granularity;
  currencies?: Record<string, string>;
}

type TimeRange = "1d" | "7d" | "30d" | "90d" | "all";
type ReportType =
  | "business_growth"
  | "revenue_vs_traffic"
  | "ad_efficiency"
  | "customer_journey"
  | "profit_overview"
  | "engagement_quality"
  | "revenue_per_visitor"
  | "ad_spend_vs_clicks"
  | "daily_transactions"
  | "impressions_vs_sessions"
  | "cac_trend"
  | "weekly_momentum";

// ── Constants ─────────────────────────────────────────────────────────────

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

const REPORT_TYPES: { key: ReportType; label: string; description: string; icon: string }[] = [
  {
    key: "business_growth",
    label: "Business Growth",
    description: "Revenue + Users + Conversions over time",
    icon: "📈",
  },
  {
    key: "revenue_vs_traffic",
    label: "Revenue vs Traffic",
    description: "Stripe revenue correlated with GA4 sessions",
    icon: "💰",
  },
  {
    key: "ad_efficiency",
    label: "Ad Efficiency",
    description: "Meta ad spend vs revenue generated (ROAS)",
    icon: "🎯",
  },
  {
    key: "customer_journey",
    label: "Customer Journey",
    description: "Traffic → Conversions → Transactions funnel",
    icon: "🔄",
  },
  {
    key: "profit_overview",
    label: "Profit Overview",
    description: "Revenue minus ad spend — net estimated profit",
    icon: "💎",
  },
  {
    key: "engagement_quality",
    label: "Engagement Quality",
    description: "Bounce rate vs conversion rate vs CTR",
    icon: "✨",
  },
  {
    key: "revenue_per_visitor",
    label: "Revenue / Visitor",
    description: "How much revenue each website visitor generates on average",
    icon: "🧮",
  },
  {
    key: "ad_spend_vs_clicks",
    label: "Spend vs Clicks",
    description: "Meta ad spend alongside click volume and CPC trend",
    icon: "🖱️",
  },
  {
    key: "daily_transactions",
    label: "Daily Transactions",
    description: "Transaction count and average order value per day",
    icon: "🧾",
  },
  {
    key: "impressions_vs_sessions",
    label: "Reach vs Sessions",
    description: "Meta impressions vs GA4 sessions — paid reach that converts to organic traffic",
    icon: "📡",
  },
  {
    key: "cac_trend",
    label: "CAC Trend",
    description: "Cost to acquire a customer over time — key for paid growth sustainability",
    icon: "👤",
  },
  {
    key: "weekly_momentum",
    label: "Weekly Momentum",
    description: "7-day rolling revenue + sessions — spot growth or decline patterns",
    icon: "🌊",
  },
];

const COLORS = {
  revenue: "#635bff",
  sessions: "#f59e0b",
  users: "#00d4aa",
  conversions: "#34d399",
  spend: "#f87171",
  clicks: "#60a5fa",
  impressions: "#a78bfa",
  profit: "#10b981",
  roas: "#fbbf24",
  ctr: "#38bdf8",
  bounceRate: "#fb923c",
  convRate: "#4ade80",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getField(snap: Snapshot, field: string): number {
  const d = snap.data as Record<string, number>;
  return d[field] ?? 0;
}

function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function filterByRange(snapshots: Snapshot[], range: TimeRange): Snapshot[] {
  if (range === "all") return snapshots;
  const days = range === "1d" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.date >= cutoffStr);
}

/** Returns a sort-stable period key for a YYYY-MM-DD date */
function getPeriodKey(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  const d = new Date(date + "T00:00:00Z");
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  // week: ISO Monday
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/** Formats a period key for display on the chart X axis */
function fmtPeriodKey(key: string, granularity: Granularity): string {
  if (granularity === "day") {
    return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return new Date(`${y}-${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  // week
  return "W " + new Date(key + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function pctChange(curr: number, prev: number): { pct: number; up: boolean } | null {
  if (!prev) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { pct: Math.abs(pct), up: curr >= prev };
}

// ── Custom Tooltip ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-[#363650] bg-[#1c1c2a]/95 px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">{label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="font-mono text-[11px] text-[#bcbcd8]">{entry.name}:</span>
            <span className="font-mono text-[11px] font-semibold text-[#f8f8fc]">{entry.value}</span>
          </div>
        )
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  change,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: { pct: number; up: boolean } | null;
  color: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-[#363650] bg-[#222235] p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        {change && (
          <span
            className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              change.up
                ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                : "bg-red-400/10 text-red-400"
            }`}
          >
            {change.up ? "▲" : "▼"} {change.pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="font-mono text-2xl font-bold" style={{ color }}>
          {value}
        </p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">
          {label}
        </p>
        {sub && <p className="mt-1 font-mono text-[10px] text-[#6666888]">{sub}</p>}
      </div>
    </div>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────

function InsightCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border bg-[#222235] p-4 flex gap-3"
      style={{ borderColor: `${accent}30` }}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[#bcbcd8]">{body}</p>
      </div>
    </div>
  );
}

// ── Build chart data ──────────────────────────────────────────────────────

function buildChartData(
  snapshots: Snapshot[],
  report: ReportType,
  granularity: Granularity = "day",
  adCurrency = "USD",
  allSnapshots?: Snapshot[],
  revCurrency = "USD",
  sameCurrencyAll = true,
): { data: Record<string, string | number>[]; lines: { key: string; color: string; label: string; yAxisId: string; type: "line" | "bar" | "area" }[]; currencyMismatch: boolean; primaryKey: string } {
  // Cross-currency metrics (profit, ROAS, CAC) are only valid when all platforms share one currency.
  const sameCurrency = sameCurrencyAll;

  // ── Step 1: build a period→row aggregation helper ────────────────────────
  type RawBucket = { revenue: number; sessions: number; users: number; conversions: number; spend: number; clicks: number; impressions: number; bounceRateSum: number; bounceRateCount: number; txCount: number };

  function aggregateToBuckets(snaps: Snapshot[]): Record<string, RawBucket> {
    const byPeriod: Record<string, RawBucket> = {};
    for (const snap of snaps) {
      const pk = getPeriodKey(snap.date, granularity);
      if (!byPeriod[pk]) {
        byPeriod[pk] = { revenue: 0, sessions: 0, users: 0, conversions: 0, spend: 0, clicks: 0, impressions: 0, bounceRateSum: 0, bounceRateCount: 0, txCount: 0 };
      }
      const d = byPeriod[pk];
      if (snap.provider === "stripe") {
        d.revenue += getField(snap, "revenue");
        d.txCount += getField(snap, "txCount");
      }
      if (snap.provider === "ga4") {
        d.sessions += getField(snap, "sessions");
        d.users += getField(snap, "users");
        d.conversions += getField(snap, "conversions");
        d.bounceRateSum += getField(snap, "bounceRate");
        d.bounceRateCount += 1;
      }
      if (snap.provider === "meta") {
        d.spend += getField(snap, "spend");
        d.clicks += getField(snap, "clicks");
        d.impressions += getField(snap, "impressions");
      }
    }
    return byPeriod;
  }

  function bucketsToRows(byPeriod: Record<string, RawBucket>) {
    return Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pk, vals]) => {
        const revenueUSD = vals.revenue / 100;
        const spendUSD = vals.spend;
        const bounceRate = vals.bounceRateCount > 0 ? vals.bounceRateSum / vals.bounceRateCount : 0;
        const profit           = sameCurrency ? revenueUSD - spendUSD : 0;
        const roas             = sameCurrency && spendUSD > 0 ? revenueUSD / spendUSD : 0;
        const convRate = vals.sessions > 0 ? (vals.conversions / vals.sessions) * 100 : 0;
        const ctr = vals.impressions > 0 ? (vals.clicks / vals.impressions) * 100 : 0;
        const revenuePerVisitor = vals.sessions > 0 ? revenueUSD / vals.sessions : 0;
        const cpc              = sameCurrency && vals.clicks > 0 ? spendUSD / vals.clicks : 0;
        const aov = vals.txCount > 0 ? revenueUSD / vals.txCount : 0;
        const cac              = sameCurrency && vals.conversions > 0 ? spendUSD / vals.conversions : 0;
        return {
          _pk: pk,
          date: fmtPeriodKey(pk, granularity),
          revenue: parseFloat(revenueUSD.toFixed(2)),
          sessions: vals.sessions,
          users: vals.users,
          conversions: vals.conversions,
          spend: parseFloat(spendUSD.toFixed(2)),
          clicks: vals.clicks,
          impressions: vals.impressions,
          profit: parseFloat(profit.toFixed(2)),
          roas: parseFloat(roas.toFixed(2)),
          convRate: parseFloat(convRate.toFixed(2)),
          ctr: parseFloat(ctr.toFixed(2)),
          bounceRate: parseFloat(bounceRate.toFixed(2)),
          txCount: vals.txCount,
          revenuePerVisitor: parseFloat(revenuePerVisitor.toFixed(4)),
          cpc: parseFloat(cpc.toFixed(2)),
          aov: parseFloat(aov.toFixed(2)),
          cac: parseFloat(cac.toFixed(2)),
        };
      });
  }

  // Step 2 — aggregate raw snapshots into period buckets
  const sorted = bucketsToRows(aggregateToBuckets(snapshots));

  // Step 3 — compute prior-period rows (same window length shifted backwards)
  let priorRows: typeof sorted = [];
  if (allSnapshots && allSnapshots.length > 0 && sorted.length > 0) {
    // Determine window in days from first/last snapshot date
    const dates = snapshots.map((s) => s.date).sort();
    if (dates.length >= 2) {
      const windowMs = new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime();
      const shiftMs = windowMs + 86400000; // full window + 1 day gap
      const priorSnaps = allSnapshots.filter((s) => {
        const t = new Date(s.date).getTime();
        const startT = new Date(dates[0]).getTime();
        return t >= startT - shiftMs && t < startT;
      });
      priorRows = bucketsToRows(aggregateToBuckets(priorSnaps));
    }
  }

  // Step 4 — merge prior-period values into sorted rows (keyed by position index)
  const mergedSorted = sorted.map((row, i) => {
    const prior = priorRows[i];
    if (!prior) return row;
    const priorEntry: Record<string, number> = {};
    for (const k of Object.keys(row)) {
      if (k !== "date" && k !== "_pk" && typeof (row as Record<string, unknown>)[k] === "number") {
        priorEntry[`prev_${k}`] = ((prior as unknown as Record<string, number>)[k]) ?? 0;
      }
    }
    return { ...row, ...priorEntry };
  });

  // Step 5 — compute anomaly flags for the primary series (first non-bar line)
  function markAnomalies(rows: typeof mergedSorted, key: string): typeof mergedSorted {
    const vals = rows.map((r) => ((r as Record<string, unknown>)[key] as number) ?? 0);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1);
    const std = Math.sqrt(variance);
    return rows.map((r, i) => ({
      ...r,
      [`${key}_anomaly`]: std > 0 && Math.abs(vals[i] - mean) > 2 * std ? 1 : 0,
    }));
  }

  if (report === "business_growth") {
    const data = markAnomalies(mergedSorted, "revenue");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "revenue",
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "users", color: COLORS.users, label: "Users", yAxisId: "right", type: "line" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "revenue_vs_traffic") {
    const data = markAnomalies(mergedSorted, "revenue");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "revenue",
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "bar" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "ad_efficiency") {
    const data = markAnomalies(mergedSorted, "spend");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "spend",
      lines: [
        { key: "spend", color: COLORS.spend, label: `Ad Spend (${adCurrency})`, yAxisId: "left", type: "bar" },
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "roas", color: COLORS.roas, label: "ROAS (x)", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "customer_journey") {
    const data = markAnomalies(mergedSorted, "sessions");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "sessions",
      lines: [
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "left", type: "bar" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "line" },
        { key: "txCount", color: COLORS.revenue, label: "Transactions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "profit_overview") {
    const data = markAnomalies(mergedSorted, "revenue");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "revenue",
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "spend", color: COLORS.spend, label: `Ad Spend (${adCurrency})`, yAxisId: "left", type: "area" },
        { key: "profit", color: COLORS.profit, label: "Est. Profit ($)", yAxisId: "left", type: "line" },
      ],
    };
  }

  // engagement_quality
  if (report === "engagement_quality") {
    const data = markAnomalies(mergedSorted, "convRate");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "convRate",
      lines: [
        { key: "convRate", color: COLORS.convRate, label: "Conv Rate (%)", yAxisId: "left", type: "line" },
        { key: "ctr", color: COLORS.ctr, label: "CTR (%)", yAxisId: "left", type: "line" },
        { key: "bounceRate", color: COLORS.bounceRate, label: "Bounce Rate (%)", yAxisId: "left", type: "area" },
      ],
    };
  }

  if (report === "revenue_per_visitor") {
    const data = markAnomalies(mergedSorted, "revenuePerVisitor");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "revenuePerVisitor",
      lines: [
        { key: "revenuePerVisitor", color: COLORS.revenue, label: "Revenue/Visitor ($)", yAxisId: "left", type: "area" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "bar" },
      ],
    };
  }

  if (report === "ad_spend_vs_clicks") {
    const data = markAnomalies(mergedSorted, "spend");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "spend",
      lines: [
        { key: "spend", color: COLORS.spend, label: `Ad Spend (${adCurrency})`, yAxisId: "left", type: "bar" },
        { key: "clicks", color: COLORS.clicks, label: "Clicks", yAxisId: "right", type: "line" },
        { key: "cpc", color: COLORS.roas, label: `CPC (${adCurrency})`, yAxisId: "left", type: "line" },
      ],
    };
  }

  if (report === "daily_transactions") {
    const data = markAnomalies(mergedSorted, "txCount");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "txCount",
      lines: [
        { key: "txCount", color: COLORS.revenue, label: "Transactions", yAxisId: "left", type: "bar" },
        { key: "aov", color: COLORS.users, label: "Avg Order Value ($)", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "impressions_vs_sessions") {
    const data = markAnomalies(mergedSorted, "impressions");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "impressions",
      lines: [
        { key: "impressions", color: COLORS.impressions, label: "Impressions", yAxisId: "left", type: "bar" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "area" },
        { key: "clicks", color: COLORS.clicks, label: "Ad Clicks", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "cac_trend") {
    const data = markAnomalies(mergedSorted, "cac");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "cac",
      lines: [
        { key: "cac", color: COLORS.spend, label: `CAC (${adCurrency})`, yAxisId: "left", type: "line" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "bar" },
        { key: "spend", color: COLORS.impressions, label: `Ad Spend (${adCurrency})`, yAxisId: "left", type: "area" },
      ],
    };
  }

  if (report === "weekly_momentum") {
    // 7-day rolling average
    const rolling = mergedSorted.map((row, i) => {
      const window = mergedSorted.slice(Math.max(0, i - 6), i + 1);
      const avgRevenue = window.reduce((s, r) => s + (r.revenue as number), 0) / window.length;
      const avgSessions = window.reduce((s, r) => s + (r.sessions as number), 0) / window.length;
      return {
        ...row,
        rollingRevenue: parseFloat(avgRevenue.toFixed(2)),
        rollingSessions: Math.round(avgSessions),
      };
    });
    const data = markAnomalies(rolling, "rollingRevenue");
    return {
      currencyMismatch: !sameCurrency,
      data,
      primaryKey: "rollingRevenue",
      lines: [
        { key: "rollingRevenue", color: COLORS.revenue, label: "7d Avg Revenue ($)", yAxisId: "left", type: "area" },
        { key: "rollingSessions", color: COLORS.sessions, label: "7d Avg Sessions", yAxisId: "right", type: "line" },
      ],
    };
  }

  // fallback
  const data = markAnomalies(mergedSorted, "convRate");
  return {
    currencyMismatch: !sameCurrency,
    data,
    primaryKey: "convRate",
    lines: [
      { key: "convRate", color: COLORS.convRate, label: "Conv Rate (%)", yAxisId: "left", type: "line" },
      { key: "ctr", color: COLORS.ctr, label: "CTR (%)", yAxisId: "left", type: "line" },
      { key: "bounceRate", color: COLORS.bounceRate, label: "Bounce Rate (%)", yAxisId: "left", type: "area" },
    ],
  };
}

// ── Generate insights ─────────────────────────────────────────────────────

function generateInsights(
  snapshots: Snapshot[],
  report: ReportType,
  connectedPlatforms: string[],
  adCurrency = "USD",
  revCurrency = "USD",
  sameCurrencyGlobal = true,
): { icon: string; title: string; body: string; accent: string }[] {
  const insights: { icon: string; title: string; body: string; accent: string }[] = [];

  const REVENUE_PROVIDERS_INS = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
  const ADS_PROVIDERS_INS = ["meta", "google-ads", "tiktok-ads"];
  const ANALYTICS_PROVIDERS_INS = ["ga4", "google-analytics", "plausible"];

  const hasRevenue = REVENUE_PROVIDERS_INS.some(p => connectedPlatforms.includes(p));
  const hasAds = ADS_PROVIDERS_INS.some(p => connectedPlatforms.includes(p));
  const hasAnalytics = ANALYTICS_PROVIDERS_INS.some(p => connectedPlatforms.includes(p));

  // Aggregate totals across all provider types
  let totalRevenue = 0, totalSessions = 0, totalConversions = 0;
  let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalTx = 0;
  let bounceSum = 0, bounceCount = 0;

  for (const s of snapshots) {
    if (REVENUE_PROVIDERS_INS.includes(s.provider)) {
      totalRevenue += getField(s, "revenue");
      totalTx += getField(s, "txCount");
    }
    if (ANALYTICS_PROVIDERS_INS.includes(s.provider)) {
      totalSessions += getField(s, "sessions");
      totalConversions += getField(s, "conversions");
      bounceSum += getField(s, "bounceRate");
      bounceCount++;
    }
    if (ADS_PROVIDERS_INS.includes(s.provider)) {
      totalSpend += getField(s, "spend");
      totalClicks += getField(s, "clicks");
      totalImpressions += getField(s, "impressions");
    }
  }

  const revenueUSD = totalRevenue / 100;
  // Cross-currency metrics are only meaningful when all platforms share a currency
  const profit = sameCurrencyGlobal ? revenueUSD - totalSpend : null;
  const roas   = sameCurrencyGlobal && totalSpend > 0 ? revenueUSD / totalSpend : null;
  const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgBounce = bounceCount > 0 ? bounceSum / bounceCount : 0;
  const cac = sameCurrencyGlobal && totalConversions > 0 ? totalSpend / totalConversions : null;
  const aov = totalTx > 0 ? revenueUSD / totalTx : 0;

  const primaryRevPlatform = REVENUE_PROVIDERS_INS.find(p => connectedPlatforms.includes(p)) ?? "revenue";

  if (hasRevenue && revenueUSD > 0) {
    insights.push({
      icon: "💰",
      title: `Revenue: ${fmtCurrency(revenueUSD, revCurrency)}`,
      body: `Average order value is ${fmtCurrency(aov, revCurrency)}. ${totalTx} total transactions in this period.`,
      accent: COLORS.revenue,
    });
  }

  if (hasAds && totalSpend > 0) {
    if (sameCurrencyGlobal && roas !== null) {
      insights.push({
        icon: roas >= 3 ? "🚀" : roas >= 1 ? "⚠️" : "🔴",
        title: `ROAS: ${roas.toFixed(2)}x`,
        body:
          roas >= 3
            ? `Excellent! You're earning ${fmtCurrency(roas, revCurrency)} for every ${fmtCurrency(1, adCurrency)} spent on ads.`
            : roas >= 1
            ? `Profitable but there's room to improve. Target ≥3x ROAS for healthy margins.`
            : `Ad spend (${fmtCurrency(totalSpend, adCurrency)}) exceeds revenue. Consider pausing underperforming campaigns.`,
        accent: roas >= 3 ? COLORS.profit : roas >= 1 ? COLORS.roas : COLORS.spend,
      });
    } else if (!sameCurrencyGlobal) {
      insights.push({
        icon: "⚠️",
        title: `Ad Spend: ${fmtCurrency(totalSpend, adCurrency)}`,
        body: `ROAS and profit calculations are unavailable — ad spend is in ${adCurrency} while ${primaryRevPlatform} revenue is in ${revCurrency}. Connect platforms sharing the same currency for cross-platform metrics.`,
        accent: COLORS.spend,
      });
    }
  }

  if (hasAds && hasRevenue && sameCurrencyGlobal && profit !== null) {
    insights.push({
      icon: profit >= 0 ? "" : "",
      title: `Est. Profit: ${fmtCurrency(profit, revCurrency)}`,
      body:
        profit >= 0
          ? `After subtracting ${fmtCurrency(totalSpend, adCurrency)} ad spend from ${fmtCurrency(revenueUSD, revCurrency)} revenue.`
          : `You're spending more on ads than you're earning. Cut spend or improve conversion rate.`,
      accent: profit >= 0 ? COLORS.profit : COLORS.spend,
    });
  }

  if (hasAnalytics && totalSessions > 0) {
    insights.push({
      icon: convRate >= 3 ? "🎯" : convRate >= 1 ? "📊" : "⚠️",
      title: `Conversion Rate: ${convRate.toFixed(2)}%`,
      body:
        convRate >= 3
          ? `Strong conversion rate! ${totalConversions} conversions from ${fmtNum(totalSessions)} sessions.`
          : convRate >= 1
          ? `Average conversion rate. Industry standard is 2-4%. Consider improving landing pages.`
          : `Low conversion rate. ${fmtNum(totalSessions)} sessions but only ${totalConversions} converted. Focus on UX.`,
      accent: convRate >= 3 ? COLORS.convRate : convRate >= 1 ? COLORS.sessions : COLORS.bounceRate,
    });
  }

  if (hasAnalytics && avgBounce > 0) {
    insights.push({
      icon: avgBounce < 40 ? "🟢" : avgBounce < 70 ? "🟡" : "🔴",
      title: `Bounce Rate: ${avgBounce.toFixed(1)}%`,
      body:
        avgBounce < 40
          ? `Excellent engagement — users are exploring your site.`
          : avgBounce < 70
          ? `Average bounce rate. Consider improving page load speed and content relevance.`
          : `High bounce rate. Users are leaving quickly — review your landing page experience.`,
      accent: avgBounce < 40 ? COLORS.profit : avgBounce < 70 ? COLORS.roas : COLORS.spend,
    });
  }

  if (hasAds && sameCurrencyGlobal && cac !== null && cac > 0) {
    insights.push({
      icon: "👤",
      title: `CAC: ${fmtCurrency(cac, adCurrency)} per conversion`,
      body: `You're spending ${fmtCurrency(cac, adCurrency)} in ads to acquire each conversion. CTR is ${ctr.toFixed(2)}%.`,
      accent: COLORS.clicks,
    });
  }

  if (report === "business_growth" && connectedPlatforms.length >= 2) {
    insights.push({
      icon: "📡",
      title: "Cross-platform health",
      body: `${connectedPlatforms.length} platforms connected. Tracking ${fmtNum(totalSessions)} sessions, ${fmtCurrency(revenueUSD, revCurrency)} revenue, and ${fmtCurrency(totalSpend, adCurrency)} ad spend in parallel.`,
      accent: COLORS.users,
    });
  }

  return insights.slice(0, 4);
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewSection({ snapshots, connectedPlatforms, timeRange: externalTimeRange, granularity = "day", currencies = {} }: Props) {
  // Derive per-platform currencies from the map (ads + revenue)
  const ADS_PROVIDERS_LOCAL = ["meta", "google-ads", "tiktok-ads"];
  const REVENUE_PROVIDERS_LOCAL = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
  const connAdsLocal = ADS_PROVIDERS_LOCAL.filter(p => connectedPlatforms.includes(p));
  const connRevLocal = REVENUE_PROVIDERS_LOCAL.filter(p => connectedPlatforms.includes(p));
  const primaryAdProvider = connAdsLocal[0];
  const primaryRevProvider = connRevLocal[0];
  // "primary ad currency" — first connected ad platform's currency
  const adCurrency = primaryAdProvider ? (currencies[primaryAdProvider] ?? "USD") : "USD";
  // "primary revenue currency" — first connected revenue platform's currency
  const revCurrency = primaryRevProvider ? (currencies[primaryRevProvider] ?? "USD") : "USD";
  // sameCurrency: all connected ad+revenue platforms share one currency
  const allPlatformCurrencies = [...connAdsLocal, ...connRevLocal]
    .map(p => currencies[p] ?? "USD");
  const sameCurrencyGlobal = allPlatformCurrencies.length === 0 || new Set(allPlatformCurrencies).size === 1;
  // Keep legacy variable names for internal helpers that still use them
  const metaCurrency = adCurrency;
  const stripeCurrency = revCurrency;
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("30d");
  const [report, setReport] = useState<ReportType>("business_growth");

  // Use external time range if provided, otherwise internal
  const timeRange = externalTimeRange ?? internalTimeRange;

  const filtered = useMemo(
    () => filterByRange(snapshots, timeRange),
    [snapshots, timeRange]
  );

  // Expose timeRange setter for external sync (unused here but keeps interface stable)

  const { data: chartData, lines, currencyMismatch, primaryKey } = useMemo(
    () => buildChartData(filtered, report, granularity, adCurrency, snapshots, revCurrency, sameCurrencyGlobal),
    [filtered, report, granularity, adCurrency, snapshots, revCurrency, sameCurrencyGlobal]
  );

  const insights = useMemo(
    () => generateInsights(filtered, report, connectedPlatforms, adCurrency, revCurrency, sameCurrencyGlobal),
    [filtered, report, connectedPlatforms, adCurrency, revCurrency, sameCurrencyGlobal]
  );

  // Summary KPIs (always shown regardless of report)
  const kpis = useMemo(() => {
    let totalRevenue = 0, prevRevenue = 0;
    let totalSessions = 0, prevSessions = 0;
    let totalSpend = 0, prevSpend = 0;
    let totalConversions = 0, prevConversions = 0;

    // Point-in-time subscription metrics — latest non-zero value wins
    let currentMRR = 0, prevMRR = 0;
    let currentActiveSubs = 0;
    let totalChurned = 0;

    const half = Math.floor(filtered.length / 2);
    filtered.forEach((s, _i) => {
      const idx = filtered.indexOf(s);
      const isSecondHalf = idx >= half;

      // Sum ALL revenue providers
      if (REVENUE_PROVIDERS_LOCAL.includes(s.provider)) {
        const r = getField(s, "revenue");
        totalRevenue += r;
        if (!isSecondHalf) prevRevenue += r;

        // Stripe-specific subscription fields
        if (s.provider === "stripe") {
          const mrr = getField(s, "mrr");
          if (mrr > 0) {
            if (!isSecondHalf) prevMRR = mrr;
            currentMRR = mrr;
          }
          const activeSubs = getField(s, "activeSubscriptions");
          if (activeSubs > 0) currentActiveSubs = activeSubs;
          totalChurned += getField(s, "churnedToday");
        }
      }
      // Analytics providers (ga4, google-analytics, plausible, etc.)
      if (s.provider === "ga4" || s.provider === "google-analytics" || s.provider === "plausible") {
        const sess = getField(s, "sessions");
        const conv = getField(s, "conversions");
        totalSessions += sess;
        totalConversions += conv;
        if (!isSecondHalf) { prevSessions += sess; prevConversions += conv; }
      }
      // Sum ALL ads providers
      if (ADS_PROVIDERS_LOCAL.includes(s.provider)) {
        const sp = getField(s, "spend");
        totalSpend += sp;
        if (!isSecondHalf) prevSpend += sp;
      }
    });

    const revenueUSD = totalRevenue / 100;
    const prevRevenueUSD = prevRevenue / 100;
    // Only compute cross-currency metrics when all connected ad+revenue platforms share one currency
    const profit = sameCurrencyGlobal ? revenueUSD - totalSpend : null;
    const roas   = sameCurrencyGlobal && totalSpend > 0 ? revenueUSD / totalSpend : 0;
    const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    const churnRate = currentActiveSubs > 0 ? (totalChurned / currentActiveSubs) * 100 : 0;
    const hasAnyRevenue = connRevLocal.some(p => connectedPlatforms.includes(p));
    const hasAnyAds = connAdsLocal.some(p => connectedPlatforms.includes(p));

    return [
      hasAnyRevenue && {
        label: "Total Revenue",
        value: fmtCurrency(revenueUSD, revCurrency),
        icon: "",
        color: COLORS.revenue,
        change: pctChange(revenueUSD, prevRevenueUSD),
      },
      // MRR card — only when subscription data is present (Stripe-specific)
      connectedPlatforms.includes("stripe") && currentMRR > 0 && {
        label: "MRR",
        value: fmtCurrency(currentMRR / 100, revCurrency),
        sub: churnRate > 0 ? `${churnRate.toFixed(1)}% churn` : currentActiveSubs > 0 ? `${currentActiveSubs} subscribers` : undefined,
        icon: "",
        color: "#a78bfa",
        change: pctChange(currentMRR / 100, prevMRR / 100),
      },
      connectedPlatforms.includes("ga4") && {
        label: "Website Sessions",
        value: fmtNum(totalSessions),
        icon: "",
        color: COLORS.sessions,
        change: pctChange(totalSessions, prevSessions),
      },
      hasAnyAds && {
        label: "Ad Spend",
        value: fmtCurrency(totalSpend, adCurrency),
        icon: "",
        color: COLORS.spend,
        change: pctChange(totalSpend, prevSpend),
      },
      // Only show Est. Profit when all connected ad+revenue platforms share one currency
      sameCurrencyGlobal && profit !== null && hasAnyAds && hasAnyRevenue && {
        label: "Est. Profit",
        value: fmtCurrency(profit, revCurrency),
        sub: roas > 0 ? `ROAS ${roas.toFixed(2)}x` : undefined,
        icon: profit >= 0 ? "" : "",
        color: profit >= 0 ? COLORS.profit : COLORS.spend,
        change: null,
      },
      connectedPlatforms.includes("ga4") && {
        label: "Conv. Rate",
        value: fmtPct(convRate),
        icon: "",
        color: COLORS.convRate,
        change: pctChange(totalConversions, prevConversions),
      },
    ].filter(Boolean) as {
      label: string;
      value: string;
      sub?: string;
      icon: string;
      color: string;
      change: { pct: number; up: boolean } | null;
    }[];
  }, [filtered, connectedPlatforms, revCurrency, adCurrency, sameCurrencyGlobal, connRevLocal, connAdsLocal]);

  const hasData = chartData.length > 0;

  // ── Period-over-period % change for the primary key ──────────────────────
  const popChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const half = Math.floor(chartData.length / 2);
    const currTotal = chartData.slice(half).reduce((s, r) => s + ((r[primaryKey] as number) ?? 0), 0);
    const prevTotal = chartData.slice(0, half).reduce((s, r) => s + ((r[primaryKey] as number) ?? 0), 0);
    if (prevTotal === 0) return null;
    const pct = ((currTotal - prevTotal) / prevTotal) * 100;
    return { pct: Math.abs(pct).toFixed(1), up: currTotal >= prevTotal };
  }, [chartData, primaryKey]);

  // ── Average reference value for the primary key ───────────────────────────
  const avgRefValue = useMemo(() => {
    if (chartData.length === 0) return null;
    const vals = chartData.map((r) => (r[primaryKey] as number) ?? 0);
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  }, [chartData, primaryKey]);

  // ── Does prior-period data exist? ─────────────────────────────────────────
  const hasPriorData = chartData.length > 0 && chartData.some((r) => r[`prev_${primaryKey}`] !== undefined);

  // ── Primary series color ──────────────────────────────────────────────────
  const primaryColor = lines[0]?.color ?? "#635bff";

  return (
    <div className="space-y-8">

      {/* ── Currency mismatch warning ──────────────────────────── */}
      {currencyMismatch && (
        <div className="flex items-start gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/8 px-4 py-3">
          <span className="text-sm">⚠️</span>
          <p className="font-mono text-[11px] text-[#f59e0b] leading-relaxed">
            Your Meta Ads account uses <strong>{metaCurrency}</strong> while Stripe revenue is in <strong>USD</strong>.
            Cross-currency metrics (ROAS, profit, CAC) have been hidden to avoid misleading calculations.
            Each platform&apos;s own figures (spend in {metaCurrency}, revenue in USD) are shown accurately.
          </p>
        </div>
      )}

      {/* ── KPI Summary Row ─────────────────────────────────────── */}
      <div className={`grid gap-3 ${kpis.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : kpis.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5"}`}>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            change={kpi.change}
            color={kpi.color}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* ── Chart Panel ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#363650] bg-[#222235] p-6">

        {/* Header: Report selector + Time range */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Report Type</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_TYPES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReport(r.key)}
                  title={r.description}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-semibold transition-all ${
                    report === r.key
                      ? "border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]"
                      : "border-[#363650] text-[#8585aa] hover:border-[#2e2e4e] hover:text-[#bcbcd8]"
                  }`}
                >
                  <span>{r.icon}</span>
                  <span className="hidden sm:inline">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hide internal time range selector when parent controls it */}
          {!externalTimeRange && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Time Range</p>
            <div className="flex gap-1 rounded-lg border border-[#363650] bg-[#1c1c2a] p-1">
              {TIME_RANGES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setInternalTimeRange(t.key)}
                  className={`rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition-all ${
                    timeRange === t.key
                      ? "bg-[#363650] text-[#f8f8fc]"
                      : "text-[#8585aa] hover:text-[#bcbcd8]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Report description */}
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-mono text-[11px] text-[#8585aa]">
            {REPORT_TYPES.find((r) => r.key === report)?.description}
          </p>
          {popChange && (
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                popChange.up
                  ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                  : "bg-red-400/10 text-red-400"
              }`}
            >
              {popChange.up ? "▲" : "▼"} {popChange.pct}% vs prior period
            </span>
          )}
        </div>

        {/* Chart */}
        {!hasData ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-[#363650] bg-[#1c1c2a]/60">
            <div className="text-center">
              <p className="font-mono text-xs text-[#8585aa]">No data for selected period</p>
              <p className="mt-1 font-mono text-[10px] text-[#2e2e4e]">Try a wider time range</p>
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  {lines.map((l) => (
                    <linearGradient key={`grad-${l.key}`} id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={l.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={l.color} stopOpacity={0.01} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#363650" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#8585aa", fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={{ stroke: "#363650" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#8585aa", fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#8585aa", fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: "monospace", fontSize: 10, paddingTop: 16 }}
                  formatter={(value) => (
                    <span style={{ color: "#bcbcd8" }}>{value}</span>
                  )}
                />

                {/* Average reference line */}
                {avgRefValue !== null && avgRefValue > 0 && (
                  <ReferenceLine
                    y={avgRefValue}
                    yAxisId="left"
                    stroke={primaryColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                    label={{
                      value: `avg ${avgRefValue}`,
                      position: "insideTopLeft",
                      fill: primaryColor,
                      fontSize: 9,
                      fontFamily: "monospace",
                      opacity: 0.6,
                    }}
                  />
                )}

                {/* Prior period dashed overlay — only for the primary series */}
                {hasPriorData && (
                  <Line
                    key={`prev_${primaryKey}`}
                    dataKey={`prev_${primaryKey}`}
                    name="Prior period"
                    stroke={primaryColor}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    strokeOpacity={0.45}
                    yAxisId="left"
                    dot={false}
                    activeDot={false}
                    legendType="plainline"
                  />
                )}

                {lines.map((l) => {
                  // Custom anomaly dot: renders a ring around outlier points
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const AnomalyDot = (props: any) => {
                    const { cx, cy, payload } = props;
                    if (!cx || !cy) return null;
                    const isAnomaly = payload[`${l.key}_anomaly`] === 1;
                    if (!isAnomaly) return null;
                    return (
                      <g key={`anom-${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r={8} fill="none" stroke={l.color} strokeWidth={1.5} opacity={0.7} />
                        <circle cx={cx} cy={cy} r={3} fill={l.color} opacity={0.9} />
                      </g>
                    );
                  };

                  if (l.type === "bar") {
                    return (
                      <Bar
                        key={l.key}
                        dataKey={l.key}
                        name={l.label}
                        fill={l.color}
                        fillOpacity={0.7}
                        yAxisId={l.yAxisId}
                        radius={[3, 3, 0, 0]}
                      />
                    );
                  }
                  if (l.type === "area") {
                    return (
                      <Area
                        key={l.key}
                        dataKey={l.key}
                        name={l.label}
                        stroke={l.color}
                        fill={`url(#grad-${l.key})`}
                        strokeWidth={2}
                        yAxisId={l.yAxisId}
                        dot={AnomalyDot}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    );
                  }
                  return (
                    <Line
                      key={l.key}
                      dataKey={l.key}
                      name={l.label}
                      stroke={l.color}
                      strokeWidth={2}
                      yAxisId={l.yAxisId}
                      dot={AnomalyDot}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  );
                })}

                {/* Brush for zooming */}
                <Brush
                  dataKey="date"
                  height={22}
                  stroke="#363650"
                  fill="#13131f"
                  travellerWidth={6}
                  startIndex={Math.max(0, chartData.length - Math.min(chartData.length, 30))}
                  tickFormatter={() => ""}
                >
                  <Area
                    dataKey={primaryKey}
                    stroke={primaryColor}
                    fill={primaryColor}
                    fillOpacity={0.08}
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                    yAxisId="left"
                  />
                </Brush>
              </ComposedChart>
            </ResponsiveContainer>

            {/* Anomaly legend hint */}
            {chartData.some((r) => r[`${primaryKey}_anomaly`] === 1) && (
              <p className="mt-2 font-mono text-[9px] text-[#8585aa]">
                <span className="inline-flex items-center gap-1 mr-1">
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <circle cx="5" cy="5" r="4" fill="none" stroke={primaryColor} strokeWidth="1" opacity="0.7" />
                    <circle cx="5" cy="5" r="2" fill={primaryColor} opacity="0.9" />
                  </svg>
                </span>
                Circled points are statistical anomalies (&gt;2σ from mean).
                {hasPriorData && " Dashed line = prior period."}
              </p>
            )}
            {!chartData.some((r) => r[`${primaryKey}_anomaly`] === 1) && hasPriorData && (
              <p className="mt-2 font-mono text-[9px] text-[#8585aa]">
                Dashed line = prior period · Drag the brush below to zoom
              </p>
            )}
            {!chartData.some((r) => r[`${primaryKey}_anomaly`] === 1) && !hasPriorData && (
              <p className="mt-2 font-mono text-[9px] text-[#8585aa]">
                Drag the handles below the chart to zoom into a sub-range
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Full Funnel ──────────────────────────────────────── */}
      <FunnelSection snapshots={filtered} connectedPlatforms={connectedPlatforms} currencies={currencies} />

      {/* ── AI Insights ─────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Key Insights</span>
            <div className="flex-1 border-t border-[#363650]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => (
              <InsightCard key={i} {...ins} />
            ))}
          </div>
        </div>
      )}

      {/* ── Health Score ─────────────────────────────────────────── */}
      <HealthScore snapshots={filtered} connectedPlatforms={connectedPlatforms} />
    </div>
  );
}

// ── Health Score Component ────────────────────────────────────────────────

function HealthScore({ snapshots, connectedPlatforms }: { snapshots: Snapshot[]; connectedPlatforms: string[] }) {
  const score = useMemo(() => {
    let points = 0;
    let maxPoints = 0;

    let revenue = 0, spend = 0, sessions = 0, conversions = 0, bounceSum = 0, bounceCount = 0;
    for (const s of snapshots) {
      if (s.provider === "stripe") revenue += getField(s, "revenue") / 100;
      if (s.provider === "meta") spend += getField(s, "spend");
      if (s.provider === "ga4") {
        sessions += getField(s, "sessions");
        conversions += getField(s, "conversions");
        bounceSum += getField(s, "bounceRate");
        bounceCount++;
      }
    }

    const roas = spend > 0 ? revenue / spend : null;
    const convRate = sessions > 0 ? (conversions / sessions) * 100 : null;
    const bounce = bounceCount > 0 ? bounceSum / bounceCount : null;
    const profit = revenue - spend;

    const metrics: { label: string; score: number; max: number; note: string }[] = [];

    if (roas !== null) {
      maxPoints += 25;
      const s = roas >= 4 ? 25 : roas >= 3 ? 20 : roas >= 2 ? 12 : roas >= 1 ? 6 : 0;
      points += s;
      metrics.push({ label: "ROAS", score: s, max: 25, note: `${roas.toFixed(2)}x` });
    }
    if (convRate !== null) {
      maxPoints += 25;
      const s = convRate >= 4 ? 25 : convRate >= 2 ? 18 : convRate >= 1 ? 10 : 3;
      points += s;
      metrics.push({ label: "Conv Rate", score: s, max: 25, note: `${convRate.toFixed(2)}%` });
    }
    if (bounce !== null) {
      maxPoints += 25;
      const s = bounce < 30 ? 25 : bounce < 50 ? 18 : bounce < 70 ? 10 : 3;
      points += s;
      metrics.push({ label: "Bounce Rate", score: s, max: 25, note: `${bounce.toFixed(1)}%` });
    }
    if (revenue > 0) {
      maxPoints += 25;
      const profitPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      const s = profitPct >= 50 ? 25 : profitPct >= 20 ? 18 : profitPct >= 0 ? 10 : 0;
      points += s;
      metrics.push({ label: "Profit Margin", score: s, max: 25, note: `${profitPct.toFixed(1)}%` });
    }

    if (maxPoints === 0) return null;
    const pct = Math.round((points / maxPoints) * 100);
    const label = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Average" : "Needs Work";
    const color = pct >= 80 ? "#00d4aa" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#fb923c" : "#f87171";

    return { pct, label, color, metrics, connectedCount: connectedPlatforms.length };
  }, [snapshots, connectedPlatforms]);

  if (!score) return null;

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#222235] p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Business Health Score</span>
        <div className="flex-1 border-t border-[#363650]" />
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Score circle */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full border-4"
            style={{ borderColor: score.color }}
          >
            <div className="text-center">
              <p className="font-mono text-3xl font-bold" style={{ color: score.color }}>
                {score.pct}
              </p>
              <p className="font-mono text-[10px] text-[#8585aa]">/ 100</p>
            </div>
          </div>
          <p className="font-mono text-sm font-semibold" style={{ color: score.color }}>
            {score.label}
          </p>
          <p className="font-mono text-[9px] text-[#8585aa]">
            {score.connectedCount} platform{score.connectedCount !== 1 ? "s" : ""} connected
          </p>
        </div>

        {/* Metric bars */}
        <div className="flex-1 space-y-3">
          {score.metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#bcbcd8]">{m.label}</span>
                <span className="font-mono text-[10px] text-[#8585aa]">{m.note}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#363650]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(m.score / m.max) * 100}%`,
                    backgroundColor: score.color,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
