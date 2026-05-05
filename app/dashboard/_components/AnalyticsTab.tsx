"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import OverviewSection from "./OverviewSection";
import { REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";

interface AnalyticsTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  /** platform → ISO currency code. e.g. { stripe: "EUR", meta: "USD" } */
  currencies?: Record<string, string>;
}

// ── Types ─────────────────────────────────────────────────────────────────

type TimeRange = "7d" | "30d" | "90d" | "180d" | "1y";
type Granularity = "day" | "week" | "month";

interface CustomRange { from: string; to: string } // YYYY-MM-DD

const TIME_RANGES: { id: TimeRange; label: string; days: number }[] = [
  { id: "7d",  label: "7D",   days: 7   },
  { id: "30d", label: "30D",  days: 30  },
  { id: "90d", label: "90D",  days: 90  },
  { id: "180d",label: "180D", days: 180 },
  { id: "1y",  label: "1Y",   days: 365 },
];

// Which granularities are available per time range
const GRANULARITY_OPTIONS: Record<TimeRange, Granularity[]> = {
  "7d":   ["day"],
  "30d":  ["day", "week"],
  "90d":  ["week", "month"],
  "180d": ["week", "month"],
  "1y":   ["month"],
};

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day:   "Day",
  week:  "Week",
  month: "Month",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getField(snap: Snapshot, field: string): number {
  const d = snap.data as Record<string, number>;
  return d[field] ?? 0;
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number", currency = "USD"): string {
  if (type === "currency") {
    const dollars = n / 100;
    // Use Intl for correct symbol — USD → $, EUR → €, GBP → £, etc.
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
    // Compact for large values
    if (Math.abs(dollars) >= 1000) {
      const compact = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        notation: "compact",
      }).format(dollars);
      return compact;
    }
    return formatted;
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function trend(vals: number[]): { pct: number; up: boolean } | null {
  if (vals.length < 2) return null;
  const half = Math.floor(vals.length / 2);
  const prev = vals.slice(0, half).reduce((a, b) => a + b, 0);
  const curr = vals.slice(half).reduce((a, b) => a + b, 0);
  if (!prev) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { pct: Math.abs(pct), up: curr >= prev };
}

/** Returns YYYY-MM-DD for N days ago */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Returns period key for grouping */
function periodKey(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  const d = new Date(date + "T00:00:00Z");
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  // week: ISO week label (Mon of that week)
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Mon offset
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return `W ${mon.toISOString().slice(0, 10)}`;
}

