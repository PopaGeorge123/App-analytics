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
  "revenue":    { label: "Revenue",    color: "#34d399" },
  "email":      { label: "Email",      color: "#f59e0b" },
  "seo":        { label: "SEO",        color: "#60a5fa" },
  "ecommerce":  { label: "Ecommerce",  color: "#f472b6" },
  "conversion": { label: "Conversion", color: "#00d4aa" },
  "retention":  { label: "Retention",  color: "#fb923c" },
};

const categories: Category[] = ["all", "paid-ads", "revenue", "email", "seo", "ecommerce", "conversion", "retention"];

// ─────────────────────────────────────────────────────────────────────────────
// Health ring
// ─────────────────────────────────────────────────────────────────────────────

function HealthRing({ score, label }: { score: number; label: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#2a2a3e" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>
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
  const pts = chart.points;
  const ticks = [pts[0]?.date, pts[Math.floor(pts.length / 2)]?.date, pts[pts.length - 1]?.date]
    .filter(Boolean) as string[];
  const gradId = `proof-grad-${uid}`;

  return (
    <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-4" />
        </svg>
        <p className="text-xs font-semibold" style={{ color: accentColor }}>
          {chart.title}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={pts} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={accentColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={fmtChartDate}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtChartVal(v as number, chart.unit)}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a2e",
              border: "1px solid #2a2a3e",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#f1f5f9",
            }}
            labelFormatter={(label) => fmtChartDate(String(label))}
            formatter={(v: unknown) => [fmtChartVal(v as number, chart.unit), chart.title]}
          />
          {chart.benchmark != null && (
            <ReferenceLine
              y={chart.benchmark}
              stroke={accentColor}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: chart.benchmarkLabel ?? `Target: ${fmtChartVal(chart.benchmark, chart.unit)}`,
                fill: accentColor,
                fontSize: 10,
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
            activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {chart.benchmark != null && (
        <p className="mt-2 text-xs text-slate-500 text-center">
          Dashed line = {chart.benchmarkLabel ?? `target ${fmtChartVal(chart.benchmark, chart.unit)}`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playbook card
// ─────────────────────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical:    { color: "#f87171", label: "Critical",    bg: "rgba(248,113,113,0.08)" },
  warning:     { color: "#f59e0b", label: "Warning",     bg: "rgba(245,158,11,0.08)"  },
  opportunity: { color: "#34d399", label: "Opportunity", bg: "rgba(52,211,153,0.08)"  },
};

function PlaybookCard({
  playbook,
  isOpen,
  onToggle,
}: {
  playbook: AiPlaybook;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const sev     = SEV_CONFIG[playbook.severity] ?? SEV_CONFIG.opportunity;
  const catCfg  = CATEGORY_CONFIG[playbook.category as Exclude<Category, "all">];
  const catColor = catCfg?.color ?? "#8b8ba8";
  const catLabel = catCfg?.label ?? playbook.category;
  const hasTriggered = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: isOpen ? "#1a1a2e" : "#16162a",
        border: `1px solid ${isOpen ? sev.color + "35" : "#2a2a3e"}`,
      }}
    >
      {/* Severity stripe */}
      <div className="h-0.5 w-full" style={{ background: sev.color, opacity: 0.7 }} />

      {/* Header button */}
      <button className="flex w-full items-start gap-4 px-5 py-4 text-left" onClick={onToggle}>
        {/* Left: severity dot */}
        <div className="mt-1.5 shrink-0">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: sev.color, boxShadow: `0 0 8px ${sev.color}60` }}
          />
        </div>

        {/* Middle: text */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: sev.bg, color: sev.color }}
            >
              {sev.label}
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300"
              style={{ background: catColor + "18" }}
            >
              {catLabel}
            </span>
            {hasTriggered && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                In your data
              </span>
            )}
          </div>
          {/* Title */}
          <h3 className="text-sm font-semibold text-white leading-snug">{playbook.title}</h3>
          {/* Problem — only when collapsed */}
          {!isOpen && (
            <p className="mt-1 text-sm text-slate-400 line-clamp-2 leading-relaxed">{playbook.problem}</p>
          )}
        </div>

        {/* Right: gain + chevron */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-400 whitespace-nowrap"
            style={{ background: "rgba(52,211,153,0.1)" }}
          >
            {playbook.expectedGain}
          </span>
          <svg
            className="transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-5">

          {/* Problem + Impact */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Problem</p>
              <p className="text-sm text-slate-200 leading-relaxed">{playbook.problem}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Why it matters</p>
              <p className="text-sm text-slate-300 leading-relaxed">{playbook.impact}</p>
            </div>
          </div>

          {/* Proof chart */}
          {playbook.chart && playbook.chart.points.length >= 3 && (
            <ProofChart chart={playbook.chart} accentColor={sev.color} uid={playbook.id} />
          )}

          {/* Triggered metric tiles */}
          {hasTriggered && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detected in your data</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {playbook.triggeredBy!.map((t, i) => (
                  <div key={i} className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{t.label}</p>
                    <p className="text-base font-bold text-red-400">{t.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Target: {t.benchmark}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action plan */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Action plan</p>
            <ol className="space-y-3">
              {playbook.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  {/* Step number */}
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5"
                    style={{ background: catColor + "22", color: catColor }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{step.action}</p>
                    <p className="mt-1 text-sm text-slate-400 leading-relaxed">{step.detail}</p>
                    {step.link && (
                      <a
                        href={step.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
                        style={{ borderColor: catColor + "50", color: catColor }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        {step.link.label}
                      </a>
                    )}
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
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#2a2a3e] bg-[#16162a] overflow-hidden">
          <div className="h-0.5 bg-[#2a2a3e]" />
          <div className="flex items-start gap-4 px-5 py-4">
            <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#2a2a3e]" />
            <div className="flex-1 space-y-2.5">
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-md bg-[#2a2a3e]" />
                <div className="h-5 w-20 rounded-md bg-[#2a2a3e]" />
              </div>
              <div className="h-4 w-2/3 rounded bg-[#2a2a3e]" />
              <div className="h-3.5 w-4/5 rounded bg-[#222238]" />
            </div>
            <div className="h-7 w-24 rounded-lg bg-[#2a2a3e]" />
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
    <div className="rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-950/40 to-[#16162a] p-10 text-center">
      <div className="mb-5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-2">AI Fix-It Playbooks</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
        Claude analyses your live data and generates personalised, step-by-step playbooks for every problem detected in your business.
      </p>
      <a
        href="/dashboard?tab=settings"
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
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
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [activeCategory, setActiveCategory]       = useState<Category>("all");
  const [showOnlyTriggered, setShowOnlyTriggered] = useState(false);
  const hasFetched = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/playbooks");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      const json: AiPlaybooksResponse = await res.json();
      setData(json);
      return json;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load playbooks.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** POST to generate endpoint → daemon runs generation → poll until generatedAt changes */
  const triggerGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    const prevGeneratedAt = data?.generatedAt ?? null;

    try {
      const res = await fetch("/api/ai/playbooks/generate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start generation.");
      setGenerating(false);
      return;
    }

    // Poll every 5s until generatedAt changes or 3-min timeout
    const deadline = Date.now() + 3 * 60 * 1000;
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        setGenerating(false);
        setError("Generation is taking longer than expected. Please try again in a few minutes.");
        return;
      }
      const res = await fetch("/api/ai/playbooks");
      if (!res.ok) return;
      const json: AiPlaybooksResponse = await res.json();
      if (json.generatedAt && json.generatedAt !== prevGeneratedAt) {
        clearInterval(pollRef.current!);
        setData(json);
        setGenerating(false);
      }
    }, 5_000);
  }, [generating, data?.generatedAt]);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

  const criticalCount  = playbooks.filter((p) => p.severity === "critical").length;
  const detectedCount  = playbooks.filter((p) => p.triggeredBy && p.triggeredBy.length > 0).length;

  const generatedAgo = data?.generatedAt
    ? (() => {
        const mins = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000);
        if (mins < 2) return "just now";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.round(mins / 60)}h ago`;
      })()
    : null;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">AI Fix-It Playbooks</h2>
          <p className="mt-1 text-sm text-slate-400">
            {data
              ? `${playbooks.length} personalised action plan${playbooks.length !== 1 ? "s" : ""} based on your live data`
              : "Claude analyses your real data and builds personalised, step-by-step action plans"}
          </p>
        </div>
        {isPremium && (
          <button
            onClick={triggerGenerate}
            disabled={loading || generating}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:border-white/20 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className={(loading || generating) ? "animate-spin" : ""}
              width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {generating ? "Generating…" : loading ? "Loading…" : "Generate"}
          </button>
        )}
      </div>

      {/* ── Not premium ────────────────────────────────────────────────────── */}
      {!isPremium && <PremiumGate />}

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="rounded-2xl border border-white/8 bg-[#16162a] p-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="shrink-0 flex justify-center sm:justify-start">
            <HealthRing score={data.healthScore} label={data.healthLabel} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Business health</p>
            <p className="text-sm text-slate-200 leading-relaxed">{data.summary}</p>
            {generatedAgo && (
              <p className="mt-2 text-xs text-slate-500">Generated {generatedAgo} · updates nightly</p>
            )}
          </div>
          <div className="flex gap-3 sm:flex-col sm:items-end shrink-0">
            {criticalCount > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-red-400">{criticalCount}</p>
                <p className="text-xs text-red-400/70 mt-0.5">Critical</p>
              </div>
            )}
            <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white">{playbooks.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Playbooks</p>
            </div>
            {detectedCount > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-emerald-400">{detectedCount}</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Detected</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isPremium && loading && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/20 p-5 flex items-center gap-4">
            <div className="h-9 w-9 shrink-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-white">Loading your playbooks…</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Reading metrics from {connectedPlatforms.length} connected platform{connectedPlatforms.length !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>
          <PlaybookSkeleton />
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {isPremium && !loading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm font-semibold text-red-400 mb-1">Failed to load playbooks</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const cfg    = cat === "all" ? null : CATEGORY_CONFIG[cat];
            const active = activeCategory === cat;
            const count  = cat === "all" ? playbooks.length : playbooks.filter((p) => p.category === cat).length;
            if (cat !== "all" && count === 0) return null;
            const color = cfg?.color ?? "#34d399";
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: active ? color + "50" : "#2a2a3e",
                  color:       active ? color : "#6b7280",
                  background:  active ? color + "12" : "transparent",
                }}
              >
                {cat === "all" ? "All" : cfg!.label}
                <span
                  className="rounded-md px-1.5 py-0 text-[10px] font-semibold"
                  style={{ background: active ? color + "22" : "#2a2a3e", color: active ? color : "#6b7280" }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {detectedCount > 0 && (
            <button
              onClick={() => setShowOnlyTriggered((v) => !v)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                borderColor: showOnlyTriggered ? "#f87171aa" : "#2a2a3e",
                color:       showOnlyTriggered ? "#f87171" : "#6b7280",
                background:  showOnlyTriggered ? "rgba(248,113,113,0.08)" : "transparent",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: showOnlyTriggered ? "#f87171" : "#6b7280" }}
              />
              {showOnlyTriggered ? "Detected only" : "Show detected only"}
            </button>
          )}
        </div>
      )}

      {/* ── Playbook list ────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-[#16162a] p-10 text-center">
              <p className="text-sm text-slate-500">No playbooks match the current filter.</p>
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
      {isPremium && data && !loading && playbooks.length > 0 && (
        <p className="text-center text-xs text-slate-600">
          Generated by Claude · based on your live data · refreshes nightly
        </p>
      )}

    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PlaybooksTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
}
