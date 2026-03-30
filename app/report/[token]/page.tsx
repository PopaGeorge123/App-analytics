import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { Metadata } from "next";

interface KPIs {
  revenue: number;
  txCount: number;
  sessions: number;
  conversions: number;
  adSpend: number;
  adClicks: number;
  bounceRate: number;
  newCustomers: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface ReportPayload {
  sharedBy: string;
  dateFrom: string;
  dateTo: string;
  platforms: string[];
  kpis: KPIs;
  dailyRevenue: DailyRevenue[];
  roas: number | null;
  cpc: number | null;
  convRate: number | null;
}

interface ShareTokenRow {
  label: string;
  date_from: string;
  date_to: string;
  platforms: string[];
  payload: ReportPayload;
  expires_at: string;
  view_count: number;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const db = createServiceClient();
  const { data } = await db
    .from("share_tokens")
    .select("label, date_from, date_to")
    .eq("token", token)
    .maybeSingle();

  return {
    title: data ? `${data.label} — Fold Report` : "Fold Report",
    description: data
      ? `Business metrics report for ${data.date_from} → ${data.date_to}`
      : "Shared analytics report",
    robots: { index: false, follow: false },
  };
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") {
    const d = n / 100;
    if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
    return `$${d.toFixed(2)}`;
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const PLATFORM_COLORS: Record<string, string> = {
  stripe: "#635bff",
  ga4:    "#f59e0b",
  meta:   "#1877f2",
};

const PLATFORM_LABELS: Record<string, string> = {
  stripe: "Stripe",
  ga4:    "Google Analytics",
  meta:   "Meta Ads",
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = createServiceClient();

  const { data: row } = await db
    .from("share_tokens")
    .select("label, date_from, date_to, platforms, payload, expires_at, view_count, created_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) notFound();
  if (new Date((row as ShareTokenRow).expires_at) < new Date()) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="font-mono text-3xl">⏳</p>
          <h1 className="font-mono text-lg font-bold text-[#f8f8fc]">This report has expired</h1>
          <p className="font-mono text-sm text-[#8585aa]">The link was valid for 30 days and has now expired.</p>
        </div>
      </main>
    );
  }

  const report = row as ShareTokenRow;
  const p = report.payload;
  const kpis = p.kpis;

  // Sparkline max for bar widths
  const maxRev = Math.max(...(p.dailyRevenue ?? []).map((d) => d.revenue), 1);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e5e5e5]" style={{ fontFamily: "'ui-monospace','SFMono-Regular','Menlo',monospace" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-[#1e2030] bg-[#0d0d14]">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <a
              href={process.env.NEXT_PUBLIC_APP_URL ?? "/"}
              className="block opacity-90 transition-opacity hover:opacity-100"
              title="Go to Fold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/fold-primary-dark.svg"
                alt="Fold"
                width={90}
                height={39}
                style={{ height: 39, width: "auto" }}
              />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#363650] px-3 py-1 text-[10px] text-[#8585aa]">
              Read-only report
            </span>
            {(report.view_count ?? 0) > 0 && (
              <span className="text-[10px] text-[#58588a]">{report.view_count} view{report.view_count !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

        {/* ── Title block ──────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-[#f8f8fc]">{report.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[#8585aa]">
            <span>{fmtDate(report.date_from)} — {fmtDate(report.date_to)}</span>
            <span>·</span>
            <span>Shared by {p.sharedBy}</span>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              {(report.platforms ?? []).map((pl) => (
                <span
                  key={pl}
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ backgroundColor: (PLATFORM_COLORS[pl] ?? "#8585aa") + "18", color: PLATFORM_COLORS[pl] ?? "#8585aa" }}
                >
                  {PLATFORM_LABELS[pl] ?? pl}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {report.platforms.includes("stripe") && (
            <>
              <KpiCard label="Revenue"       value={fmt(kpis.revenue, "currency")} color="#635bff" />
              <KpiCard label="Transactions"  value={fmt(kpis.txCount)}             color="#635bff" />
              <KpiCard label="New Customers" value={fmt(kpis.newCustomers)}        color="#635bff" />
            </>
          )}
          {report.platforms.includes("ga4") && (
            <>
              <KpiCard label="Sessions"     value={fmt(kpis.sessions)}                    color="#f59e0b" />
              <KpiCard label="Conversions"  value={fmt(kpis.conversions)}                 color="#00d4aa" />
              <KpiCard label="Bounce Rate"  value={fmt(kpis.bounceRate, "percent")}        color="#f59e0b" />
            </>
          )}
          {report.platforms.includes("meta") && (
            <>
              <KpiCard label="Ad Spend"  value={`$${fmt(kpis.adSpend)}`}  color="#1877f2" />
              <KpiCard label="Ad Clicks" value={fmt(kpis.adClicks)}        color="#1877f2" />
            </>
          )}
        </div>

        {/* ── Efficiency row ────────────────────────────────── */}
        {(p.roas !== null || p.cpc !== null || p.convRate !== null) && (
          <div className="flex flex-wrap gap-4 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 px-6 py-4">
            {p.roas !== null && (
              <MetricPill label="ROAS" value={`${p.roas.toFixed(2)}×`} />
            )}
            {p.cpc !== null && (
              <MetricPill label="CPC" value={`$${p.cpc.toFixed(2)}`} />
            )}
            {p.convRate !== null && (
              <MetricPill label="Conv Rate" value={`${p.convRate.toFixed(2)}%`} />
            )}
            {kpis.adSpend > 0 && kpis.newCustomers > 0 && (
              <MetricPill label="CAC" value={`$${(kpis.adSpend / kpis.newCustomers).toFixed(2)}`} />
            )}
          </div>
        )}

        {/* ── Revenue sparkline ─────────────────────────────── */}
        {report.platforms.includes("stripe") && p.dailyRevenue.length > 1 && (
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest text-[#8585aa]">Daily Revenue</span>
              <span className="text-[9px] text-[#58588a]">Stripe</span>
            </div>
            <div className="flex items-end gap-px h-16">
              {p.dailyRevenue.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${fmt(d.revenue, "currency")}`}
                  className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${Math.max((d.revenue / maxRev) * 100, 2)}%`,
                    backgroundColor: "#635bff",
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-[#58588a]">
              <span>{fmtDate(p.dailyRevenue[0].date)}</span>
              <span>{fmtDate(p.dailyRevenue[p.dailyRevenue.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="border-t border-[#1e2030] pt-6 flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] text-[#58588a]">
            Generated by <span className="text-[#00d4aa]">Fold</span> · Expires {fmtDate(report.expires_at)} · Read-only snapshot
          </p>
          <a
            href={process.env.NEXT_PUBLIC_APP_URL ?? "/"}
            className="text-[11px] text-[#00d4aa] hover:underline"
          >
            Create your own analytics dashboard →
          </a>
        </div>
      </div>
    </main>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border p-4 space-y-1"
      style={{ borderColor: color + "25", backgroundColor: color + "08" }}
    >
      <p className="text-[9px] uppercase tracking-widest" style={{ color: color + "aa" }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</p>
      <p className="text-sm font-bold text-[#f8f8fc]">{value}</p>
    </div>
  );
}
