"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import type { AiPlaybook, AiPlaybookChart, AiPlaybooksResponse } from "@/app/api/ai/playbooks/route";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PlaybooksTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────────────────────────────────────

type Category =
  | "all"
  | "paid-ads"
  | "revenue"
  | "email"
  | "seo"
  | "ecommerce"
  | "conversion"
  | "retention";

const CATEGORY_CONFIG: Record<Exclude<Category, "all">, { label: string; color: string }> = {
  "paid-ads":   { label: "Paid Ads",   color: "#a78bfa" },
  "revenue":    { label: "Revenue",    color: "#00d4aa" },
  "email":      { label: "Email",      color: "#f59e0b" },
  "seo":        { label: "SEO",        color: "#60a5fa" },
  "ecommerce":  { label: "Ecommerce",  color: "#f472b6" },
  "conversion": { label: "Conversion", color: "#34d399" },
  "retention":  { label: "Retention",  color: "#fb923c" },
};

const categories: Category[] = ["all", "paid-ads", "revenue", "email", "seo", "ecommerce", "conversion", "retention"];

// ─────────────────────────────────────────────────────────────────────────────
// Health ring
// ─────────────────────────────────────────────────────────────────────────────

function HealthRing({ score, label }: { score: number; label: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 75 ? "#00d4aa" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#363650" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-xl font-bold" style={{ color }}>{score}</span>
        <span className="font-mono text-[8px] text-[#8585aa] uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtChartVal(v: number, unit: string): string {
  if (unit === "usd")             return `$${v.toFixed(2)}`;
  if (unit === "usd_cents")       return `$${(v / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (unit === "percent_decimal") return `${(v * 100).toFixed(1)}%`;
  if (unit === "multiplier")      return `${v.toFixed(2)}×`;
  return String(Math.round(v));
}

function fmtChartDate(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProofChart({ chart, accentColor, uid }: { chart: AiPlaybookChart; accentColor: string; uid: string }) {
  // Pick 3 evenly-spaced ticks so the x-axis isn't crowded
  const pts = chart.points;
  const ticks = [pts[0]?.date, pts[Math.floor(pts.length / 2)]?.date, pts[pts.length - 1]?.date]
    .filter(Boolean) as string[];

  const gradId = `proof-grad-${uid}`;

  return (
    <div className="rounded-xl border border-[#363650] bg-[#13131f] p-3 overflow-hidden">
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-4" />
        </svg>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
          Proof: {chart.title}
        </p>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={148}>
        <AreaChart data={pts} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={accentColor} stopOpacity={0.22} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={fmtChartDate}
            tick={{ fill: "#8585aa", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtChartVal(v as number, chart.unit)}
            tick={{ fill: "#8585aa", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "#1c1c2a",
              border: "1px solid #363650",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#f8f8fc",
            }}
            labelFormatter={(label) => fmtChartDate(String(label))}
            formatter={(v: unknown) => [fmtChartVal(v as number, chart.unit), "Value"]}
          />
          {chart.benchmark != null && (
            <ReferenceLine
              y={chart.benchmark}
              stroke="#00d4aa"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: chart.benchmarkLabel ?? `Target: ${fmtChartVal(chart.benchmark, chart.unit)}`,
                fill: "#00d4aa",
                fontSize: 9,
                fontFamily: "monospace",
                position: "insideTopRight",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={accentColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Footnote */}
      {chart.benchmark != null && (
        <p className="mt-1.5 font-mono text-[8px] text-[#58588a] text-center">
          ── {chart.benchmarkLabel ?? `target ${fmtChartVal(chart.benchmark, chart.unit)}`} · your trend should cross this line after fixing
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playbook card
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookCard({
  playbook,
  isOpen,
  onToggle,
}: {
  playbook: AiPlaybook;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const sevColor = playbook.severity === "critical" ? "#f87171"
                 : playbook.severity === "warning"  ? "#f59e0b"
                 : "#00d4aa";
  const catCfg   = CATEGORY_CONFIG[playbook.category as Exclude<Category, "all">];
  const catColor = catCfg?.color ?? "#8585aa";
  const catLabel = catCfg?.label ?? playbook.category;
  const hasTriggered = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;

  return (
    <div
      className="rounded-2xl border transition-all"
      style={{
        borderColor: isOpen ? sevColor + "40" : "#363650",
        background:  isOpen ? sevColor + "06" : "#1c1c2a60",
      }}
    >
      {/* Header */}
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={onToggle}>
        <div
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}80` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {hasTriggered && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#f87171]/30 bg-[#f87171]/8 px-2 py-0.5 font-mono text-[8px] font-semibold text-[#f87171] uppercase tracking-widest">
                <span className="h-1 w-1 rounded-full bg-[#f87171] animate-pulse" />
                detected in your data
              </span>
            )}
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest"
              style={{ borderColor: catColor + "40", color: catColor, background: catColor + "10" }}
            >
              {catLabel}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest"
              style={{ borderColor: sevColor + "40", color: sevColor, background: sevColor + "10" }}
            >
              {playbook.severity}
            </span>
          </div>
          <h3 className="font-mono text-sm font-bold text-[#f8f8fc]">{playbook.title}</h3>
          <p className="mt-0.5 text-xs text-[#8585aa] line-clamp-2">{playbook.problem}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span
            className="rounded-lg border px-2 py-1 font-mono text-[9px] font-semibold"
            style={{ borderColor: "#00d4aa30", color: "#00d4aa", background: "#00d4aa08" }}
          >
            {playbook.expectedGain}
          </span>
          <svg
            className="transition-transform"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded */}
      {isOpen && (
        <div className="border-t border-[#363650] px-4 pb-4 pt-3 space-y-4">
          {/* Why it matters */}
          <div className="rounded-xl border border-[#363650] bg-[#13131f] p-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa] mb-1">Why this matters</p>
            <p className="text-xs text-[#c4c4d4]">{playbook.impact}</p>
          </div>

          {/* ── Proof chart ─────────────────────────────────────────────── */}
          {playbook.chart && playbook.chart.points.length >= 3 && (
            <ProofChart chart={playbook.chart} accentColor={sevColor} uid={playbook.id} />
          )}

          {/* Triggered metric tiles */}
          {hasTriggered && (
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#f87171] mb-2">Detected in your data</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {playbook.triggeredBy!.map((t, i) => (
                  <div key={i} className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/6 p-2.5">
                    <p className="font-mono text-[9px] text-[#8585aa] uppercase tracking-widest">{t.label}</p>
                    <p className="font-mono text-sm font-bold text-[#f87171]">{t.value}</p>
                    <p className="font-mono text-[8px] text-[#8585aa]">benchmark: {t.benchmark}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Action plan ─────────────────────────────────────────────── */}
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa] mb-2">Action plan</p>
            <ol className="space-y-2">
              {playbook.steps.map((step, i) => (
                <li key={i} className="rounded-xl border border-[#363650] bg-[#222235] p-3">
                  <div className="flex gap-3">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold"
                      style={{ background: catColor + "25", color: catColor }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{step.action}</p>
                      <p className="mt-0.5 text-xs text-[#8585aa]">{step.detail}</p>
                      {/* Step resource link */}
                      {step.link && (
                        <a
                          href={step.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[9px] font-semibold transition-colors"
                          style={{
                            borderColor: catColor + "40",
                            color: catColor,
                            background: catColor + "0d",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          {step.link.label}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#363650] bg-[#1c1c2a60] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 rounded-full bg-[#363650]" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-16 rounded-full bg-[#363650]" />
                <div className="h-4 w-20 rounded-full bg-[#363650]" />
              </div>
              <div className="h-4 w-3/5 rounded bg-[#363650]" />
              <div className="h-3 w-4/5 rounded bg-[#2a2a3d]" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-[#363650]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium gate
// ─────────────────────────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#00d4aa]/20 bg-gradient-to-br from-[#0d2b24] to-[#1a1a2e] p-8 text-center">
      <div className="mb-4 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      </div>
      <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-2">AI Fix-It Playbooks</h3>
      <p className="text-xs text-[#8585aa] mb-4 max-w-sm mx-auto">
        Claude analyses your live data and generates personalised, step-by-step playbooks for every problem detected in your business.
      </p>
      <a
        href="/dashboard?tab=settings"
        className="inline-flex items-center gap-2 rounded-xl border border-[#00d4aa] bg-[#00d4aa]/10 px-4 py-2 font-mono text-xs font-semibold text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
      >
        Upgrade to Premium →
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PlaybooksTab({
  isPremium,
  connectedPlatforms,
}: PlaybooksTabProps) {
  const [data, setData]         = useState<AiPlaybooksResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [activeCategory, setActiveCategory]     = useState<Category>("all");
  const [showOnlyTriggered, setShowOnlyTriggered] = useState(false);
  const hasFetched = useRef(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? "/api/ai/playbooks?refresh=1" : "/api/ai/playbooks";
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      const json: AiPlaybooksResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load playbooks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPremium || hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [isPremium, load]);

  const playbooks = data?.playbooks ?? [];

  const filtered = playbooks.filter((p) => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    if (showOnlyTriggered && !(p.triggeredBy && p.triggeredBy.length > 0)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, opportunity: 2 } as const;
    const aHas = a.triggeredBy && a.triggeredBy.length > 0 ? -1 : 0;
    const bHas = b.triggeredBy && b.triggeredBy.length > 0 ? -1 : 0;
    if (aHas !== bHas) return aHas - bHas;
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  const criticalCount = playbooks.filter((p) => p.severity === "critical").length;
  const detectedCount = playbooks.filter((p) => p.triggeredBy && p.triggeredBy.length > 0).length;

  const generatedAgo = data?.generatedAt
    ? (() => {
        const mins = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000);
        if (mins < 2) return "just now";
        if (mins < 60) return `${mins} min ago`;
        return `${Math.round(mins / 60)}h ago`;
      })()
    : null;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-mono text-base font-bold text-[#f8f8fc]">AI Fix-It Playbooks</h2>
          <p className="mt-0.5 text-xs text-[#8585aa]">
            {data
              ? `Claude analysed your live data and found ${playbooks.length} personalised action plans`
              : "Claude analyses your real data and builds personalised, step-by-step action plans"}
          </p>
        </div>
        {isPremium && (
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2 font-mono text-[10px] font-semibold text-[#8585aa] hover:border-[#00d4aa]/40 hover:text-[#00d4aa] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className={loading ? "animate-spin" : ""}
              width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {loading ? "Generating…" : "Regenerate"}
          </button>
        )}
      </div>

      {/* ── Not premium ────────────────────────────────────────────────────── */}
      {!isPremium && <PremiumGate />}

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-4 sm:flex-row sm:items-center">
          <div className="shrink-0 flex justify-center sm:justify-start">
            <HealthRing score={data.healthScore} label={data.healthLabel} />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa] mb-1.5">Business health summary</p>
            <p className="text-xs text-[#c4c4d4] leading-relaxed">{data.summary}</p>
            {generatedAgo && (
              <p className="mt-2 font-mono text-[8px] text-[#58588a]">Generated {generatedAgo} · based on your live data</p>
            )}
          </div>
          <div className="flex gap-2 sm:flex-col sm:items-end shrink-0">
            {criticalCount > 0 && (
              <div className="rounded-xl border border-[#f87171]/25 bg-[#f87171]/6 px-3 py-2 text-center">
                <p className="font-mono text-lg font-bold text-[#f87171]">{criticalCount}</p>
                <p className="font-mono text-[8px] text-[#f87171]/70 uppercase tracking-widest">Critical</p>
              </div>
            )}
            <div className="rounded-xl border border-[#363650] bg-[#222235] px-3 py-2 text-center">
              <p className="font-mono text-lg font-bold text-[#f8f8fc]">{playbooks.length}</p>
              <p className="font-mono text-[8px] text-[#8585aa] uppercase tracking-widest">Playbooks</p>
            </div>
            {detectedCount > 0 && (
              <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-2 text-center">
                <p className="font-mono text-lg font-bold text-[#00d4aa]">{detectedCount}</p>
                <p className="font-mono text-[8px] text-[#00d4aa]/70 uppercase tracking-widest">Detected</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isPremium && loading && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#00d4aa]/20 bg-[#0d2b24]/40 p-5 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full border-2 border-[#00d4aa]/30 border-t-[#00d4aa] animate-spin" />
            <div>
              <p className="font-mono text-xs font-bold text-[#f8f8fc]">Claude is analysing your data…</p>
              <p className="text-xs text-[#8585aa] mt-0.5">
                Reading your metrics from {connectedPlatforms.length} connected platform{connectedPlatforms.length !== 1 ? "s" : ""} and building personalised playbooks.
              </p>
            </div>
          </div>
          <PlaybookSkeleton />
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {isPremium && !loading && error && (
        <div className="rounded-2xl border border-[#f87171]/30 bg-[#f87171]/6 p-5 text-center">
          <p className="font-mono text-xs font-bold text-[#f87171] mb-1">Failed to generate playbooks</p>
          <p className="text-xs text-[#8585aa] mb-3">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#f87171]/40 px-3 py-2 font-mono text-[10px] font-semibold text-[#f87171] hover:bg-[#f87171]/10 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const cfg    = cat === "all" ? null : CATEGORY_CONFIG[cat];
              const active = activeCategory === cat;
              const count  = cat === "all" ? playbooks.length : playbooks.filter((p) => p.category === cat).length;
              if (cat !== "all" && count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-all"
                  style={{
                    borderColor: active ? (cfg?.color ?? "#00d4aa") + "60" : "#363650",
                    color:       active ? (cfg?.color ?? "#00d4aa") : "#8585aa",
                    background:  active ? (cfg?.color ?? "#00d4aa") + "12" : "transparent",
                  }}
                >
                  {cat === "all" ? "All Playbooks" : cfg!.label}
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px]"
                    style={{ background: active ? (cfg?.color ?? "#00d4aa") + "25" : "#363650" }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {detectedCount > 0 && (
            <button
              onClick={() => setShowOnlyTriggered((v) => !v)}
              className="ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-all"
              style={{
                borderColor: showOnlyTriggered ? "#f87171aa" : "#363650",
                color:       showOnlyTriggered ? "#f87171" : "#8585aa",
                background:  showOnlyTriggered ? "rgba(248,113,113,0.08)" : "transparent",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: showOnlyTriggered ? "#f87171" : "#8585aa" }}
              />
              {showOnlyTriggered ? "Showing detected only" : "Detected in data only"}
            </button>
          )}
        </div>
      )}

      {/* ── Playbook list ────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-8 text-center">
              <p className="font-mono text-xs text-[#8585aa]">No playbooks match the current filter.</p>
            </div>
          ) : (
            sorted.map((pb) => (
              <PlaybookCard
                key={pb.id}
                playbook={pb}
                isOpen={openId === pb.id}
                onToggle={() => setOpenId(openId === pb.id ? null : pb.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <p className="text-center font-mono text-[9px] text-[#58588a]">
          Playbooks are generated by Claude using your real live data. Connect more integrations for deeper analysis.
        </p>
      )}

    </div>
  );
}