/** Format a period key nicely for display */
function fmtPeriod(key: string, granularity: Granularity): string {
  if (granularity === "day") {
    const d = new Date(key + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return new Date(`${y}-${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  // week: "W Mar 16"
  const dateStr = key.slice(2);
  const d = new Date(dateStr + "T00:00:00Z");
  return "W " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Group snapshots by period, summing sum-fields, averaging avg-fields,
 *  and taking the last (most recent) value for latestFields (point-in-time metrics
 *  like MRR, active subscriptions, ARPU that should NOT be summed across days). */
function groupSnapshots(
  snapshots: Snapshot[],
  granularity: Granularity,
  sumFields: string[],
  avgFields: string[],
  latestFields: string[] = []
): { period: string; data: Record<string, number> }[] {
  const grouped: Record<string, {
    sums: Record<string, number>;
    avgs: Record<string, number[]>;
    latests: Record<string, number>;
  }> = {};

  for (const snap of snapshots) {
    const pk = periodKey(snap.date, granularity);
    if (!grouped[pk]) {
      grouped[pk] = {
        sums: Object.fromEntries(sumFields.map((f) => [f, 0])),
        avgs: Object.fromEntries(avgFields.map((f) => [f, []])),
        latests: Object.fromEntries(latestFields.map((f) => [f, 0])),
      };
    }
    for (const f of sumFields) grouped[pk].sums[f] += getField(snap, f);
    for (const f of avgFields) grouped[pk].avgs[f].push(getField(snap, f));
    // Latest: overwrite each time — snapshots are sorted asc so last write wins
    for (const f of latestFields) {
      const v = getField(snap, f);
      if (v > 0) grouped[pk].latests[f] = v;
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { sums, avgs, latests }]) => ({
      period,
      data: {
        ...sums,
        ...latests,
        ...Object.fromEntries(
          avgFields.map((f) => [f, avgs[f].length ? avgs[f].reduce((a, b) => a + b, 0) / avgs[f].length : 0])
        ),
      },
    }));
}

// ── Sparkline (Recharts) ──────────────────────────────────────────────────

interface SparkTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  formatter?: (v: number) => string;
}

function SparkTooltip({ active, payload, formatter }: SparkTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border border-[#363650] bg-[#13131f] px-2.5 py-1.5 shadow-2xl">
      <p className="font-mono text-[11px] font-bold text-[#f8f8fc]">
        {formatter ? formatter(val) : val.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

function Sparkline({ values, color = "#00d4aa", formatter }: {
  values: number[];
  color?: string;
  formatter?: (v: number) => string;
}) {
  if (values.length < 2) return <div className="h-10 w-full" />;
  const data = values.map((v, i) => ({ i, v }));
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${values.length}`;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          content={<SparkTooltip formatter={formatter} />}
          cursor={{ stroke: color + "50", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Shared periods context — sections provide, StatCard reads ──────────────
const PeriodsCtx = createContext<string[]>([]);

// ── Expanded-card context — StatCardGroup provides, StatCard reads ─────────
const ExpandedCtx = createContext<{
  active: string | null;
  setActive: (v: string | null) => void;
}>({ active: null, setActive: () => {} });

/** Wrap a set of <StatCard>s with this instead of a plain grid div so that
 *  clicking one card expands it in-place while the others shrink. */
function StatCardGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <ExpandedCtx.Provider value={{ active, setActive }}>
      <div className={className ?? "grid grid-cols-2 gap-3 sm:grid-cols-4"}>
        {children}
      </div>
    </ExpandedCtx.Provider>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, values, color, sparkFormatter, periods,
}: {
  label: string;
  value: string;
  sub?: string;
  values: number[];
  color?: string;
  sparkFormatter?: (v: number) => string;
  periods?: string[];
}) {
  const { active, setActive } = useContext(ExpandedCtx);
  const ctxPeriods  = useContext(PeriodsCtx);
  const effectivePeriods =
    periods ??
    (ctxPeriods.length === values.length && ctxPeriods.length > 0
      ? ctxPeriods
      : values.map((_, i) => `#${i + 1}`));

  const isExpanded      = active === label;
  const isOtherExpanded = active !== null && !isExpanded;
  const canExpand       = values.length >= 2;
  const accent          = color ?? "#00d4aa";
  const t               = trend(values);

  // Escape collapses
  useEffect(() => {
    if (!isExpanded) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isExpanded, setActive]);

  // ── chart data (only computed when about to show) ──
  const fmtVal = (v: number) =>
    sparkFormatter
      ? sparkFormatter(v)
      : v.toLocaleString("en-US", { maximumFractionDigits: 1 });

  const total    = values.reduce((a, b) => a + b, 0);
  const avg      = values.length ? total / values.length : 0;
  const peak     = Math.max(...values, 0);
  const tickStep = Math.max(1, Math.ceil(effectivePeriods.length / 8));
  const chartData = effectivePeriods.map((lbl, i) => ({ lbl, v: values[i] ?? 0 }));
  const gradId    = `sc-${label.replace(/\W/g, "")}-${accent.replace(/\W/g, "")}`;

  return (
    <div
      onClick={() => canExpand && setActive(isExpanded ? null : label)}
      className={[
        "relative overflow-hidden rounded-xl border bg-[#222235] flex flex-col transition-all duration-300 ease-in-out",
        isExpanded
          ? "col-span-full border-[#454560] bg-[#1a1a2e] p-5 gap-4"
          : "p-5 gap-3 border-[#363650]",
        !isExpanded && !isOtherExpanded
          ? "hover:border-[#454560] hover:bg-[#1c1c2a]"
          : "",
        isOtherExpanded
          ? "opacity-40 scale-[0.97] pointer-events-none"
          : "",
        canExpand && !isOtherExpanded ? "cursor-pointer group" : "",
      ].join(" ")}
    >
      {/* left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl opacity-60" style={{ backgroundColor: accent }} />

      {/* header row */}
      <div className="flex items-start justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</p>
        <div className="flex items-center gap-1.5">
          {t && (
            <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md ${t.up ? "text-[#00d4aa] bg-[#00d4aa]/10" : "text-red-400 bg-red-400/10"}`}>
              {t.up ? "▲" : "▼"} {t.pct.toFixed(1)}%
            </span>
          )}
          {canExpand && !isExpanded && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5a5a7a]" title="Expand">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </span>
          )}
          {isExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setActive(null); }}
              className="rounded-lg p-1 text-[#5a5a7a] hover:text-[#bcbcd8] hover:bg-[#222235] transition-colors"
              title="Collapse"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* value */}
      <div>
        <p className="font-mono text-2xl font-bold text-[#f8f8fc]">{value}</p>
        {sub && <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
      </div>

      {/* sparkline OR expanded chart */}
      {isExpanded ? (
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: isExpanded ? 380 : 0, opacity: isExpanded ? 1 : 0 }}
        >
          {/* stats strip */}
          <div className="grid grid-cols-3 sm:grid-cols-4 mb-4 rounded-lg border border-[#1e1e2e] divide-x divide-[#1e1e2e] overflow-hidden">
            {[
              { lbl: "Total",   val: fmtVal(total) },
              { lbl: "Average", val: fmtVal(avg) },
              { lbl: "Peak",    val: fmtVal(peak) },
              { lbl: "Periods", val: String(effectivePeriods.length) },
            ].map((s) => (
              <div key={s.lbl} className="px-4 py-2.5 hidden sm:block last:block first:block nth-3:block">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#5a5a7a]">{s.lbl}</p>
                <p className="font-mono text-sm font-bold text-[#f8f8fc] mt-0.5">{s.val}</p>
              </div>
            ))}
          </div>

          {/* full chart */}
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
              <XAxis
                dataKey="lbl"
                tick={{ fill: "#5a5a7a", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false} tickLine={false}
                interval={tickStep - 1} tickMargin={8}
              />
              <YAxis
                tick={{ fill: "#5a5a7a", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false} tickLine={false}
                width={64} tickFormatter={fmtVal}
              />
              <Tooltip
                content={({ active: a, payload, label: lbl }) => {
                  if (!a || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-[#363650] bg-[#13131f] px-3 py-2 shadow-2xl">
                      <p className="font-mono text-[10px] text-[#8585aa] mb-0.5">{lbl}</p>
                      <p className="font-mono text-sm font-bold" style={{ color: accent }}>
                        {fmtVal(payload[0].value as number)}
                      </p>
                    </div>
                  );
                }}
                cursor={{ stroke: `${accent}30`, strokeWidth: 1 }}
              />
              <Area
                type="monotone" dataKey="v"
                stroke={accent} strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={chartData.length <= 45 ? { fill: accent, r: 3, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: accent, strokeWidth: 0 }}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-2 font-mono text-[10px] text-[#3a3a5a] text-right">
            click card or press <kbd className="rounded px-1 py-0.5 bg-[#1e1e2e] text-[#5a5a7a]">Esc</kbd> to collapse
          </p>
        </div>
      ) : (
        <Sparkline values={values} color={accent} formatter={sparkFormatter} />
      )}
    </div>
  );
}
  function YouTubeSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
    const grouped = groupSnapshots(snapshots, granularity, ["subscribers", "totalViews"], []);
    const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
    const subs = grouped.map((r) => r.data.subscribers);
    const views = grouped.map((r) => r.data.totalViews);
    const lastSubs = subs.length > 0 ? subs[subs.length - 1] : 0;
    const tableRows = grouped.map((r) => ({
      period: fmtPeriod(r.period, granularity),
      cells: [
        { label: "Subscribers", value: fmt(r.data.subscribers), raw: r.data.subscribers },
        { label: "Total Views", value: fmt(r.data.totalViews),  raw: r.data.totalViews },
      ],
    }));
    const youtubeInsights = buildInsights({
      primary: { label: "Subscribers", values: subs },
      secondary: [{ label: "Total Views", values: views }],
    });
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#FF0000]/15 bg-[#FF0000]/5 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF0000]/15 font-mono text-[10px] font-bold text-[#FF0000]">YT</div>
          <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">YouTube</h3>
        </div>
        <PeriodCompare values={subs} label="Subscribers" />
        <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Subscribers" value={fmt(lastSubs)} values={subs} color="#FF0000" />
          <StatCard label="Total Views" value={fmt(views.reduce((a,b)=>a+b,0))} values={views} color="#f87171" />
        </StatCardGroup>
        <DataTable rows={tableRows} />
        <PlatformInsights insights={youtubeInsights} />
      </div>
    );
  }

  function TwitterOrganicSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
    const grouped = groupSnapshots(snapshots, granularity, ["followers", "tweetCount"], []);
    const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
    const followers = grouped.map((r) => r.data.followers);
    const tweets = grouped.map((r) => r.data.tweetCount);
    const lastFollowers = followers.length > 0 ? followers[followers.length - 1] : 0;
    const tableRows = grouped.map((r) => ({
      period: fmtPeriod(r.period, granularity),
      cells: [
        { label: "Followers", value: fmt(r.data.followers),  raw: r.data.followers },
        { label: "Tweets",    value: fmt(r.data.tweetCount), raw: r.data.tweetCount },
      ],
    }));
    const twitterInsights = buildInsights({
      primary: { label: "Followers", values: followers },
      secondary: [{ label: "Tweets", values: tweets }],
    });
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#1d9bf0]/15 bg-[#1d9bf0]/5 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d9bf0]/15 font-mono text-[10px] font-bold text-[#1d9bf0]">XA</div>
          <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">X (Twitter)</h3>
        </div>
        <PeriodCompare values={followers} label="Followers" />
        <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Followers" value={fmt(lastFollowers)} values={followers} color="#1d9bf0" />
          <StatCard label="Tweets" value={fmt(tweets.reduce((a,b)=>a+b,0))} values={tweets} color="#60a5fa" />
        </StatCardGroup>
        <DataTable rows={tableRows} />
        <PlatformInsights insights={twitterInsights} />
      </div>
    );
  }

// ── Controls: Time Range + View By + Custom Date Range ───────────────────

function DateRangePicker({
  customRange,
  setCustomRange,
  onClear,
}: {
  customRange: CustomRange | null;
  setCustomRange: (r: CustomRange | null) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(customRange?.from ?? "");
  const [to, setTo]     = useState(customRange?.to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function apply() {
    if (from && to && from <= to) {
      setCustomRange({ from, to });
      setOpen(false);
    }
  }

  function clear() {
    setFrom(""); setTo("");
    setCustomRange(null);
    onClear();
    setOpen(false);
  }

  const label = customRange
    ? `${customRange.from} → ${customRange.to}`
    : "Custom range";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
          customRange
            ? "border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]"
            : "border-[#363650] bg-[#1c1c2a] text-[#8585aa] hover:text-[#bcbcd8]"
        }`}
      >
        {/* calendar icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{label}</span>
        {customRange && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="ml-1 text-[#8585aa] hover:text-red-400 transition-colors cursor-pointer"
          >✕</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-[#363650] bg-[#1c1c2a] p-5 shadow-2xl">
          <p className="mb-4 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Custom Date Range</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] text-[#8585aa]">From</label>
              <input
                type="date"
                value={from}
                max={to || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-[#363650] bg-[#222235] px-3 py-2 font-mono text-[12px] text-[#f8f8fc] outline-none focus:border-[#00d4aa]/40 transition-colors scheme-dark"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] text-[#8585aa]">To</label>
              <input
                type="date"
                value={to}
                min={from}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-[#363650] bg-[#222235] px-3 py-2 font-mono text-[12px] text-[#f8f8fc] outline-none focus:border-[#00d4aa]/40 transition-colors scheme-dark"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={apply}
              disabled={!from || !to || from > to}
              className="flex-1 rounded-lg bg-[#00d4aa] px-3 py-2 font-mono text-[11px] font-bold text-[#13131f] transition hover:bg-[#00bfa0] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
            <button
              onClick={clear}
              className="rounded-lg border border-[#363650] px-3 py-2 font-mono text-[11px] text-[#8585aa] hover:text-[#bcbcd8] transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────

function exportCSV(snapshots: Snapshot[], platform: string, timeRangeLabel: string) {
  const rows = snapshots
    .filter((s) => platform === "overview" || s.provider === platform)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) return;

  // Collect all unique field names from data objects
  const fieldSet = new Set<string>();
  for (const s of rows) {
    for (const key of Object.keys(s.data as Record<string, unknown>)) {
      fieldSet.add(key);
    }
  }
  const fields = Array.from(fieldSet);

  const headerRow = ["date", "provider", ...fields].join(",");
  const dataRows = rows.map((s) => {
    const d = s.data as Record<string, unknown>;
    return [
      s.date,
      s.provider,
      ...fields.map((f) => {
        const v = d[f] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
      }),
    ].join(",");
  });

  const csv = [headerRow, ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fold-${platform}-${timeRangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AnalyticsControls({
  timeRange, setTimeRange,
  granularity, setGranularity,
  customRange, setCustomRange,
  snapshots, activeSection,
}: {
  timeRange: TimeRange; setTimeRange: (t: TimeRange) => void;
  granularity: Granularity; setGranularity: (g: Granularity) => void;
  customRange: CustomRange | null; setCustomRange: (r: CustomRange | null) => void;
  snapshots: Snapshot[]; activeSection: PlatformTab;
}) {
  const availableGrans = GRANULARITY_OPTIONS[timeRange];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {/* Time range pills */}
      <div className="flex items-center gap-1 rounded-xl border border-[#363650] bg-[#1c1c2a] p-1">
        {TIME_RANGES.map((tr) => (
          <button
            key={tr.id}
            onClick={() => {
              setTimeRange(tr.id);
              setCustomRange(null);
              // Auto-adjust granularity if current one is not available
              const avail = GRANULARITY_OPTIONS[tr.id];
              if (!avail.includes(granularity)) setGranularity(avail[0]);
            }}
            className={`rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-all ${
              !customRange && timeRange === tr.id
                ? "bg-[#363650] text-[#f8f8fc]"
                : "text-[#8585aa] hover:text-[#bcbcd8]"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Divider — hidden on mobile wrap */}
      <div className="hidden sm:block h-5 w-px bg-[#363650]" />

      {/* View by pills */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">View by</span>
        <div className="flex items-center gap-1 rounded-xl border border-[#363650] bg-[#1c1c2a] p-1">
          {availableGrans.map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-all ${
                granularity === g
                  ? "bg-[#00d4aa]/15 text-[#00d4aa]"
                  : "text-[#8585aa] hover:text-[#bcbcd8]"
              }`}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Divider — hidden on mobile wrap */}
      <div className="hidden sm:block h-5 w-px bg-[#363650]" />

      {/* Custom date range picker */}
      <DateRangePicker
        customRange={customRange}
        setCustomRange={setCustomRange}
        onClear={() => {}}
      />

      {/* Export CSV */}
      <button
        onClick={() => exportCSV(snapshots, activeSection, customRange ? `${customRange.from}_${customRange.to}` : timeRange)}
        className="sm:ml-auto flex items-center gap-1.5 rounded-xl border border-[#363650] px-3 py-1.5 font-mono text-[11px] text-[#8585aa] hover:text-[#00d4aa] hover:border-[#00d4aa]/40 transition-all"
        title="Export visible data as CSV"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Export CSV
      </button>
    </div>
  );
}

// ── Smart Data Table — with Δ deltas, best/worst highlights ──────────────

type SmartRow = { period: string; cells: { label: string; value: string; raw?: number }[] };

function SmartTable({ rows, title = "Period breakdown" }: { rows: SmartRow[]; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;

  // Compute deltas: for each column, compare each row to the previous row
  // (rows are sorted oldest→newest; we display newest→oldest)
  const sorted = [...rows]; // oldest first (same order as input)

  function deltaClass(delta: number | null) {
    if (delta === null) return "text-[#58588a]";
    return delta > 0 ? "text-[#00d4aa]" : delta < 0 ? "text-[#f87171]" : "text-[#58588a]";
  }
  function deltaStr(delta: number | null) {
    if (delta === null) return "";
    if (delta === 0) return "—";
    const sign = delta > 0 ? "▲" : "▼";
    return `${sign} ${Math.abs(delta).toFixed(1)}%`;
  }

  // Find best/worst row by primary metric (first cell with a raw value)
  let bestIdx = -1, worstIdx = -1;
  let bestVal = -Infinity, worstVal = Infinity;
  sorted.forEach((row, i) => {
    const v = row.cells[0]?.raw;
    if (v === undefined) return;
    if (v > bestVal) { bestVal = v; bestIdx = i; }
    if (v < worstVal) { worstVal = v; worstIdx = i; }
  });

  const displayed = [...sorted].reverse(); // newest first

  return (
    <div className="rounded-xl border border-[#1e1e2e] overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#0f0f14] hover:bg-[#111118] transition-colors"
      >
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#5a5a7a]">{title}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-[#3a3a5a]">{rows.length} periods</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`text-[#3a3a5a] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e1e2e] bg-[#0c0c12]">
                <th className="px-4 py-2.5 font-mono text-[9px] uppercase tracking-widest text-[#3a3a5a]">Period</th>
                {rows[0].cells.map((c) => (
                  <th key={c.label} colSpan={2} className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-widest text-[#3a3a5a]">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, di) => {
                // Find this row's index in sorted (oldest-first) for delta calc
                const si = sorted.length - 1 - di;
                const prevRow = sorted[si - 1];
                // Best/worst highlight on first cell's raw
                const isBest  = si === bestIdx && bestVal > 0;
                const isWorst = si === worstIdx && worstIdx !== bestIdx;

                return (
                  <tr
                    key={row.period}
                    className={`border-b border-[#1e1e2e]/60 ${
                      isBest  ? "bg-[#00d4aa]/4" :
                      isWorst ? "bg-[#f87171]/3" :
                      di % 2 === 0 ? "bg-[#0f0f14]/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-[11px] text-[#6a6a8a] whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isBest  && <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] shrink-0" />}
                        {isWorst && <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] shrink-0" />}
                        {!isBest && !isWorst && <span className="w-1.5 h-1.5 shrink-0" />}
                        {row.period}
                      </span>
                    </td>
                    {row.cells.map((c, ci) => {
                      const prevVal = prevRow?.cells[ci]?.raw;
                      const curVal  = c.raw;
                      let delta: number | null = null;
                      if (curVal !== undefined && prevVal !== undefined && prevVal !== 0) {
                        delta = ((curVal - prevVal) / Math.abs(prevVal)) * 100;
                      }
                      return (
                        <td key={c.label} colSpan={2} className="px-3 py-2">
                          <span className="font-mono text-[11px] text-[#c8c8de]">{c.value}</span>
                          {delta !== null && (
                            <span className={`ml-1.5 font-mono text-[9px] ${deltaClass(delta)}`}>
                              {deltaStr(delta)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 bg-[#0c0c12] border-t border-[#1e1e2e]">
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#3a3a5a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa]" /> Best period
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#3a3a5a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" /> Lowest period
            </span>
            <span className="font-mono text-[9px] text-[#3a3a5a]">▲▼ = change vs prior period</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy alias so existing <DataTable rows={…} /> calls still compile
function DataTable({ rows }: { rows: SmartRow[] }) {
  return <SmartTable rows={rows} />;
}

// ── Platform Insights ─────────────────────────────────────────────────────

type InsightSeverity = "positive" | "negative" | "warning" | "neutral";

interface PlatformInsight {
  severity: InsightSeverity;
  headline: string;
  detail: string;
}

function InsightBadge({ severity }: { severity: InsightSeverity }) {
  const map: Record<InsightSeverity, { color: string; icon: React.ReactNode }> = {
    positive: {
      color: "#00d4aa",
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    negative: {
      color: "#f87171",
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    },
    warning: {
      color: "#f59e0b",
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    },
    neutral: {
      color: "#8585aa",
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    },
  };
  const { color, icon } = map[severity];
  return (
    <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: `${color}15`, color }}>
      {icon}
    </div>
  );
}

function PlatformInsights({ insights }: { insights: PlatformInsight[] }) {
  if (!insights.length) return null;
  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0c0c12] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#1e1e2e] flex items-center gap-2">
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5a5a7a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
        </svg>
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#3a3a5a]">Insights</span>
      </div>
      <div className="divide-y divide-[#1a1a28]">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <InsightBadge severity={ins.severity} />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#c8c8de] leading-snug">{ins.headline}</p>
              <p className="text-[11px] text-[#5a5a7a] mt-0.5 leading-relaxed">{ins.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Revenue run-rate strip — shown at top of all revenue sections */
function RunRateStrip({
  snapshots,
  field,
  currency,
  label = "Revenue",
}: {
  snapshots: Snapshot[];
  field: string;
  currency?: string;
  label?: string;
}) {
  if (snapshots.length === 0) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.reduce((sum, s) => sum + (((s.data as Record<string, number>)[field]) ?? 0), 0);
  if (total === 0) return null;

  const firstDate = new Date(sorted[0].date + "T12:00:00");
  const lastDate  = new Date(sorted[sorted.length - 1].date + "T12:00:00");
  const periodDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / 86400000 + 1);
  const dailyRate  = total / periodDays;
  const monthly    = dailyRate * 30.44;
  const annual     = dailyRate * 365.25;

  // Trend: first half vs second half of sorted snapshots
  const half      = Math.max(1, Math.floor(sorted.length / 2));
  const firstHalf = sorted.slice(0, half).reduce((sum, s) => sum + (((s.data as Record<string, number>)[field]) ?? 0), 0);
  const lastHalf  = sorted.slice(-half).reduce((sum, s) => sum + (((s.data as Record<string, number>)[field]) ?? 0), 0);
  const trendPct  = firstHalf > 0 ? ((lastHalf - firstHalf) / firstHalf) * 100 : 0;
  const up        = lastHalf >= firstHalf;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#00d4aa]/15 bg-[#00d4aa]/5 px-4 py-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#00d4aa]">Run Rate</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] text-[#8585aa]">Monthly</span>
        <span className="font-mono text-sm font-bold text-[#f8f8fc]">{fmt(monthly, "currency", currency)}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] text-[#8585aa]">Annual</span>
        <span className="font-mono text-sm font-bold text-[#00d4aa]">{fmt(annual, "currency", currency)}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] text-[#8585aa]">Avg/day</span>
        <span className="font-mono text-xs font-semibold text-[#bcbcd8]">{fmt(dailyRate, "currency", currency)}</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className={`font-mono text-xs font-bold ${up ? "text-[#00d4aa]" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(trendPct).toFixed(1)}%
        </span>
        <span className="font-mono text-[9px] text-[#8585aa]">period trend</span>
      </div>
      <p className="w-full font-mono text-[9px] text-[#8585aa]">
        Based on {fmt(total, "currency", currency)} {label.toLowerCase()} over {Math.round(periodDays)} days · extrapolated at current daily pace
      </p>
    </div>
  );
}

/** Period-over-period header banner for any section */
function PeriodCompare({
  values,
  label,
  isCurrency,
  currency,
  lowerIsBetter = false,
  formatter,
}: {
  values: number[];
  label: string;
  isCurrency?: boolean;
  currency?: string;
  lowerIsBetter?: boolean;
  formatter?: (v: number) => string;
}) {
  if (values.length < 2) return null;
  const half      = Math.floor(values.length / 2);
  const prev      = values.slice(0, half).reduce((a, b) => a + b, 0);
  const curr      = values.slice(-half).reduce((a, b) => a + b, 0);
  if (prev === 0) return null;
  const delta     = curr - prev;
  const deltaPct  = (delta / prev) * 100;
  const positive  = lowerIsBetter ? delta <= 0 : delta >= 0;
  const fmtVal    = formatter ?? ((v: number) => isCurrency ? fmt(v, "currency", currency) : fmt(v));

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-3 ${positive ? "border-[#00d4aa]/15 bg-[#00d4aa]/5" : "border-red-400/15 bg-red-400/5"}`}>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-mono text-[9px] uppercase tracking-widest ${positive ? "text-[#00d4aa]" : "text-red-400"}`}>
          Period comparison
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-xl font-bold ${positive ? "text-[#00d4aa]" : "text-red-400"}`}>
          {delta >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
        </span>
        <span className="font-mono text-xs text-[#8585aa]">{label}</span>
      </div>
      <div className="flex items-center gap-4 ml-auto shrink-0">
        <div className="text-right">
          <p className="font-mono text-[9px] text-[#58588a] uppercase tracking-widest">First half</p>
          <p className="font-mono text-xs font-semibold text-[#bcbcd8]">{fmtVal(prev)}</p>
        </div>
        <div className="font-mono text-[#363650]">→</div>
        <div className="text-right">
          <p className="font-mono text-[9px] text-[#58588a] uppercase tracking-widest">Second half</p>
          <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{fmtVal(curr)}</p>
        </div>
      </div>
      <p className="w-full font-mono text-[9px] text-[#8585aa]">
        Comparing first {half} vs last {half} {values.length <= 31 ? "day" : "period"}s in the selected range
        {Math.abs(deltaPct) > 20 ? (positive ? " · Significant improvement" : " · Significant decline — review contributing factors") : ""}
      </p>
    </div>
  );
}

/** Build insights from any numeric series */
function buildInsights(params: {
  primary: { label: string; values: number[]; isCurrency?: boolean; currency?: string; lowerIsBetter?: boolean };
  secondary?: { label: string; values: number[] }[];
  rateMetrics?: { label: string; numerator: number; denominator: number; suffix: string; goodThreshold?: number; badThreshold?: number; lowerIsBetter?: boolean }[];
  customInsights?: PlatformInsight[];
}): PlatformInsight[] {
  const insights: PlatformInsight[] = [];
  const { primary, secondary = [], rateMetrics = [], customInsights = [] } = params;

  function fmtV(v: number, isCurrency = false, currency = "USD") {
    if (isCurrency) return fmt(v, "currency", currency);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  const pv = primary.values;
  const total = pv.reduce((a, b) => a + b, 0);
  const n = pv.length;

  // 1. Period-over-period trend
  if (n >= 4) {
    const half = Math.floor(n / 2);
    const prevHalf = pv.slice(0, half).reduce((a, b) => a + b, 0);
    const currHalf = pv.slice(half).reduce((a, b) => a + b, 0);
    if (prevHalf > 0) {
      const pct = ((currHalf - prevHalf) / prevHalf) * 100;
      const up = pct > 0;
      const good = primary.lowerIsBetter ? !up : up;
      insights.push({
        severity: Math.abs(pct) < 5 ? "neutral" : good ? "positive" : "negative",
        headline: `${primary.label} ${up ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% vs previous half`,
        detail: `${fmtV(currHalf, primary.isCurrency, primary.currency)} this half vs ${fmtV(prevHalf, primary.isCurrency, primary.currency)} prior half.${Math.abs(pct) >= 20 ? " Notable swing — worth investigating the cause." : ""}`,
      });
    }
  }

  // 2. Best/worst period
  if (n >= 3) {
    const maxV = Math.max(...pv);
    const minV = Math.min(...pv);
    const maxIdx = pv.lastIndexOf(maxV);
    const minIdx = pv.indexOf(minV);
    const avg = total / n;
    if (maxV > 0 && maxIdx === n - 1) {
      insights.push({
        severity: "positive",
        headline: `Best ${primary.label.toLowerCase()} period on record`,
        detail: `The most recent period hit ${fmtV(maxV, primary.isCurrency, primary.currency)} — ${((maxV / avg - 1) * 100).toFixed(0)}% above the period average of ${fmtV(avg, primary.isCurrency, primary.currency)}.`,
      });
    } else if (maxV > 0 && minIdx === n - 1 && n >= 4) {
      insights.push({
        severity: primary.lowerIsBetter ? "positive" : "negative",
        headline: `${primary.label} at its lowest this period`,
        detail: `Latest period: ${fmtV(minV, primary.isCurrency, primary.currency)} — ${((1 - minV / avg) * 100).toFixed(0)}% below average. Investigate for seasonal dips or issues.`,
      });
    } else if (maxV > 0) {
      insights.push({
        severity: "neutral",
        headline: `Peak ${primary.label.toLowerCase()}: ${fmtV(maxV, primary.isCurrency, primary.currency)}`,
        detail: `Reached in period ${maxIdx + 1} of ${n}. Average across all periods: ${fmtV(avg, primary.isCurrency, primary.currency)}.`,
      });
    }
  }

  // 3. Volatility check
  if (n >= 5) {
    const avg = total / n;
    const stddev = Math.sqrt(pv.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / n);
    const cv = avg > 0 ? (stddev / avg) * 100 : 0;
    if (cv > 40) {
      insights.push({
        severity: "warning",
        headline: `High volatility in ${primary.label.toLowerCase()} (CV ${cv.toFixed(0)}%)`,
        detail: `Values swing widely period-to-period. This may indicate seasonal demand, irregular ad spend, or inconsistent customer behaviour.`,
      });
    }
  }

  // 4. Secondary series trend
  for (const sec of secondary) {
    const sv = sec.values;
    if (sv.length >= 4) {
      const half = Math.floor(sv.length / 2);
      const prev = sv.slice(0, half).reduce((a, b) => a + b, 0);
      const curr = sv.slice(half).reduce((a, b) => a + b, 0);
      if (prev > 0) {
        const pct = ((curr - prev) / prev) * 100;
        if (Math.abs(pct) >= 10) {
          insights.push({
            severity: Math.abs(pct) < 5 ? "neutral" : pct > 0 ? "positive" : "warning",
            headline: `${sec.label} ${pct > 0 ? "grew" : "fell"} ${Math.abs(pct).toFixed(1)}% this half`,
            detail: `${fmtV(curr)} this half vs ${fmtV(prev)} prior half.`,
          });
        }
      }
    }
  }

  // 5. Rate metrics
  for (const rm of rateMetrics) {
    if (rm.denominator === 0) continue;
    const rate = (rm.numerator / rm.denominator) * 100;
    let severity: InsightSeverity = "neutral";
    if (rm.goodThreshold !== undefined) {
      const isGood = rm.lowerIsBetter ? rate <= rm.goodThreshold : rate >= rm.goodThreshold;
      severity = isGood ? "positive" : rm.badThreshold !== undefined
        ? (rm.lowerIsBetter ? rate >= rm.badThreshold : rate <= rm.badThreshold) ? "negative" : "warning"
        : "warning";
    }
    insights.push({
      severity,
      headline: `${rm.label}: ${rate.toFixed(2)}${rm.suffix}`,
      detail: rm.goodThreshold !== undefined
        ? `${rm.lowerIsBetter ? "Target" : "Target"}: ${rm.goodThreshold}${rm.suffix}. ${severity === "positive" ? "You're hitting this benchmark." : severity === "negative" ? "Below benchmark — action recommended." : "Close to benchmark."}`
        : `Derived from ${fmtV(rm.numerator)} / ${fmtV(rm.denominator)}.`,
    });
  }

  return [...insights, ...customInsights].slice(0, 5);
}

// ── Cross-platform Funnel Waterfall ──────────────────────────────────────

export function FunnelSection({ snapshots, connectedPlatforms, currencies = {} }: { snapshots: Snapshot[]; connectedPlatforms: string[]; currencies?: Record<string, string> }) {
  // ── Multi-provider aggregation ───────────────────────────────────────
  const connRevenue  = connectedPlatforms.filter((p) => REVENUE_PROVIDERS.includes(p));
  const connAnalytics = connectedPlatforms.filter((p) => ANALYTICS_PROVIDERS.includes(p));
  const connAds      = connectedPlatforms.filter((p) => ADS_PROVIDERS.includes(p));

  const hasRevenue  = connRevenue.length > 0;
  const hasAnalytics = connAnalytics.length > 0;
  const hasAds      = connAds.length > 0;

  if (!hasRevenue && !hasAnalytics && !hasAds) return null;
  if (connectedPlatforms.length < 2) return null; // need at least 2 sources to show a funnel

  // Primary analytics provider for sessions/conversions (avoid double-counting)
  const primaryAnalytics = (() => {
    const counts: Record<string, number> = {};
    for (const s of snapshots) {
      if (!connAnalytics.includes(s.provider)) continue;
      const hasData = Object.values(s.data as Record<string, number>).some((v) => v > 0);
      if (hasData) counts[s.provider] = (counts[s.provider] ?? 0) + 1;
    }
    const sorted = Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
    return sorted[0] ?? connAnalytics[0] ?? null;
  })();

  // Ad spend — SUM across all connected ad platforms
  const adSpend  = snapshots.filter((s) => connAds.includes(s.provider)).reduce((a, s) => a + ((s.data as Record<string, number>).spend ?? 0), 0);
  // Clicks — Meta only (no standard field across ad platforms)
  const adClicks = snapshots.filter((s) => s.provider === "meta").reduce((a, s) => a + ((s.data as Record<string, number>).clicks ?? 0), 0);

  // Sessions / conversions — primary analytics only
  const sessions    = primaryAnalytics ? snapshots.filter((s) => s.provider === primaryAnalytics).reduce((a, s) => a + ((s.data as Record<string, number>).sessions ?? 0), 0) : 0;
  const conversions = primaryAnalytics ? snapshots.filter((s) => s.provider === primaryAnalytics).reduce((a, s) => a + ((s.data as Record<string, number>).conversions ?? 0), 0) : 0;

  // Revenue — SUM across all connected revenue providers
  const revenue = snapshots.filter((s) => connRevenue.includes(s.provider)).reduce((a, s) => a + ((s.data as Record<string, number>).revenue ?? 0), 0);

  type FunnelStage = {
    label: string;
    value: number;
    displayValue: string;
    color: string;
    sub: string;
    available: boolean;
  };

  // Build currency for ad spend display — use currencies map first, fall back to snapshot data
  const connAds0 = connAds[0] as string | undefined;
  const currency: string =
    (connAds0 ? currencies[connAds0] : undefined) ??
    (([...snapshots].reverse().find((s) => s.provider === "meta" && (s.data as Record<string, unknown>)?.currency) as { data: Record<string, unknown> } | undefined)
      ?.data.currency as string) ??
    "USD";
  const fmtSpend = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  // Multi-source labels
  const adSpendSub = connAds.length > 1
    ? `${connAds.join(" + ")}${adSpend > 0 && adClicks > 0 ? " · " + fmtSpend(adSpend / adClicks) + " CPC" : ""}`
    : adSpend > 0 && adClicks > 0 ? fmtSpend(adSpend / adClicks) + " CPC" : connAds[0] ?? "Ads";

  const revCurrency: string = (connRevenue[0] ? currencies[connRevenue[0]] : undefined) ?? "USD";
  const revenueSub = connRevenue.length > 1
    ? connRevenue.join(" + ")
    : conversions > 0 && revenue > 0 ? fmt(revenue / conversions, "currency", revCurrency) + " per conv" : connRevenue[0] ?? "Revenue";

  const stages: FunnelStage[] = [
    {
      label: "Ad Spend",
      value: adSpend,
      displayValue: hasAds ? fmtSpend(adSpend) : "—",
      color: "#1877f2",
      sub: adSpendSub,
      available: hasAds,
    },
    {
      label: "Ad Clicks",
      value: adClicks,
      displayValue: hasAds && adClicks > 0 ? fmt(adClicks) : hasAds ? "—" : "—",
      color: "#1877f2",
      sub: adClicks > 0 && adSpend > 0 ? fmtSpend(adSpend / adClicks) + " CPC" : "Meta Ads",
      available: hasAds && adClicks > 0,
    },
    {
      label: "Sessions",
      value: sessions,
      displayValue: hasAnalytics ? fmt(sessions) : "—",
      color: "#f59e0b",
      sub: `${adClicks > 0 && sessions > 0 ? ((sessions / adClicks) * 100).toFixed(1) + "% click-to-session" : primaryAnalytics ?? "Analytics"}`,
      available: hasAnalytics,
    },
    {
      label: "Conversions",
      value: conversions,
      displayValue: hasAnalytics ? fmt(conversions) : "—",
      color: "#00d4aa",
      sub: `${sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) + "% conv rate" : primaryAnalytics ?? "Analytics"}`,
      available: hasAnalytics,
    },
    {
      label: "Revenue",
      value: revenue,
      displayValue: hasRevenue ? fmt(revenue, "currency", revCurrency) : "—",
      color: "#635bff",
      sub: revenueSub,
      available: hasRevenue,
    },
  ].filter((s) => s.available);

  if (stages.length < 2) return null;

  const maxVal = Math.max(...stages.map((s) => s.value), 1);

  // For ROAS: only show when both ad + revenue providers are connected in same currency
  const hasMeta    = connectedPlatforms.includes("meta");
  const hasStripe  = connectedPlatforms.includes("stripe");
  // Derive currencies for ad spend and primary revenue platform
  const primaryAdCurrency = connAds.length > 0 ? (currencies[connAds[0]] ?? "USD") : "USD";
  const primaryRevCurrency = connRevenue.length > 0 ? (currencies[connRevenue[0]] ?? "USD") : "USD";
  const allCurrenciesMatch = [...connAds, ...connRevenue].every(
    (p) => (currencies[p] ?? "USD") === primaryAdCurrency
  );
  const showROAS   = hasAds && hasRevenue && adSpend > 0 && revenue > 0 && allCurrenciesMatch;

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h18M6 8h12M10 12h4M12 16v0M11 20h2" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Full Funnel</h3>
        {/* Multi-source badge */}
        {(connRevenue.length > 1 || connAds.length > 1 || connAnalytics.length > 1) && (
          <span className="font-mono text-[8px] rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/8 px-2 py-0.5 text-[#00d4aa]">
            multi-source
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-[#8585aa]">Spend → Revenue</span>
      </div>

      {/* Analytics primary source note (when multiple analytics connected) */}
      {connAnalytics.length > 1 && primaryAnalytics && (
        <div className="flex items-center gap-2 rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-2">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          <p className="font-mono text-[10px] text-[#8585aa]">
            Sessions & conversions from <strong className="text-[#bcbcd8]">{primaryAnalytics}</strong> (most data) · summing multiple analytics tools would double-count visitors
          </p>
        </div>
      )}

      {/* Waterfall bars */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const barPct = stage.value > 0 ? (stage.value / maxVal) * 100 : 0;
          const prevStage = i > 0 ? stages[i - 1] : null;
          const showDropoff = prevStage && prevStage.value > 0 && stage.value > 0
            && prevStage.color === stage.color;
          const dropoffPct = showDropoff
            ? Math.round(((prevStage!.value - stage.value) / prevStage!.value) * 100)
            : null;

          return (
            <div key={stage.label}>
              {dropoffPct !== null && dropoffPct > 0 && (
                <div className="flex items-center gap-2 py-0.5 pl-4">
                  <div className="w-px h-3 bg-[#363650]" />
                  <span className="font-mono text-[9px] text-[#f87171]">▼ {dropoffPct}% drop-off</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] w-24 shrink-0">{stage.label}</span>
                <div className="flex-1 relative h-7 rounded-lg overflow-hidden bg-[#363650]/60">
                  <div
                    className="h-full rounded-lg transition-all duration-700 flex items-center"
                    style={{ width: `${Math.max(barPct, 1)}%`, backgroundColor: stage.color + "30", borderLeft: `3px solid ${stage.color}` }}
                  />
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold"
                    style={{ color: stage.color }}
                  >
                    {stage.displayValue}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#58588a] w-32 shrink-0 truncate">{stage.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROAS / efficiency summary */}
      {showROAS && (
        <div className="flex items-center gap-6 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">ROAS</p>
            <p className="font-mono text-base font-bold text-[#f8f8fc]">{((revenue / 100) / adSpend).toFixed(2)}×</p>
          </div>
          {adClicks > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">CPC</p>
              <p className="font-mono text-base font-bold text-[#f8f8fc]">{fmtSpend(adSpend / adClicks)}</p>
            </div>
          )}
          {conversions > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Cost / Conv</p>
              <p className="font-mono text-base font-bold text-[#f8f8fc]">{fmtSpend(adSpend / conversions)}</p>
            </div>
          )}
          {sessions > 0 && conversions > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Conv Rate</p>
              <p className="font-mono text-base font-bold text-[#f8f8fc]">{((conversions / sessions) * 100).toFixed(2)}%</p>
            </div>
          )}
        </div>
      )}
      {hasMeta && hasStripe && primaryAdCurrency !== primaryRevCurrency && (
        <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/8 px-4 py-3">
          <span className="text-sm">⚠️</span>
          <p className="font-mono text-[10px] text-[#f59e0b]">
            ROAS and cross-platform efficiency metrics are hidden — ad spend is in <strong>{primaryAdCurrency}</strong> while revenue is in <strong>{primaryRevCurrency}</strong>.
          </p>
        </div>
      )}

      <p className="font-mono text-[9px] text-[#58588a]">
        {connAds.length > 1 ? `Ad spend summed across ${connAds.join(", ")}. ` : ""}
        {connRevenue.length > 1 ? `Revenue summed across ${connRevenue.join(", ")}. ` : ""}
        Full-funnel view across the selected time range.
      </p>
    </div>
  );
}

// ── Platform sections ─────────────────────────────────────────────────────

// ── MRR Benchmarks ───────────────────────────────────────────────────────

// Industry benchmarks sourced from Baremetrics Open Startups, ChartMogul SaaS Report, OpenView SaaS Benchmarks
const SAAS_BENCHMARKS = {
  mrrGrowthMedian: 8,      // % monthly MRR growth, SaaS median
  mrrGrowthTop25:  20,     // % monthly MRR growth, top quartile
  churnMedian:     2.5,    // % monthly churn, SaaS median
  churnTop25:      1,      // % monthly churn, top quartile (lower = better)
  arpuSMB:         50,     // USD, SMB SaaS ARPU median (in dollars)
  arpuMid:         250,    // USD, mid-market SaaS ARPU median
};

function MRRBenchmarks({ currentMRR, mrrSeries, churnRate, arpu, currency }: {
  currentMRR: number; mrrSeries: number[]; churnRate: number; arpu: number; currency: string;
}) {
  // Compute MRR growth: compare last value to first non-zero value
  const firstMRR = mrrSeries.find((v) => v > 0) ?? 0;
  const mrrGrowthPct = firstMRR > 0 && currentMRR > firstMRR
    ? ((currentMRR - firstMRR) / firstMRR) * 100
    : null;

  // Arpu in dollars (stored in cents)
  const arpuDollars = arpu / 100;

  type BenchmarkItem = {
    label: string;
    yourValue: string;
    median: string;
    top25: string;
    status: "above" | "below" | "on" | "na";
    note: string;
  };

  const items: BenchmarkItem[] = [];

  if (mrrGrowthPct !== null) {
    const status = mrrGrowthPct >= SAAS_BENCHMARKS.mrrGrowthTop25 ? "above"
      : mrrGrowthPct >= SAAS_BENCHMARKS.mrrGrowthMedian ? "on" : "below";
    items.push({
      label: "MRR Growth",
      yourValue: `${mrrGrowthPct.toFixed(1)}%`,
      median: `${SAAS_BENCHMARKS.mrrGrowthMedian}%`,
      top25: `${SAAS_BENCHMARKS.mrrGrowthTop25}%`,
      status,
      note: status === "above" ? "Top quartile 🚀" : status === "on" ? "At median" : "Below median",
    });
  }

  if (churnRate > 0) {
    const status = churnRate <= SAAS_BENCHMARKS.churnTop25 ? "above"
      : churnRate <= SAAS_BENCHMARKS.churnMedian ? "on" : "below";
    items.push({
      label: "Monthly Churn",
      yourValue: `${churnRate.toFixed(1)}%`,
      median: `${SAAS_BENCHMARKS.churnMedian}%`,
      top25: `${SAAS_BENCHMARKS.churnTop25}%`,
      status,
      note: status === "above" ? "Top quartile 🎯" : status === "on" ? "At median" : "Above median (high churn)",
    });
  }

  if (arpuDollars > 0 && currency === "USD") {
    const status = arpuDollars >= SAAS_BENCHMARKS.arpuMid ? "above"
      : arpuDollars >= SAAS_BENCHMARKS.arpuSMB ? "on" : "below";
    items.push({
      label: "ARPU / Month",
      yourValue: `$${arpuDollars.toFixed(0)}`,
      median: `$${SAAS_BENCHMARKS.arpuSMB} (SMB)`,
      top25: `$${SAAS_BENCHMARKS.arpuMid}+ (Mid-market)`,
      status,
      note: status === "above" ? "Mid-market range 🏆" : status === "on" ? "SMB range" : "Below SMB median",
    });
  }

  if (items.length === 0) return null;

  const statusColor = (s: BenchmarkItem["status"]) =>
    s === "above" ? "#00d4aa" : s === "on" ? "#f59e0b" : "#f87171";

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <div>
          <h4 className="font-mono text-sm font-semibold text-[#f8f8fc]">SaaS Benchmarks</h4>
          <p className="font-mono text-[10px] text-[#8585aa]">How your metrics compare to industry medians</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#363650]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#363650] bg-[#222235]">
              {["Metric", "You", "SaaS Median", "Top 25%", "Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.label} className="border-b border-[#363650]/50">
                <td className="px-4 py-2.5 font-mono text-[11px] text-[#bcbcd8]">{item.label}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] font-bold" style={{ color: statusColor(item.status) }}>
                  {item.yourValue}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-[#8585aa]">{item.median}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-[#8585aa]">{item.top25}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold"
                    style={{ backgroundColor: statusColor(item.status) + "15", color: statusColor(item.status) }}
                  >
                    {item.note}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[9px] text-[#58588a]">
        Benchmarks from Baremetrics Open Startups, ChartMogul SaaS Report, OpenView SaaS Benchmarks 2024. MRR growth measured over the selected period.
      </p>
    </div>
  );
}

// ── Stripe Section ────────────────────────────────────────────────────────

function StripeSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped = groupSnapshots(
    snapshots, granularity,
    ["revenue", "txCount", "refunds", "newCustomers", "churnedToday"],
    [],
    ["mrr", "activeSubscriptions", "trialingSubscriptions", "arpu"]
  );
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));

  const revenue             = grouped.map((r) => r.data.revenue);
  const txCount             = grouped.map((r) => r.data.txCount);
  const newCustomers        = grouped.map((r) => r.data.newCustomers);
  const mrrSeries           = grouped.map((r) => r.data.mrr);

  const totalRevenue  = revenue.reduce((a, b) => a + b, 0);
  const totalTx       = txCount.reduce((a, b) => a + b, 0);
  const totalRefunds  = grouped.reduce((a, r) => a + r.data.refunds, 0);
  const totalNew      = newCustomers.reduce((a, b) => a + b, 0);
  const totalChurned  = grouped.reduce((a, r) => a + r.data.churnedToday, 0);
  const avgOrderVal   = totalTx > 0 ? totalRevenue / totalTx : 0;

  // Point-in-time subscription metrics — use latest non-zero value
  const currentMRR            = [...mrrSeries].reverse().find((v) => v > 0) ?? 0;
  const currentActiveSubs     = [...grouped].reverse().map((r) => r.data.activeSubscriptions).find((v) => v > 0) ?? 0;
  const currentTrialingSubs   = [...grouped].reverse().map((r) => r.data.trialingSubscriptions).find((v) => v > 0) ?? 0;
  const currentARPU           = [...grouped].reverse().map((r) => r.data.arpu).find((v) => v > 0) ?? 0;
  const churnRate             = currentActiveSubs > 0 ? ((totalChurned / currentActiveSubs) * 100) : 0;

  const hasSubscriptions = currentActiveSubs > 0 || currentMRR > 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency", currency),       raw: r.data.revenue },
      { label: "Transactions",  value: fmt(r.data.txCount),                              raw: r.data.txCount },
      { label: "New Customers", value: fmt(r.data.newCustomers),                         raw: r.data.newCustomers },
      { label: "Refunds",       value: fmt(r.data.refunds, "currency", currency),       raw: r.data.refunds },
      ...(hasSubscriptions ? [
        { label: "MRR",         value: fmt(r.data.mrr, "currency", currency),           raw: r.data.mrr },
        { label: "Active Subs", value: fmt(r.data.activeSubscriptions),                 raw: r.data.activeSubscriptions },
        { label: "Churned",     value: fmt(r.data.churnedToday),                        raw: r.data.churnedToday },
      ] : []),
    ],
  }));

  // ── Stripe-specific insights ──
  const stripeInsights = buildInsights({
    primary: { label: "Revenue", values: revenue, isCurrency: true, currency },
    secondary: [
      { label: "New customers", values: newCustomers },
      ...(hasSubscriptions ? [{ label: "MRR", values: mrrSeries }] : []),
    ],
    rateMetrics: [
      ...(churnRate > 0 ? [{ label: "Monthly churn rate", numerator: totalChurned, denominator: currentActiveSubs, suffix: "%", goodThreshold: 2.5, badThreshold: 5, lowerIsBetter: true }] : []),
      ...(totalTx > 0 ? [{ label: "Refund rate", numerator: totalRefunds, denominator: totalRevenue, suffix: "%", goodThreshold: 5, badThreshold: 10, lowerIsBetter: true }] : []),
    ],
    customInsights: [
      ...(currentMRR > 0 ? [{
        severity: "neutral" as const,
        headline: `ARR run rate: ${fmt(currentMRR * 12, "currency", currency)}`,
        detail: `Based on current MRR of ${fmt(currentMRR, "currency", currency)}. Maintaining this pace yields ${fmt(currentMRR * 12, "currency", currency)} annualised.`,
      }] : []),
    ],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 rounded-xl border border-[#635bff]/15 bg-[#635bff]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff]/15 text-[#635bff]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">
          Stripe Revenue{hasSubscriptions ? " & Subscriptions" : ""}
        </h3>
      </div>

      {/* ── Revenue row ── */}
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Revenue"   value={fmt(totalRevenue, "currency", currency)} values={revenue}      color="#635bff" sparkFormatter={(v) => fmt(v, "currency", currency)} periods={periods} />
        <StatCard label="Transactions"    value={fmt(totalTx)}                  values={txCount}      color="#635bff" periods={periods} />
        <StatCard label="New Customers"   value={fmt(totalNew)}                 values={newCustomers} color="#00d4aa" periods={periods} />
        <StatCard label="Avg Order Val"   value={fmt(avgOrderVal, "currency", currency)}  sub={`${fmt(totalRefunds, "currency", currency)} refunds`} values={revenue.length ? [avgOrderVal] : []} color="#f59e0b" sparkFormatter={(v) => fmt(v, "currency", currency)} />
      </StatCardGroup>

      {/* ── Subscription health row (only when subscription data exists) ── */}
      {hasSubscriptions && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-px flex-1 bg-[#363650]" />
            <span className="font-mono text-[10px] text-[#8585aa] uppercase tracking-widest">Subscription Health</span>
            <div className="h-px flex-1 bg-[#363650]" />
          </div>
          <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="MRR"
              value={fmt(currentMRR, "currency", currency)}
              sub="monthly recurring"
              values={mrrSeries}
              color="#a78bfa"
              sparkFormatter={(v) => fmt(v, "currency", currency)}
              periods={periods}
            />
            <StatCard
              label="Active Subs"
              value={fmt(currentActiveSubs)}
              sub={currentTrialingSubs > 0 ? `${currentTrialingSubs} trialing` : undefined}
              values={grouped.map((r) => r.data.activeSubscriptions)}
              color="#00d4aa"
              periods={periods}
            />
            <StatCard
              label="ARPU"
              value={fmt(currentARPU, "currency", currency)}
              sub="avg per subscriber/mo"
              values={grouped.map((r) => r.data.arpu)}
              color="#635bff"
              sparkFormatter={(v) => fmt(v, "currency", currency)}
              periods={periods}
            />
            <StatCard
              label="Churn"
              value={fmt(totalChurned)}
              sub={churnRate > 0 ? `${churnRate.toFixed(1)}% rate` : "cancellations"}
              values={grouped.map((r) => r.data.churnedToday)}
              color={churnRate > 5 ? "#f87171" : "#f59e0b"}
              periods={periods}
            />
          </StatCardGroup>
        </>
      )}

      <DataTable rows={tableRows} />
      <PlatformInsights insights={stripeInsights} />
      {hasSubscriptions && <MRRBenchmarks currentMRR={currentMRR} mrrSeries={mrrSeries} churnRate={churnRate} arpu={currentARPU} currency={currency} />}
    </div>
    </PeriodsCtx.Provider>
  );
}

function ProductBreakdownSection({ snapshots, currency = "USD" }: { snapshots: Snapshot[]; currency?: string }) {
  const products = useMemo(() => {
    // Aggregate revenue by product name / price ID across all snapshots.
    // Stripe sync stores either:
    //   data.products = [{ id, name, revenue, count }]  (array, preferred)
    //   data.topProduct / data.topProductRevenue        (legacy single-field)
    const map: Record<string, { revenue: number; count: number }> = {};

    for (const snap of snapshots) {
      if (snap.provider !== "stripe") continue;
      const d = snap.data as Record<string, unknown>;

      // Array form
      if (Array.isArray(d.products)) {
        for (const p of d.products as { id?: string; name?: string; revenue?: number; count?: number }[]) {
          const key = p.name ?? p.id ?? "Unknown";
          if (!map[key]) map[key] = { revenue: 0, count: 0 };
          map[key].revenue += p.revenue ?? 0;
          map[key].count   += p.count ?? 1;
        }
        continue;
      }

      // Legacy: topProduct + topProductRevenue
      if (d.topProduct) {
        const key = String(d.topProduct);
        if (!map[key]) map[key] = { revenue: 0, count: 0 };
        map[key].revenue += (d.topProductRevenue as number) ?? 0;
        map[key].count   += 1;
      }
    }

    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [snapshots]);

  if (products.length === 0) return null;

  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);
  const totalRevenue = products.reduce((a, p) => a + p.revenue, 0);
  const palette = ["#635bff", "#00d4aa", "#f59e0b", "#f87171", "#a78bfa", "#1877f2", "#34d399", "#fb923c"];

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Revenue by Product</h3>
        <span className="ml-auto font-mono text-[10px] text-[#8585aa]">{fmt(totalRevenue, "currency", currency)} total</span>
      </div>

      <div className="space-y-3">
        {products.map((p, i) => {
          const pct = Math.round((p.revenue / totalRevenue) * 100);
          const color = palette[i % palette.length];
          return (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-mono text-[10px] text-[#bcbcd8] truncate max-w-48">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[9px] text-[#8585aa]">{p.count} sales</span>
                  <span className="font-mono text-[10px] font-bold text-[#f8f8fc]">{fmt(p.revenue, "currency", currency)}</span>
                  <span className="font-mono text-[9px] text-[#8585aa] w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#363650]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(p.revenue / maxRevenue) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[9px] text-[#58588a]">
        Revenue aggregated from Stripe transactions across the selected time range. Product names sourced from Stripe price/product objects.
      </p>
    </div>
  );
}

// ── Cohort / Retention Section ────────────────────────────────────────────

function CohortSection({ snapshots }: { snapshots: Snapshot[] }) {
  // Build week-over-week retention grid.
  // Each cohort = week they first appeared. Columns = weeks since acquisition (W0..W4).
  // We approximate retention by tracking whether a customer who joined in week W
  // also made a transaction in week W+n.
  const cohortData = useMemo(() => {
    // Collect weekly buckets: week key → { newCustomers, totalTransactions }
    type WeekBucket = { newCustomers: number; totalTransactions: number };
    const weeks: Record<string, WeekBucket> = {};

    for (const snap of snapshots) {
      if (snap.provider !== "stripe") continue;
      const d = new Date(snap.date + "T12:00:00");
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil((((d.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weeks[key]) weeks[key] = { newCustomers: 0, totalTransactions: 0 };
      const data = snap.data as Record<string, number>;
      weeks[key].newCustomers += data.newCustomers ?? 0;
      weeks[key].totalTransactions += data.transactions ?? data.txCount ?? 0;
    }

    const sortedKeys = Object.keys(weeks).sort().slice(-10); // last 10 weeks
    if (sortedKeys.length < 2) return null;

    // Build cohort rows: cohort week → retention % for W0, W1, W2, W3, W4
    // W0 = acquisition week (always 100%), W1..W4 = returning % estimated from
    // totalTransactions in that later week vs cohort size
    type CohortRow = { week: string; cohortSize: number; retention: (number | null)[] };
    const rows: CohortRow[] = sortedKeys.slice(0, -1).map((key, i) => {
      const cohortSize = weeks[key].newCustomers;
      const retention: (number | null)[] = [100]; // W0 = 100%
      for (let w = 1; w <= 4; w++) {
        const futureKey = sortedKeys[i + w];
        if (!futureKey || cohortSize === 0) {
          retention.push(null);
        } else {
          const returning = Math.max(0, (weeks[futureKey]?.totalTransactions ?? 0) - (weeks[futureKey]?.newCustomers ?? 0));
          retention.push(Math.min(100, Math.round((returning / cohortSize) * 100)));
        }
      }
      return { week: key, cohortSize, retention };
    });

    // Average retention per column (excluding null cells)
    const avgRetention: (number | null)[] = [100];
    for (let w = 1; w <= 4; w++) {
      const vals = rows.map((r) => r.retention[w]).filter((v): v is number => v !== null);
      avgRetention.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
    }

    return { rows: rows.slice(-6), avgRetention }; // show last 6 cohorts
  }, [snapshots]);

  if (!cohortData || cohortData.rows.length === 0) return null;

  function retColor(pct: number | null): string {
    if (pct === null) return "transparent";
    if (pct >= 80) return "#00d4aa";
    if (pct >= 60) return "#34d399";
    if (pct >= 40) return "#f59e0b";
    if (pct >= 20) return "#fb923c";
    return "#f87171";
  }

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Retention Cohorts</h3>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#58588a]">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#00d4aa" }} />≥80%
          <span className="w-2 h-2 rounded-sm ml-1" style={{ backgroundColor: "#f59e0b" }} />≥40%
          <span className="w-2 h-2 rounded-sm ml-1" style={{ backgroundColor: "#f87171" }} />&lt;20%
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pb-2 pr-4 font-mono text-[9px] uppercase tracking-widest text-[#8585aa] whitespace-nowrap">Cohort week</th>
              <th className="pb-2 pr-4 font-mono text-[9px] uppercase tracking-widest text-[#8585aa] text-right">Size</th>
              {["W0", "W1", "W2", "W3", "W4"].map((w) => (
                <th key={w} className="pb-2 px-2 font-mono text-[9px] uppercase tracking-widest text-[#8585aa] text-center">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohortData.rows.map((row) => (
              <tr key={row.week} className="border-t border-[#363650]/40">
                <td className="py-1.5 pr-4 font-mono text-[10px] text-[#bcbcd8] whitespace-nowrap">{row.week}</td>
                <td className="py-1.5 pr-4 font-mono text-[10px] text-[#8585aa] text-right">{row.cohortSize}</td>
                {row.retention.map((pct, i) => (
                  <td key={i} className="py-1.5 px-2 text-center">
                    {pct !== null ? (
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        style={{ backgroundColor: retColor(pct) + "22", color: retColor(pct) }}
                      >
                        {pct}%
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[#363650]">–</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {/* Average row */}
            <tr className="border-t-2 border-[#363650]">
              <td className="pt-2 pr-4 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Avg</td>
              <td />
              {cohortData.avgRetention.map((pct, i) => (
                <td key={i} className="pt-2 px-2 text-center">
                  {pct !== null ? (
                    <span
                      className="inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                      style={{ backgroundColor: retColor(pct) + "22", color: retColor(pct) }}
                    >
                      {pct}%
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[#363650]">–</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[9px] text-[#58588a]">
        W0 = acquisition week (always 100%). W1–W4 = % of cohort who transacted in subsequent weeks. Estimated from daily Stripe snapshots.
      </p>
    </div>
  );
}

function GA4Section({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["sessions", "users", "newUsers", "conversions"], ["bounceRate", "avgSessionDuration"]);
  const periods     = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sessions    = grouped.map((r) => r.data.sessions);
  const users       = grouped.map((r) => r.data.users);
  const conversions = grouped.map((r) => r.data.conversions);
  const bounceRates = grouped.map((r) => r.data.bounceRate);

  const totalSessions    = sessions.reduce((a, b) => a + b, 0);
  const totalUsers       = users.reduce((a, b) => a + b, 0);
  const totalConversions = conversions.reduce((a, b) => a + b, 0);
  const avgBounce        = bounceRates.length ? bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length : 0;
  const convRate         = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sessions",    value: fmt(r.data.sessions),                     raw: r.data.sessions },
      { label: "Users",       value: fmt(r.data.users),                        raw: r.data.users },
      { label: "Conversions", value: fmt(r.data.conversions),                  raw: r.data.conversions },
      { label: "Bounce Rate", value: fmt(r.data.bounceRate, "percent"),        raw: r.data.bounceRate },
    ],
  }));

  const ga4Insights = buildInsights({
    primary: { label: "Sessions", values: sessions },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: [
      { label: "Conversion rate", numerator: totalConversions, denominator: totalSessions, suffix: "%", goodThreshold: 2, badThreshold: 0.5 },
      { label: "Bounce rate", numerator: totalSessions * avgBounce / 100, denominator: totalSessions, suffix: "%", goodThreshold: 40, badThreshold: 70, lowerIsBetter: true },
    ],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#f59e0b]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Google Analytics 4</h3>
      </div>
      <PeriodCompare values={sessions} label="Sessions" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions"        value={fmt(totalSessions)}    values={sessions}    color="#f59e0b" periods={periods} />
        <StatCard label="Users"           value={fmt(totalUsers)}       values={users}       color="#f59e0b" periods={periods} />
        <StatCard label="Conversions"     value={fmt(totalConversions)} sub={`${convRate.toFixed(1)}% conv rate`} values={conversions} color="#00d4aa" periods={periods} />
        <StatCard label="Avg Bounce Rate" value={fmt(avgBounce, "percent")} values={bounceRates} color="#f87171" periods={periods} />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={ga4Insights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function MetaSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["spend", "impressions", "clicks", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));

  const spend       = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const clicks      = grouped.map((r) => r.data.clicks);
  const conversions = grouped.map((r) => r.data.conversions);

  const totalSpend       = spend.reduce((a, b) => a + b, 0);
  const totalImpressions = impressions.reduce((a, b) => a + b, 0);
  const totalClicks      = clicks.reduce((a, b) => a + b, 0);
  const totalConversions = conversions.reduce((a, b) => a + b, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  // Pick currency from the most recent snapshot that has one; fall back to USD
  const currency: string =
    ([...snapshots].reverse().find((s) => (s.data as Record<string, unknown>)?.currency) as { data: Record<string, unknown> } | undefined)
      ?.data.currency as string ?? "USD";

  // Format spend with the real account currency using the browser's Intl API
  const fmtSpend = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const tableRows = grouped.map((r) => {
    const rowCpc = r.data.clicks > 0 ? r.data.spend / r.data.clicks : 0;
    return {
      period: fmtPeriod(r.period, granularity),
      cells: [
        { label: "Spend",       value: fmtSpend(r.data.spend),       raw: r.data.spend },
        { label: "Impressions", value: fmt(r.data.impressions),       raw: r.data.impressions },
        { label: "Clicks",      value: fmt(r.data.clicks),            raw: r.data.clicks },
        { label: "CPC",         value: fmtSpend(rowCpc),              raw: rowCpc },
        { label: "Conversions", value: fmt(r.data.conversions),       raw: r.data.conversions },
      ],
    };
  });

  const metaInsights = buildInsights({
    primary: { label: "Ad spend", values: spend },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: [
      { label: "Click-through rate (CTR)", numerator: totalClicks, denominator: totalImpressions, suffix: "%", goodThreshold: 2, badThreshold: 0.5 },
      ...(totalConversions > 0 ? [{ label: "Conversion rate on clicks", numerator: totalConversions, denominator: totalClicks, suffix: "%", goodThreshold: 3 }] : []),
    ],
    customInsights: totalClicks > 0 && totalSpend > 0 ? [{
      severity: cpc < 1 ? "positive" as const : cpc < 3 ? "neutral" as const : "warning" as const,
      headline: `Average CPC: ${fmtSpend(cpc)}`,
      detail: `${fmt(totalClicks)} clicks at ${fmtSpend(cpc)} each. ${cpc < 1 ? "Strong efficiency — below $1 CPC." : cpc < 3 ? "CPC in normal range." : "CPC is elevated — consider refining targeting or creative."}`,
    }] : [],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1877f2]/15 bg-[#1877f2]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877f2]/15 text-[#1877f2]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Meta Ads</h3>
        {currency !== "USD" && (
          <span className="ml-auto font-mono text-[10px] text-[#8585aa] bg-[#363650] px-2 py-0.5 rounded-full">
            {currency}
          </span>
        )}
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency={currency} label="Ad Spend" />
      <PeriodCompare values={spend} label="Ad Spend" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ad Spend"    value={fmtSpend(totalSpend)}  values={spend}       color="#1877f2" />
        <StatCard label="Impressions" value={fmt(totalImpressions)}  values={impressions} color="#1877f2" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}       sub={`${ctr.toFixed(2)}% CTR`} values={clicks} color="#00d4aa" />
        <StatCard label="CPC"         value={fmtSpend(cpc)}          sub={`${fmt(totalConversions)} conversions`} values={spend.length ? [cpc] : []} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={metaInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PayPalSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["revenue", "fees", "netRevenue", "txCount"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));

  const revenues    = grouped.map((r) => r.data.revenue);
  const fees        = grouped.map((r) => r.data.fees);
  const netRevenues = grouped.map((r) => r.data.netRevenue);
  const txCounts    = grouped.map((r) => r.data.txCount);

  const totalRevenue    = revenues.reduce((a, b) => a + b, 0);
  const totalFees       = fees.reduce((a, b) => a + b, 0);
  const totalNet        = netRevenues.reduce((a, b) => a + b, 0);
  const totalTx         = txCounts.reduce((a, b) => a + b, 0);
  const avgOrderValue   = totalTx > 0 ? totalRevenue / totalTx : 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",     value: fmt(r.data.revenue,    "currency", currency), raw: r.data.revenue },
      { label: "Fees",        value: fmt(r.data.fees,       "currency", currency), raw: r.data.fees },
      { label: "Net Revenue", value: fmt(r.data.netRevenue, "currency", currency), raw: r.data.netRevenue },
      { label: "Tx Count",    value: fmt(r.data.txCount),                           raw: r.data.txCount },
    ],
  }));

  const paypalInsights = buildInsights({
    primary: { label: "Revenue", values: revenues, isCurrency: true, currency },
    secondary: [{ label: "Transactions", values: txCounts }],
    rateMetrics: totalRevenue > 0 ? [{ label: "Fee rate", numerator: totalFees, denominator: totalRevenue, suffix: "%", goodThreshold: 4, badThreshold: 6, lowerIsBetter: true }] : [],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#003087]/20 bg-[#003087]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087]/15 text-[#009cde]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.79A.859.859 0 0 1 5.79 2h7.518c2.58 0 4.383.596 5.36 1.77.948 1.14 1.178 2.622.683 4.395-.038.14-.08.283-.124.428C18.05 11.1 15.98 12.5 13.1 12.5H9.77l-1.067 6.31a.641.641 0 0 1-.627.527z" />
            <path d="M19.873 7.93c-.04.155-.083.313-.13.474C18.65 12.14 16.2 13.8 12.49 13.8H9.62l-1.2 7.09a.501.501 0 0 0 .494.587h3.47a.75.75 0 0 0 .74-.632l.031-.158.588-3.726.038-.204a.75.75 0 0 1 .74-.633h.465c3.02 0 5.386-1.228 6.077-4.78.29-1.486.14-2.727-.623-3.6a3.3 3.3 0 0 0-.567-.413z" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">PayPal</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenues} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"     value={fmt(totalRevenue,  "currency", currency)} values={revenues}    color="#009cde" />
        <StatCard label="Net Revenue" value={fmt(totalNet,      "currency", currency)} values={netRevenues} color="#00d4aa" />
        <StatCard label="Fees Paid"   value={fmt(totalFees,     "currency", currency)} values={fees}        color="#f87171" />
        <StatCard label="Avg Order"   value={fmt(avgOrderValue, "currency", currency)} sub={`${fmt(totalTx)} tx`} values={txCounts} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={paypalInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PaddleSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["revenue", "fees", "netRevenue", "txCount"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));

  const revenues    = grouped.map((r) => r.data.revenue);
  const fees        = grouped.map((r) => r.data.fees);
  const netRevenues = grouped.map((r) => r.data.netRevenue);
  const txCounts    = grouped.map((r) => r.data.txCount);

  const totalRevenue  = revenues.reduce((a, b) => a + b, 0);
  const totalFees     = fees.reduce((a, b) => a + b, 0);
  const totalNet      = netRevenues.reduce((a, b) => a + b, 0);
  const totalTx       = txCounts.reduce((a, b) => a + b, 0);
  const avgOrderValue = totalTx > 0 ? totalRevenue / totalTx : 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",     value: fmt(r.data.revenue,    "currency", currency), raw: r.data.revenue },
      { label: "Fees",        value: fmt(r.data.fees,       "currency", currency), raw: r.data.fees },
      { label: "Net Revenue", value: fmt(r.data.netRevenue, "currency", currency), raw: r.data.netRevenue },
      { label: "Tx Count",    value: fmt(r.data.txCount),                           raw: r.data.txCount },
    ],
  }));

  const paddleInsights = buildInsights({
    primary: { label: "Revenue", values: revenues, isCurrency: true, currency },
    secondary: [{ label: "Transactions", values: txCounts }],
    rateMetrics: totalRevenue > 0 ? [{ label: "Fee rate", numerator: totalFees, denominator: totalRevenue, suffix: "%", goodThreshold: 5, badThreshold: 8, lowerIsBetter: true }] : [],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#3ddc97]/15 bg-[#3ddc97]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ddc97]/15 text-[#3ddc97]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.133c-.144.668-.52.835-.996.52l-2.75-2.026-1.328 1.277c-.147.147-.27.27-.552.27l.196-2.797 5.086-4.593c.221-.196-.048-.306-.342-.11L6.78 14.748l-2.716-.848c-.59-.184-.6-.59.123-.872l10.605-4.087c.49-.18.92.112.77.307z"/>
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Paddle</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenues} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"     value={fmt(totalRevenue,  "currency", currency)} values={revenues}    color="#3ddc97" />
        <StatCard label="Net Revenue" value={fmt(totalNet,      "currency", currency)} values={netRevenues} color="#00d4aa" />
        <StatCard label="Fees Paid"   value={fmt(totalFees,     "currency", currency)} values={fees}        color="#f87171" />
        <StatCard label="Avg Order"   value={fmt(avgOrderValue, "currency", currency)} sub={`${fmt(totalTx)} tx`} values={txCounts} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={paddleInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function LemonSqueezySection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["revenue", "fees", "netRevenue", "txCount"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));

  const revenues    = grouped.map((r) => r.data.revenue);
  const fees        = grouped.map((r) => r.data.fees);
  const netRevenues = grouped.map((r) => r.data.netRevenue);
  const txCounts    = grouped.map((r) => r.data.txCount);

  const totalRevenue  = revenues.reduce((a, b) => a + b, 0);
  const totalFees     = fees.reduce((a, b) => a + b, 0);
  const totalNet      = netRevenues.reduce((a, b) => a + b, 0);
  const totalTx       = txCounts.reduce((a, b) => a + b, 0);
  const avgOrderValue = totalTx > 0 ? totalRevenue / totalTx : 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",     value: fmt(r.data.revenue,    "currency", currency), raw: r.data.revenue },
      { label: "Fees",        value: fmt(r.data.fees,       "currency", currency), raw: r.data.fees },
      { label: "Net Revenue", value: fmt(r.data.netRevenue, "currency", currency), raw: r.data.netRevenue },
      { label: "Tx Count",    value: fmt(r.data.txCount),                           raw: r.data.txCount },
    ],
  }));

  const lemonInsights = buildInsights({
    primary: { label: "Revenue", values: revenues, isCurrency: true, currency },
    secondary: [{ label: "Transactions", values: txCounts }],
    rateMetrics: totalRevenue > 0 ? [{ label: "Fee rate", numerator: totalFees, denominator: totalRevenue, suffix: "%", goodThreshold: 5, badThreshold: 10, lowerIsBetter: true }] : [],
  });

  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FFC233]/15 bg-[#FFC233]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFC233]/15 text-[#FFC233]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Lemon Squeezy</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenues} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"     value={fmt(totalRevenue,  "currency", currency)} values={revenues}    color="#FFC233" />
        <StatCard label="Net Revenue" value={fmt(totalNet,      "currency", currency)} values={netRevenues} color="#f59e0b" />
        <StatCard label="Fees Paid"   value={fmt(totalFees,     "currency", currency)} values={fees}        color="#f87171" />
        <StatCard label="Avg Order"   value={fmt(avgOrderValue, "currency", currency)} sub={`${fmt(totalTx)} tx`} values={txCounts} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={lemonInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function GumroadSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped = groupSnapshots(snapshots, granularity, ["revenue", "fees", "netRevenue", "txCount"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenues    = grouped.map((r) => r.data.revenue);
  const fees        = grouped.map((r) => r.data.fees);
  const netRevenues = grouped.map((r) => r.data.netRevenue);
  const txCounts    = grouped.map((r) => r.data.txCount);
  const totalRevenue  = revenues.reduce((a, b) => a + b, 0);
  const totalFees     = fees.reduce((a, b) => a + b, 0);
  const totalNet      = netRevenues.reduce((a, b) => a + b, 0);
  const totalTx       = txCounts.reduce((a, b) => a + b, 0);
  const avgOrderValue = totalTx > 0 ? totalRevenue / totalTx : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",     value: fmt(r.data.revenue,    "currency", currency), raw: r.data.revenue },
      { label: "Fees",        value: fmt(r.data.fees,       "currency", currency), raw: r.data.fees },
      { label: "Net Revenue", value: fmt(r.data.netRevenue, "currency", currency), raw: r.data.netRevenue },
      { label: "Tx Count",    value: fmt(r.data.txCount),                           raw: r.data.txCount },
    ],
  }));
  const gumroadInsights = buildInsights({
    primary: { label: "Revenue", values: revenues, isCurrency: true, currency },
    secondary: [{ label: "Transactions", values: txCounts }],
    rateMetrics: totalRevenue > 0 ? [{ label: "Fee rate", numerator: totalFees, denominator: totalRevenue, suffix: "%", goodThreshold: 8, badThreshold: 12, lowerIsBetter: true }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#ff90e8]/15 bg-[#ff90e8]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff90e8]/15 font-mono text-sm font-bold text-[#ff90e8]">G</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Gumroad</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenues} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"     value={fmt(totalRevenue,  "currency", currency)} values={revenues}    color="#ff90e8" />
        <StatCard label="Net Revenue" value={fmt(totalNet,      "currency", currency)} values={netRevenues} color="#f59e0b" />
        <StatCard label="Fees Paid"   value={fmt(totalFees,     "currency", currency)} values={fees}        color="#f87171" />
        <StatCard label="Avg Order"   value={fmt(avgOrderValue, "currency", currency)} sub={`${fmt(totalTx)} tx`} values={txCounts} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={gumroadInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PlausibleSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity, ["visitors", "pageviews", "bounceRate", "visitDuration"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const visitors     = grouped.map((r) => r.data.visitors);
  const pageviews    = grouped.map((r) => r.data.pageviews);
  const bounceRates  = grouped.map((r) => r.data.bounceRate);
  const durations    = grouped.map((r) => r.data.visitDuration);
  const totalVisitors  = visitors.reduce((a, b) => a + b, 0);
  const totalPageviews = pageviews.reduce((a, b) => a + b, 0);
  const avgBounce      = bounceRates.length > 0 ? bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length : 0;
  const avgDuration    = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Visitors",     value: fmt(r.data.visitors),                              raw: r.data.visitors },
      { label: "Pageviews",    value: fmt(r.data.pageviews),                             raw: r.data.pageviews },
      { label: "Bounce Rate",  value: `${(r.data.bounceRate ?? 0).toFixed(1)}%`,         raw: r.data.bounceRate },
      { label: "Avg Duration", value: `${Math.round(r.data.visitDuration ?? 0)}s`,       raw: r.data.visitDuration },
    ],
  }));
  const plausibleInsights = buildInsights({
    primary: { label: "Visitors", values: visitors },
    secondary: [{ label: "Pageviews", values: pageviews }],
    rateMetrics: [
      { label: "Bounce rate", numerator: avgBounce * bounceRates.length, denominator: bounceRates.length || 1, suffix: "%", goodThreshold: 40, badThreshold: 70, lowerIsBetter: true },
    ],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#5850ec]/15 bg-[#5850ec]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5850ec]/15 font-mono text-sm font-bold text-[#5850ec]">P</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Plausible</h3>
      </div>
      <PeriodCompare values={visitors} label="Visitors" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Visitors"    value={fmt(totalVisitors)}                            values={visitors}    color="#5850ec" />
        <StatCard label="Pageviews"   value={fmt(totalPageviews)}                           values={pageviews}   color="#818cf8" />
        <StatCard label="Bounce Rate" value={`${avgBounce.toFixed(1)}%`}                   values={bounceRates} color="#f87171" />
        <StatCard label="Avg Duration" value={`${Math.round(avgDuration)}s`}               values={durations}   color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={plausibleInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function MixpanelSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["events", "uniqueUsers"], []);
  const periods    = grouped.map((r) => fmtPeriod(r.period, granularity));
  const events     = grouped.map((r) => r.data.events);
  const users      = grouped.map((r) => r.data.uniqueUsers);
  const totalEvents = events.reduce((a, b) => a + b, 0);
  const totalUsers  = users.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Events",       value: fmt(r.data.events),      raw: r.data.events },
      { label: "Unique Users", value: fmt(r.data.uniqueUsers), raw: r.data.uniqueUsers },
    ],
  }));
  const mixpanelInsights = buildInsights({
    primary: { label: "Events", values: events },
    secondary: [{ label: "Unique Users", values: users }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#7856ff]/15 bg-[#7856ff]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7856ff]/15 font-mono text-[10px] font-bold text-[#7856ff]">MX</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Mixpanel</h3>
      </div>
      <PeriodCompare values={events} label="Events" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard label="Total Events"  value={fmt(totalEvents)} values={events} color="#7856ff" />
        <StatCard label="Unique Users"  value={fmt(totalUsers)}  values={users}  color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={mixpanelInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function AmplitudeSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["activeUsers", "totalEvents", "newUsers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const activeUsers = grouped.map((r) => r.data.activeUsers);
  const events      = grouped.map((r) => r.data.totalEvents);
  const newUsers    = grouped.map((r) => r.data.newUsers);
  const totalActive = activeUsers.reduce((a, b) => a + b, 0);
  const totalEvents = events.reduce((a, b) => a + b, 0);
  const totalNew    = newUsers.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Active Users",  value: fmt(r.data.activeUsers),  raw: r.data.activeUsers },
      { label: "Total Events",  value: fmt(r.data.totalEvents),  raw: r.data.totalEvents },
      { label: "New Users",     value: fmt(r.data.newUsers),     raw: r.data.newUsers },
    ],
  }));
  const amplitudeInsights = buildInsights({
    primary: { label: "Active Users", values: activeUsers },
    secondary: [{ label: "New Users", values: newUsers }, { label: "Events", values: events }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1e73be]/15 bg-[#1e73be]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e73be]/15 font-mono text-sm font-bold text-[#1e73be]">A</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Amplitude</h3>
      </div>
      <PeriodCompare values={activeUsers} label="Active Users" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active Users" value={fmt(totalActive)} values={activeUsers} color="#1e73be" />
        <StatCard label="Total Events" value={fmt(totalEvents)} values={events}      color="#3b82f6" />
        <StatCard label="New Users"    value={fmt(totalNew)}    values={newUsers}    color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={amplitudeInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PostHogSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["pageviews", "uniqueUsers", "sessions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const pageviews   = grouped.map((r) => r.data.pageviews);
  const users       = grouped.map((r) => r.data.uniqueUsers);
  const sessions    = grouped.map((r) => r.data.sessions);
  const totalPV     = pageviews.reduce((a, b) => a + b, 0);
  const totalUsers  = users.reduce((a, b) => a + b, 0);
  const totalSess   = sessions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Pageviews",    value: fmt(r.data.pageviews),    raw: r.data.pageviews },
      { label: "Unique Users", value: fmt(r.data.uniqueUsers),  raw: r.data.uniqueUsers },
      { label: "Sessions",     value: fmt(r.data.sessions),     raw: r.data.sessions },
    ],
  }));
  const posthogInsights = buildInsights({
    primary: { label: "Pageviews", values: pageviews },
    secondary: [{ label: "Unique Users", values: users }, { label: "Sessions", values: sessions }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f76300]/15 bg-[#f76300]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f76300]/15 font-mono text-[10px] font-bold text-[#f76300]">PH</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">PostHog</h3>
      </div>
      <PeriodCompare values={pageviews} label="Pageviews" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Pageviews"    value={fmt(totalPV)}    values={pageviews} color="#f76300" />
        <StatCard label="Unique Users" value={fmt(totalUsers)} values={users}     color="#fb923c" />
        <StatCard label="Sessions"     value={fmt(totalSess)}  values={sessions}  color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={posthogInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function FathomSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["pageviews", "uniques", "visits", "bounceRate", "avgDuration"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const pageviews   = grouped.map((r) => r.data.pageviews);
  const uniques     = grouped.map((r) => r.data.uniques);
  const bounceRates = grouped.map((r) => r.data.bounceRate);
  const durations   = grouped.map((r) => r.data.avgDuration);
  const totalPV     = pageviews.reduce((a, b) => a + b, 0);
  const totalUniq   = uniques.reduce((a, b) => a + b, 0);
  const avgBounce   = bounceRates.length > 0 ? bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length : 0;
  const avgDur      = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Pageviews",    value: fmt(r.data.pageviews),                          raw: r.data.pageviews },
      { label: "Uniques",      value: fmt(r.data.uniques),                            raw: r.data.uniques },
      { label: "Bounce Rate",  value: `${(r.data.bounceRate ?? 0).toFixed(1)}%`,      raw: r.data.bounceRate },
      { label: "Avg Duration", value: `${Math.round(r.data.avgDuration ?? 0)}s`,      raw: r.data.avgDuration },
    ],
  }));
  const fathomInsights = buildInsights({
    primary: { label: "Pageviews", values: pageviews },
    secondary: [{ label: "Uniques", values: uniques }],
    rateMetrics: [{ label: "Bounce rate", numerator: avgBounce * bounceRates.length, denominator: bounceRates.length || 1, suffix: "%", goodThreshold: 40, badThreshold: 70, lowerIsBetter: true }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#9333ea]/15 bg-[#9333ea]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9333ea]/15 font-mono text-[10px] font-bold text-[#9333ea]">FA</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Fathom</h3>
      </div>
      <PeriodCompare values={pageviews} label="Pageviews" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pageviews"    value={fmt(totalPV)}            values={pageviews}   color="#9333ea" />
        <StatCard label="Uniques"      value={fmt(totalUniq)}          values={uniques}     color="#c084fc" />
        <StatCard label="Bounce Rate"  value={`${avgBounce.toFixed(1)}%`} values={bounceRates} color="#f87171" />
        <StatCard label="Avg Duration" value={`${Math.round(avgDur)}s`}   values={durations}   color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={fathomInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function GoogleAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "clicks", "impressions", "conversions", "ctr"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const clicks      = grouped.map((r) => r.data.clicks);
  const impressions = grouped.map((r) => r.data.impressions);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",        value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Clicks",       value: fmt(r.data.clicks),                    raw: r.data.clicks },
      { label: "Impressions",  value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Conversions",  value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const googleAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }, { label: "Clicks", values: clicks }],
    rateMetrics: totalClicks > 0 ? [
      { label: "CTR", numerator: totalClicks, denominator: totalImpr || 1, suffix: "%", goodThreshold: 3, badThreshold: 1, lowerIsBetter: false },
      { label: "Conv rate", numerator: totalConv, denominator: totalClicks, suffix: "%", goodThreshold: 3, badThreshold: 1, lowerIsBetter: false },
    ] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#4285F4]/15 bg-[#4285F4]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4285F4]/15 font-mono text-[10px] font-bold text-[#4285F4]">GA</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Google Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#4285F4" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}            values={clicks}      color="#34A853" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#FBBC05" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#EA4335" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={googleAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function TikTokAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "impressions", "clicks", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const clicks      = grouped.map((r) => r.data.clicks);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Impressions", value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Clicks",      value: fmt(r.data.clicks),                    raw: r.data.clicks },
      { label: "Conversions", value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const tiktokAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: totalClicks > 0 ? [{ label: "CTR", numerator: totalClicks, denominator: totalImpr || 1, suffix: "%", goodThreshold: 1.5, badThreshold: 0.5, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#69C9D0]/15 bg-[#69C9D0]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#69C9D0]/15 font-mono text-[10px] font-bold text-[#69C9D0]">TT</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">TikTok Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#69C9D0" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#ee1d52" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}            values={clicks}      color="#f59e0b" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={tiktokAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function TwitterAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "impressions", "clicks", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const clicks      = grouped.map((r) => r.data.clicks);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Impressions", value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Clicks",      value: fmt(r.data.clicks),                    raw: r.data.clicks },
      { label: "Conversions", value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const twitterAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: totalClicks > 0 ? [{ label: "CTR", numerator: totalClicks, denominator: totalImpr || 1, suffix: "%", goodThreshold: 1, badThreshold: 0.3, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1d9bf0]/15 bg-[#1d9bf0]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d9bf0]/15 font-mono text-[10px] font-bold text-[#1d9bf0]">XA</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">X (Twitter) Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#1d9bf0" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#60a5fa" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}            values={clicks}      color="#00d4aa" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={twitterAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function LinkedInAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "impressions", "clicks", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const clicks      = grouped.map((r) => r.data.clicks);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Impressions", value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Clicks",      value: fmt(r.data.clicks),                    raw: r.data.clicks },
      { label: "Conversions", value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const linkedInAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: totalClicks > 0 ? [{ label: "CTR", numerator: totalClicks, denominator: totalImpr || 1, suffix: "%", goodThreshold: 0.6, badThreshold: 0.2, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#0a66c2]/15 bg-[#0a66c2]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a66c2]/15 font-mono text-[10px] font-bold text-[#0a66c2]">LI</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">LinkedIn Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#0a66c2" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#3b82f6" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}            values={clicks}      color="#00d4aa" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={linkedInAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function SnapchatAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "impressions", "swipes", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const swipes      = grouped.map((r) => r.data.swipes);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalSwipes = swipes.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Impressions", value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Swipes",      value: fmt(r.data.swipes),                    raw: r.data.swipes },
      { label: "Conversions", value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const snapchatAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f5c518]/15 bg-[#f5c518]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5c518]/15 font-mono text-[10px] font-bold text-[#f5c518]">SC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Snapchat Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#f5c518" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#fbbf24" />
        <StatCard label="Swipes"      value={fmt(totalSwipes)}            values={swipes}      color="#00d4aa" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#f87171" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={snapchatAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PinterestAdsSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["spend", "impressions", "clicks", "conversions"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const spends      = grouped.map((r) => r.data.spend);
  const impressions = grouped.map((r) => r.data.impressions);
  const clicks      = grouped.map((r) => r.data.clicks);
  const conversions = grouped.map((r) => r.data.conversions);
  const totalSpend  = spends.reduce((a, b) => a + b, 0);
  const totalImpr   = impressions.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${(r.data.spend ?? 0).toFixed(2)}`,  raw: r.data.spend },
      { label: "Impressions", value: fmt(r.data.impressions),               raw: r.data.impressions },
      { label: "Clicks",      value: fmt(r.data.clicks),                    raw: r.data.clicks },
      { label: "Conversions", value: fmt(r.data.conversions),               raw: r.data.conversions },
    ],
  }));
  const pinterestAdsInsights = buildInsights({
    primary: { label: "Spend", values: spends, isCurrency: true },
    secondary: [{ label: "Conversions", values: conversions }],
    rateMetrics: totalClicks > 0 ? [{ label: "CTR", numerator: totalClicks, denominator: totalImpr || 1, suffix: "%", goodThreshold: 0.5, badThreshold: 0.2, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#E60023]/15 bg-[#E60023]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E60023]/15 font-mono text-[10px] font-bold text-[#E60023]">PT</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Pinterest Ads</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="spend" currency="USD" label="Ad Spend" />
      <PeriodCompare values={spends} label="Ad Spend" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend"       value={`$${totalSpend.toFixed(2)}`} values={spends}      color="#E60023" />
        <StatCard label="Impressions" value={fmt(totalImpr)}              values={impressions} color="#f87171" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}            values={clicks}      color="#f59e0b" />
        <StatCard label="Conversions" value={fmt(totalConv)}              values={conversions} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={pinterestAdsInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function MailchimpSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped       = groupSnapshots(snapshots, granularity, ["emailsSent", "opens", "clicks", "subscribers", "unsubscribes"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sent          = grouped.map((r) => r.data.emailsSent);
  const opens         = grouped.map((r) => r.data.opens);
  const clicks        = grouped.map((r) => r.data.clicks);
  const subs          = grouped.map((r) => r.data.subscribers);
  const totalSent     = sent.reduce((a, b) => a + b, 0);
  const totalOpens    = opens.reduce((a, b) => a + b, 0);
  const totalClicks   = clicks.reduce((a, b) => a + b, 0);
  const lastSubs      = subs.length > 0 ? subs[subs.length - 1] : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sent",         value: fmt(r.data.emailsSent),    raw: r.data.emailsSent },
      { label: "Opens",        value: fmt(r.data.opens),         raw: r.data.opens },
      { label: "Clicks",       value: fmt(r.data.clicks),        raw: r.data.clicks },
      { label: "Subscribers",  value: fmt(r.data.subscribers),   raw: r.data.subscribers },
    ],
  }));
  const mailchimpInsights = buildInsights({
    primary: { label: "Subscribers", values: subs },
    secondary: [{ label: "Opens", values: opens }],
    rateMetrics: totalSent > 0 ? [
      { label: "Open rate", numerator: totalOpens, denominator: totalSent, suffix: "%", goodThreshold: 25, badThreshold: 15, lowerIsBetter: false },
      { label: "Click rate", numerator: totalClicks, denominator: totalSent, suffix: "%", goodThreshold: 3, badThreshold: 1, lowerIsBetter: false },
    ] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/15 font-mono text-[10px] font-bold text-[#f59e0b]">MC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Mailchimp</h3>
      </div>
      <PeriodCompare values={subs} label="Subscribers" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Emails Sent" value={fmt(totalSent)}   values={sent}   color="#f59e0b" />
        <StatCard label="Opens"       value={fmt(totalOpens)}  values={opens}  color="#fbbf24" />
        <StatCard label="Clicks"      value={fmt(totalClicks)} values={clicks} color="#00d4aa" />
        <StatCard label="Subscribers" value={fmt(lastSubs)}    values={subs}   color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={mailchimpInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function KlaviyoSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["emailsSent", "opens", "clicks", "revenue"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sent        = grouped.map((r) => r.data.emailsSent);
  const opens       = grouped.map((r) => r.data.opens);
  const clicks      = grouped.map((r) => r.data.clicks);
  const revenues    = grouped.map((r) => r.data.revenue);
  const totalSent   = sent.reduce((a, b) => a + b, 0);
  const totalOpens  = opens.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalRev    = revenues.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sent",    value: fmt(r.data.emailsSent),                       raw: r.data.emailsSent },
      { label: "Opens",   value: fmt(r.data.opens),                           raw: r.data.opens },
      { label: "Clicks",  value: fmt(r.data.clicks),                          raw: r.data.clicks },
      { label: "Revenue", value: `$${(r.data.revenue ?? 0).toFixed(2)}`,      raw: r.data.revenue },
    ],
  }));
  const klaviyoInsights = buildInsights({
    primary: { label: "Revenue", values: revenues, isCurrency: true },
    secondary: [{ label: "Opens", values: opens }],
    rateMetrics: totalSent > 0 ? [
      { label: "Open rate", numerator: totalOpens, denominator: totalSent, suffix: "%", goodThreshold: 30, badThreshold: 20, lowerIsBetter: false },
      { label: "Click rate", numerator: totalClicks, denominator: totalSent, suffix: "%", goodThreshold: 4, badThreshold: 2, lowerIsBetter: false },
    ] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#6366f1]/15 bg-[#6366f1]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]/15 font-mono text-[10px] font-bold text-[#6366f1]">KL</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Klaviyo</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency="USD" label="Revenue" />
      <PeriodCompare values={revenues} label="Revenue" isCurrency />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Emails Sent" value={fmt(totalSent)}           values={sent}     color="#6366f1" />
        <StatCard label="Opens"       value={fmt(totalOpens)}          values={opens}    color="#818cf8" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}         values={clicks}   color="#00d4aa" />
        <StatCard label="Revenue"     value={`$${totalRev.toFixed(2)}`} values={revenues} color="#f59e0b" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={klaviyoInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function ConvertKitSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["totalSubscribers", "newSubscribers", "broadcastsSent"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const totals      = grouped.map((r) => r.data.totalSubscribers);
  const newSubs     = grouped.map((r) => r.data.newSubscribers);
  const broadcasts  = grouped.map((r) => r.data.broadcastsSent);
  const lastTotal   = totals.length > 0 ? totals[totals.length - 1] : 0;
  const totalNew    = newSubs.reduce((a, b) => a + b, 0);
  const totalBcast  = broadcasts.reduce((a, b) => a + b, 0);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Subscribers",      value: fmt(r.data.totalSubscribers),  raw: r.data.totalSubscribers },
      { label: "New Subscribers",  value: fmt(r.data.newSubscribers),    raw: r.data.newSubscribers },
      { label: "Broadcasts Sent",  value: fmt(r.data.broadcastsSent),    raw: r.data.broadcastsSent },
    ],
  }));
  const convertkitInsights = buildInsights({
    primary: { label: "Subscribers", values: totals },
    secondary: [{ label: "New Subscribers", values: newSubs }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FB6970]/15 bg-[#FB6970]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FB6970]/15 font-mono text-[10px] font-bold text-[#FB6970]">CK</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">ConvertKit</h3>
      </div>
      <PeriodCompare values={totals} label="Subscribers" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Subscribers"     value={fmt(lastTotal)}  values={totals}     color="#FB6970" />
        <StatCard label="New Subscribers" value={fmt(totalNew)}   values={newSubs}    color="#f87171" />
        <StatCard label="Broadcasts Sent" value={fmt(totalBcast)} values={broadcasts} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={convertkitInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── ActiveCampaign ────────────────────────────────────────────────────────────
function ActiveCampaignSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["emailsSent", "opens", "clicks", "unsubscribes", "newContacts"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sent       = grouped.map((r) => r.data.emailsSent);
  const opens      = grouped.map((r) => r.data.opens);
  const clicks     = grouped.map((r) => r.data.clicks);
  const newContacts = grouped.map((r) => r.data.newContacts);
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Emails Sent",  value: fmt(r.data.emailsSent),   raw: r.data.emailsSent },
      { label: "Opens",        value: fmt(r.data.opens),        raw: r.data.opens },
      { label: "Clicks",       value: fmt(r.data.clicks),       raw: r.data.clicks },
      { label: "New Contacts", value: fmt(r.data.newContacts),  raw: r.data.newContacts },
    ],
  }));
  const acInsights = buildInsights({
    primary: { label: "New Contacts", values: newContacts },
    secondary: [{ label: "Opens", values: opens }],
    rateMetrics: sent.reduce((a,b)=>a+b,0) > 0 ? [{ label: "Open rate", numerator: opens.reduce((a,b)=>a+b,0), denominator: sent.reduce((a,b)=>a+b,0), suffix: "%", goodThreshold: 25, badThreshold: 15, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#356AE6]/15 bg-[#356AE6]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#356AE6]/15 font-mono text-[10px] font-bold text-[#356AE6]">AC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">ActiveCampaign</h3>
      </div>
      <PeriodCompare values={newContacts} label="New Contacts" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Emails Sent"  value={fmt(sent.reduce((a,b)=>a+b,0))}       values={sent}       color="#356AE6" />
        <StatCard label="Opens"        value={fmt(opens.reduce((a,b)=>a+b,0))}      values={opens}      color="#60a5fa" />
        <StatCard label="Clicks"       value={fmt(clicks.reduce((a,b)=>a+b,0))}     values={clicks}     color="#00d4aa" />
        <StatCard label="New Contacts" value={fmt(newContacts.reduce((a,b)=>a+b,0))} values={newContacts} color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={acInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Brevo ─────────────────────────────────────────────────────────────────────
function BrevoSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["emailsSent", "opens", "clicks", "unsubscribes", "newContacts"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sent       = grouped.map((r) => r.data.emailsSent);
  const opens      = grouped.map((r) => r.data.opens);
  const clicks     = grouped.map((r) => r.data.clicks);
  const newContacts = grouped.map((r) => r.data.newContacts);
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Emails Sent",  value: fmt(r.data.emailsSent),   raw: r.data.emailsSent },
      { label: "Opens",        value: fmt(r.data.opens),        raw: r.data.opens },
      { label: "Clicks",       value: fmt(r.data.clicks),       raw: r.data.clicks },
      { label: "New Contacts", value: fmt(r.data.newContacts),  raw: r.data.newContacts },
    ],
  }));
  const brevoInsights = buildInsights({
    primary: { label: "New Contacts", values: newContacts },
    secondary: [{ label: "Opens", values: opens }],
    rateMetrics: sent.reduce((a,b)=>a+b,0) > 0 ? [{ label: "Open rate", numerator: opens.reduce((a,b)=>a+b,0), denominator: sent.reduce((a,b)=>a+b,0), suffix: "%", goodThreshold: 25, badThreshold: 15, lowerIsBetter: false }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#0092FF]/15 bg-[#0092FF]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0092FF]/15 font-mono text-[10px] font-bold text-[#0092FF]">BR</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Brevo</h3>
      </div>
      <PeriodCompare values={newContacts} label="New Contacts" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Emails Sent"  value={fmt(sent.reduce((a,b)=>a+b,0))}        values={sent}        color="#0092FF" />
        <StatCard label="Opens"        value={fmt(opens.reduce((a,b)=>a+b,0))}       values={opens}       color="#38bdf8" />
        <StatCard label="Clicks"       value={fmt(clicks.reduce((a,b)=>a+b,0))}      values={clicks}      color="#00d4aa" />
        <StatCard label="New Contacts" value={fmt(newContacts.reduce((a,b)=>a+b,0))} values={newContacts} color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={brevoInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Beehiiv ───────────────────────────────────────────────────────────────────
function BeehiivSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["totalSubscribers", "newSubscribers", "postsPublished", "premiumSubscribers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const totals     = grouped.map((r) => r.data.totalSubscribers);
  const newSubs    = grouped.map((r) => r.data.newSubscribers);
  const posts      = grouped.map((r) => r.data.postsPublished);
  const premium    = grouped.map((r) => r.data.premiumSubscribers);
  const lastTotal  = totals.length > 0 ? totals[totals.length - 1] : 0;
  const lastPrem   = premium.length > 0 ? premium[premium.length - 1] : 0;
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Subscribers",         value: fmt(r.data.totalSubscribers),    raw: r.data.totalSubscribers },
      { label: "New Subscribers",     value: fmt(r.data.newSubscribers),      raw: r.data.newSubscribers },
      { label: "Posts Published",     value: fmt(r.data.postsPublished),      raw: r.data.postsPublished },
      { label: "Premium Subscribers", value: fmt(r.data.premiumSubscribers),  raw: r.data.premiumSubscribers },
    ],
  }));
  const beehiivInsights = buildInsights({
    primary: { label: "Subscribers", values: totals },
    secondary: [{ label: "New Subscribers", values: newSubs }, { label: "Premium", values: premium }],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FF6B35]/15 bg-[#FF6B35]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B35]/15 font-mono text-[10px] font-bold text-[#FF6B35]">BH</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Beehiiv</h3>
      </div>
      <PeriodCompare values={totals} label="Subscribers" />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Subscribers"  value={fmt(lastTotal)}                         values={totals}  color="#FF6B35" />
        <StatCard label="New Subs"     value={fmt(newSubs.reduce((a,b)=>a+b,0))}     values={newSubs} color="#fb923c" />
        <StatCard label="Posts"        value={fmt(posts.reduce((a,b)=>a+b,0))}       values={posts}   color="#00d4aa" />
        <StatCard label="Premium"      value={fmt(lastPrem)}                          values={premium} color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={beehiivInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Shopify ───────────────────────────────────────────────────────────────────
function ShopifySection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["revenue", "orders", "refunds", "newCustomers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenue   = grouped.map((r) => r.data.revenue);
  const orders    = grouped.map((r) => r.data.orders);
  const refunds   = grouped.map((r) => r.data.refunds);
  const customers = grouped.map((r) => r.data.newCustomers);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency", currency),  raw: r.data.revenue },
      { label: "Orders",        value: fmt(r.data.orders),                          raw: r.data.orders },
      { label: "Refunds",       value: fmt(r.data.refunds),                         raw: r.data.refunds },
      { label: "New Customers", value: fmt(r.data.newCustomers),                    raw: r.data.newCustomers },
    ],
  }));
  const totalRevenue  = revenue.reduce((a, b) => a + b, 0);
  const totalRefunds  = refunds.reduce((a, b) => a + b, 0);
  const shopifyInsights = buildInsights({
    primary: { label: "Revenue", values: revenue, isCurrency: true, currency },
    secondary: [{ label: "Orders", values: orders }, { label: "New Customers", values: customers }],
    rateMetrics: totalRevenue > 0 ? [{ label: "Refund rate", numerator: totalRefunds, denominator: totalRevenue, suffix: "%", goodThreshold: 2, badThreshold: 5, lowerIsBetter: true }] : [],
  });
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#96bf48]/15 bg-[#96bf48]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#96bf48]/15 font-mono text-[10px] font-bold text-[#96bf48]">SH</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Shopify</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"       value={fmt(revenue.reduce((a,b)=>a+b,0), "currency", currency)}   values={revenue}   color="#96bf48" />
        <StatCard label="Orders"        value={fmt(orders.reduce((a,b)=>a+b,0))}          values={orders}    color="#a3e635" />
        <StatCard label="Refunds"       value={fmt(refunds.reduce((a,b)=>a+b,0))}         values={refunds}   color="#f87171" />
        <StatCard label="New Customers" value={fmt(customers.reduce((a,b)=>a+b,0))}       values={customers} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
      <PlatformInsights insights={shopifyInsights} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── WooCommerce ───────────────────────────────────────────────────────────────
function WooCommerceSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["revenue", "orders", "refunds", "newCustomers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenue   = grouped.map((r) => r.data.revenue);
  const orders    = grouped.map((r) => r.data.orders);
  const refunds   = grouped.map((r) => r.data.refunds);
  const customers = grouped.map((r) => r.data.newCustomers);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency", currency) },
      { label: "Orders",        value: fmt(r.data.orders) },
      { label: "Refunds",       value: fmt(r.data.refunds) },
      { label: "New Customers", value: fmt(r.data.newCustomers) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#7f54b3]/15 bg-[#7f54b3]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7f54b3]/15 font-mono text-[10px] font-bold text-[#7f54b3]">WC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">WooCommerce</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"       value={fmt(revenue.reduce((a,b)=>a+b,0), "currency", currency)}   values={revenue}   color="#7f54b3" />
        <StatCard label="Orders"        value={fmt(orders.reduce((a,b)=>a+b,0))}          values={orders}    color="#a78bfa" />
        <StatCard label="Refunds"       value={fmt(refunds.reduce((a,b)=>a+b,0))}         values={refunds}   color="#f87171" />
        <StatCard label="New Customers" value={fmt(customers.reduce((a,b)=>a+b,0))}       values={customers} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── BigCommerce ───────────────────────────────────────────────────────────────
function BigCommerceSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["revenue", "orders", "refunds", "newCustomers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenue   = grouped.map((r) => r.data.revenue);
  const orders    = grouped.map((r) => r.data.orders);
  const refunds   = grouped.map((r) => r.data.refunds);
  const customers = grouped.map((r) => r.data.newCustomers);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency", currency) },
      { label: "Orders",        value: fmt(r.data.orders) },
      { label: "Refunds",       value: fmt(r.data.refunds) },
      { label: "New Customers", value: fmt(r.data.newCustomers) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#34313F]/40 bg-[#34313F]/10 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#34313F]/30 font-mono text-[10px] font-bold text-[#bcbcd8]">BC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">BigCommerce</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"       value={fmt(revenue.reduce((a,b)=>a+b,0), "currency", currency)}   values={revenue}   color="#bcbcd8" />
        <StatCard label="Orders"        value={fmt(orders.reduce((a,b)=>a+b,0))}          values={orders}    color="#a78bfa" />
        <StatCard label="Refunds"       value={fmt(refunds.reduce((a,b)=>a+b,0))}         values={refunds}   color="#f87171" />
        <StatCard label="New Customers" value={fmt(customers.reduce((a,b)=>a+b,0))}       values={customers} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Amazon Seller ─────────────────────────────────────────────────────────────
function AmazonSellerSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped  = groupSnapshots(snapshots, granularity, ["revenue", "orders", "units", "refunds"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenue  = grouped.map((r) => r.data.revenue);
  const orders   = grouped.map((r) => r.data.orders);
  const units    = grouped.map((r) => r.data.units);
  const refunds  = grouped.map((r) => r.data.refunds);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue", value: fmt(r.data.revenue, "currency", currency) },
      { label: "Orders",  value: fmt(r.data.orders) },
      { label: "Units",   value: fmt(r.data.units) },
      { label: "Refunds", value: fmt(r.data.refunds) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FF9900]/15 bg-[#FF9900]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF9900]/15 font-mono text-[10px] font-bold text-[#FF9900]">AMZ</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Amazon Seller</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue" value={fmt(revenue.reduce((a,b)=>a+b,0), "currency", currency)} values={revenue} color="#FF9900" />
        <StatCard label="Orders"  value={fmt(orders.reduce((a,b)=>a+b,0))}       values={orders}  color="#fbbf24" />
        <StatCard label="Units"   value={fmt(units.reduce((a,b)=>a+b,0))}        values={units}   color="#00d4aa" />
        <StatCard label="Refunds" value={fmt(refunds.reduce((a,b)=>a+b,0))}      values={refunds} color="#f87171" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Etsy ──────────────────────────────────────────────────────────────────────
function EtsySection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped  = groupSnapshots(snapshots, granularity, ["revenue", "orders", "views", "newCustomers"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const revenue  = grouped.map((r) => r.data.revenue);
  const orders   = grouped.map((r) => r.data.orders);
  const views    = grouped.map((r) => r.data.views);
  const customers = grouped.map((r) => r.data.newCustomers);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency", currency) },
      { label: "Orders",        value: fmt(r.data.orders) },
      { label: "Views",         value: fmt(r.data.views) },
      { label: "New Customers", value: fmt(r.data.newCustomers) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#F56400]/15 bg-[#F56400]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F56400]/15 font-mono text-[10px] font-bold text-[#F56400]">ET</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Etsy</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="revenue" currency={currency} label="Revenue" />
      <PeriodCompare values={revenue} label="Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue"       value={fmt(revenue.reduce((a,b)=>a+b,0), "currency", currency)}   values={revenue}   color="#F56400" />
        <StatCard label="Orders"        value={fmt(orders.reduce((a,b)=>a+b,0))}          values={orders}    color="#fb923c" />
        <StatCard label="Views"         value={fmt(views.reduce((a,b)=>a+b,0))}           values={views}     color="#60a5fa" />
        <StatCard label="New Customers" value={fmt(customers.reduce((a,b)=>a+b,0))}       values={customers} color="#00d4aa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── HubSpot ───────────────────────────────────────────────────────────────────
function HubSpotSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped       = groupSnapshots(snapshots, granularity, ["dealsWon", "closedRevenue", "newContacts", "pipelineValue"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const dealsWon      = grouped.map((r) => r.data.dealsWon);
  const closedRev     = grouped.map((r) => r.data.closedRevenue);
  const newContacts   = grouped.map((r) => r.data.newContacts);
  const pipeline      = grouped.map((r) => r.data.pipelineValue);
  const lastPipeline  = pipeline.length > 0 ? pipeline[pipeline.length - 1] : 0;
  const tableRows     = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Deals Won",       value: fmt(r.data.dealsWon) },
      { label: "Closed Revenue",  value: fmt(r.data.closedRevenue, "currency", currency) },
      { label: "New Contacts",    value: fmt(r.data.newContacts) },
      { label: "Pipeline Value",  value: fmt(r.data.pipelineValue, "currency", currency) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#ff7a59]/15 bg-[#ff7a59]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff7a59]/15 font-mono text-[10px] font-bold text-[#ff7a59]">HS</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">HubSpot</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="closedRevenue" currency={currency} label="Closed Revenue" />
      <PeriodCompare values={closedRev} label="Closed Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deals Won"      value={fmt(dealsWon.reduce((a,b)=>a+b,0))}        values={dealsWon}    color="#ff7a59" />
        <StatCard label="Closed Revenue" value={fmt(closedRev.reduce((a,b)=>a+b,0), "currency", currency)} values={closedRev}   color="#fb923c" />
        <StatCard label="New Contacts"   value={fmt(newContacts.reduce((a,b)=>a+b,0))}     values={newContacts} color="#00d4aa" />
        <StatCard label="Pipeline"       value={fmt(lastPipeline, "currency", currency)}                    values={pipeline}    color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

// ── Salesforce ────────────────────────────────────────────────────────────────
// Duplicate SalesforceSection removed (already defined above)

function SalesforceSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped      = groupSnapshots(snapshots, granularity, ["dealsWon", "closedRevenue", "newLeads", "pipelineValue"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const dealsWon     = grouped.map((r) => r.data.dealsWon);
  const closedRev    = grouped.map((r) => r.data.closedRevenue);
  const newLeads     = grouped.map((r) => r.data.newLeads);
  const pipeline     = grouped.map((r) => r.data.pipelineValue);
  const lastPipeline = pipeline.length > 0 ? pipeline[pipeline.length - 1] : 0;
  const tableRows    = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Deals Won",      value: fmt(r.data.dealsWon) },
      { label: "Closed Revenue", value: fmt(r.data.closedRevenue, "currency", currency) },
      { label: "New Leads",      value: fmt(r.data.newLeads) },
      { label: "Pipeline Value", value: fmt(r.data.pipelineValue, "currency", currency) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#00A1E0]/15 bg-[#00A1E0]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00A1E0]/15 font-mono text-[10px] font-bold text-[#00A1E0]">SF</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Salesforce</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="closedRevenue" currency={currency} label="Closed Revenue" />
      <PeriodCompare values={closedRev} label="Closed Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deals Won"      value={fmt(dealsWon.reduce((a,b)=>a+b,0))}        values={dealsWon}  color="#00A1E0" />
        <StatCard label="Closed Revenue" value={fmt(closedRev.reduce((a,b)=>a+b,0), "currency", currency)} values={closedRev} color="#38bdf8" />
        <StatCard label="New Leads"      value={fmt(newLeads.reduce((a,b)=>a+b,0))}        values={newLeads}  color="#00d4aa" />
        <StatCard label="Pipeline"       value={fmt(lastPipeline, "currency", currency)}                    values={pipeline}  color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function PipedriveSection({ snapshots, granularity, currency = "USD" }: { snapshots: Snapshot[]; granularity: Granularity; currency?: string }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["dealsWon", "closedRevenue", "newContacts", "pipelineValue"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const dealsWon    = grouped.map((r) => r.data.dealsWon);
  const closedRev   = grouped.map((r) => r.data.closedRevenue);
  const newContacts = grouped.map((r) => r.data.newContacts);
  const pipeline    = grouped.map((r) => r.data.pipelineValue);
  const lastPipe    = pipeline.length > 0 ? pipeline[pipeline.length - 1] : 0;
  const tableRows   = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Deals Won",      value: fmt(r.data.dealsWon) },
      { label: "Closed Revenue", value: fmt(r.data.closedRevenue, "currency", currency) },
      { label: "New Contacts",   value: fmt(r.data.newContacts) },
      { label: "Pipeline Value", value: fmt(r.data.pipelineValue, "currency", currency) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#30a04c]/15 bg-[#30a04c]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#30a04c]/15 font-mono text-[10px] font-bold text-[#30a04c]">PD</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Pipedrive</h3>
      </div>
      <RunRateStrip snapshots={snapshots} field="closedRevenue" currency={currency} label="Closed Revenue" />
      <PeriodCompare values={closedRev} label="Closed Revenue" isCurrency currency={currency} />
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deals Won"      value={fmt(dealsWon.reduce((a,b)=>a+b,0))}             values={dealsWon}    color="#30a04c" />
        <StatCard label="Closed Revenue" value={fmt(closedRev.reduce((a,b)=>a+b,0), "currency", currency)} values={closedRev}   color="#4ade80" />
        <StatCard label="New Contacts"   value={fmt(newContacts.reduce((a,b)=>a+b,0))}           values={newContacts} color="#00d4aa" />
        <StatCard label="Pipeline"       value={fmt(lastPipe, "currency", currency)}                        values={pipeline}    color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function NotionSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["newRows", "updatedRows", "totalRows"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const newRows    = grouped.map((r) => r.data.newRows);
  const updated    = grouped.map((r) => r.data.updatedRows);
  const totalRows  = grouped.map((r) => r.data.totalRows);
  const lastTotal  = totalRows.length > 0 ? totalRows[totalRows.length - 1] : 0;
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "New Rows",     value: fmt(r.data.newRows) },
      { label: "Updated Rows", value: fmt(r.data.updatedRows) },
      { label: "Total Rows",   value: fmt(r.data.totalRows) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#555]/20 bg-[#1a1a1a]/60 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 font-mono text-[10px] font-bold text-white">NO</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Notion</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="New Rows"     value={fmt(newRows.reduce((a,b)=>a+b,0))}   values={newRows}   color="#e5e5e5" />
        <StatCard label="Updated Rows" value={fmt(updated.reduce((a,b)=>a+b,0))}   values={updated}   color="#a3a3a3" />
        <StatCard label="Total Rows"   value={fmt(lastTotal)}                       values={totalRows} color="#737373" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function IntercomSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["newConversations", "resolvedConversations", "newContacts", "csatScore"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const newConvos = grouped.map((r) => r.data.newConversations);
  const resolved  = grouped.map((r) => r.data.resolvedConversations);
  const contacts  = grouped.map((r) => r.data.newContacts);
  const csat      = grouped.map((r) => r.data.csatScore);
  const lastCsat  = csat.length > 0 ? csat[csat.length - 1] : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "New Conversations",      value: fmt(r.data.newConversations) },
      { label: "Resolved Conversations", value: fmt(r.data.resolvedConversations) },
      { label: "New Contacts",           value: fmt(r.data.newContacts) },
      { label: "CSAT",                   value: `${(r.data.csatScore ?? 0).toFixed(1)}%` },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1f8ded]/15 bg-[#1f8ded]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f8ded]/15 font-mono text-[10px] font-bold text-[#1f8ded]">IC</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Intercom</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="New Convos"   value={fmt(newConvos.reduce((a,b)=>a+b,0))} values={newConvos} color="#1f8ded" />
        <StatCard label="Resolved"     value={fmt(resolved.reduce((a,b)=>a+b,0))}  values={resolved}  color="#38bdf8" />
        <StatCard label="New Contacts" value={fmt(contacts.reduce((a,b)=>a+b,0))}  values={contacts}  color="#00d4aa" />
        <StatCard label="CSAT"         value={`${lastCsat.toFixed(1)}%`}            values={csat}      color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function ZendeskSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["newTickets", "solvedTickets", "reopenedTickets", "csatScore"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const newT       = grouped.map((r) => r.data.newTickets);
  const solved     = grouped.map((r) => r.data.solvedTickets);
  const csat       = grouped.map((r) => r.data.csatScore);
  const lastCsat   = csat.length > 0 ? csat[csat.length - 1] : 0;
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "New Tickets",    value: fmt(r.data.newTickets) },
      { label: "Solved Tickets", value: fmt(r.data.solvedTickets) },
      { label: "CSAT",           value: `${(r.data.csatScore ?? 0).toFixed(1)}%` },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#03363D]/40 bg-[#03363D]/10 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#03363D]/40 font-mono text-[10px] font-bold text-[#2ECC71]">ZD</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Zendesk</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="New Tickets"    value={fmt(newT.reduce((a,b)=>a+b,0))}    values={newT}   color="#2ECC71" />
        <StatCard label="Solved Tickets" value={fmt(solved.reduce((a,b)=>a+b,0))}  values={solved} color="#00d4aa" />
        <StatCard label="CSAT"           value={`${lastCsat.toFixed(1)}%`}          values={csat}   color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function FreshdeskSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["newTickets", "resolvedTickets", "openTickets", "csatScore"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const newT      = grouped.map((r) => r.data.newTickets);
  const resolved  = grouped.map((r) => r.data.resolvedTickets);
  const open      = grouped.map((r) => r.data.openTickets);
  const csat      = grouped.map((r) => r.data.csatScore);
  const lastCsat  = csat.length > 0 ? csat[csat.length - 1] : 0;
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "New Tickets",      value: fmt(r.data.newTickets) },
      { label: "Resolved Tickets", value: fmt(r.data.resolvedTickets) },
      { label: "Open Tickets",     value: fmt(r.data.openTickets) },
      { label: "CSAT",             value: `${(r.data.csatScore ?? 0).toFixed(1)}%` },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#25C16F]/15 bg-[#25C16F]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25C16F]/15 font-mono text-[10px] font-bold text-[#25C16F]">FD</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Freshdesk</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="New Tickets"  value={fmt(newT.reduce((a,b)=>a+b,0))}     values={newT}     color="#25C16F" />
        <StatCard label="Resolved"     value={fmt(resolved.reduce((a,b)=>a+b,0))} values={resolved} color="#4ade80" />
        <StatCard label="Open"         value={fmt(open.reduce((a,b)=>a+b,0))}     values={open}     color="#fbbf24" />
        <StatCard label="CSAT"         value={`${lastCsat.toFixed(1)}%`}           values={csat}     color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function SegmentSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["eventsDelivered", "eventsFailed", "sourceCount"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const delivered  = grouped.map((r) => r.data.eventsDelivered);
  const failed     = grouped.map((r) => r.data.eventsFailed);
  const sources    = grouped.map((r) => r.data.sourceCount);
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Delivered",    value: fmt(r.data.eventsDelivered) },
      { label: "Failed",       value: fmt(r.data.eventsFailed) },
      { label: "Sources",      value: fmt(r.data.sourceCount) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#52BD94]/15 bg-[#52BD94]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#52BD94]/15 font-mono text-[10px] font-bold text-[#52BD94]">SG</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Segment</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Delivered" value={fmt(delivered.reduce((a,b)=>a+b,0))} values={delivered} color="#52BD94" />
        <StatCard label="Failed"    value={fmt(failed.reduce((a,b)=>a+b,0))}    values={failed}    color="#f87171" />
        <StatCard label="Sources"   value={fmt(sources.length > 0 ? sources[sources.length - 1] : 0)} values={sources} color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function HeapSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped   = groupSnapshots(snapshots, granularity, ["sessions", "uniqueUsers", "pageViews", "events"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sessions  = grouped.map((r) => r.data.sessions);
  const users     = grouped.map((r) => r.data.uniqueUsers);
  const pv        = grouped.map((r) => r.data.pageViews);
  const events    = grouped.map((r) => r.data.events);
  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sessions",      value: fmt(r.data.sessions) },
      { label: "Unique Users",  value: fmt(r.data.uniqueUsers) },
      { label: "Page Views",    value: fmt(r.data.pageViews) },
      { label: "Events",        value: fmt(r.data.events) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FF5B5B]/15 bg-[#FF5B5B]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF5B5B]/15 font-mono text-[10px] font-bold text-[#FF5B5B]">HP</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Heap</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions"     value={fmt(sessions.reduce((a,b)=>a+b,0))} values={sessions} color="#FF5B5B" />
        <StatCard label="Unique Users" value={fmt(users.reduce((a,b)=>a+b,0))}    values={users}    color="#fb923c" />
        <StatCard label="Page Views"   value={fmt(pv.reduce((a,b)=>a+b,0))}       values={pv}       color="#00d4aa" />
        <StatCard label="Events"       value={fmt(events.reduce((a,b)=>a+b,0))}   values={events}   color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function FullStorySection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["sessions", "pageViews", "frustrationSignals", "errorClicks"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sessions   = grouped.map((r) => r.data.sessions);
  const pv         = grouped.map((r) => r.data.pageViews);
  const frust      = grouped.map((r) => r.data.frustrationSignals);
  const errors     = grouped.map((r) => r.data.errorClicks);
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sessions",              value: fmt(r.data.sessions) },
      { label: "Page Views",            value: fmt(r.data.pageViews) },
      { label: "Frustration Signals",   value: fmt(r.data.frustrationSignals) },
      { label: "Error Clicks",          value: fmt(r.data.errorClicks) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#3B1D8E]/30 bg-[#3B1D8E]/10 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B1D8E]/30 font-mono text-[10px] font-bold text-[#a78bfa]">FS</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">FullStory</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions"    value={fmt(sessions.reduce((a,b)=>a+b,0))} values={sessions} color="#7c3aed" />
        <StatCard label="Page Views"  value={fmt(pv.reduce((a,b)=>a+b,0))}       values={pv}       color="#a78bfa" />
        <StatCard label="Frustration" value={fmt(frust.reduce((a,b)=>a+b,0))}    values={frust}    color="#f87171" />
        <StatCard label="Error Clicks" value={fmt(errors.reduce((a,b)=>a+b,0))}  values={errors}   color="#fb923c" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function HotjarSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped    = groupSnapshots(snapshots, granularity, ["sessions", "recordings", "heatmapViews", "feedbackResponses"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const sessions   = grouped.map((r) => r.data.sessions);
  const recs       = grouped.map((r) => r.data.recordings);
  const heatmaps   = grouped.map((r) => r.data.heatmapViews);
  const feedback   = grouped.map((r) => r.data.feedbackResponses);
  const tableRows  = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Sessions",           value: fmt(r.data.sessions) },
      { label: "Recordings",         value: fmt(r.data.recordings) },
      { label: "Heatmap Views",      value: fmt(r.data.heatmapViews) },
      { label: "Feedback Responses", value: fmt(r.data.feedbackResponses) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#FD3A5C]/15 bg-[#FD3A5C]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FD3A5C]/15 font-mono text-[10px] font-bold text-[#FD3A5C]">HJ</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Hotjar</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions"   value={fmt(sessions.reduce((a,b)=>a+b,0))} values={sessions} color="#FD3A5C" />
        <StatCard label="Recordings" value={fmt(recs.reduce((a,b)=>a+b,0))}     values={recs}     color="#f87171" />
        <StatCard label="Heatmaps"   value={fmt(heatmaps.reduce((a,b)=>a+b,0))} values={heatmaps} color="#fbbf24" />
        <StatCard label="Feedback"   value={fmt(feedback.reduce((a,b)=>a+b,0))} values={feedback} color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function InstagramSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped     = groupSnapshots(snapshots, granularity, ["followers", "reach", "impressions", "profileVisits"], []);
  const periods = grouped.map((r) => fmtPeriod(r.period, granularity));
  const followers   = grouped.map((r) => r.data.followers);
  const reach       = grouped.map((r) => r.data.reach);
  const impressions = grouped.map((r) => r.data.impressions);
  const visits      = grouped.map((r) => r.data.profileVisits);
  const lastFollows = followers.length > 0 ? followers[followers.length - 1] : 0;
  const tableRows   = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Followers",      value: fmt(r.data.followers) },
      { label: "Reach",          value: fmt(r.data.reach) },
      { label: "Impressions",    value: fmt(r.data.impressions) },
      { label: "Profile Visits", value: fmt(r.data.profileVisits) },
    ],
  }));
  return (
    <PeriodsCtx.Provider value={periods}>
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#E1306C]/15 bg-[#E1306C]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E1306C]/15 font-mono text-[10px] font-bold text-[#E1306C]">IG</div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Instagram</h3>
      </div>
      <StatCardGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Followers"      value={fmt(lastFollows)}                          values={followers}   color="#E1306C" />
        <StatCard label="Reach"          value={fmt(reach.reduce((a,b)=>a+b,0))}           values={reach}       color="#f472b6" />
        <StatCard label="Impressions"    value={fmt(impressions.reduce((a,b)=>a+b,0))}     values={impressions} color="#fb923c" />
        <StatCard label="Profile Visits" value={fmt(visits.reduce((a,b)=>a+b,0))}          values={visits}      color="#a78bfa" />
      </StatCardGroup>
      <DataTable rows={tableRows} />
    </div>
    </PeriodsCtx.Provider>
  );
}

function LockScreen() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 py-20 px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
      </div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-2">Premium Feature</p>
      <h2 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">Analytics requires Premium</h2>
      <p className="text-sm text-[#bcbcd8] max-w-sm mb-6">Upgrade to access full analytics, revenue trends, and AI-generated insights.</p>
      <a href="/api/stripe/checkout" className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-2.5 font-mono text-sm font-bold text-[#13131f] hover:bg-[#00bfa0] transition">
        Start 7-day free trial →
      </a>
      <p className="mt-3 font-mono text-[10px] text-[#8585aa]">$19/mo after trial · Cancel anytime</p>
    </div>
  );
}

function EmptySection({ platform, hasDataOutsideRange = false }: { platform: string; hasDataOutsideRange?: boolean }) {
  if (hasDataOutsideRange) {
    return (
      <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-10 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/8 px-4 py-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#f59e0b]">No data in range</span>
        </div>
        <p className="text-sm text-[#bcbcd8]">
          <span className="text-[#f8f8fc]">{platform}</span> has synced data, but none falls within the selected time range.
        </p>
        <p className="mt-2 text-xs text-[#6b6b88]">Try extending the time range to see historical data.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-10 text-center">
      <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-4 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">Syncing data</span>
      </div>
      <p className="text-sm text-[#bcbcd8]">
        <span className="text-[#f8f8fc]">{platform}</span> is connected. Waiting for data to sync…
      </p>
      <p className="mt-2 text-xs text-[#6b6b88]">First sync can take up to 24 hours.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type PlatformTab = "overview" | "stripe" | "ga4" | "meta" | "paypal" | "paddle" | "lemon-squeezy" | "gumroad" | "plausible" | "mixpanel" | "amplitude" | "posthog" | "fathom" | "google-ads" | "tiktok-ads" | "twitter-ads" | "linkedin-ads" | "snapchat-ads" | "pinterest-ads" | "mailchimp" | "klaviyo" | "convertkit" | "activecampaign" | "brevo" | "beehiiv" | "shopify" | "woocommerce" | "bigcommerce" | "amazon-seller" | "etsy" | "hubspot" | "salesforce" | "pipedrive" | "notion" | "intercom" | "zendesk" | "freshdesk" | "segment" | "heap" | "fullstory" | "hotjar" | "instagram" | "youtube" | "twitter-organic";

const PLATFORM_LABELS: Record<PlatformTab, string> = {
  overview:          "Overview",
  stripe:            "Stripe",
  ga4:               "Google Analytics",
  meta:              "Meta Ads",
  paypal:            "PayPal",
  paddle:            "Paddle",
  "lemon-squeezy":   "Lemon Squeezy",
  gumroad:           "Gumroad",
  plausible:         "Plausible",
  mixpanel:          "Mixpanel",
  amplitude:         "Amplitude",
  posthog:           "PostHog",
  fathom:            "Fathom",
  "google-ads":      "Google Ads",
  "tiktok-ads":      "TikTok Ads",
  "twitter-ads":     "X Ads",
  "linkedin-ads":    "LinkedIn Ads",
  "snapchat-ads":    "Snapchat Ads",
  "pinterest-ads":   "Pinterest Ads",
  mailchimp:         "Mailchimp",
  klaviyo:           "Klaviyo",
  convertkit:        "ConvertKit",
  activecampaign:    "ActiveCampaign",
  brevo:             "Brevo",
  beehiiv:           "Beehiiv",
  shopify:           "Shopify",
  woocommerce:       "WooCommerce",
  bigcommerce:       "BigCommerce",
  "amazon-seller":   "Amazon Seller",
  etsy:              "Etsy",
  hubspot:           "HubSpot",
  salesforce:        "Salesforce",
  pipedrive:         "Pipedrive",
  notion:            "Notion",
  intercom:          "Intercom",
  zendesk:           "Zendesk",
  freshdesk:         "Freshdesk",
  segment:           "Segment",
  heap:              "Heap",
  fullstory:         "FullStory",
  hotjar:            "Hotjar",
  instagram:         "Instagram",
  youtube:           "YouTube",
  "twitter-organic": "X (Twitter)",
};

export default function AnalyticsTab({ isPremium, connectedPlatforms, snapshots, currencies = {} }: AnalyticsTabProps) {
  const availablePlatforms = (["stripe", "ga4", "meta", "paypal", "paddle", "lemon-squeezy", "gumroad", "plausible", "mixpanel", "amplitude", "posthog", "fathom", "google-ads", "tiktok-ads", "twitter-ads", "linkedin-ads", "snapchat-ads", "pinterest-ads", "mailchimp", "klaviyo", "convertkit", "activecampaign", "brevo", "beehiiv", "shopify", "woocommerce", "bigcommerce", "amazon-seller", "etsy", "hubspot", "salesforce", "pipedrive", "notion", "intercom", "zendesk", "freshdesk", "segment", "heap", "fullstory", "hotjar", "instagram", "youtube", "twitter-organic"] as Exclude<PlatformTab, "overview">[]).filter(
    (p) => connectedPlatforms.includes(p)
  );

  const [activeSection, setActiveSection] = useState<PlatformTab>("overview");

  // ── Persisted filter state (survives tab switches) ──────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window === "undefined") return "30d";
    const saved = localStorage.getItem("analytics_timeRange");
    return (saved as TimeRange | null) ?? "30d";
  });
  const [granularity, setGranularity] = useState<Granularity>(() => {
    if (typeof window === "undefined") return "day";
    const saved = localStorage.getItem("analytics_granularity");
    return (saved as Granularity | null) ?? "day";
  });
  const [customRange, setCustomRange] = useState<CustomRange | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("analytics_customRange");
      return saved ? (JSON.parse(saved) as CustomRange) : null;
    } catch {
      return null;
    }
  });

  // Persist whenever any filter changes
  useEffect(() => {
    localStorage.setItem("analytics_timeRange", timeRange);
  }, [timeRange]);
  useEffect(() => {
    localStorage.setItem("analytics_granularity", granularity);
  }, [granularity]);
  useEffect(() => {
    if (customRange) {
      localStorage.setItem("analytics_customRange", JSON.stringify(customRange));
    } else {
      localStorage.removeItem("analytics_customRange");
    }
  }, [customRange]);

  // Share report state
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleShare() {
    if (shareState === "loading") return;
    setShareState("loading");
    try {
      const res = await fetch("/api/report/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: cutoff,
          dateTo: ceilDate,
          label: `Analytics ${cutoff} → ${ceilDate}`,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareState("idle"), 3000);
    } catch {
      setShareState("error");
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareState("idle"), 3000);
    }
  }

  // Filter snapshots — custom range takes priority over preset
  const cutoff = useMemo(() => {
    if (customRange) return customRange.from;
    const days = TIME_RANGES.find((t) => t.id === timeRange)?.days ?? 30;
    return daysAgoStr(days);
  }, [timeRange, customRange]);

  const ceilDate = useMemo(() => {
    if (customRange) return customRange.to;
    return new Date().toISOString().slice(0, 10);
  }, [customRange]);

  const filteredSnapshots = useMemo(
    () => snapshots.filter((s) => s.date >= cutoff && s.date <= ceilDate),
    [snapshots, cutoff, ceilDate]
  );

  const snapshotsByPlatform = useMemo(() => {
    const map: Record<string, Snapshot[]> = { stripe: [], ga4: [], meta: [], paypal: [], paddle: [], "lemon-squeezy": [], gumroad: [], plausible: [], mixpanel: [], amplitude: [], posthog: [], fathom: [], "google-ads": [], "tiktok-ads": [], "twitter-ads": [], "linkedin-ads": [], "snapchat-ads": [], "pinterest-ads": [], mailchimp: [], klaviyo: [], convertkit: [], activecampaign: [], brevo: [], beehiiv: [], shopify: [], woocommerce: [], bigcommerce: [], "amazon-seller": [], etsy: [], hubspot: [], salesforce: [], pipedrive: [], notion: [], intercom: [], zendesk: [], freshdesk: [], segment: [], heap: [], fullstory: [], hotjar: [], instagram: [], youtube: [], "twitter-organic": [] };
    for (const s of filteredSnapshots) {
      if (map[s.provider]) map[s.provider].push(s);
    }
    return map;
  }, [filteredSnapshots]);

  // Providers that have ANY snapshot in the DB (ignoring date filter).
  // Used to distinguish "syncing for the first time" vs "data exists outside range".
  const providersWithAnyData = useMemo(
    () => new Set(snapshots.map((s) => s.provider)),
    [snapshots],
  );

  if (!isPremium) {
    return (
      <div className="w-full">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Analytics</h1>
          <p className="mt-1 text-sm text-[#bcbcd8]">Deep-dive into your business metrics.</p>
        </div>
        <LockScreen />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Analytics</h1>
          <p className="mt-1 text-sm text-[#bcbcd8]">Daily breakdown per integration.</p>
        </div>
        {availablePlatforms.length > 0 && (
          <button
            onClick={handleShare}
            disabled={shareState === "loading"}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-[#363650] bg-[#1c1c2a] px-4 py-2.5 font-mono text-xs font-semibold transition-all hover:border-[#00d4aa]/40 hover:text-[#00d4aa] disabled:opacity-50"
            style={{
              color: shareState === "copied" ? "#00d4aa" : shareState === "error" ? "#f87171" : "#bcbcd8",
              borderColor: shareState === "copied" ? "#00d4aa40" : shareState === "error" ? "#f8717140" : undefined,
            }}
          >
            {shareState === "loading" ? (
              <>
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Generating…
              </>
            ) : shareState === "copied" ? (
              <>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Link copied!
              </>
            ) : shareState === "error" ? (
              <>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                Error — retry
              </>
            ) : (
              <>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                Share report
              </>
            )}
          </button>
        )}
      </div>

      {availablePlatforms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#363650] p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#363650] bg-[#222235] text-[#8585aa]">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-2">No data yet</p>
          <p className="text-sm text-[#bcbcd8]">Connect at least one integration from the Overview tab to see analytics.</p>
        </div>
      ) : (
        <>
          {/* ── Platform tabs ─────────────────────────────────── */}
          {/* Full-bleed: negative margin cancels the parent p-6/p-8, then we re-add px so tabs stay inset */}
          <div className="relative mb-4 -mx-6 lg:-mx-8">
            {/* Scroll fade — right edge hint */}
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-linear-to-l from-[#13131f] to-transparent" />
            <div className="flex gap-2 border-b border-[#363650] overflow-x-auto scrollbar-none px-6 lg:px-8">
              {(["overview", ...availablePlatforms] as PlatformTab[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveSection(p)}
                  className={`shrink-0 whitespace-nowrap pb-3 px-1 font-mono text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                    activeSection === p
                      ? "border-[#00d4aa] text-[#00d4aa]"
                      : "border-transparent text-[#8585aa] hover:text-[#bcbcd8]"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Controls (time range + view by) ──────────────── */}
          <AnalyticsControls
            timeRange={timeRange} setTimeRange={(t) => { setTimeRange(t); setCustomRange(null); }}
            granularity={granularity} setGranularity={setGranularity}
            customRange={customRange} setCustomRange={setCustomRange}
            snapshots={filteredSnapshots} activeSection={activeSection}
          />

          {/* ── Sections ──────────────────────────────────────── */}
          {activeSection === "overview" && (
            <OverviewSection
              snapshots={filteredSnapshots}
              connectedPlatforms={connectedPlatforms}
              timeRange="all"
              granularity={granularity}
              currencies={currencies}
            />
          )}
          {activeSection === "stripe" && connectedPlatforms.includes("stripe") && (
            snapshotsByPlatform.stripe.length > 0
              ? (
                <div className="space-y-6">
                  <StripeSection snapshots={snapshotsByPlatform.stripe} granularity={granularity} currency={currencies["stripe"] ?? "USD"} />
                  <ProductBreakdownSection snapshots={snapshotsByPlatform.stripe} currency={currencies["stripe"] ?? "USD"} />
                  <CohortSection snapshots={snapshotsByPlatform.stripe} />
                </div>
              )
              : <EmptySection platform="Stripe" />
          )}
          {activeSection === "ga4" && connectedPlatforms.includes("ga4") && (
            snapshotsByPlatform.ga4.length > 0
              ? <GA4Section snapshots={snapshotsByPlatform.ga4} granularity={granularity} />
              : <EmptySection platform="Google Analytics" />
          )}
          {activeSection === "meta" && connectedPlatforms.includes("meta") && (
            snapshotsByPlatform.meta.length > 0
              ? <MetaSection snapshots={snapshotsByPlatform.meta} granularity={granularity} />
              : <EmptySection platform="Meta Ads" />
          )}
          {activeSection === "paypal" && connectedPlatforms.includes("paypal") && (
            snapshotsByPlatform.paypal.length > 0
              ? <PayPalSection snapshots={snapshotsByPlatform.paypal} granularity={granularity} currency={currencies["paypal"] ?? "USD"} />
              : <EmptySection platform="PayPal" />
          )}
          {activeSection === "paddle" && connectedPlatforms.includes("paddle") && (
            snapshotsByPlatform.paddle.length > 0
              ? <PaddleSection snapshots={snapshotsByPlatform.paddle} granularity={granularity} currency={currencies["paddle"] ?? "USD"} />
              : <EmptySection platform="Paddle" />
          )}
          {activeSection === "lemon-squeezy" && connectedPlatforms.includes("lemon-squeezy") && (
            snapshotsByPlatform["lemon-squeezy"].length > 0
              ? <LemonSqueezySection snapshots={snapshotsByPlatform["lemon-squeezy"]} granularity={granularity} currency={currencies["lemon-squeezy"] ?? "USD"} />
              : <EmptySection platform="Lemon Squeezy" />
          )}
          {activeSection === "gumroad" && connectedPlatforms.includes("gumroad") && (
            snapshotsByPlatform.gumroad.length > 0
              ? <GumroadSection snapshots={snapshotsByPlatform.gumroad} granularity={granularity} currency={currencies["gumroad"] ?? "USD"} />
              : <EmptySection platform="Gumroad" />
          )}
          {activeSection === "plausible" && connectedPlatforms.includes("plausible") && (
            snapshotsByPlatform.plausible.length > 0
              ? <PlausibleSection snapshots={snapshotsByPlatform.plausible} granularity={granularity} />
              : <EmptySection platform="Plausible" />
          )}
          {activeSection === "mixpanel" && connectedPlatforms.includes("mixpanel") && (
            snapshotsByPlatform.mixpanel.length > 0
              ? <MixpanelSection snapshots={snapshotsByPlatform.mixpanel} granularity={granularity} />
              : <EmptySection platform="Mixpanel" />
          )}
          {activeSection === "amplitude" && connectedPlatforms.includes("amplitude") && (
            snapshotsByPlatform.amplitude.length > 0
              ? <AmplitudeSection snapshots={snapshotsByPlatform.amplitude} granularity={granularity} />
              : <EmptySection platform="Amplitude" />
          )}
          {activeSection === "posthog" && connectedPlatforms.includes("posthog") && (
            snapshotsByPlatform.posthog.length > 0
              ? <PostHogSection snapshots={snapshotsByPlatform.posthog} granularity={granularity} />
              : <EmptySection platform="PostHog" />
          )}
          {activeSection === "fathom" && connectedPlatforms.includes("fathom") && (
            snapshotsByPlatform.fathom.length > 0
              ? <FathomSection snapshots={snapshotsByPlatform.fathom} granularity={granularity} />
              : <EmptySection platform="Fathom" />
          )}
          {activeSection === "google-ads" && connectedPlatforms.includes("google-ads") && (
            snapshotsByPlatform["google-ads"].length > 0
              ? <GoogleAdsSection snapshots={snapshotsByPlatform["google-ads"]} granularity={granularity} />
              : <EmptySection platform="Google Ads" />
          )}
          {activeSection === "tiktok-ads" && connectedPlatforms.includes("tiktok-ads") && (
            snapshotsByPlatform["tiktok-ads"].length > 0
              ? <TikTokAdsSection snapshots={snapshotsByPlatform["tiktok-ads"]} granularity={granularity} />
              : <EmptySection platform="TikTok Ads" />
          )}
          {activeSection === "twitter-ads" && connectedPlatforms.includes("twitter-ads") && (
            snapshotsByPlatform["twitter-ads"].length > 0
              ? <TwitterAdsSection snapshots={snapshotsByPlatform["twitter-ads"]} granularity={granularity} />
              : <EmptySection platform="X (Twitter) Ads" />
          )}
          {activeSection === "linkedin-ads" && connectedPlatforms.includes("linkedin-ads") && (
            snapshotsByPlatform["linkedin-ads"].length > 0
              ? <LinkedInAdsSection snapshots={snapshotsByPlatform["linkedin-ads"]} granularity={granularity} />
              : <EmptySection platform="LinkedIn Ads" />
          )}
          {activeSection === "snapchat-ads" && connectedPlatforms.includes("snapchat-ads") && (
            snapshotsByPlatform["snapchat-ads"].length > 0
              ? <SnapchatAdsSection snapshots={snapshotsByPlatform["snapchat-ads"]} granularity={granularity} />
              : <EmptySection platform="Snapchat Ads" />
          )}
          {activeSection === "pinterest-ads" && connectedPlatforms.includes("pinterest-ads") && (
            snapshotsByPlatform["pinterest-ads"].length > 0
              ? <PinterestAdsSection snapshots={snapshotsByPlatform["pinterest-ads"]} granularity={granularity} />
              : <EmptySection platform="Pinterest Ads" />
          )}
          {activeSection === "mailchimp" && connectedPlatforms.includes("mailchimp") && (
            snapshotsByPlatform.mailchimp.length > 0
              ? <MailchimpSection snapshots={snapshotsByPlatform.mailchimp} granularity={granularity} />
              : <EmptySection platform="Mailchimp" />
          )}
          {activeSection === "klaviyo" && connectedPlatforms.includes("klaviyo") && (
            snapshotsByPlatform.klaviyo.length > 0
              ? <KlaviyoSection snapshots={snapshotsByPlatform.klaviyo} granularity={granularity} />
              : <EmptySection platform="Klaviyo" />
          )}
          {activeSection === "convertkit" && connectedPlatforms.includes("convertkit") && (
            snapshotsByPlatform.convertkit.length > 0
              ? <ConvertKitSection snapshots={snapshotsByPlatform.convertkit} granularity={granularity} />
              : <EmptySection platform="ConvertKit" />
          )}
          {activeSection === "activecampaign" && connectedPlatforms.includes("activecampaign") && (
            snapshotsByPlatform.activecampaign.length > 0
              ? <ActiveCampaignSection snapshots={snapshotsByPlatform.activecampaign} granularity={granularity} />
              : <EmptySection platform="ActiveCampaign" />
          )}
          {activeSection === "brevo" && connectedPlatforms.includes("brevo") && (
            snapshotsByPlatform.brevo.length > 0
              ? <BrevoSection snapshots={snapshotsByPlatform.brevo} granularity={granularity} />
              : <EmptySection platform="Brevo" />
          )}
          {activeSection === "beehiiv" && connectedPlatforms.includes("beehiiv") && (
            snapshotsByPlatform.beehiiv.length > 0
              ? <BeehiivSection snapshots={snapshotsByPlatform.beehiiv} granularity={granularity} />
              : <EmptySection platform="Beehiiv" />
          )}
          {activeSection === "shopify" && connectedPlatforms.includes("shopify") && (
            snapshotsByPlatform.shopify.length > 0
              ? <ShopifySection snapshots={snapshotsByPlatform.shopify} granularity={granularity} currency={currencies["shopify"] ?? "USD"} />
              : <EmptySection platform="Shopify" />
          )}
          {activeSection === "woocommerce" && connectedPlatforms.includes("woocommerce") && (
            snapshotsByPlatform.woocommerce.length > 0
              ? <WooCommerceSection snapshots={snapshotsByPlatform.woocommerce} granularity={granularity} currency={currencies["woocommerce"] ?? "USD"} />
              : <EmptySection platform="WooCommerce" />
          )}
          {activeSection === "bigcommerce" && connectedPlatforms.includes("bigcommerce") && (
            snapshotsByPlatform.bigcommerce.length > 0
              ? <BigCommerceSection snapshots={snapshotsByPlatform.bigcommerce} granularity={granularity} currency={currencies["bigcommerce"] ?? "USD"} />
              : <EmptySection platform="BigCommerce" />
          )}
          {activeSection === "amazon-seller" && connectedPlatforms.includes("amazon-seller") && (
            snapshotsByPlatform["amazon-seller"].length > 0
              ? <AmazonSellerSection snapshots={snapshotsByPlatform["amazon-seller"]} granularity={granularity} currency={currencies["amazon-seller"] ?? "USD"} />
              : <EmptySection platform="Amazon Seller" />
          )}
          {activeSection === "etsy" && connectedPlatforms.includes("etsy") && (
            snapshotsByPlatform.etsy.length > 0
              ? <EtsySection snapshots={snapshotsByPlatform.etsy} granularity={granularity} currency={currencies["etsy"] ?? "USD"} />
              : <EmptySection platform="Etsy" />
          )}
          {activeSection === "hubspot" && connectedPlatforms.includes("hubspot") && (
            snapshotsByPlatform.hubspot.length > 0
              ? <HubSpotSection snapshots={snapshotsByPlatform.hubspot} granularity={granularity} currency={currencies["hubspot"] ?? "USD"} />
              : <EmptySection platform="HubSpot" />
          )}
          {activeSection === "salesforce" && connectedPlatforms.includes("salesforce") && (
            snapshotsByPlatform.salesforce.length > 0
              ? <SalesforceSection snapshots={snapshotsByPlatform.salesforce} granularity={granularity} currency={currencies["salesforce"] ?? "USD"} />
              : <EmptySection platform="Salesforce" />
          )}
          {activeSection === "pipedrive" && connectedPlatforms.includes("pipedrive") && (
            snapshotsByPlatform.pipedrive.length > 0
              ? <PipedriveSection snapshots={snapshotsByPlatform.pipedrive} granularity={granularity} currency={currencies["pipedrive"] ?? "USD"} />
              : <EmptySection platform="Pipedrive" />
          )}
          {activeSection === "notion" && connectedPlatforms.includes("notion") && (
            snapshotsByPlatform.notion.length > 0
              ? <NotionSection snapshots={snapshotsByPlatform.notion} granularity={granularity} />
              : <EmptySection platform="Notion" />
          )}
          {activeSection === "intercom" && connectedPlatforms.includes("intercom") && (
            snapshotsByPlatform.intercom.length > 0
              ? <IntercomSection snapshots={snapshotsByPlatform.intercom} granularity={granularity} />
              : <EmptySection platform="Intercom" />
          )}
          {activeSection === "zendesk" && connectedPlatforms.includes("zendesk") && (
            snapshotsByPlatform.zendesk.length > 0
              ? <ZendeskSection snapshots={snapshotsByPlatform.zendesk} granularity={granularity} />
              : <EmptySection platform="Zendesk" />
          )}
          {activeSection === "freshdesk" && connectedPlatforms.includes("freshdesk") && (
            snapshotsByPlatform.freshdesk.length > 0
              ? <FreshdeskSection snapshots={snapshotsByPlatform.freshdesk} granularity={granularity} />
              : <EmptySection platform="Freshdesk" />
          )}
          {activeSection === "segment" && connectedPlatforms.includes("segment") && (
            snapshotsByPlatform.segment.length > 0
              ? <SegmentSection snapshots={snapshotsByPlatform.segment} granularity={granularity} />
              : <EmptySection platform="Segment" />
          )}
          {activeSection === "heap" && connectedPlatforms.includes("heap") && (
            snapshotsByPlatform.heap.length > 0
              ? <HeapSection snapshots={snapshotsByPlatform.heap} granularity={granularity} />
              : <EmptySection platform="Heap" />
          )}
          {activeSection === "fullstory" && connectedPlatforms.includes("fullstory") && (
            snapshotsByPlatform.fullstory.length > 0
              ? <FullStorySection snapshots={snapshotsByPlatform.fullstory} granularity={granularity} />
              : <EmptySection platform="FullStory" />
          )}
          {activeSection === "hotjar" && connectedPlatforms.includes("hotjar") && (
            snapshotsByPlatform.hotjar.length > 0
              ? <HotjarSection snapshots={snapshotsByPlatform.hotjar} granularity={granularity} />
              : <EmptySection platform="Hotjar" />
          )}
          {activeSection === "instagram" && connectedPlatforms.includes("instagram") && (
            snapshotsByPlatform.instagram.length > 0
              ? <InstagramSection snapshots={snapshotsByPlatform.instagram} granularity={granularity} />
              : <EmptySection platform="Instagram" />
          )}
          {activeSection === "youtube" && connectedPlatforms.includes("youtube") && (
            snapshotsByPlatform.youtube.length > 0
              ? <YouTubeSection snapshots={snapshotsByPlatform.youtube} granularity={granularity} />
              : <EmptySection platform="YouTube" />
          )}
          {activeSection === "twitter-organic" && connectedPlatforms.includes("twitter-organic") && (
            snapshotsByPlatform["twitter-organic"].length > 0
              ? <TwitterOrganicSection snapshots={snapshotsByPlatform["twitter-organic"]} granularity={granularity} />
              : <EmptySection platform="X (Twitter)" />
          )}
        </>
      )}
    </div>
  );
}

