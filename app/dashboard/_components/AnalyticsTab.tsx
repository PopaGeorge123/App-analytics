"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot } from "./DashboardShell";
import OverviewSection from "./OverviewSection";

interface AnalyticsTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  metaCurrency?: string;
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

// ── Cross-platform Funnel Waterfall ──────────────────────────────────────

export function FunnelSection({ snapshots, connectedPlatforms, metaCurrency = "USD" }: { snapshots: Snapshot[]; connectedPlatforms: string[]; metaCurrency?: string }) {
  const hasStripe = connectedPlatforms.includes("stripe");
  const hasGA4    = connectedPlatforms.includes("ga4");
  const hasMeta   = connectedPlatforms.includes("meta");

  if (!hasStripe && !hasGA4 && !hasMeta) return null;
  if (connectedPlatforms.length < 2) return null; // need at least 2 sources to show a funnel

  const adSpend     = snapshots.filter((s) => s.provider === "meta").reduce((a, s)    => a + ((s.data as Record<string, number>).spend ?? 0), 0);
  const adClicks    = snapshots.filter((s) => s.provider === "meta").reduce((a, s)    => a + ((s.data as Record<string, number>).clicks ?? 0), 0);
  const sessions    = snapshots.filter((s) => s.provider === "ga4").reduce((a, s)     => a + ((s.data as Record<string, number>).sessions ?? 0), 0);
  const conversions = snapshots.filter((s) => s.provider === "ga4").reduce((a, s)     => a + ((s.data as Record<string, number>).conversions ?? 0), 0);
  const revenue     = snapshots.filter((s) => s.provider === "stripe").reduce((a, s)  => a + ((s.data as Record<string, number>).revenue ?? 0), 0);

  type FunnelStage = {
    label: string;
    value: number;
    displayValue: string;
    color: string;
    sub: string;
    available: boolean;
  };

  // Build currency for meta spend
  const currency: string =
    ([...snapshots].reverse().find((s) => s.provider === "meta" && (s.data as Record<string, unknown>)?.currency) as { data: Record<string, unknown> } | undefined)
      ?.data.currency as string ?? "USD";
  const fmtSpend = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const stages: FunnelStage[] = [
    {
      label: "Ad Spend",
      value: adSpend,
      displayValue: hasMeta ? fmtSpend(adSpend) : "—",
      color: "#1877f2",
      sub: "Meta Ads",
      available: hasMeta,
    },
    {
      label: "Ad Clicks",
      value: adClicks,
      displayValue: hasMeta ? fmt(adClicks) : "—",
      color: "#1877f2",
      sub: `${adSpend > 0 && adClicks > 0 ? fmtSpend(adSpend / adClicks) + " CPC" : "Meta Ads"}`,
      available: hasMeta,
    },
    {
      label: "Sessions",
      value: sessions,
      displayValue: hasGA4 ? fmt(sessions) : "—",
      color: "#f59e0b",
      sub: `${adClicks > 0 && sessions > 0 ? ((sessions / adClicks) * 100).toFixed(1) + "% click-to-session" : "Google Analytics"}`,
      available: hasGA4,
    },
    {
      label: "Conversions",
      value: conversions,
      displayValue: hasGA4 ? fmt(conversions) : "—",
      color: "#00d4aa",
      sub: `${sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) + "% conv rate" : "Google Analytics"}`,
      available: hasGA4,
    },
    {
      label: "Revenue",
      value: revenue,
      displayValue: hasStripe ? fmt(revenue, "currency") : "—",
      color: "#635bff",
      sub: `${conversions > 0 && revenue > 0 ? fmt(revenue / conversions, "currency") + " per conv" : "Stripe"}`,
      available: hasStripe,
    },
  ].filter((s) => s.available);

  if (stages.length < 2) return null;

  // Compute drop-off between consecutive stages (only meaningful for same-unit stages)
  // We show the percentage drop between consecutive absolute values where both are > 0
  const maxVal = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h18M6 8h12M10 12h4M12 16v0M11 20h2" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">Full Funnel</h3>
        <span className="ml-auto font-mono text-[9px] text-[#8585aa]">Spend → Revenue</span>
      </div>

      {/* Waterfall bars */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const barPct = stage.value > 0 ? (stage.value / maxVal) * 100 : 0;
          const prevStage = i > 0 ? stages[i - 1] : null;
          // Drop-off only when both are plain counts (not currency) — skip for spend/revenue
          const showDropoff = prevStage && prevStage.value > 0 && stage.value > 0
            && prevStage.color === stage.color; // same data source
          const dropoffPct = showDropoff
            ? Math.round(((prevStage!.value - stage.value) / prevStage!.value) * 100)
            : null;

          return (
            <div key={stage.label}>
              {/* Drop-off connector */}
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
      {hasMeta && hasStripe && adSpend > 0 && revenue > 0 && metaCurrency === "USD" && (
        <div className="flex items-center gap-6 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">ROAS</p>
            {/* revenue is Stripe cents → /100 to get USD; adSpend is Meta full units in USD */}
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
      {hasMeta && hasStripe && metaCurrency !== "USD" && (
        <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/8 px-4 py-3">
          <span className="text-sm">⚠️</span>
          <p className="font-mono text-[10px] text-[#f59e0b]">
            ROAS and cross-platform efficiency metrics are hidden — Meta spend is in <strong>{metaCurrency}</strong> while Stripe revenue is in <strong>USD</strong>.
          </p>
        </div>
      )}

      <p className="font-mono text-[9px] text-[#58588a]">
        Connects Meta Ads → Google Analytics → Stripe across the selected time range. This is your unique full-funnel view.
      </p>
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

// ── Product Revenue Breakdown ─────────────────────────────────────────────

function ProductBreakdownSection({ snapshots }: { snapshots: Snapshot[] }) {
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
        <span className="ml-auto font-mono text-[10px] text-[#8585aa]">{fmt(totalRevenue, "currency")} total</span>
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
                  <span className="font-mono text-[10px] font-bold text-[#f8f8fc]">{fmt(p.revenue, "currency")}</span>
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
        { label: "Spend",       value: fmtSpend(r.data.spend) },
        { label: "Impressions", value: fmt(r.data.impressions) },
        { label: "Clicks",      value: fmt(r.data.clicks) },
        { label: "CPC",         value: fmtSpend(rowCpc) },
        { label: "Conversions", value: fmt(r.data.conversions) },
      ],
    };
  });

  return (
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ad Spend"    value={fmtSpend(totalSpend)}  values={spend}       color="#1877f2" />
        <StatCard label="Impressions" value={fmt(totalImpressions)}  values={impressions} color="#1877f2" />
        <StatCard label="Clicks"      value={fmt(totalClicks)}       sub={`${ctr.toFixed(2)}% CTR`} values={clicks} color="#00d4aa" />
        <StatCard label="CPC"         value={fmtSpend(cpc)}          sub={`${fmt(totalConversions)} conversions`} values={spend.length ? [cpc] : []} color="#f59e0b" />
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
        <span className="text-[#f8f8fc]">{platform}</span> is connected. Waiting for data to sync...
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

export default function AnalyticsTab({ isPremium, connectedPlatforms, snapshots, metaCurrency = "USD" }: AnalyticsTabProps) {
  const availablePlatforms = (["stripe", "ga4", "meta"] as Exclude<PlatformTab, "overview">[]).filter(
    (p) => connectedPlatforms.includes(p)
  );

  const [activeSection, setActiveSection] = useState<PlatformTab>("overview");
  const [timeRange, setTimeRange]         = useState<TimeRange>("30d");
  const [granularity, setGranularity]     = useState<Granularity>("day");
  const [customRange, setCustomRange]     = useState<CustomRange | null>(null);

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
            snapshots={filteredSnapshots} activeSection={activeSection}
          />

          {/* ── Sections ──────────────────────────────────────── */}
          {activeSection === "overview" && (
            <OverviewSection
              snapshots={filteredSnapshots}
              connectedPlatforms={connectedPlatforms}
              timeRange="all"
              granularity={granularity}
              metaCurrency={metaCurrency}
            />
          )}
          {activeSection === "stripe" && connectedPlatforms.includes("stripe") && (
            snapshotsByPlatform.stripe.length > 0
              ? (
                <div className="space-y-6">
                  <StripeSection snapshots={snapshotsByPlatform.stripe} granularity={granularity} />
                  <ProductBreakdownSection snapshots={snapshotsByPlatform.stripe} />
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

