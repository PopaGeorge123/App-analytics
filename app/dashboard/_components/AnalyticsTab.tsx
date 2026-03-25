"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot } from "./DashboardShell";
import OverviewSection from "./OverviewSection";

interface AnalyticsTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
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

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") {
    const dollars = n / 100;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toFixed(2)}`;
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

/** Group snapshots by period, summing sum-fields and averaging avg-fields */
function groupSnapshots(
  snapshots: Snapshot[],
  granularity: Granularity,
  sumFields: string[],
  avgFields: string[]
): { period: string; data: Record<string, number> }[] {
  const grouped: Record<string, { sums: Record<string, number>; avgs: Record<string, number[]> }> = {};

  for (const snap of snapshots) {
    const pk = periodKey(snap.date, granularity);
    if (!grouped[pk]) {
      grouped[pk] = {
        sums: Object.fromEntries(sumFields.map((f) => [f, 0])),
        avgs: Object.fromEntries(avgFields.map((f) => [f, []])),
      };
    }
    for (const f of sumFields) grouped[pk].sums[f] += getField(snap, f);
    for (const f of avgFields) grouped[pk].avgs[f].push(getField(snap, f));
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { sums, avgs }]) => ({
      period,
      data: {
        ...sums,
        ...Object.fromEntries(
          avgFields.map((f) => [f, avgs[f].length ? avgs[f].reduce((a, b) => a + b, 0) / avgs[f].length : 0])
        ),
      },
    }));
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────

function Sparkline({ values, color = "#00d4aa" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-10 w-full" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 160; const H = 40;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const fill = `M ${pts[0]} L ${pts.join(" L ")} L ${W},${H} L 0,${H} Z`;
  const gid = `grad-${color.replace("#", "")}-${values.length}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, values, color }: {
  label: string; value: string; sub?: string; values: number[]; color?: string;
}) {
  const t = trend(values);
  const accent = color ?? "#00d4aa";
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#363650] bg-[#222235] p-5 flex flex-col gap-3 transition-all hover:border-[#454560] hover:bg-[#1c1c2a]">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl opacity-60" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</p>
        {t && (
          <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md ${t.up ? "text-[#00d4aa] bg-[#00d4aa]/10" : "text-red-400 bg-red-400/10"}`}>
            {t.up ? "▲" : "▼"} {t.pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-[#f8f8fc]">{value}</p>
        {sub && <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
      </div>
      <Sparkline values={values} color={accent} />
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

function AnalyticsControls({
  timeRange, setTimeRange,
  granularity, setGranularity,
  customRange, setCustomRange,
}: {
  timeRange: TimeRange; setTimeRange: (t: TimeRange) => void;
  granularity: Granularity; setGranularity: (g: Granularity) => void;
  customRange: CustomRange | null; setCustomRange: (r: CustomRange | null) => void;
}) {
  const availableGrans = GRANULARITY_OPTIONS[timeRange];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
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
            className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
              !customRange && timeRange === tr.id
                ? "bg-[#363650] text-[#f8f8fc]"
                : "text-[#8585aa] hover:text-[#bcbcd8]"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-[#363650]" />

      {/* View by pills */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">View by</span>
        <div className="flex items-center gap-1 rounded-xl border border-[#363650] bg-[#1c1c2a] p-1">
          {availableGrans.map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
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

      {/* Divider */}
      <div className="h-5 w-px bg-[#363650]" />

      {/* Custom date range picker */}
      <DateRangePicker
        customRange={customRange}
        setCustomRange={setCustomRange}
        onClear={() => {}}
      />
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────

function DataTable({ rows }: { rows: { period: string; cells: { label: string; value: string }[] }[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#363650]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#363650]">
            <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Period</th>
            {rows[0].cells.map((c) => (
              <th key={c.label} className="px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row, i) => (
            <tr key={row.period} className={`border-b border-[#363650]/50 ${i % 2 === 0 ? "bg-[#1c1c2a]/40" : ""}`}>
              <td className="px-4 py-2.5 font-mono text-[11px] text-[#bcbcd8]">{row.period}</td>
              {row.cells.map((c) => (
                <td key={c.label} className="px-4 py-2.5 font-mono text-[11px] text-[#f8f8fc]">{c.value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Platform sections ─────────────────────────────────────────────────────

function StripeSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["revenue", "txCount", "refunds", "newCustomers"], []);

  const revenue      = grouped.map((r) => r.data.revenue);
  const txCount      = grouped.map((r) => r.data.txCount);
  const newCustomers = grouped.map((r) => r.data.newCustomers);

  const totalRevenue = revenue.reduce((a, b) => a + b, 0);
  const totalTx      = txCount.reduce((a, b) => a + b, 0);
  const totalRefunds = grouped.reduce((a, r) => a + r.data.refunds, 0);
  const totalNew     = newCustomers.reduce((a, b) => a + b, 0);
  const avgOrderVal  = totalTx > 0 ? totalRevenue / totalTx : 0;

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Revenue",       value: fmt(r.data.revenue, "currency") },
      { label: "Transactions",  value: fmt(r.data.txCount) },
      { label: "New Customers", value: fmt(r.data.newCustomers) },
      { label: "Refunds",       value: fmt(r.data.refunds, "currency") },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#635bff]/15 bg-[#635bff]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff]/15 text-[#635bff]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Stripe Revenue</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Revenue"   value={fmt(totalRevenue, "currency")} values={revenue}      color="#635bff" />
        <StatCard label="Transactions"    value={fmt(totalTx)}                  values={txCount}      color="#635bff" />
        <StatCard label="New Customers"   value={fmt(totalNew)}                 values={newCustomers} color="#00d4aa" />
        <StatCard label="Avg Order Val"   value={fmt(avgOrderVal, "currency")}  sub={`${fmt(totalRefunds, "currency")} refunds`} values={revenue.length ? [avgOrderVal] : []} color="#f59e0b" />
      </div>
      <DataTable rows={tableRows} />
    </div>
  );
}

// ── Cohort / Retention Section ────────────────────────────────────────────

function CohortSection({ snapshots }: { snapshots: Snapshot[] }) {
  // Build weekly cohort data: new vs returning customers per week
  const weeklyData = useMemo(() => {
    // Group by ISO week
    const weeks: Record<string, { newCustomers: number; totalTransactions: number }> = {};
    for (const snap of snapshots) {
      if (snap.provider !== "stripe") continue;
      const d = new Date(snap.date + "T12:00:00");
      // ISO week key: YYYY-Www
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil((((d.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weeks[key]) weeks[key] = { newCustomers: 0, totalTransactions: 0 };
      const data = snap.data as Record<string, number>;
      weeks[key].newCustomers += data.newCustomers ?? 0;
      weeks[key].totalTransactions += data.transactions ?? data.txCount ?? 0;
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8) // last 8 weeks
      .map(([week, vals]) => ({
        week,
        newCustomers: vals.newCustomers,
        returning: Math.max(0, vals.totalTransactions - vals.newCustomers),
        total: vals.totalTransactions,
      }));
  }, [snapshots]);

  const totalNew = weeklyData.reduce((a, w) => a + w.newCustomers, 0);
  const totalReturning = weeklyData.reduce((a, w) => a + w.returning, 0);
  const totalAll = totalNew + totalReturning;
  const retentionRate = totalAll > 0 ? Math.round((totalReturning / totalAll) * 100) : 0;

  if (weeklyData.length === 0) return null;

  const maxVal = Math.max(...weeklyData.map((w) => w.total), 1);

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
          <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Customer Cohort</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-[#00d4aa]">{retentionRate}%</p>
            <p className="font-mono text-[9px] text-[#8585aa] uppercase tracking-widest">Returning</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-[#f8f8fc]">{totalNew}</p>
            <p className="font-mono text-[9px] text-[#8585aa] uppercase tracking-widest">New</p>
          </div>
        </div>
      </div>

      {/* Stacked bar chart */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#635bff]" />
            <span className="font-mono text-[9px] text-[#8585aa]">New customers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#00d4aa]" />
            <span className="font-mono text-[9px] text-[#8585aa]">Returning</span>
          </div>
        </div>
        {weeklyData.map((w) => (
          <div key={w.week} className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-[#8585aa] w-14 shrink-0">{w.week}</span>
            <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-[#363650]">
              <div
                className="h-full"
                style={{ width: `${(w.newCustomers / maxVal) * 100}%`, backgroundColor: "#635bff" }}
              />
              <div
                className="h-full"
                style={{ width: `${(w.returning / maxVal) * 100}%`, backgroundColor: "#00d4aa" }}
              />
            </div>
            <span className="font-mono text-[9px] text-[#bcbcd8] w-6 shrink-0 text-right">{w.total}</span>
          </div>
        ))}
      </div>

      <p className="font-mono text-[9px] text-[#58588a]">
        Based on Stripe transactions — new customers are first-time buyers in each week.
      </p>
    </div>
  );
}

function GA4Section({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["sessions", "users", "newUsers", "conversions"], ["bounceRate", "avgSessionDuration"]);

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
      { label: "Sessions",    value: fmt(r.data.sessions) },
      { label: "Users",       value: fmt(r.data.users) },
      { label: "Conversions", value: fmt(r.data.conversions) },
      { label: "Bounce Rate", value: fmt(r.data.bounceRate, "percent") },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#f59e0b]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Google Analytics 4</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions"        value={fmt(totalSessions)}    values={sessions}    color="#f59e0b" />
        <StatCard label="Users"           value={fmt(totalUsers)}       values={users}       color="#f59e0b" />
        <StatCard label="Conversions"     value={fmt(totalConversions)} sub={`${convRate.toFixed(1)}% conv rate`} values={conversions} color="#00d4aa" />
        <StatCard label="Avg Bounce Rate" value={fmt(avgBounce, "percent")} values={bounceRates} color="#f87171" />
      </div>
      <DataTable rows={tableRows} />
    </div>
  );
}

function MetaSection({ snapshots, granularity }: { snapshots: Snapshot[]; granularity: Granularity }) {
  const grouped = groupSnapshots(snapshots, granularity,
    ["spend", "impressions", "clicks", "conversions"], []);

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

  const tableRows = grouped.map((r) => ({
    period: fmtPeriod(r.period, granularity),
    cells: [
      { label: "Spend",       value: `$${r.data.spend.toFixed(2)}` },
      { label: "Impressions", value: fmt(r.data.impressions) },
      { label: "Clicks",      value: fmt(r.data.clicks) },
      { label: "Conversions", value: fmt(r.data.conversions) },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1877f2]/15 bg-[#1877f2]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877f2]/15 text-[#1877f2]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Meta Ads</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ad Spend"    value={`$${totalSpend.toFixed(2)}`}  values={spend}       color="#1877f2" />
        <StatCard label="Impressions" value={fmt(totalImpressions)}         values={impressions} color="#1877f2" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}              sub={`${ctr.toFixed(2)}% CTR`} values={clicks} color="#00d4aa" />
        <StatCard label="CPC"         value={`$${cpc.toFixed(2)}`}          sub={`${fmt(totalConversions)} conversions`} values={spend.length ? [cpc] : []} color="#f59e0b" />
      </div>
      <DataTable rows={tableRows} />
    </div>
  );
}

// ── Lock screen ───────────────────────────────────────────────────────────

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
        Start 3-day free trial →
      </a>
      <p className="mt-3 font-mono text-[10px] text-[#8585aa]">$29/mo after trial · Cancel anytime</p>
    </div>
  );
}

function EmptySection({ platform }: { platform: string }) {
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-10 text-center">
      <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-4 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">Syncing data</span>
      </div>
      <p className="text-sm text-[#bcbcd8]">
        <span className="text-[#f8f8fc]">{platform}</span> is connected. Data will appear after the first nightly sync (02:00 UTC).
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type PlatformTab = "overview" | "stripe" | "ga4" | "meta";

const PLATFORM_LABELS: Record<PlatformTab, string> = {
  overview: "Overview",
  stripe:   "Stripe",
  ga4:      "Google Analytics",
  meta:     "Meta Ads",
};

export default function AnalyticsTab({ isPremium, connectedPlatforms, snapshots }: AnalyticsTabProps) {
  const availablePlatforms = (["stripe", "ga4", "meta"] as Exclude<PlatformTab, "overview">[]).filter(
    (p) => connectedPlatforms.includes(p)
  );

  const [activeSection, setActiveSection] = useState<PlatformTab>("overview");
  const [timeRange, setTimeRange]         = useState<TimeRange>("30d");
  const [granularity, setGranularity]     = useState<Granularity>("day");
  const [customRange, setCustomRange]     = useState<CustomRange | null>(null);

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
    const map: Record<string, Snapshot[]> = { stripe: [], ga4: [], meta: [] };
    for (const s of filteredSnapshots) {
      if (map[s.provider]) map[s.provider].push(s);
    }
    return map;
  }, [filteredSnapshots]);

  if (!isPremium) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Analytics</h1>
          <p className="mt-1 text-sm text-[#bcbcd8]">Deep-dive into your business metrics.</p>
        </div>
        <LockScreen />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Analytics</h1>
        <p className="mt-1 text-sm text-[#bcbcd8]">Daily breakdown per integration.</p>
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
          <div className="mb-4 flex gap-2 border-b border-[#363650]">
            {(["overview", ...availablePlatforms] as PlatformTab[]).map((p) => (
              <button
                key={p}
                onClick={() => setActiveSection(p)}
                className={`pb-3 px-1 font-mono text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                  activeSection === p
                    ? "border-[#00d4aa] text-[#00d4aa]"
                    : "border-transparent text-[#8585aa] hover:text-[#bcbcd8]"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          {/* ── Controls (time range + view by) ──────────────── */}
          <AnalyticsControls
            timeRange={timeRange} setTimeRange={(t) => { setTimeRange(t); setCustomRange(null); }}
            granularity={granularity} setGranularity={setGranularity}
            customRange={customRange} setCustomRange={setCustomRange}
          />

          {/* ── Sections ──────────────────────────────────────── */}
          {activeSection === "overview" && (
            <OverviewSection
              snapshots={filteredSnapshots}
              connectedPlatforms={connectedPlatforms}
              timeRange="all"
              granularity={granularity}
            />
          )}
          {activeSection === "stripe" && connectedPlatforms.includes("stripe") && (
            snapshotsByPlatform.stripe.length > 0
              ? (
                <div className="space-y-6">
                  <StripeSection snapshots={snapshotsByPlatform.stripe} granularity={granularity} />
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
        </>
      )}
    </div>
  );
}

