"use client";

import { useMemo, useState, useEffect } from "react";
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
  | "weekly_momentum"
  | "custom";

// ── Constants ─────────────────────────────────────────────────────────────

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

const REPORT_ICONS: Record<string, React.ReactNode> = {
  business_growth: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  revenue_vs_traffic: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  ad_efficiency: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  customer_journey: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
    </svg>
  ),
  profit_overview: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  engagement_quality: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  revenue_per_visitor: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  ad_spend_vs_clicks: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l16 8-16 8V4z"/>
    </svg>
  ),
  daily_transactions: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  impressions_vs_sessions: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  cac_trend: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  weekly_momentum: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c1.5-4 3.5-6 5-6s3 2.5 4 2.5S13 6 15 6s3.5 2 5 6"/>
    </svg>
  ),
};

const REPORT_TYPES: { key: ReportType; label: string; description: string }[] = [
  {
    key: "business_growth",
    label: "Business Growth",
    description: "Revenue + Users + Conversions over time",
  },
  {
    key: "revenue_vs_traffic",
    label: "Revenue vs Traffic",
    description: "Stripe revenue correlated with GA4 sessions",
  },
  {
    key: "ad_efficiency",
    label: "Ad Efficiency",
    description: "Meta ad spend vs revenue generated (ROAS)",
  },
  {
    key: "customer_journey",
    label: "Customer Journey",
    description: "Traffic → Conversions → Transactions funnel",
  },
  {
    key: "profit_overview",
    label: "Profit Overview",
    description: "Revenue minus ad spend — net estimated profit",
  },
  {
    key: "engagement_quality",
    label: "Engagement Quality",
    description: "Bounce rate vs conversion rate vs CTR",
  },
  {
    key: "revenue_per_visitor",
    label: "Revenue / Visitor",
    description: "How much revenue each website visitor generates on average",
  },
  {
    key: "ad_spend_vs_clicks",
    label: "Spend vs Clicks",
    description: "Meta ad spend alongside click volume and CPC trend",
  },
  {
    key: "daily_transactions",
    label: "Daily Transactions",
    description: "Transaction count and average order value per day",
  },
  {
    key: "impressions_vs_sessions",
    label: "Reach vs Sessions",
    description: "Meta impressions vs GA4 sessions — paid reach that converts to organic traffic",
  },
  {
    key: "cac_trend",
    label: "CAC Trend",
    description: "Cost to acquire a customer over time — key for paid growth sustainability",
  },
  {
    key: "weekly_momentum",
    label: "Weekly Momentum",
    description: "7-day rolling revenue + sessions — spot growth or decline patterns",
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

// ── Custom Chart Builder types + catalog ──────────────────────────────────

type AggregationType = "sum" | "avg" | "latest";
type FormatType = "currency" | "number" | "percent";
type ChartSeriesType = "line" | "bar" | "area";

interface MetricDef {
  field: string;
  label: string;
  color: string;
  axis: "left" | "right";
  chartType: ChartSeriesType;
  formatType: FormatType;
  aggregation: AggregationType;
}

export interface SelectedMetric extends MetricDef {
  id: string;    // "<platform>:<field>"
  platform: string;
}

/** Ordered palette for custom metric assignment */
const CUSTOM_PALETTE = [
  "#635bff", "#00d4aa", "#f59e0b", "#f87171", "#34d399",
  "#60a5fa", "#a78bfa", "#fb923c", "#fbbf24", "#38bdf8",
];

/** Per-platform metric catalog — only fields that are actually synced */
const PLATFORM_METRICS: Record<string, MetricDef[]> = {
  stripe: [
    { field: "revenue",              label: "Revenue",          color: "#635bff", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum"    },
    { field: "mrr",                  label: "MRR",              color: "#a78bfa", axis: "left",  chartType: "line", formatType: "currency", aggregation: "latest" },
    { field: "txCount",              label: "Transactions",     color: "#34d399", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum"    },
    { field: "newCustomers",         label: "New Customers",    color: "#00d4aa", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum"    },
    { field: "refunds",              label: "Refunds",          color: "#f87171", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum"    },
    { field: "activeSubscriptions",  label: "Active Subs",      color: "#fbbf24", axis: "right", chartType: "line", formatType: "number",   aggregation: "latest" },
    { field: "trialingSubscriptions",label: "Trialing Subs",    color: "#38bdf8", axis: "right", chartType: "line", formatType: "number",   aggregation: "latest" },
    { field: "arpu",                 label: "ARPU",             color: "#e879f9", axis: "right", chartType: "line", formatType: "currency", aggregation: "latest" },
    { field: "churnedToday",         label: "Churn (daily)",    color: "#fb923c", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum"    },
  ],
  ga4: [
    { field: "sessions",    label: "Sessions",     color: "#f59e0b", axis: "left",  chartType: "area", formatType: "number",  aggregation: "sum" },
    { field: "users",       label: "Users",        color: "#00d4aa", axis: "left",  chartType: "line", formatType: "number",  aggregation: "sum" },
    { field: "conversions", label: "Conversions",  color: "#34d399", axis: "right", chartType: "bar",  formatType: "number",  aggregation: "sum" },
    { field: "pageviews",   label: "Pageviews",    color: "#60a5fa", axis: "left",  chartType: "area", formatType: "number",  aggregation: "sum" },
    { field: "bounceRate",  label: "Bounce Rate",  color: "#fb923c", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg" },
  ],
  plausible: [
    { field: "visitors",    label: "Visitors",    color: "#f59e0b", axis: "left",  chartType: "area", formatType: "number",  aggregation: "sum" },
    { field: "pageviews",   label: "Pageviews",   color: "#60a5fa", axis: "left",  chartType: "line", formatType: "number",  aggregation: "sum" },
    { field: "bounceRate",  label: "Bounce Rate", color: "#fb923c", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg" },
    { field: "sessions",    label: "Sessions",    color: "#fbbf24", axis: "left",  chartType: "area", formatType: "number",  aggregation: "sum" },
  ],
  meta: [
    { field: "spend",       label: "Ad Spend",     color: "#1877f2", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum" },
    { field: "clicks",      label: "Clicks",       color: "#60a5fa", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
    { field: "impressions", label: "Impressions",  color: "#a78bfa", axis: "right", chartType: "area", formatType: "number",   aggregation: "sum" },
    { field: "reach",       label: "Reach",        color: "#34d399", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
  ],
  "google-ads": [
    { field: "spend",       label: "Ad Spend",     color: "#34a853", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum" },
    { field: "clicks",      label: "Clicks",       color: "#4ade80", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
    { field: "impressions", label: "Impressions",  color: "#a78bfa", axis: "right", chartType: "area", formatType: "number",   aggregation: "sum" },
  ],
  "tiktok-ads": [
    { field: "spend",       label: "Ad Spend",     color: "#fe2c55", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum" },
    { field: "clicks",      label: "Clicks",       color: "#fb923c", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
    { field: "impressions", label: "Impressions",  color: "#a78bfa", axis: "right", chartType: "area", formatType: "number",   aggregation: "sum" },
  ],
  "twitter-ads": [
    { field: "spend",       label: "Ad Spend",     color: "#1d9bf0", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum" },
    { field: "clicks",      label: "Clicks",       color: "#60a5fa", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
  ],
  "linkedin-ads": [
    { field: "spend",       label: "Ad Spend",     color: "#0077b5", axis: "left",  chartType: "bar",  formatType: "currency", aggregation: "sum" },
    { field: "clicks",      label: "Clicks",       color: "#38bdf8", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum" },
  ],
  mailchimp: [
    { field: "subscriberCount", label: "Subscribers",  color: "#f59e0b", axis: "left",  chartType: "area", formatType: "number",  aggregation: "latest" },
    { field: "openRate",        label: "Open Rate",    color: "#34d399", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
    { field: "clickRate",       label: "Click Rate",   color: "#60a5fa", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
  ],
  klaviyo: [
    { field: "subscriberCount", label: "Subscribers",  color: "#00d4aa", axis: "left",  chartType: "area", formatType: "number",  aggregation: "latest" },
    { field: "openRate",        label: "Open Rate",    color: "#34d399", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
    { field: "clickRate",       label: "Click Rate",   color: "#60a5fa", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
  ],
  beehiiv: [
    { field: "subscriberCount", label: "Subscribers",  color: "#635bff", axis: "left",  chartType: "area", formatType: "number",  aggregation: "latest" },
    { field: "openRate",        label: "Open Rate",    color: "#34d399", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
  ],
  convertkit: [
    { field: "subscriberCount", label: "Subscribers",  color: "#f59e0b", axis: "left",  chartType: "area", formatType: "number",  aggregation: "latest" },
    { field: "openRate",        label: "Open Rate",    color: "#34d399", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
  ],
  activecampaign: [
    { field: "subscriberCount", label: "Subscribers",  color: "#1d6ae5", axis: "left",  chartType: "area", formatType: "number",  aggregation: "latest" },
    { field: "openRate",        label: "Open Rate",    color: "#34d399", axis: "right", chartType: "line", formatType: "percent", aggregation: "avg"    },
  ],
  shopify: [
    { field: "revenue",      label: "Revenue",        color: "#5da832", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum"    },
    { field: "orders",       label: "Orders",         color: "#34d399", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum"    },
    { field: "newCustomers", label: "New Customers",  color: "#00d4aa", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum"    },
    { field: "sessions",     label: "Store Sessions", color: "#f59e0b", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum"    },
  ],
  woocommerce: [
    { field: "revenue",      label: "Revenue",        color: "#9b59b6", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum"    },
    { field: "orders",       label: "Orders",         color: "#a78bfa", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum"    },
    { field: "newCustomers", label: "New Customers",  color: "#34d399", axis: "right", chartType: "line", formatType: "number",   aggregation: "sum"    },
  ],
  "lemon-squeezy": [
    { field: "revenue",  label: "Revenue",      color: "#fbbf24", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum" },
    { field: "txCount",  label: "Transactions", color: "#f59e0b", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum" },
    { field: "mrr",      label: "MRR",          color: "#a78bfa", axis: "left",  chartType: "line", formatType: "currency", aggregation: "latest" },
  ],
  gumroad: [
    { field: "revenue", label: "Revenue", color: "#f87171", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum" },
    { field: "sales",   label: "Sales",   color: "#fb923c", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum" },
  ],
  paddle: [
    { field: "revenue",  label: "Revenue",      color: "#38bdf8", axis: "left",  chartType: "area", formatType: "currency", aggregation: "sum"    },
    { field: "txCount",  label: "Transactions", color: "#60a5fa", axis: "right", chartType: "bar",  formatType: "number",   aggregation: "sum"    },
    { field: "mrr",      label: "MRR",          color: "#a78bfa", axis: "left",  chartType: "line", formatType: "currency", aggregation: "latest" },
  ],
};

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  stripe: "Stripe", ga4: "Google Analytics", plausible: "Plausible", meta: "Meta Ads",
  "google-ads": "Google Ads", "tiktok-ads": "TikTok Ads", "twitter-ads": "X Ads",
  "linkedin-ads": "LinkedIn Ads", mailchimp: "Mailchimp", klaviyo: "Klaviyo",
  beehiiv: "Beehiiv", convertkit: "ConvertKit", activecampaign: "ActiveCampaign",
  shopify: "Shopify", woocommerce: "WooCommerce", "lemon-squeezy": "Lemon Squeezy",
  gumroad: "Gumroad", paddle: "Paddle",
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
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border bg-[#222235] p-4 flex gap-3"
      style={{ borderColor: `${accent}30` }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
        style={{ backgroundColor: `${accent}15` }}
      >
        {icon}
      </div>
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

// ── Custom chart builder ──────────────────────────────────────────────────

function buildCustomChartData(
  snapshots: Snapshot[],
  metrics: SelectedMetric[],
  granularity: Granularity,
): {
  data: Record<string, string | number>[];
  lines: { key: string; color: string; label: string; yAxisId: string; type: "line" | "bar" | "area" }[];
} {
  if (metrics.length === 0) return { data: [], lines: [] };

  // Bucket by period
  const byPeriod: Record<string, Record<string, { sum: number; vals: number[]; last: number }>> = {};
  for (const snap of snapshots) {
    const relevantMetrics = metrics.filter((m) => m.platform === snap.provider);
    if (!relevantMetrics.length) continue;
    const pk = getPeriodKey(snap.date, granularity);
    if (!byPeriod[pk]) byPeriod[pk] = {};
    const d = snap.data as Record<string, number>;
    for (const m of relevantMetrics) {
      const raw = d[m.field] ?? 0;
      if (!byPeriod[pk][m.id]) byPeriod[pk][m.id] = { sum: 0, vals: [], last: 0 };
      byPeriod[pk][m.id].sum += raw;
      byPeriod[pk][m.id].vals.push(raw);
      byPeriod[pk][m.id].last = raw;
    }
  }

  const periods = Object.keys(byPeriod).sort();
  const data = periods.map((pk) => {
    const row: Record<string, string | number> = { date: fmtPeriodKey(pk, granularity) };
    for (const m of metrics) {
      const b = byPeriod[pk]?.[m.id];
      if (!b) { row[m.id] = 0; continue; }
      let val = 0;
      if (m.aggregation === "sum") {
        val = b.sum;
        if (m.formatType === "currency") val = val / 100; // stored in cents
      } else if (m.aggregation === "avg") {
        val = b.vals.length ? b.vals.reduce((a, v) => a + v, 0) / b.vals.length : 0;
      } else {
        // latest
        val = b.last;
        if (m.formatType === "currency") val = val / 100;
      }
      row[m.id] = parseFloat(val.toFixed(3));
    }
    return row;
  });

  const lines = metrics.map((m) => ({
    key: m.id,
    color: m.color,
    label: m.label,
    yAxisId: m.axis,
    type: m.chartType,
  }));

  return { data, lines };
}

// ── Generate insights ─────────────────────────────────────────────────────

function generateInsights(
  snapshots: Snapshot[],
  report: ReportType,
  connectedPlatforms: string[],
  adCurrency = "USD",
  revCurrency = "USD",
  sameCurrencyGlobal = true,
): { icon: React.ReactNode; title: string; body: string; accent: string }[] {
  const insights: { icon: React.ReactNode; title: string; body: string; accent: string }[] = [];

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
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.revenue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ),
      title: `Revenue: ${fmtCurrency(revenueUSD, revCurrency)}`,
      body: `Average order value is ${fmtCurrency(aov, revCurrency)}. ${totalTx} total transactions in this period.`,
      accent: COLORS.revenue,
    });
  }

  if (hasAds && totalSpend > 0) {
    if (sameCurrencyGlobal && roas !== null) {
      insights.push({
        icon: roas >= 3 ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.profit} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
        ) : roas >= 1 ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.roas} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.spend} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        ),
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
        icon: (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.spend} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        ),
        title: `Ad Spend: ${fmtCurrency(totalSpend, adCurrency)}`,
        body: `ROAS and profit calculations are unavailable — ad spend is in ${adCurrency} while ${primaryRevPlatform} revenue is in ${revCurrency}. Connect platforms sharing the same currency for cross-platform metrics.`,
        accent: COLORS.spend,
      });
    }
  }

  if (hasAds && hasRevenue && sameCurrencyGlobal && profit !== null) {
    insights.push({
      icon: profit >= 0 ? (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.profit} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.spend} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      ),
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
      icon: convRate >= 3 ? (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.convRate} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      ) : convRate >= 1 ? (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.sessions} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="10" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="12" rx="1"/><rect x="18" y="3" width="4" height="15" rx="1"/>
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.bounceRate} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
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
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={avgBounce < 40 ? COLORS.profit : avgBounce < 70 ? COLORS.roas : COLORS.spend} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {avgBounce < 40
            ? <><circle cx="12" cy="12" r="10"/><polyline points="9 11 12 14 22 4"/></>
            : avgBounce < 70
            ? <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
            : <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
          }
        </svg>
      ),
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
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.clicks} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      title: `CAC: ${fmtCurrency(cac, adCurrency)} per conversion`,
      body: `You're spending ${fmtCurrency(cac, adCurrency)} in ads to acquire each conversion. CTR is ${ctr.toFixed(2)}%.`,
      accent: COLORS.clicks,
    });
  }

  if (report === "business_growth" && connectedPlatforms.length >= 2) {
    insights.push({
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={COLORS.users} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
          <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
        </svg>
      ),
      title: "Cross-platform health",
      body: `${connectedPlatforms.length} platforms connected. Tracking ${fmtNum(totalSessions)} sessions, ${fmtCurrency(revenueUSD, revCurrency)} revenue, and ${fmtCurrency(totalSpend, adCurrency)} ad spend in parallel.`,
      accent: COLORS.users,
    });
  }

  return insights.slice(0, 4);
}

// ── Growth Pulse Chart ────────────────────────────────────────────────────

/** Computes rolling N-day sums for a given field+provider combo */
function rollingSum(snapshots: Snapshot[], provider: string, field: string, window = 7): { date: string; value: number }[] {
  const dayMap: Record<string, number> = {};
  for (const s of snapshots) {
    if (s.provider !== provider) continue;
    const v = (s.data as Record<string, number>)[field] ?? 0;
    dayMap[s.date] = (dayMap[s.date] ?? 0) + v;
  }
  const sorted = Object.keys(dayMap).sort();
  return sorted.map((date, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = sorted.slice(start, i + 1);
    const sum = slice.reduce((a, d) => a + (dayMap[d] ?? 0), 0);
    return { date, value: sum };
  });
}

type GrowthPulseSeries = "revenue" | "sessions" | "subscribers" | "adspend";

const PULSE_SERIES_META: Record<GrowthPulseSeries, { label: string; color: string; icon: React.ReactNode }> = {
  revenue: {
    label: "Revenue (7d roll.)", color: "#635bff",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#635bff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  sessions: {
    label: "Sessions (7d roll.)", color: "#f59e0b",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  subscribers: {
    label: "Subscribers (7d roll.)", color: "#00d4aa",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  adspend: {
    label: "Ad Spend (7d roll.)", color: "#f87171",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
};

function GrowthPulseChart({
  snapshots,
  connectedPlatforms,
  currencies = {},
}: {
  snapshots: Snapshot[];
  connectedPlatforms: string[];
  currencies?: Record<string, string>;
}) {
  // Detect which series are available
  const REVENUE_PROVIDERS = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
  const ANALYTICS_PROVIDERS = ["ga4", "plausible"];
  const EMAIL_PROVIDERS = ["mailchimp", "klaviyo", "beehiiv", "convertkit", "activecampaign"];
  const ADS_PROVIDERS = ["meta", "google-ads", "tiktok-ads", "twitter-ads", "linkedin-ads"];

  const primaryRev = REVENUE_PROVIDERS.find((p) => connectedPlatforms.includes(p));
  const primaryAnalytics = ANALYTICS_PROVIDERS.find((p) => connectedPlatforms.includes(p));
  const primaryEmail = EMAIL_PROVIDERS.find((p) => connectedPlatforms.includes(p));
  const primaryAds = ADS_PROVIDERS.find((p) => connectedPlatforms.includes(p));

  const available: GrowthPulseSeries[] = [];
  if (primaryRev) available.push("revenue");
  if (primaryAnalytics) available.push("sessions");
  if (primaryEmail) available.push("subscribers");
  if (primaryAds) available.push("adspend");

  const [enabledSeries, setEnabledSeries] = useState<GrowthPulseSeries[]>(() => {
    if (typeof window === "undefined") return available.slice(0, 2);
    try {
      const saved = localStorage.getItem("growth_pulse_series");
      if (saved) {
        const parsed = JSON.parse(saved) as GrowthPulseSeries[];
        return parsed.filter((s) => available.includes(s));
      }
    } catch { /* ignore */ }
    return available.slice(0, 2);
  });

  // Persist enabled series
  useEffect(() => {
    localStorage.setItem("growth_pulse_series", JSON.stringify(enabledSeries));
  }, [enabledSeries]);

  function toggleSeries(s: GrowthPulseSeries) {
    setEnabledSeries((prev) =>
      prev.includes(s)
        ? prev.length > 1 ? prev.filter((x) => x !== s) : prev // keep at least 1
        : [...prev, s]
    );
  }

  // Build chart data
  const chartData = useMemo(() => {
    // Collect all dates from relevant providers
    const dateSet = new Set<string>();
    for (const s of snapshots) dateSet.add(s.date);
    const dates = Array.from(dateSet).sort();
    if (dates.length === 0) return [];

    // Per-day raw buckets
    const revByDay: Record<string, number> = {};
    const sessByDay: Record<string, number> = {};
    const subsByDay: Record<string, number> = {};
    const adsByDay: Record<string, number> = {};

    for (const s of snapshots) {
      const d = s.data as Record<string, number>;
      if (primaryRev && s.provider === primaryRev) {
        // revenue stored in cents → convert
        revByDay[s.date] = (revByDay[s.date] ?? 0) + (d.revenue ?? 0) / 100;
      }
      if (primaryAnalytics && s.provider === primaryAnalytics) {
        sessByDay[s.date] = (sessByDay[s.date] ?? 0) + (d.sessions ?? d.visitors ?? 0);
      }
      if (primaryEmail && s.provider === primaryEmail) {
        // subscriber count is point-in-time — use last value for each day
        subsByDay[s.date] = d.subscriberCount ?? subsByDay[s.date] ?? 0;
      }
      if (primaryAds && s.provider === primaryAds) {
        adsByDay[s.date] = (adsByDay[s.date] ?? 0) + (d.spend ?? 0);
      }
    }

    // Build rolling 7d sums + WoW delta
    const rows = dates.map((date, i) => {
      const windowStart = Math.max(0, i - 6);
      const window = dates.slice(windowStart, i + 1);

      const revRolling = window.reduce((a, d) => a + (revByDay[d] ?? 0), 0);
      const sessRolling = window.reduce((a, d) => a + (sessByDay[d] ?? 0), 0);
      const subsVal = subsByDay[date] ?? 0; // subscribers: point-in-time
      const adsRolling = window.reduce((a, d) => a + (adsByDay[d] ?? 0), 0);

      // WoW delta for revenue (compare current 7d window vs prior 7d window)
      const priorStart = Math.max(0, i - 13);
      const priorWindow = dates.slice(priorStart, Math.max(0, i - 6));
      const priorRev = priorWindow.reduce((a, d) => a + (revByDay[d] ?? 0), 0);
      const wowRevDelta = priorRev > 0 ? ((revRolling - priorRev) / priorRev) * 100 : 0;

      const label = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: "UTC",
      });

      return {
        date: label,
        revenue: parseFloat(revRolling.toFixed(2)),
        sessions: sessRolling,
        subscribers: subsVal,
        adspend: parseFloat(adsRolling.toFixed(2)),
        wowDelta: parseFloat(wowRevDelta.toFixed(1)),
      };
    });

    // Only return last 60 days for performance
    return rows.slice(-60);
  }, [snapshots, primaryRev, primaryAnalytics, primaryEmail, primaryAds]);

  if (available.length === 0 || chartData.length < 3) return null;

  const revCurrency = primaryRev ? (currencies[primaryRev] ?? "USD") : "USD";
  const adCurrency = primaryAds ? (currencies[primaryAds] ?? "USD") : "USD";

  function formatPulseValue(key: GrowthPulseSeries, v: number): string {
    if (key === "revenue") return new Intl.NumberFormat("en-US", { style: "currency", currency: revCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    if (key === "adspend") return new Intl.NumberFormat("en-US", { style: "currency", currency: adCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v.toLocaleString();
  }

  // Latest + prev values for KPI chips
  const latest = chartData[chartData.length - 1];
  const prev7 = chartData.length >= 8 ? chartData[chartData.length - 8] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function PulseTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-[#363650] bg-[#1c1c2a]/95 px-4 py-3 shadow-2xl backdrop-blur-sm min-w-36">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any) => {
          if (entry.dataKey === "wowDelta") return null;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="font-mono text-[10px] text-[#bcbcd8]">{entry.name}:</span>
              <span className="font-mono text-[10px] font-bold text-[#f8f8fc]">
                {typeof entry.value === "number" ? formatPulseValue(entry.dataKey as GrowthPulseSeries, entry.value) : entry.value}
              </span>
            </div>
          );
        })}
        {payload.find((e: { dataKey: string }) => e.dataKey === "wowDelta") && (
          <div className="mt-1.5 border-t border-[#363650] pt-1.5">
            <span className="font-mono text-[10px]" style={{ color: payload.find((e: { dataKey: string }) => e.dataKey === "wowDelta")?.value >= 0 ? "#00d4aa" : "#f87171" }}>
              WoW: {payload.find((e: { dataKey: string }) => e.dataKey === "wowDelta")?.value >= 0 ? "+" : ""}{payload.find((e: { dataKey: string }) => e.dataKey === "wowDelta")?.value}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#222235] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Growth Pulse</h3>
            <p className="font-mono text-[10px] text-[#8585aa]">7-day rolling totals · WoW revenue delta bars</p>
          </div>
        </div>
        {/* Series toggles */}
        <div className="flex flex-wrap gap-2">
          {available.map((s) => {
            const meta = PULSE_SERIES_META[s];
            const enabled = enabledSeries.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSeries(s)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${
                  enabled
                    ? "border-[#363650] text-[#f8f8fc]"
                    : "border-[#363650]/50 text-[#58588a] opacity-50"
                }`}
                style={enabled ? { borderColor: meta.color + "50", backgroundColor: meta.color + "12", color: meta.color } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: enabled ? meta.color : "#363650" }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI chips */}
      {latest && (
        <div className="flex flex-wrap gap-3">
          {enabledSeries.filter((s) => available.includes(s)).map((s) => {
            const meta = PULSE_SERIES_META[s];
            const curr = latest[s] as number;
            const prevVal = prev7 ? (prev7[s] as number) : null;
            const delta = prevVal && prevVal > 0 ? ((curr - prevVal) / prevVal) * 100 : null;
            return (
              <div
                key={s}
                className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                style={{ borderColor: meta.color + "30", backgroundColor: meta.color + "08" }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: meta.color + "15" }}
                >
                  {meta.icon}
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{meta.label.replace(" (7d roll.)", "")}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm font-bold" style={{ color: meta.color }}>
                      {formatPulseValue(s, curr)}
                    </p>
                    {delta !== null && (
                      <span className={`font-mono text-[9px] font-bold ${delta >= 0 ? "text-[#00d4aa]" : "text-red-400"}`}>
                        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {enabledSeries.map((s) => (
              <linearGradient key={s} id={`pulse-grad-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PULSE_SERIES_META[s].color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={PULSE_SERIES_META[s].color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#363650" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#8585aa", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: "#363650" }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fill: "#8585aa", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={50} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#8585aa", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={50} />
          <Tooltip content={<PulseTooltip />} />
          {/* WoW delta bars (right axis, always shown) */}
          {primaryRev && (
            <Bar
              dataKey="wowDelta"
              yAxisId="right"
              name="WoW %"
              fill="#363650"
              opacity={0}
              // Use custom cell coloring via a Cell workaround — we render this as a transparent bar
              // The actual delta tooltip value is shown via tooltip
            />
          )}
          {enabledSeries.filter((s) => available.includes(s)).map((s, idx) => (
            <Area
              key={s}
              dataKey={s}
              name={PULSE_SERIES_META[s].label}
              stroke={PULSE_SERIES_META[s].color}
              fill={`url(#pulse-grad-${s})`}
              strokeWidth={idx === 0 ? 2.5 : 1.5}
              yAxisId="left"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
          <Brush dataKey="date" height={18} stroke="#363650" fill="#13131f" travellerWidth={5} startIndex={Math.max(0, chartData.length - 30)} tickFormatter={() => ""} />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="font-mono text-[9px] text-[#58588a]">
        Rolling 7-day window totals. Toggle series above. Drag brush to zoom.
        {primaryRev && ` Revenue source: ${PLATFORM_DISPLAY_NAMES[primaryRev] ?? primaryRev}.`}
        {primaryAnalytics && ` Analytics source: ${PLATFORM_DISPLAY_NAMES[primaryAnalytics] ?? primaryAnalytics}.`}
      </p>
    </div>
  );
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
  const [report, setReport] = useState<ReportType>(() => {
    if (typeof window === "undefined") return "business_growth";
    return (localStorage.getItem("overview_report") as ReportType | null) ?? "business_growth";
  });

  // Custom builder — selected metrics, persisted
  const [customMetrics, setCustomMetrics] = useState<SelectedMetric[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("overview_customMetrics");
      return saved ? (JSON.parse(saved) as SelectedMetric[]) : [];
    } catch { return []; }
  });
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  // Persist report choice
  useEffect(() => {
    localStorage.setItem("overview_report", report);
  }, [report]);

  // Persist custom metrics
  useEffect(() => {
    localStorage.setItem("overview_customMetrics", JSON.stringify(customMetrics));
  }, [customMetrics]);

  // Use external time range if provided, otherwise internal
  const timeRange = externalTimeRange ?? internalTimeRange;

  const filtered = useMemo(
    () => filterByRange(snapshots, timeRange),
    [snapshots, timeRange]
  );

  // Expose timeRange setter for external sync (unused here but keeps interface stable)

  const { data: chartData, lines, currencyMismatch, primaryKey } = useMemo(() => {
    if (report === "custom") {
      const { data, lines: customLines } = buildCustomChartData(filtered, customMetrics, granularity);
      return { data, lines: customLines, currencyMismatch: false, primaryKey: customLines[0]?.key ?? "" };
    }
    return buildChartData(filtered, report, granularity, adCurrency, snapshots, revCurrency, sameCurrencyGlobal);
  }, [filtered, report, granularity, adCurrency, snapshots, revCurrency, sameCurrencyGlobal, customMetrics]);

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

  // ── Custom builder helpers ──────────────────────────────────────────────
  const availableForCustom = Object.keys(PLATFORM_METRICS).filter((p) =>
    connectedPlatforms.includes(p)
  );

  function addMetric(platform: string, def: MetricDef) {
    const id = `${platform}:${def.field}`;
    if (customMetrics.some((m) => m.id === id)) return; // already selected
    if (customMetrics.length >= 6) return; // max 6 series
    const paletteColor = CUSTOM_PALETTE[customMetrics.length % CUSTOM_PALETTE.length];
    const newMetric: SelectedMetric = {
      ...def,
      id,
      platform,
      color: paletteColor, // override with palette color for visual distinction
    };
    setCustomMetrics((prev) => [...prev, newMetric]);
  }

  function removeMetric(id: string) {
    setCustomMetrics((prev) => prev.filter((m) => m.id !== id));
  }

  function updateMetricAxis(id: string, axis: "left" | "right") {
    setCustomMetrics((prev) => prev.map((m) => m.id === id ? { ...m, axis } : m));
  }

  function updateMetricChartType(id: string, chartType: ChartSeriesType) {
    setCustomMetrics((prev) => prev.map((m) => m.id === id ? { ...m, chartType } : m));
  }

  function updateMetricColor(id: string, color: string) {
    setCustomMetrics((prev) => prev.map((m) => m.id === id ? { ...m, color } : m));
  }

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
      <div className="rounded-2xl border border-[#363650] bg-[#222235] overflow-hidden">

        {/* ── Report Selector Header ──────────────────────────── */}
        <div className="border-b border-[#363650] bg-[#1c1c2a]/60 px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#635bff]/15">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#635bff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#f8f8fc]">Chart View</span>
              {popChange && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${popChange.up ? "bg-[#00d4aa]/12 text-[#00d4aa]" : "bg-red-400/12 text-red-400"}`}>
                  {popChange.up ? "▲" : "▼"} {popChange.pct}% vs prior period
                </span>
              )}
            </div>
            {/* Time range — hidden when parent controls it */}
            {!externalTimeRange && (
              <div className="flex gap-0.5 rounded-lg border border-[#363650] bg-[#13131f] p-0.5">
                {TIME_RANGES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setInternalTimeRange(t.key)}
                    className={`rounded-md px-3 py-1 font-mono text-[10px] font-semibold transition-all ${
                      timeRange === t.key
                        ? "bg-[#363650] text-[#f8f8fc]"
                        : "text-[#8585aa] hover:text-[#bcbcd8]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Report type tab strip + Custom Builder button */}
          <div className="flex items-stretch gap-0">
            <div className="flex-1 flex gap-0 overflow-x-auto scrollbar-none pb-0 min-w-0">
              {REPORT_TYPES.map((r) => {
                const isActive = report === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => setReport(r.key as ReportType)}
                    title={r.description}
                    className={`relative shrink-0 flex items-center gap-2 px-4 py-3 font-mono text-[11px] font-semibold transition-all border-b-2 -mb-px whitespace-nowrap ${
                      isActive
                        ? "border-[#635bff] text-[#f8f8fc]"
                        : "border-transparent text-[#8585aa] hover:text-[#bcbcd8] hover:border-[#363650]"
                    }`}
                  >
                    <span className={`shrink-0 transition-colors ${isActive ? "text-[#635bff]" : "text-[#58588a]"}`}>
                      {REPORT_ICONS[r.key]}
                    </span>
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Builder — separate button on the right */}
            <div className="shrink-0 flex items-center px-3 border-l border-[#363650]/60 border-b-2 border-b-transparent -mb-px">
              <button
                onClick={() => {
                  setReport("custom" as ReportType);
                  setShowCustomBuilder(true);
                }}
                title="Build a custom chart from your connected integrations"
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-semibold transition-all ${
                  report === "custom"
                    ? "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]"
                    : "border-[#363650] text-[#8585aa] hover:text-[#bcbcd8] hover:border-[#454560] hover:bg-[#222235]"
                }`}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                </svg>
                <span>Custom</span>
                {customMetrics.length > 0 && (
                  <span className={`rounded-full px-1.5 py-px font-mono text-[8px] font-bold ${report === "custom" ? "bg-[#f59e0b]/20 text-[#f59e0b]" : "bg-[#363650] text-[#8585aa]"}`}>
                    {customMetrics.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Report description bar ──────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#363650]/60 bg-[#1c1c2a]/30">
          <p className="font-mono text-[10px] text-[#8585aa] flex-1">
            {report === "custom"
              ? "Pick any metrics from your connected integrations and combine them freely"
              : REPORT_TYPES.find((r) => r.key === report)?.description}
          </p>
        </div>

        {/* ── Custom Builder Panel ──────────────────────────── */}
        {report === "custom" && (
          <div className="border-b border-[#363650] bg-[#13131f]/60">
            {/* Builder toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#363650]/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f59e0b]/15">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#f8f8fc]">Build your chart</span>
                <span className="font-mono text-[9px] text-[#58588a]">
                  {customMetrics.length === 0 ? "Pick metrics below" : `${customMetrics.length}/6 series selected`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {customMetrics.length > 0 && (
                  <button
                    onClick={() => setCustomMetrics([])}
                    className="font-mono text-[9px] text-[#8585aa] hover:text-red-400 transition flex items-center gap-1"
                  >
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                    </svg>
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowCustomBuilder((v) => !v)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-all ${
                    showCustomBuilder
                      ? "border-[#f59e0b]/30 bg-[#f59e0b]/8 text-[#f59e0b]"
                      : "border-[#363650] text-[#8585aa] hover:text-[#bcbcd8]"
                  }`}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {showCustomBuilder
                      ? <path d="M18 15l-6-6-6 6"/>
                      : <path d="M6 9l6 6 6-6"/>}
                  </svg>
                  {showCustomBuilder ? "Hide picker" : "Add metrics"}
                </button>
              </div>
            </div>

            {/* Two-column layout: picker + selected */}
            <div className={`grid transition-all ${showCustomBuilder ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} overflow-hidden`}>
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#363650]/50">

                  {/* Left: metric picker by platform */}
                  <div className="p-5 space-y-4 max-h-72 overflow-y-auto scrollbar-none">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] sticky top-0 bg-[#13131f]/80 backdrop-blur-sm py-1">
                      Available metrics · {availableForCustom.length} platform{availableForCustom.length !== 1 ? "s" : ""}
                    </p>
                    {availableForCustom.length === 0 ? (
                      <p className="font-mono text-[11px] text-[#58588a]">No supported integrations connected yet.</p>
                    ) : (
                      availableForCustom.map((platform) => {
                        const defs = PLATFORM_METRICS[platform] ?? [];
                        return (
                          <div key={platform} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#8585aa]">
                                {PLATFORM_DISPLAY_NAMES[platform] ?? platform}
                              </span>
                              <div className="flex-1 h-px bg-[#363650]/60" />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {defs.map((def) => {
                                const id = `${platform}:${def.field}`;
                                const isSelected = customMetrics.some((m) => m.id === id);
                                const atMax = customMetrics.length >= 6 && !isSelected;
                                return (
                                  <button
                                    key={id}
                                    onClick={() => isSelected ? removeMetric(id) : addMetric(platform, def)}
                                    disabled={atMax}
                                    className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[10px] text-left transition-all group ${
                                      isSelected
                                        ? "border-[#00d4aa]/30 bg-[#00d4aa]/8 text-[#00d4aa]"
                                        : atMax
                                        ? "border-[#363650]/30 text-[#58588a] opacity-40 cursor-not-allowed"
                                        : "border-[#363650]/60 text-[#bcbcd8] hover:border-[#454560] hover:bg-[#222235] hover:text-[#f8f8fc]"
                                    }`}
                                  >
                                    {/* Color swatch */}
                                    <span className="h-2 w-2 rounded-full shrink-0 flex-none" style={{ backgroundColor: isSelected ? "#00d4aa" : def.color }} />
                                    <span className="flex-1 min-w-0 truncate">{def.label}</span>
                                    <span className="shrink-0 font-mono text-[8px] opacity-60">
                                      {def.formatType === "currency" ? "$" : def.formatType === "percent" ? "%" : "#"}
                                    </span>
                                    {isSelected && (
                                      <span className="shrink-0">
                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {customMetrics.length >= 6 && (
                      <div className="sticky bottom-0 bg-[#13131f]/90 backdrop-blur-sm py-1">
                        <p className="font-mono text-[9px] text-[#f59e0b]">⚠ Max 6 series. Remove one to add another.</p>
                      </div>
                    )}
                  </div>

                  {/* Right: selected series controls */}
                  <div className="p-5">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Selected series</p>
                    {customMetrics.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-[#363650]/60 gap-2">
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#363650" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <p className="font-mono text-[10px] text-[#58588a]">Select metrics from the left</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customMetrics.map((m, idx) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all"
                            style={{ borderColor: m.color + "30", backgroundColor: m.color + "08" }}
                          >
                            {/* Color dot + index */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[9px] text-[#58588a] w-3">{idx + 1}</span>
                              <div
                                className="h-3 w-3 rounded-full ring-2 ring-[#13131f] shrink-0"
                                style={{ backgroundColor: m.color }}
                              />
                            </div>

                            {/* Label + platform */}
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-[11px] font-semibold text-[#f8f8fc] truncate">{m.label}</p>
                              <p className="font-mono text-[9px] text-[#8585aa]">{PLATFORM_DISPLAY_NAMES[m.platform] ?? m.platform}</p>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Chart type icon buttons */}
                              <div className="flex gap-0.5 rounded-md border border-[#363650] overflow-hidden">
                                {(["line", "area", "bar"] as ChartSeriesType[]).map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => updateMetricChartType(m.id, t)}
                                    title={t}
                                    className={`px-1.5 py-1 transition-all ${m.chartType === t ? "bg-[#363650] text-[#f8f8fc]" : "text-[#58588a] hover:text-[#bcbcd8]"}`}
                                  >
                                    {t === "line"
                                      ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 12l5-5 4 4 6-6"/></svg>
                                      : t === "area"
                                      ? <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M3 18l4-8 5 5 4-7 5 4V18H3z" opacity={0.7}/></svg>
                                      : <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="10" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="12" rx="1"/><rect x="18" y="3" width="4" height="15" rx="1"/></svg>
                                    }
                                  </button>
                                ))}
                              </div>

                              {/* Axis toggle */}
                              <button
                                onClick={() => updateMetricAxis(m.id, m.axis === "left" ? "right" : "left")}
                                className="flex items-center gap-0.5 rounded-md border border-[#363650] px-1.5 py-1 font-mono text-[9px] text-[#8585aa] hover:text-[#bcbcd8] hover:border-[#454560] transition-all"
                                title="Toggle Y axis"
                              >
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  {m.axis === "left"
                                    ? <><path d="M3 3v18"/><path d="M7 7H3m4 5H3m4 5H3"/></>
                                    : <><path d="M21 3v18"/><path d="M17 7h4m-4 5h4m-4 5h4"/></>}
                                </svg>
                                {m.axis}
                              </button>

                              {/* Color swatches */}
                              <div className="flex gap-0.5">
                                {CUSTOM_PALETTE.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => updateMetricColor(m.id, c)}
                                    className="h-4 w-4 rounded-full transition-transform hover:scale-110"
                                    style={{
                                      backgroundColor: c,
                                      outline: m.color === c ? `2px solid ${c}` : "none",
                                      outlineOffset: "2px",
                                    }}
                                  />
                                ))}
                              </div>

                              {/* Remove */}
                              <button
                                onClick={() => removeMetric(m.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[#8585aa] hover:text-red-400 hover:bg-red-400/10 transition-all ml-0.5"
                              >
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected metrics summary bar (always visible when custom mode) */}
            {customMetrics.length > 0 && !showCustomBuilder && (
              <div className="flex items-center gap-2 px-6 py-2.5 flex-wrap">
                {customMetrics.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]"
                    style={{ borderColor: m.color + "40", backgroundColor: m.color + "10", color: m.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span>{m.label}</span>
                    <button onClick={() => removeMetric(m.id)} className="opacity-50 hover:opacity-100 transition ml-0.5">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-6">
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
        </div>{/* /p-6 */}
      </div>

      {/* ── Full Funnel ──────────────────────────────────────── */}
      <FunnelSection snapshots={filtered} connectedPlatforms={connectedPlatforms} currencies={currencies} />

      {/* ── Growth Pulse ─────────────────────────────────────── */}
      <GrowthPulseChart snapshots={filtered} connectedPlatforms={connectedPlatforms} currencies={currencies} />

      {/* ── Revenue Attribution / CAC per Channel ───────────────── */}
      <RevenueAttributionSection snapshots={filtered} connectedPlatforms={connectedPlatforms} currencies={currencies} />

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

// ── Revenue Attribution / CAC per Channel ────────────────────────────────

const ADS_PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: "meta",         label: "Meta Ads",      color: "#1877f2" },
  { key: "google-ads",   label: "Google Ads",    color: "#34a853" },
  { key: "tiktok-ads",   label: "TikTok Ads",    color: "#fe2c55" },
  { key: "twitter-ads",  label: "X Ads",         color: "#1d9bf0" },
  { key: "linkedin-ads", label: "LinkedIn Ads",  color: "#0077b5" },
  { key: "snapchat-ads", label: "Snapchat Ads",  color: "#fffc00" },
  { key: "pinterest-ads",label: "Pinterest Ads", color: "#e60023" },
];

const REVENUE_PLATFORMS_ATTR = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];

function RevenueAttributionSection({
  snapshots,
  connectedPlatforms,
  currencies = {},
}: {
  snapshots: Snapshot[];
  connectedPlatforms: string[];
  currencies?: Record<string, string>;
}) {
  const connectedAds = ADS_PLATFORMS.filter((p) => connectedPlatforms.includes(p.key));
  const hasRevenue = REVENUE_PLATFORMS_ATTR.some((p) => connectedPlatforms.includes(p));

  if (connectedAds.length === 0 || !hasRevenue) return null;

  // Total new customers across all revenue platforms
  const totalNewCustomers = snapshots
    .filter((s) => REVENUE_PLATFORMS_ATTR.includes(s.provider))
    .reduce((a, s) => a + (((s.data as Record<string, number>).newCustomers) ?? 0), 0);

  // Total revenue
  const totalRevenue = snapshots
    .filter((s) => REVENUE_PLATFORMS_ATTR.includes(s.provider))
    .reduce((a, s) => a + (((s.data as Record<string, number>).revenue) ?? 0), 0);
  const totalRevenueUSD = totalRevenue / 100;

  // Per-channel metrics
  type ChannelRow = {
    key: string;
    label: string;
    color: string;
    spend: number;
    clicks: number;
    impressions: number;
    currency: string;
    cac: number | null;
    roas: number | null;
    cpc: number | null;
    ctr: number | null;
    sharePct: number;
  };

  // Aggregate total spend across all ad platforms for share calculation
  let totalSpendAll = 0;

  const channels: ChannelRow[] = connectedAds.map((adPlatform) => {
    const adSnaps = snapshots.filter((s) => s.provider === adPlatform.key);
    const spend = adSnaps.reduce((a, s) => a + (((s.data as Record<string, number>).spend) ?? 0), 0);
    const clicks = adSnaps.reduce((a, s) => a + (((s.data as Record<string, number>).clicks) ?? 0), 0);
    const impressions = adSnaps.reduce((a, s) => a + (((s.data as Record<string, number>).impressions) ?? 0), 0);
    totalSpendAll += spend;

    const currency = currencies[adPlatform.key] ?? "USD";
    // Same-currency check for this channel vs revenue
    const primaryRevCurrency = (REVENUE_PLATFORMS_ATTR.find(p => connectedPlatforms.includes(p)) ? currencies[REVENUE_PLATFORMS_ATTR.find(p => connectedPlatforms.includes(p))!] : null) ?? "USD";
    const sameCurrency = currency === primaryRevCurrency;

    const cac = sameCurrency && totalNewCustomers > 0 && spend > 0 ? spend / totalNewCustomers : null;
    const roas = sameCurrency && spend > 0 && totalRevenueUSD > 0 ? (totalRevenueUSD * (spend / totalSpendAll + 1) / spend) : null; // approx proportional attribution
    const cpc = clicks > 0 && spend > 0 ? spend / clicks : null;
    const ctr = impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null;

    return { ...adPlatform, spend, clicks, impressions, currency, cac, roas, cpc, ctr, sharePct: 0 };
  });

  // Compute spend share after totalSpendAll is known
  for (const ch of channels) {
    ch.sharePct = totalSpendAll > 0 ? (ch.spend / totalSpendAll) * 100 : 0;
    // recompute roas with accurate attribution
    const primaryRevCurrency = (REVENUE_PLATFORMS_ATTR.find(p => connectedPlatforms.includes(p)) ? currencies[REVENUE_PLATFORMS_ATTR.find(p => connectedPlatforms.includes(p))!] : null) ?? "USD";
    const sameCurrency = ch.currency === primaryRevCurrency;
    if (sameCurrency && ch.spend > 0 && totalSpendAll > 0) {
      const attributedRevenue = totalRevenueUSD * (ch.spend / totalSpendAll);
      ch.roas = attributedRevenue / ch.spend;
    }
  }

  const activeChannels = channels.filter((c) => c.spend > 0 || c.clicks > 0);
  if (activeChannels.length === 0) return null;

  const maxSpend = Math.max(...activeChannels.map((c) => c.spend), 1);
  const lowestCAC = activeChannels.filter((c) => c.cac !== null && c.cac > 0).sort((a, b) => (a.cac ?? Infinity) - (b.cac ?? Infinity))[0];
  const highestROAS = activeChannels.filter((c) => c.roas !== null && c.roas > 0).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];

  function fmtSpend(n: number, cur: string) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="m16 8-4 4-4-4m0 8 4-4 4 4"/>
          </svg>
        </div>
        <div>
          <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Revenue Attribution</h3>
          <p className="font-mono text-[10px] text-[#8585aa]">CAC &amp; ROAS per ad channel · proportional attribution</p>
        </div>
        {(lowestCAC || highestROAS) && (
          <div className="ml-auto flex items-center gap-3">
            {lowestCAC && (
              <div className="text-right">
                <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Best CAC</p>
                <p className="font-mono text-[11px] font-bold text-[#00d4aa]">{lowestCAC.label}</p>
              </div>
            )}
            {highestROAS && (
              <div className="text-right">
                <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Best ROAS</p>
                <p className="font-mono text-[11px] font-bold text-[#a78bfa]">{highestROAS.label}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Channel bars */}
      <div className="space-y-3">
        {activeChannels.map((ch) => {
          const barPct = (ch.spend / maxSpend) * 100;
          return (
            <div key={ch.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />
                  <span className="font-mono text-[11px] font-semibold text-[#f8f8fc]">{ch.label}</span>
                  {ch.sharePct > 0 && (
                    <span className="font-mono text-[9px] text-[#58588a]">{ch.sharePct.toFixed(0)}% of spend</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {ch.cac !== null && (
                    <div className="text-right">
                      <p className="font-mono text-[8px] text-[#8585aa]">CAC</p>
                      <p className="font-mono text-[11px] font-bold text-[#f8f8fc]">{fmtSpend(ch.cac, ch.currency)}</p>
                    </div>
                  )}
                  {ch.roas !== null && (
                    <div className="text-right">
                      <p className="font-mono text-[8px] text-[#8585aa]">ROAS</p>
                      <p className={`font-mono text-[11px] font-bold ${ch.roas >= 3 ? "text-[#00d4aa]" : ch.roas >= 1 ? "text-[#f59e0b]" : "text-red-400"}`}>
                        {ch.roas.toFixed(2)}×
                      </p>
                    </div>
                  )}
                  {ch.cpc !== null && (
                    <div className="text-right">
                      <p className="font-mono text-[8px] text-[#8585aa]">CPC</p>
                      <p className="font-mono text-[11px] font-bold text-[#f8f8fc]">{fmtSpend(ch.cpc, ch.currency)}</p>
                    </div>
                  )}
                  <div className="text-right w-20">
                    <p className="font-mono text-[8px] text-[#8585aa]">Spend</p>
                    <p className="font-mono text-[11px] font-bold text-[#f8f8fc]">{fmtSpend(ch.spend, ch.currency)}</p>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[#363650]/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(barPct, 1)}%`, backgroundColor: ch.color + "80" }}
                />
              </div>
              <div className="flex items-center gap-4 pl-4">
                {ch.impressions > 0 && (
                  <span className="font-mono text-[9px] text-[#58588a]">
                    {ch.impressions.toLocaleString("en-US")} impressions
                  </span>
                )}
                {ch.clicks > 0 && (
                  <span className="font-mono text-[9px] text-[#58588a]">
                    {ch.clicks.toLocaleString("en-US")} clicks
                    {ch.ctr !== null && ` · ${ch.ctr.toFixed(2)}% CTR`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Total Ad Spend</p>
          <p className="font-mono text-sm font-bold text-[#f8f8fc]">
            {fmtSpend(totalSpendAll, (connectedAds[0] ? currencies[connectedAds[0].key] : null) ?? "USD")}
          </p>
        </div>
        {totalNewCustomers > 0 && (
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">New Customers</p>
            <p className="font-mono text-sm font-bold text-[#f8f8fc]">{totalNewCustomers.toLocaleString("en-US")}</p>
          </div>
        )}
        {totalNewCustomers > 0 && totalSpendAll > 0 && (
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Blended CAC</p>
            <p className="font-mono text-sm font-bold text-[#f8f8fc]">
              {fmtSpend(totalSpendAll / totalNewCustomers, (connectedAds[0] ? currencies[connectedAds[0].key] : null) ?? "USD")}
            </p>
          </div>
        )}
        {totalRevenueUSD > 0 && totalSpendAll > 0 && (
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Blended ROAS</p>
            <p className={`font-mono text-sm font-bold ${totalRevenueUSD / totalSpendAll >= 3 ? "text-[#00d4aa]" : totalRevenueUSD / totalSpendAll >= 1 ? "text-[#f59e0b]" : "text-red-400"}`}>
              {(totalRevenueUSD / totalSpendAll).toFixed(2)}×
            </p>
          </div>
        )}
      </div>

      <p className="font-mono text-[9px] text-[#58588a]">
        CAC = total ad spend ÷ new customers (all revenue platforms) · ROAS = proportional revenue attribution by spend share · period matches selected time range
      </p>
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
