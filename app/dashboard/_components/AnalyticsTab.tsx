"use client";

import { useMemo, useState } from "react";
import type { Snapshot } from "./DashboardShell";
import OverviewSection from "./OverviewSection";

interface AnalyticsTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
}

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

// ── Sparkline SVG ─────────────────────────────────────────────────────────

function Sparkline({ values, color = "#00d4aa" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-10 w-full" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 160;
  const H = 40;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const fill = `M ${pts[0]} L ${pts.join(" L ")} L ${W},${H} L 0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  values,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  values: number[];
  color?: string;
}) {
  const t = trend(values);
  const accent = color ?? "#00d4aa";
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 flex flex-col gap-3 transition-all hover:border-[#2a2a3e] hover:bg-[#141420] group"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl opacity-60"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">{label}</p>
        {t && (
          <span
            className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              t.up ? "text-[#00d4aa] bg-[#00d4aa]/10" : "text-red-400 bg-red-400/10"
            }`}
          >
            {t.up ? "▲" : "▼"} {t.pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-[#f0f0f5]">{value}</p>
        {sub && <p className="mt-0.5 font-mono text-[10px] text-[#4a4a6a]">{sub}</p>}
      </div>
      <Sparkline values={values} color={accent} />
    </div>
  );
}

// ── Daily table ───────────────────────────────────────────────────────────

function DailyTable({ rows }: { rows: { date: string; cells: { label: string; value: string }[] }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#1e1e2e]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#1e1e2e]">
            <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">Date</th>
            {rows[0]?.cells.map((c) => (
              <th key={c.label} className="px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.date} className={`border-b border-[#1e1e2e]/50 ${i % 2 === 0 ? "bg-[#0d0d16]/40" : ""}`}>
              <td className="px-4 py-2.5 font-mono text-[11px] text-[#8888aa]">{row.date}</td>
              {row.cells.map((c) => (
                <td key={c.label} className="px-4 py-2.5 font-mono text-[11px] text-[#f0f0f5]">
                  {c.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Platform sections ─────────────────────────────────────────────────────

function StripeSection({ snapshots }: { snapshots: Snapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const revenue = sorted.map((s) => getField(s, "revenue"));
  const txCount = sorted.map((s) => getField(s, "txCount"));
  const refunds = sorted.map((s) => getField(s, "refunds"));
  const newCustomers = sorted.map((s) => getField(s, "newCustomers"));

  const totalRevenue = revenue.reduce((a, b) => a + b, 0);
  const totalTx = txCount.reduce((a, b) => a + b, 0);
  const totalRefunds = refunds.reduce((a, b) => a + b, 0);
  const totalNew = newCustomers.reduce((a, b) => a + b, 0);
  const avgOrderVal = totalTx > 0 ? totalRevenue / totalTx : 0;

  const tableRows = sorted.slice(0, 14).map((s) => ({
    date: s.date,
    cells: [
      { label: "Revenue", value: fmt(getField(s, "revenue"), "currency") },
      { label: "Transactions", value: fmt(getField(s, "txCount")) },
      { label: "New Customers", value: fmt(getField(s, "newCustomers")) },
      { label: "Refunds", value: fmt(getField(s, "refunds"), "currency") },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#635bff]/15 bg-[#635bff]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635bff]/15 text-[#635bff]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f0f0f5]">Stripe Revenue</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={fmt(totalRevenue, "currency")} values={[...revenue].reverse()} color="#635bff" />
        <StatCard label="Transactions" value={fmt(totalTx)} values={[...txCount].reverse()} color="#635bff" />
        <StatCard label="New Customers" value={fmt(totalNew)} values={[...newCustomers].reverse()} color="#00d4aa" />
        <StatCard label="Avg Order Val" value={fmt(avgOrderVal, "currency")} sub={`${fmt(totalRefunds, "currency")} refunds`} values={revenue.length ? [avgOrderVal] : []} color="#f59e0b" />
      </div>

      {tableRows.length > 0 && <DailyTable rows={tableRows} />}
    </div>
  );
}

function GA4Section({ snapshots }: { snapshots: Snapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const sessions = sorted.map((s) => getField(s, "sessions"));
  const users = sorted.map((s) => getField(s, "users"));
  const conversions = sorted.map((s) => getField(s, "conversions"));
  const bounceRates = sorted.map((s) => getField(s, "bounceRate"));

  const totalSessions = sessions.reduce((a, b) => a + b, 0);
  const totalUsers = users.reduce((a, b) => a + b, 0);
  const totalConversions = conversions.reduce((a, b) => a + b, 0);
  const avgBounce = bounceRates.length ? bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length : 0;
  const convRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

  const tableRows = sorted.slice(0, 14).map((s) => ({
    date: s.date,
    cells: [
      { label: "Sessions", value: fmt(getField(s, "sessions")) },
      { label: "Users", value: fmt(getField(s, "users")) },
      { label: "Conversions", value: fmt(getField(s, "conversions")) },
      { label: "Bounce Rate", value: fmt(getField(s, "bounceRate"), "percent") },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#f59e0b]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f0f0f5]">Google Analytics 4</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions" value={fmt(totalSessions)} values={[...sessions].reverse()} color="#f59e0b" />
        <StatCard label="Users" value={fmt(totalUsers)} values={[...users].reverse()} color="#f59e0b" />
        <StatCard label="Conversions" value={fmt(totalConversions)} sub={`${convRate.toFixed(1)}% conv rate`} values={[...conversions].reverse()} color="#00d4aa" />
        <StatCard label="Avg Bounce Rate" value={fmt(avgBounce, "percent")} values={[...bounceRates].reverse()} color="#f87171" />
      </div>

      {tableRows.length > 0 && <DailyTable rows={tableRows} />}
    </div>
  );
}

function MetaSection({ snapshots }: { snapshots: Snapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const spend = sorted.map((s) => getField(s, "spend"));
  const impressions = sorted.map((s) => getField(s, "impressions"));
  const clicks = sorted.map((s) => getField(s, "clicks"));
  const conversions = sorted.map((s) => getField(s, "conversions"));

  const totalSpend = spend.reduce((a, b) => a + b, 0);
  const totalImpressions = impressions.reduce((a, b) => a + b, 0);
  const totalClicks = clicks.reduce((a, b) => a + b, 0);
  const totalConversions = conversions.reduce((a, b) => a + b, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const tableRows = sorted.slice(0, 14).map((s) => ({
    date: s.date,
    cells: [
      { label: "Spend", value: `$${getField(s, "spend").toFixed(2)}` },
      { label: "Impressions", value: fmt(getField(s, "impressions")) },
      { label: "Clicks", value: fmt(getField(s, "clicks")) },
      { label: "Conversions", value: fmt(getField(s, "conversions")) },
    ],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-[#1877f2]/15 bg-[#1877f2]/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877f2]/15 text-[#1877f2]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </div>
        <h3 className="font-mono text-sm font-semibold text-[#f0f0f5]">Meta Ads</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ad Spend" value={`$${totalSpend.toFixed(2)}`} values={[...spend].reverse()} color="#1877f2" />
        <StatCard label="Impressions" value={fmt(totalImpressions)} values={[...impressions].reverse()} color="#1877f2" />
        <StatCard label="Clicks" value={fmt(totalClicks)} sub={`${ctr.toFixed(2)}% CTR`} values={[...clicks].reverse()} color="#00d4aa" />
        <StatCard label="CPC" value={`$${cpc.toFixed(2)}`} sub={`${fmt(totalConversions)} conversions`} values={spend.length ? [cpc] : []} color="#f59e0b" />
      </div>

      {tableRows.length > 0 && <DailyTable rows={tableRows} />}
    </div>
  );
}

// ── Lock screen ───────────────────────────────────────────────────────────

function LockScreen() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 py-20 px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-2">Premium Feature</p>
      <h2 className="font-mono text-xl font-bold text-[#f0f0f5] mb-3">Analytics requires Premium</h2>
      <p className="text-sm text-[#8888aa] max-w-sm mb-6">
        Upgrade to access full analytics, revenue trends, cohort analysis, and AI-generated insights.
      </p>
      <a
        href="/api/stripe/checkout"
        className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-2.5 font-mono text-sm font-bold text-[#0a0a0f] hover:bg-[#00bfa0] transition"
      >
        Start 3-day free trial →
      </a>
      <p className="mt-3 font-mono text-[10px] text-[#4a4a6a]">$29/mo after trial · Cancel anytime</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type PlatformTab = "overview" | "stripe" | "ga4" | "meta";

const PLATFORM_LABELS: Record<PlatformTab, string> = {
  overview: "📊 Overview",
  stripe: "Stripe",
  ga4: "Google Analytics",
  meta: "Meta Ads",
};

export default function AnalyticsTab({ isPremium, connectedPlatforms, snapshots }: AnalyticsTabProps) {
  const availablePlatforms = (["stripe", "ga4", "meta"] as Exclude<PlatformTab, "overview">[]).filter((p) =>
    connectedPlatforms.includes(p)
  );

  const [activeSection, setActiveSection] = useState<PlatformTab>("overview");

  const snapshotsByPlatform = useMemo(() => {
    const map: Record<string, Snapshot[]> = { stripe: [], ga4: [], meta: [] };
    for (const s of snapshots) {
      if (map[s.provider]) map[s.provider].push(s);
    }
    return map;
  }, [snapshots]);

  if (!isPremium) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[#f0f0f5]">Analytics</h1>
          <p className="mt-1 text-sm text-[#8888aa]">Deep-dive into your business metrics.</p>
        </div>
        <LockScreen />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold text-[#f0f0f5]">Analytics</h1>
        <p className="mt-1 text-sm text-[#8888aa]">Last 30 days — daily breakdown per integration.</p>
      </div>

      {availablePlatforms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1e1e2e] p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#1e1e2e] bg-[#12121a] text-[#4a4a6a]">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#4a4a6a] mb-2">No data yet</p>
          <p className="text-sm text-[#8888aa]">Connect at least one integration from the Overview tab to see analytics.</p>
        </div>
      ) : (
        <>
          {/* Platform tabs */}
          <div className="mb-6 flex gap-2 border-b border-[#1e1e2e]">
            {/* Overview tab — always visible */}
            <button
              onClick={() => setActiveSection("overview")}
              className={`pb-3 px-1 font-mono text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                activeSection === "overview"
                  ? "border-[#00d4aa] text-[#00d4aa]"
                  : "border-transparent text-[#4a4a6a] hover:text-[#8888aa]"
              }`}
            >
              {PLATFORM_LABELS["overview"]}
            </button>

            {availablePlatforms.map((p) => (
              <button
                key={p}
                onClick={() => setActiveSection(p)}
                className={`pb-3 px-1 font-mono text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                  activeSection === p
                    ? "border-[#00d4aa] text-[#00d4aa]"
                    : "border-transparent text-[#4a4a6a] hover:text-[#8888aa]"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Overview section */}
          {activeSection === "overview" && (
            <OverviewSection snapshots={snapshots} connectedPlatforms={connectedPlatforms} />
          )}

          {/* Per-platform sections */}
          {activeSection === "stripe" && connectedPlatforms.includes("stripe") && (
            snapshotsByPlatform.stripe.length > 0
              ? <StripeSection snapshots={snapshotsByPlatform.stripe} />
              : <EmptySection platform="Stripe" />
          )}
          {activeSection === "ga4" && connectedPlatforms.includes("ga4") && (
            snapshotsByPlatform.ga4.length > 0
              ? <GA4Section snapshots={snapshotsByPlatform.ga4} />
              : <EmptySection platform="Google Analytics" />
          )}
          {activeSection === "meta" && connectedPlatforms.includes("meta") && (
            snapshotsByPlatform.meta.length > 0
              ? <MetaSection snapshots={snapshotsByPlatform.meta} />
              : <EmptySection platform="Meta Ads" />
          )}
        </>
      )}
    </div>
  );
}

function EmptySection({ platform }: { platform: string }) {
  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-10 text-center">
      <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-4 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
          Syncing data
        </span>
      </div>
      <p className="text-sm text-[#8888aa]">
        <span className="text-[#f0f0f5]">{platform}</span> is connected. Data will appear after the first daily sync (02:00 UTC).
      </p>
    </div>
  );
}
