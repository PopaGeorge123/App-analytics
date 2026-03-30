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

function fmtCurrency(n: number): string {
  const d = n / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${(d / 1_000).toFixed(1)}k`;
  return `$${d.toFixed(0)}`;
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
  granularity: Granularity = "day"
): { data: Record<string, string | number>[]; lines: { key: string; color: string; label: string; yAxisId: string; type: "line" | "bar" | "area" }[] } {
  // Step 1 — aggregate raw snapshots into period buckets
  type RawBucket = { revenue: number; sessions: number; users: number; conversions: number; spend: number; clicks: number; impressions: number; bounceRateSum: number; bounceRateCount: number; txCount: number };
  const byPeriod: Record<string, RawBucket> = {};

  for (const snap of snapshots) {
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

  // Step 2 — compute derived metrics per period
  const sorted = Object.entries(byPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pk, vals]) => {
      const revenueUSD = vals.revenue / 100;
      const spendUSD = vals.spend;
      const bounceRate = vals.bounceRateCount > 0 ? vals.bounceRateSum / vals.bounceRateCount : 0;
      const profit = revenueUSD - spendUSD;
      const roas = spendUSD > 0 ? revenueUSD / spendUSD : 0;
      const convRate = vals.sessions > 0 ? (vals.conversions / vals.sessions) * 100 : 0;
      const ctr = vals.impressions > 0 ? (vals.clicks / vals.impressions) * 100 : 0;
      const revenuePerVisitor = vals.sessions > 0 ? revenueUSD / vals.sessions : 0;
      const cpc = vals.clicks > 0 ? spendUSD / vals.clicks : 0;
      const aov = vals.txCount > 0 ? revenueUSD / vals.txCount : 0;
      const cac = vals.conversions > 0 ? spendUSD / vals.conversions : 0;

      return {
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

  if (report === "business_growth") {
    return {
      data: sorted,
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "users", color: COLORS.users, label: "Users", yAxisId: "right", type: "line" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "revenue_vs_traffic") {
    return {
      data: sorted,
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "bar" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "ad_efficiency") {
    return {
      data: sorted,
      lines: [
        { key: "spend", color: COLORS.spend, label: "Ad Spend ($)", yAxisId: "left", type: "bar" },
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "roas", color: COLORS.roas, label: "ROAS (x)", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "customer_journey") {
    return {
      data: sorted,
      lines: [
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "left", type: "bar" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "line" },
        { key: "txCount", color: COLORS.revenue, label: "Transactions", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "profit_overview") {
    return {
      data: sorted,
      lines: [
        { key: "revenue", color: COLORS.revenue, label: "Revenue ($)", yAxisId: "left", type: "area" },
        { key: "spend", color: COLORS.spend, label: "Ad Spend ($)", yAxisId: "left", type: "area" },
        { key: "profit", color: COLORS.profit, label: "Est. Profit ($)", yAxisId: "left", type: "line" },
      ],
    };
  }

  // engagement_quality
  if (report === "engagement_quality") {
    return {
      data: sorted,
      lines: [
        { key: "convRate", color: COLORS.convRate, label: "Conv Rate (%)", yAxisId: "left", type: "line" },
        { key: "ctr", color: COLORS.ctr, label: "CTR (%)", yAxisId: "left", type: "line" },
        { key: "bounceRate", color: COLORS.bounceRate, label: "Bounce Rate (%)", yAxisId: "left", type: "area" },
      ],
    };
  }

  if (report === "revenue_per_visitor") {
    return {
      data: sorted,
      lines: [
        { key: "revenuePerVisitor", color: COLORS.revenue, label: "Revenue/Visitor ($)", yAxisId: "left", type: "area" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "bar" },
      ],
    };
  }

  if (report === "ad_spend_vs_clicks") {
    return {
      data: sorted,
      lines: [
        { key: "spend", color: COLORS.spend, label: "Ad Spend ($)", yAxisId: "left", type: "bar" },
        { key: "clicks", color: COLORS.clicks, label: "Clicks", yAxisId: "right", type: "line" },
        { key: "cpc", color: COLORS.roas, label: "CPC ($)", yAxisId: "left", type: "line" },
      ],
    };
  }

  if (report === "daily_transactions") {
    return {
      data: sorted,
      lines: [
        { key: "txCount", color: COLORS.revenue, label: "Transactions", yAxisId: "left", type: "bar" },
        { key: "aov", color: COLORS.users, label: "Avg Order Value ($)", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "impressions_vs_sessions") {
    return {
      data: sorted,
      lines: [
        { key: "impressions", color: COLORS.impressions, label: "Impressions", yAxisId: "left", type: "bar" },
        { key: "sessions", color: COLORS.sessions, label: "Sessions", yAxisId: "right", type: "area" },
        { key: "clicks", color: COLORS.clicks, label: "Ad Clicks", yAxisId: "right", type: "line" },
      ],
    };
  }

  if (report === "cac_trend") {
    return {
      data: sorted,
      lines: [
        { key: "cac", color: COLORS.spend, label: "CAC ($)", yAxisId: "left", type: "line" },
        { key: "conversions", color: COLORS.conversions, label: "Conversions", yAxisId: "right", type: "bar" },
        { key: "spend", color: COLORS.impressions, label: "Ad Spend ($)", yAxisId: "left", type: "area" },
      ],
    };
  }

  if (report === "weekly_momentum") {
    // 7-day rolling average
    const rolling = sorted.map((row, i) => {
      const window = sorted.slice(Math.max(0, i - 6), i + 1);
      const avgRevenue = window.reduce((s, r) => s + (r.revenue as number), 0) / window.length;
      const avgSessions = window.reduce((s, r) => s + (r.sessions as number), 0) / window.length;
      return {
        ...row,
        rollingRevenue: parseFloat(avgRevenue.toFixed(2)),
        rollingSessions: Math.round(avgSessions),
      };
    });
    return {
      data: rolling,
      lines: [
        { key: "rollingRevenue", color: COLORS.revenue, label: "7d Avg Revenue ($)", yAxisId: "left", type: "area" },
        { key: "rollingSessions", color: COLORS.sessions, label: "7d Avg Sessions", yAxisId: "right", type: "line" },
      ],
    };
  }

  // fallback
  return {
    data: sorted,
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
  connectedPlatforms: string[]
): { icon: string; title: string; body: string; accent: string }[] {
  const insights: { icon: string; title: string; body: string; accent: string }[] = [];

  // Aggregate totals
  let totalRevenue = 0, totalSessions = 0, totalConversions = 0;
  let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalTx = 0;
  let bounceSum = 0, bounceCount = 0;

  for (const s of snapshots) {
    if (s.provider === "stripe") {
      totalRevenue += getField(s, "revenue");
      totalTx += getField(s, "txCount");
    }
    if (s.provider === "ga4") {
      totalSessions += getField(s, "sessions");
      totalConversions += getField(s, "conversions");
      bounceSum += getField(s, "bounceRate");
      bounceCount++;
    }
    if (s.provider === "meta") {
      totalSpend += getField(s, "spend");
      totalClicks += getField(s, "clicks");
      totalImpressions += getField(s, "impressions");
    }
  }

  const revenueUSD = totalRevenue / 100;
  const profit = revenueUSD - totalSpend;
  const roas = totalSpend > 0 ? revenueUSD / totalSpend : 0;
  const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgBounce = bounceCount > 0 ? bounceSum / bounceCount : 0;
  const cac = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const aov = totalTx > 0 ? revenueUSD / totalTx : 0;

  if (connectedPlatforms.includes("stripe") && revenueUSD > 0) {
    insights.push({
      icon: "💰",
      title: `Revenue: $${revenueUSD.toFixed(2)}`,
      body: `Average order value is $${aov.toFixed(2)}. ${totalTx} total transactions in this period.`,
      accent: COLORS.revenue,
    });
  }

  if (connectedPlatforms.includes("meta") && totalSpend > 0) {
    insights.push({
      icon: roas >= 3 ? "🚀" : roas >= 1 ? "⚠️" : "🔴",
      title: `ROAS: ${roas.toFixed(2)}x`,
      body:
        roas >= 3
          ? `Excellent! You're earning $${roas.toFixed(2)} for every $1 spent on ads.`
          : roas >= 1
          ? `Profitable but there's room to improve. Target ≥3x ROAS for healthy margins.`
          : `Ad spend ($${totalSpend.toFixed(2)}) exceeds revenue. Consider pausing underperforming campaigns.`,
      accent: roas >= 3 ? COLORS.profit : roas >= 1 ? COLORS.roas : COLORS.spend,
    });
  }

  if (connectedPlatforms.includes("meta") && connectedPlatforms.includes("stripe")) {
    insights.push({
      icon: profit >= 0 ? "" : "",
      title: `Est. Profit: $${profit.toFixed(2)}`,
      body:
        profit >= 0
          ? `After subtracting $${totalSpend.toFixed(2)} ad spend from $${revenueUSD.toFixed(2)} revenue.`
          : `You're spending more on ads than you're earning. Cut spend or improve conversion rate.`,
      accent: profit >= 0 ? COLORS.profit : COLORS.spend,
    });
  }

  if (connectedPlatforms.includes("ga4") && totalSessions > 0) {
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

  if (connectedPlatforms.includes("ga4") && avgBounce > 0) {
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

  if (connectedPlatforms.includes("meta") && cac > 0) {
    insights.push({
      icon: "👤",
      title: `CAC: $${cac.toFixed(2)} per conversion`,
      body: `You're spending $${cac.toFixed(2)} in ads to acquire each conversion. CTR is ${ctr.toFixed(2)}%.`,
      accent: COLORS.clicks,
    });
  }

  if (report === "business_growth" && connectedPlatforms.length >= 2) {
    insights.push({
      icon: "📡",
      title: "Cross-platform health",
      body: `${connectedPlatforms.length} platforms connected. Tracking ${fmtNum(totalSessions)} sessions, $${revenueUSD.toFixed(0)} revenue, and $${totalSpend.toFixed(0)} ad spend in parallel.`,
      accent: COLORS.users,
    });
  }

  return insights.slice(0, 4);
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewSection({ snapshots, connectedPlatforms, timeRange: externalTimeRange, granularity = "day" }: Props) {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("30d");
  const [report, setReport] = useState<ReportType>("business_growth");

  // Use external time range if provided, otherwise internal
  const timeRange = externalTimeRange ?? internalTimeRange;

  const filtered = useMemo(
    () => filterByRange(snapshots, timeRange),
    [snapshots, timeRange]
  );

  // Expose timeRange setter for external sync (unused here but keeps interface stable)

  const { data: chartData, lines } = useMemo(
    () => buildChartData(filtered, report, granularity),
    [filtered, report, granularity]
  );

  const insights = useMemo(
    () => generateInsights(filtered, report, connectedPlatforms),
    [filtered, report, connectedPlatforms]
  );

  // Summary KPIs (always shown regardless of report)
  const kpis = useMemo(() => {
    let totalRevenue = 0, prevRevenue = 0;
    let totalSessions = 0, prevSessions = 0;
    let totalSpend = 0, prevSpend = 0;
    let totalConversions = 0, prevConversions = 0;

    const half = Math.floor(filtered.length / 2);
    filtered.forEach((s, _i) => {
      const idx = filtered.indexOf(s);
      const isSecondHalf = idx >= half;

      if (s.provider === "stripe") {
        const r = getField(s, "revenue");
        totalRevenue += r;
        if (!isSecondHalf) prevRevenue += r;
      }
      if (s.provider === "ga4") {
        const sess = getField(s, "sessions");
        const conv = getField(s, "conversions");
        totalSessions += sess;
        totalConversions += conv;
        if (!isSecondHalf) { prevSessions += sess; prevConversions += conv; }
      }
      if (s.provider === "meta") {
        const sp = getField(s, "spend");
        totalSpend += sp;
        if (!isSecondHalf) prevSpend += sp;
      }
    });

    const revenueUSD = totalRevenue / 100;
    const prevRevenueUSD = prevRevenue / 100;
    const profit = revenueUSD - totalSpend;
    const roas = totalSpend > 0 ? revenueUSD / totalSpend : 0;
    const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

    return [
      connectedPlatforms.includes("stripe") && {
        label: "Total Revenue",
        value: `$${revenueUSD.toFixed(2)}`,
        icon: "",
        color: COLORS.revenue,
        change: pctChange(revenueUSD, prevRevenueUSD),
      },
      connectedPlatforms.includes("ga4") && {
        label: "Website Sessions",
        value: fmtNum(totalSessions),
        icon: "",
        color: COLORS.sessions,
        change: pctChange(totalSessions, prevSessions),
      },
      connectedPlatforms.includes("meta") && {
        label: "Ad Spend",
        value: `$${totalSpend.toFixed(2)}`,
        icon: "",
        color: COLORS.spend,
        change: pctChange(totalSpend, prevSpend),
      },
      (connectedPlatforms.includes("meta") || connectedPlatforms.includes("stripe")) && {
        label: "Est. Profit",
        value: `$${profit.toFixed(2)}`,
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
  }, [filtered, connectedPlatforms]);

  const hasData = chartData.length > 0;

  return (
    <div className="space-y-8">

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
        <p className="mb-5 font-mono text-[11px] text-[#8585aa]">
          {REPORT_TYPES.find((r) => r.key === report)?.description}
        </p>

        {/* Chart */}
        {!hasData ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-[#363650] bg-[#1c1c2a]/60">
            <div className="text-center">
              <p className="font-mono text-xs text-[#8585aa]">No data for selected period</p>
              <p className="mt-1 font-mono text-[10px] text-[#2e2e4e]">Try a wider time range</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
              {lines.map((l) => {
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
                      fill={l.color}
                      fillOpacity={0.08}
                      strokeWidth={2}
                      yAxisId={l.yAxisId}
                      dot={false}
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
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Full Funnel ──────────────────────────────────────── */}
      <FunnelSection snapshots={filtered} connectedPlatforms={connectedPlatforms} />

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
