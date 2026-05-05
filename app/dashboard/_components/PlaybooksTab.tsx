"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import type { AiPlaybook, AiPlaybookChart, AiPlaybooksResponse } from "@/app/api/ai/playbooks/route";

// ─────────────────────────────────────────────────────────────────────────────
// Generating Tips Modal — shown while AI is running (no playbooks yet)
// ─────────────────────────────────────────────────────────────────────────────

const TIPS = [
  {
    icon: "🎯",
    title: "Connect more platforms for better insights",
    body: "The more data sources you connect (Stripe, GA4, Meta Ads…), the more specific and actionable your playbooks become. Generic advice is worthless — real numbers unlock real recommendations.",
  },
  {
    icon: "📊",
    title: "Playbooks reference your actual metrics",
    body: "Every recommendation cites your real revenue, sessions, churn rate and ad spend — not industry averages. If a number looks wrong, check your integration is syncing correctly.",
  },
  {
    icon: "⚡",
    title: "Critical issues are ranked first",
    body: "Your playbooks are ordered from most urgent to biggest opportunity. Start with Critical — those are issues that are actively costing you money or growth right now.",
  },
  {
    icon: "✅",
    title: "Check off steps as you complete them",
    body: "Each playbook has 4–6 concrete steps. Tick them off as you go — the AI will track your progress and avoid repeating advice you've already acted on in future generations.",
  },
  {
    icon: "👍",
    title: "Rate playbooks to teach the AI",
    body: "Thumbs up / down on each playbook teaches the AI what works for your business. Over time it gets sharper, avoids unhelpful patterns, and surfaces better opportunities.",
  },
  {
    icon: "🔄",
    title: "Playbooks refresh automatically every week",
    body: "You don't need to manually regenerate — the daemon runs every Sunday night and produces fresh playbooks based on the latest 30 days of data. You can also trigger a manual refresh anytime.",
  },
];

const NEVER_SHOW_KEY = "fold_playbooks_tips_never_show";

function GeneratingTipsModal({ onClose, onNeverShow }: { onClose: () => void; onNeverShow: () => void }) {
  const [tipIdx, setTipIdx] = useState(0);
  const tip = TIPS[tipIdx];

  // Auto-advance tips every 6s
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: "#0f0f1a", borderColor: "#1e2040" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Spinner + heading */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
          <div>
            <p className="text-sm font-bold text-white">Claude is analysing your data…</p>
            <p className="text-xs text-slate-500 mt-0.5">This usually takes 30–90 seconds</p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {TIPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setTipIdx(i)}
              className="h-1 flex-1 rounded-full cursor-pointer transition-all duration-300"
              style={{ background: i === tipIdx ? "#00d4aa" : "#1e2040" }}
            />
          ))}
        </div>

        {/* Tip card */}
        <div
          key={tipIdx}
          className="rounded-xl border p-4 mb-5 transition-all"
          style={{ borderColor: "#1e2040", background: "#13141f" }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">{tip.icon}</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">{tip.title}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{tip.body}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setTipIdx((i) => (i - 1 + TIPS.length) % TIPS.length)}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-600">{tipIdx + 1} / {TIPS.length}</span>
          <button
            onClick={() => setTipIdx((i) => (i + 1) % TIPS.length)}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onNeverShow}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2"
          >
            Don&apos;t show this again
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-white/20 transition-colors"
          >
            Close for now
          </button>
        </div>
      </div>
    </div>
  );
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
  "paid-ads":   { label: "Paid Ads",   color: "#7a6fa8" },
  "revenue":    { label: "Revenue",    color: "#4a7a64" },
  "email":      { label: "Email",      color: "#8a7040" },
  "seo":        { label: "SEO",        color: "#4a6a8a" },
  "ecommerce":  { label: "Ecommerce",  color: "#7a5070" },
  "conversion": { label: "Conversion", color: "#3a7878" },
  "retention":  { label: "Retention",  color: "#7a5a3a" },
};

const categories: Category[] = ["all", "paid-ads", "revenue", "email", "seo", "ecommerce", "conversion", "retention"];

// ─────────────────────────────────────────────────────────────────────────────
// Health ring
// ─────────────────────────────────────────────────────────────────────────────

function HealthRing({ score, label }: { score: number; label: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 75 ? "#3d8a68" : score >= 50 ? "#a07840" : "#b06060";
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
// Severity config
// ─────────────────────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical:    { color: "#b06060", label: "Critical",    bg: "rgba(176,96,96,0.09)",   icon: "🔴" },
  warning:     { color: "#a07840", label: "Warning",     bg: "rgba(160,120,64,0.09)",  icon: "🟡" },
  opportunity: { color: "#3d8a68", label: "Opportunity", bg: "rgba(61,138,104,0.09)",  icon: "🟢" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Playbook list item  (compact left-column row)
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookListItem({
  playbook,
  isSelected,
  onSelect,
}: {
  playbook: AiPlaybook;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const sev = SEV_CONFIG[playbook.severity] ?? SEV_CONFIG.opportunity;
  const hasTriggered = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;

  return (
    <button
      onClick={onSelect}
      className="group w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus:outline-none"
      style={{
        background: isSelected ? "#18182a" : "transparent",
        border: `1px solid ${isSelected ? "#2a2a40" : "transparent"}`,
      }}
    >
      <div className="flex items-stretch">
        {/* Left severity bar */}
        <div
          className="w-0.5 shrink-0 rounded-l-lg"
          style={{ background: sev.color, opacity: isSelected ? 0.8 : 0.25 }}
        />

        <div className="flex-1 px-3 py-2.5 min-w-0 flex items-center gap-2">
          {/* Live dot */}
          {hasTriggered && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/50 animate-pulse" />
          )}
          {/* Title */}
          <p
            className="text-xs leading-snug line-clamp-2 transition-colors"
            style={{ color: isSelected ? "#c8cfe0" : "#5a6070" }}
          >
            {playbook.title}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playbook detail  (inline right-side panel)
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookDetail({
  playbook,
  feedback,
  onRating,
  onToggleStep,
  isDemo,
}: {
  playbook: AiPlaybook;
  feedback: { rating: number | null; completed_steps: number[] };
  onRating: (r: 1 | -1 | null) => void;
  onToggleStep: (idx: number) => void;
  isDemo: boolean;
}) {
  const sev      = SEV_CONFIG[playbook.severity] ?? SEV_CONFIG.opportunity;
  const catCfg   = CATEGORY_CONFIG[playbook.category as Exclude<Category, "all">];
  const catColor = catCfg?.color ?? "#8b8ba8";
  const catLabel = catCfg?.label ?? playbook.category;
  const hasTriggered = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;
  const completedSteps = feedback.completed_steps ?? [];
  const doneCount = playbook.steps.filter((_, i) => completedSteps.includes(i)).length;
  const allDone = doneCount === playbook.steps.length && playbook.steps.length > 0;

  return (
    <div
      key={playbook.id}
      className="h-full flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: "#0f0f1c",
        border: `1px solid ${sev.color}25`,
      }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full shrink-0" style={{ background: sev.color }} />

      {/* Header */}
      <div
        className="shrink-0 px-6 py-5 border-b"
        style={{ borderColor: "#1a1a2e" }}
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: sev.bg, color: sev.color }}
          >
            {sev.label.toUpperCase()}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ background: catColor + "18", color: catColor }}
          >
            {catLabel}
          </span>
          {hasTriggered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              Live data
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-white leading-snug">{playbook.title}</h3>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Expected gain */}
          <div
            className="rounded-xl border p-3.5 flex items-center gap-3"
            style={{ borderColor: "#2a3a30", background: "rgba(61,138,104,0.06)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a8a6a" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Expected gain</p>
              <p className="text-sm font-semibold text-slate-300">{playbook.expectedGain}</p>
            </div>
          </div>        {/* Problem */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Problem</p>
          <p className="text-sm text-slate-200 leading-relaxed">{playbook.problem}</p>
        </div>

        {/* Why it matters */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Why it matters</p>
          <p className="text-sm text-slate-300 leading-relaxed">{playbook.impact}</p>
        </div>

        {/* Proof chart */}
        {playbook.chart && playbook.chart.points.length >= 3 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Proof</p>
            <ProofChart chart={playbook.chart} accentColor={sev.color} uid={playbook.id} />
          </div>
        )}

        {/* Triggered metrics */}
        {hasTriggered && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Detected in your data</p>
            <div className="grid grid-cols-2 gap-2">
              {playbook.triggeredBy!.map((t, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3">
                  <p className="text-xs text-slate-500 mb-0.5">{t.label}</p>
                  <p className="text-base font-semibold text-slate-300">{t.value}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Target: {t.benchmark}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action plan */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action plan</p>
            {playbook.steps.length > 0 && (
              <span className="text-[10px] font-mono text-slate-600">
                {doneCount}/{playbook.steps.length} done
              </span>
            )}
          </div>
          {allDone && (
            <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 text-sm text-green-400 font-medium">
              ✓ All steps completed — Fold will factor your progress into the next generation.
            </div>
          )}
          <ol className="space-y-4">
            {playbook.steps.map((step, i) => {
              const done = completedSteps.includes(i);
              return (
                <li key={i} className="flex gap-3">
                  {/* Checkbox */}
                  {!isDemo && (
                    <button
                      onClick={() => onToggleStep(i)}
                      title={done ? "Mark as not done" : "Mark as done"}
                      className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all focus:outline-none"
                      style={{
                        borderColor: done ? catColor : "#3a3a54",
                        background: done ? catColor + "22" : "transparent",
                      }}
                    >
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={catColor} strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}
                  {/* Step number (demo mode) */}
                  {isDemo && (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5"
                      style={{ background: catColor + "22", color: catColor, border: `1px solid ${catColor}30` }}
                    >
                      {i + 1}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold leading-snug transition-colors"
                      style={{ color: done ? "#4a4a6a" : "#ffffff", textDecoration: done ? "line-through" : "none" }}
                    >
                      {step.action}
                    </p>
                    <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{step.detail}</p>
                    {step.link && (
                      <a
                        href={step.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
                        style={{ borderColor: catColor + "50", color: catColor }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        {step.link.label}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {!isDemo && (
          <div
            className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
            style={{ borderColor: "#1e1e30", background: "#0b0b18" }}
          >
            <p className="text-xs text-slate-500">Was this playbook accurate and useful?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRating(feedback.rating === 1 ? null : 1)}
                title="Yes, helpful"
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: feedback.rating === 1 ? "#3d8a6880" : "#2a2a3e",
                  background:  feedback.rating === 1 ? "rgba(61,138,104,0.12)" : "transparent",
                  color:       feedback.rating === 1 ? "#4a9a78" : "#6b7280",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback.rating === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.25M9 20.25h.008v.008H9v-.008zm-3.75 0h.008v.008H6v-.008z" />
                </svg>
                Helpful
              </button>
              <button
                onClick={() => onRating(feedback.rating === -1 ? null : -1)}
                title="Not accurate / not useful"
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: feedback.rating === -1 ? "#b0606080" : "#2a2a3e",
                  background:  feedback.rating === -1 ? "rgba(176,96,96,0.12)" : "transparent",
                  color:       feedback.rating === -1 ? "#b06060" : "#6b7280",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback.rating === -1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75 2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.134 12.134 0 012.25 12c0-2.848.992-5.464 2.649-7.521.388-.482.987-.729 1.605-.729h9.768c.483 0 .964.078 1.423.23l3.114 1.04a4.501 4.501 0 001.423.23H21.75M15 3.75h-.008v.008H15V3.75zm3.75 0h-.008v.008H18.75V3.75z" />
                </svg>
                Not useful
              </button>
            </div>
          </div>
        )}

        <div className="pb-6" />
      </div>
    </div>
  );
}

function PlaybookDetailEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0f0f1c]">
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#2a2a3e" strokeWidth={1.5} className="mb-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-xs text-slate-600">Select a playbook to view details</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse" style={{ height: 560 }}>
      {/* Left list skeleton */}
      <div className="w-64 shrink-0 flex flex-col gap-1 overflow-hidden rounded-2xl border border-[#1e1e30] bg-[#0f0f1c] p-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded bg-[#2a2a3e]" />
              <div className="h-4 w-10 rounded bg-[#2a2a3e] ml-auto" />
            </div>
            <div className="h-3 w-full rounded bg-[#222238]" />
            <div className="h-3 w-3/4 rounded bg-[#222238]" />
            <div className="h-3 w-20 rounded bg-[#1e2a20]" />
          </div>
        ))}
      </div>
      {/* Right detail skeleton */}
      <div className="flex-1 rounded-2xl border border-[#1e1e30] bg-[#0f0f1c] p-6 space-y-4">
        <div className="flex gap-2 mb-2">
          <div className="h-5 w-16 rounded-full bg-[#2a2a3e]" />
          <div className="h-5 w-20 rounded-full bg-[#2a2a3e]" />
        </div>
        <div className="h-5 w-2/3 rounded bg-[#2a2a3e]" />
        <div className="h-14 rounded-xl bg-[#1a2a1e]" />
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-[#2a2a3e]" />
          <div className="h-3 w-full rounded bg-[#222238]" />
          <div className="h-3 w-4/5 rounded bg-[#222238]" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-[#2a2a3e]" />
          <div className="h-32 rounded-xl bg-[#111128]" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium gate
// ─────────────────────────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#16162a] p-10 text-center">
      <div className="mb-5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#4a6a8a" strokeWidth={1.5}>
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
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/8 transition-colors"
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
  isDemo = false,
}: PlaybooksTabProps) {
  const [data, setData]         = useState<AiPlaybooksResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [activeCategory, setActiveCategory]       = useState<Category>("all");
  const [showOnlyTriggered, setShowOnlyTriggered] = useState(false);
  const hasFetched = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Feedback state ────────────────────────────────────────────────────────
  // Map of playbook_id → { rating, completed_steps }
  const [feedback, setFeedback] = useState<Record<string, { rating: number | null; completed_steps: number[] }>>({});
  const [, startTransition] = useTransition();

  const loadFeedback = useCallback(async () => {
    if (isDemo) return;
    try {
      const res = await fetch("/api/ai/playbooks/feedback");
      if (res.ok) setFeedback(await res.json());
    } catch { /* non-critical */ }
  }, [isDemo]);

  const saveFeedback = useCallback(async (
    playbookId: string,
    playbookTitle: string,
    patch: Partial<{ rating: number | null; completed_steps: number[] }>,
  ) => {
    if (isDemo) return;
    // Optimistic update
    setFeedback((prev) => ({
      ...prev,
      [playbookId]: {
        rating: prev[playbookId]?.rating ?? null,
        completed_steps: prev[playbookId]?.completed_steps ?? [],
        ...patch,
      },
    }));
    startTransition(() => {
      fetch("/api/ai/playbooks/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbook_id: playbookId, playbook_title: playbookTitle, ...patch }),
      }).catch(() => { /* swallow — optimistic already applied */ });
    });
  }, [isDemo, startTransition]);

  const handleRating = useCallback((playbook: AiPlaybook, r: 1 | -1 | null) => {
    saveFeedback(playbook.id, playbook.title, { rating: r });
  }, [saveFeedback]);

  const handleToggleStep = useCallback((playbook: AiPlaybook, stepIdx: number) => {
    const current = feedback[playbook.id]?.completed_steps ?? [];
    const next = current.includes(stepIdx)
      ? current.filter((i) => i !== stepIdx)
      : [...current, stepIdx];
    saveFeedback(playbook.id, playbook.title, { completed_steps: next });
  }, [feedback, saveFeedback]);

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
      if (json.playbooks?.length > 0) {
        setOpenId((prev) => prev ?? json.playbooks[0].id);
      }
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
        if (json.playbooks?.length > 0) {
          setOpenId((prev) => prev ?? json.playbooks[0].id);
        }
        setGenerating(false);
      }
    }, 5_000);
  }, [generating, data?.generatedAt]);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (!isPremium && !isDemo) return;
    if (hasFetched.current) return;
    hasFetched.current = true;
    if (isDemo) {
      setData(DEMO_DATA);
      setOpenId(DEMO_DATA.playbooks[0]?.id ?? null);
    } else {
      load();
      loadFeedback();
    }
  }, [isPremium, isDemo, load, loadFeedback]);

  // ── Tips modal logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!generating || playbooks.length > 0) return;
    const neverShow = typeof window !== "undefined" && localStorage.getItem(NEVER_SHOW_KEY) === "true";
    if (!neverShow) setShowTipsModal(true);
  }, [generating]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!generating) setShowTipsModal(false);
  }, [generating]);

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

      {showTipsModal && (
        <GeneratingTipsModal
          onClose={() => setShowTipsModal(false)}
          onNeverShow={() => {
            localStorage.setItem(NEVER_SHOW_KEY, "true");
            setShowTipsModal(false);
          }}
        />
      )}

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
              <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-slate-300">{criticalCount}</p>
                <p className="text-xs text-slate-600 mt-0.5">Critical</p>
              </div>
            )}
            <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white">{playbooks.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Playbooks</p>
            </div>
            {detectedCount > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-slate-300">{detectedCount}</p>
                <p className="text-xs text-slate-600 mt-0.5">Detected</p>
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
                borderColor: showOnlyTriggered ? "#60404080" : "#2a2a3e",
                color:       showOnlyTriggered ? "#a06060" : "#6b7280",
                background:  showOnlyTriggered ? "rgba(160,96,96,0.08)" : "transparent",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: showOnlyTriggered ? "#a06060" : "#6b7280" }}
              />
              {showOnlyTriggered ? "Detected only" : "Show detected only"}
            </button>
          )}
        </div>
      )}

      {/* ── Playbook split layout ─────────────────────────────────────────── */}
      {isPremium && data && !loading && (
        <div>
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-[#16162a] p-10 text-center">
              <p className="text-sm text-slate-500">No playbooks match the current filter.</p>
            </div>
          ) : (
            <div className="flex gap-3" style={{ height: 600 }}>
              {/* ── Left: compact list ─────────────────────────────────── */}
              <div
                className="w-64 shrink-0 flex flex-col gap-0.5 overflow-y-auto rounded-2xl border p-2"
                style={{ borderColor: "#1e1e30", background: "#0b0b18" }}
              >
                {sorted.map((pb) => (
                  <PlaybookListItem
                    key={pb.id}
                    playbook={pb}
                    isSelected={openId === pb.id}
                    onSelect={() => setOpenId(openId === pb.id ? null : pb.id)}
                  />
                ))}
              </div>

              {/* ── Right: detail ──────────────────────────────────────── */}
              <div className="flex-1 min-w-0">
                {openId && (() => {
                  const selected = sorted.find((pb) => pb.id === openId);
                  return selected ? (
                    <PlaybookDetail
                      playbook={selected}
                      feedback={feedback[selected.id] ?? { rating: null, completed_steps: [] }}
                      onRating={(r) => handleRating(selected, r)}
                      onToggleStep={(idx) => handleToggleStep(selected, idx)}
                      isDemo={isDemo}
                    />
                  ) : <PlaybookDetailEmpty />;
                })()}
                {!openId && <PlaybookDetailEmpty />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && playbooks.length > 0 && (
        <p className="text-center text-xs text-slate-600">
          Generated by Claude · based on your live data · refreshes weekly
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
  isDemo?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo data
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_DATA: AiPlaybooksResponse = {
  healthScore: 58,
  healthLabel: "Needs Work",
  summary: "Your SaaS is generating solid top-line revenue but leaking growth through three critical vectors: rising ad costs, a deteriorating email programme, and a churn rate that is quietly compounding. Fixing ad targeting and email segmentation alone could recover an estimated $2,400/month within 30 days. The biggest immediate opportunity is your conversion rate — at 0.8% you are leaving roughly 60 sign-ups per week on the table from existing traffic.",
  generatedAt: "2026-04-28T08:00:00.000Z",
  playbooks: [
    {
      id: "meta-cpc-bleed",
      title: "Meta Ad CPC Has Tripled — Kill Broad Targeting Now",
      severity: "critical",
      category: "paid-ads",
      problem: "Your Meta CPC has risen to $4.20 over the last 30 days, up from $1.40 the prior period — a 200% increase. At your current click volume (820 clicks/month) you are overpaying by roughly $2,300/month for the same traffic.",
      impact: "At $4.20 CPC with your 0.8% conversion rate, your blended CAC from paid is now $525 — well above your $49/month ARPU, making every paid acquisition loss-making. If left unaddressed for 60 days, this alone will drain ~$4,600 in wasted spend with no improvement in new customers.",
      expectedGain: "Cut CPC back below $1.80 and reduce paid CAC to ~$225 within 3 weeks",
      triggeredBy: [
        { label: "CPC (30d avg)", value: "$4.20", benchmark: "< $1.80" },
        { label: "Paid CAC", value: "$525", benchmark: "< $250" },
        { label: "Ad spend (30d)", value: "$3,444", benchmark: "—" },
      ],
      chart: {
        title: "Meta CPC — last 30 days",
        unit: "usd",
        benchmark: 1.8,
        benchmarkLabel: "Target CPC $1.80",
        points: [
          { date: "2026-03-29", value: 1.45 }, { date: "2026-03-31", value: 1.62 },
          { date: "2026-04-02", value: 1.9 },  { date: "2026-04-04", value: 2.1 },
          { date: "2026-04-07", value: 2.55 }, { date: "2026-04-10", value: 3.0 },
          { date: "2026-04-13", value: 3.4 },  { date: "2026-04-16", value: 3.8 },
          { date: "2026-04-19", value: 4.0 },  { date: "2026-04-22", value: 4.2 },
          { date: "2026-04-25", value: 4.2 },  { date: "2026-04-28", value: 4.2 },
        ],
      },
      steps: [
        {
          action: "Pause all Advantage+ and broad-audience ad sets immediately",
          detail: "In Meta Ads Manager, filter by ad sets with CPC > $3.00 and pause them today. Advantage+ campaigns frequently expand audiences in ways that inflate CPC once creative fatigue sets in. Broad audiences with no interest or behavioural constraints are the primary driver of your CPC spike. Pausing these stops the bleed while you rebuild tighter targeting.",
          link: { label: "Meta Ads Manager", url: "https://business.facebook.com/adsmanager" },
        },
        {
          action: "Rebuild with 3 tightly scoped interest-based ad sets",
          detail: "Create three new ad sets each capped at a potential reach of 500k–1.5M: (1) job titles matching your ICP, (2) competitors as interests, (3) lookalike 1% from your existing customer list. Set a manual CPC bid cap of $2.00 in each. Narrow audiences consistently outperform broad ones for B2B SaaS — expect CPC to drop to $1.50–$2.00 within the first week.",
          link: { label: "Meta Lookalike Audiences guide", url: "https://www.facebook.com/business/help/164749007013531" },
        },
        {
          action: "Refresh ad creative with 3 new variants per ad set",
          detail: "Creative fatigue is the second most common cause of CPC spikes. Upload at least 3 new image/video variants per ad set — test a problem-focused headline, a social-proof headline, and a benefit-led headline. Use Meta's Creative Reporting to kill any creative with CTR below 0.8% after 3 days. Fresh creative typically recovers CTR by 25–40% within 5 days.",
        },
        {
          action: "Set a daily spend cap per ad set at $40 while testing",
          detail: "While CPCs are elevated, capping each ad set at $40/day limits downside exposure to $120/day total during the rebuild phase. Once you confirm CPC is below $2.00 for 5 consecutive days, scale back to your previous budget. This prevents compounding losses during the optimisation window.",
        },
        {
          action: "Install the Meta Pixel conversion event for 'Trial Started'",
          detail: "If you are only optimising for 'Lead' or 'View Content', Meta's algorithm is not learning from your highest-value conversion signal. Add a custom conversion event firing on your trial confirmation page and switch your campaign objective to 'Conversions — Trial Started'. This gives the algorithm the signal it needs to find users who actually convert, which naturally reduces CPC on a per-quality-click basis.",
          link: { label: "Meta Pixel setup guide", url: "https://developers.facebook.com/docs/meta-pixel/get-started" },
        },
      ],
    },
    {
      id: "churn-rate-spike",
      title: "Churn Rate at 6.2% — Identify and Plug the Leak",
      severity: "critical",
      category: "retention",
      problem: "Your monthly churn rate is 6.2%, meaning you are losing 6 out of every 100 active subscribers each month. At your current MRR of $11,400 this translates to $707/month in churned revenue — or $8,484 annualised.",
      impact: "At 6.2% monthly churn your net revenue retention (NRR) is below 94%, meaning your existing customer base is shrinking even if you add new customers. To maintain flat MRR you must acquire more than $707 in new MRR every month just to stay even — your growth is being run on a treadmill. Reducing churn to 2% would free up effectively $480/month in retained revenue, compounding significantly over 12 months.",
      expectedGain: "Reduce monthly churn from 6.2% to under 2.5%, recovering ~$400–$480/month in MRR",
      triggeredBy: [
        { label: "Monthly churn rate", value: "6.2%", benchmark: "< 2.5%" },
        { label: "Churned MRR (30d)", value: "$707", benchmark: "< $285" },
        { label: "Active subscriptions", value: "97", benchmark: "—" },
      ],
      chart: {
        title: "New customers vs churned (30d)",
        unit: "number",
        benchmark: 0,
        benchmarkLabel: "",
        points: [
          { date: "2026-03-29", value: 102 }, { date: "2026-04-04", value: 101 },
          { date: "2026-04-07", value: 99 },  { date: "2026-04-11", value: 100 },
          { date: "2026-04-14", value: 98 },  { date: "2026-04-18", value: 99 },
          { date: "2026-04-21", value: 97 },  { date: "2026-04-25", value: 97 },
          { date: "2026-04-28", value: 97 },
        ],
      },
      steps: [
        {
          action: "Pull the last 30 churned customers and identify a pattern",
          detail: "In Stripe, filter cancelled subscriptions from the last 30 days and export to CSV. Look for common attributes: plan type, company size, how long they were a customer before churning, and whether they ever contacted support. In most SaaS businesses 60–70% of churn clusters around 2–3 specific failure patterns (e.g. never set up a core feature, or churned at day 7, 14, or 30). Identifying the pattern tells you exactly where to intervene.",
          link: { label: "Stripe subscription export", url: "https://dashboard.stripe.com/subscriptions" },
        },
        {
          action: "Add a cancellation survey with 4 fixed options + free text",
          detail: "Before a user can cancel, show a one-question modal: 'Why are you leaving?' with options: Too expensive / Missing a feature I need / Switching to a competitor / Not using it enough / Other. Log responses to your database. Even 30 responses will give you statistically meaningful signal. Tools like Stripe Billing Portal or a custom modal in your app can intercept the cancel flow. This data will tell you whether churn is a pricing, activation, or product problem.",
        },
        {
          action: "Set up a 3-email at-risk sequence triggered by inactivity",
          detail: "Using your email platform, create a segment of users who have not logged in for 7 days. Send them a 3-email sequence over 14 days: Day 7 — 'You haven't tried [core feature] yet, here's how'; Day 10 — a case study or win from another customer; Day 14 — a personal check-in from the founder offering a 15-min call. This sequence consistently recovers 15–25% of at-risk users before they churn.",
        },
        {
          action: "Offer a pause option instead of cancellation for price-sensitive users",
          detail: "For users who indicate 'Too expensive' in the cancellation survey, offer a 1-month pause at 50% discount before full cancellation. Stripe Billing supports subscription pausing natively. Roughly 20–30% of users who intend to cancel will accept a pause, and ~60% of those paused users resume at full price. This alone can recover 1–2% of monthly churn.",
          link: { label: "Stripe: pause a subscription", url: "https://stripe.com/docs/billing/subscriptions/pause-payment" },
        },
      ],
    },
    {
      id: "email-open-rate-drop",
      title: "Email Open Rate Collapsed to 11% — Resegment Your List",
      severity: "warning",
      category: "email",
      problem: "Your email open rate over the last 30 days is 11.2%, down from 24.8% the prior period. Your click-to-open rate is 3.1%, well below the 8–12% SaaS benchmark. You are sending to a disengaged list which is actively damaging your sender reputation.",
      impact: "Continued sending to a disengaged list risks your domain landing in spam folders — once that happens it takes 4–8 weeks to recover sender reputation. Beyond deliverability, a 3.1% CTOR means your email channel is generating roughly 1/4 of the leads it should be. For a list of 2,400 subscribers this represents ~180 missed clicks per campaign versus industry norm.",
      expectedGain: "Restore open rate above 22% and CTOR above 8% within 4 weeks",
      triggeredBy: [
        { label: "Open rate (30d)", value: "11.2%", benchmark: "> 22%" },
        { label: "CTOR (30d)", value: "3.1%", benchmark: "> 8%" },
        { label: "List size", value: "2,400", benchmark: "—" },
      ],
      steps: [
        {
          action: "Immediately suppress anyone who hasn't opened in 60+ days",
          detail: "In your email platform, create a segment of subscribers with 0 opens in the last 60 days and move them to a suppressed list — do not delete them, just stop mailing them. This will likely be 40–60% of your list. Your immediate open rate will jump to 18–22% because you're only sending to engaged subscribers. This also protects your domain reputation from further damage.",
        },
        {
          action: "Run a re-engagement campaign to the suppressed segment",
          detail: "Send a single 'We miss you' email to suppressed users with a very low-friction CTA (e.g. 'Click here if you want to stay on our list'). Subject line: 'Should we break up?' typically gets 2–3× the open rate of regular emails due to curiosity. Anyone who does not open or click within 7 days should be permanently unsubscribed. This cleans your list while giving dormant users one last chance to re-engage.",
        },
        {
          action: "A/B test subject lines — move from feature-led to curiosity or benefit-led",
          detail: "Your current subject lines appear to be feature announcements (e.g. 'New dashboard update'). Switch to benefit or curiosity formats: 'How [Customer Name] 3×'d their revenue in 30 days' or 'The metric killing your growth (and how to fix it)'. Run an A/B test on your next 3 sends using your platform's split-test feature. Expect a 30–50% improvement in open rate from subject line optimisation alone.",
        },
        {
          action: "Reduce send frequency to 1× per week and increase content quality",
          detail: "If you are sending 3+ emails per week, cut to once per week. List fatigue is the #1 cause of sudden open rate drops. Each email should deliver one clear insight, story, or actionable tip — not a product update. Track your open rate weekly; it should recover by 2–3 percentage points per week once you reduce frequency and improve content relevance.",
        },
      ],
    },
    {
      id: "conversion-rate-low",
      title: "0.8% Conversion Rate — Your Pricing Page Is Losing Signups",
      severity: "warning",
      category: "conversion",
      problem: "Your site-wide conversion rate (sessions to trial sign-ups) is 0.8% against a SaaS benchmark of 2.5–3.5%. You are generating 4,200 sessions per month but only 34 trial sign-ups — at 2.5% conversion that would be 105 sign-ups, or 71 more per month.",
      impact: "At your current CAC of $525 those 71 missed sign-ups represent $37,275 in equivalent paid acquisition cost every month — traffic you already have but are not converting. Even a modest improvement to 1.5% conversion would deliver 29 additional trials per month from zero incremental ad spend, and at a 15% trial-to-paid rate that is 4–5 new customers per month.",
      expectedGain: "Increase conversion rate from 0.8% to 1.8%+, adding ~25 trials/month from existing traffic",
      triggeredBy: [
        { label: "Conversion rate (30d)", value: "0.8%", benchmark: "> 2.5%" },
        { label: "Sessions (30d)", value: "4,200", benchmark: "—" },
        { label: "Trial sign-ups (30d)", value: "34", benchmark: "105+" },
      ],
      steps: [
        {
          action: "Install a heatmap tool and identify where users drop off on your pricing page",
          detail: "Set up Microsoft Clarity (free) or Hotjar on your pricing page today. Within 48–72 hours you will have heatmap and session recording data. Look for: (1) how far users scroll — if 60%+ don't reach your CTA, move it up; (2) rage clicks on non-clickable elements indicating confusion; (3) whether users hover over the pricing tiers but don't click. This data replaces guesswork and tells you exactly what to fix.",
          link: { label: "Microsoft Clarity (free)", url: "https://clarity.microsoft.com" },
        },
        {
          action: "Add a single social proof element above the fold on your pricing page",
          detail: "Place a strip of 3–5 customer logos, or a single pull-quote from a recognisable customer, immediately below your hero headline — before any pricing table. Studies consistently show this single change improves conversion by 10–25%. If you don't have recognisable logos, use a '⭐⭐⭐⭐⭐ Rated 4.8/5 by 120+ teams' trust badge instead. This reduces the psychological risk of clicking 'Start free trial'.",
        },
        {
          action: "Simplify to 2 pricing tiers and rename your primary CTA",
          detail: "If you have 3+ tiers, the paradox of choice is causing decision paralysis. Consolidate to 2 tiers: Starter and Pro (or equivalent). Make your recommended tier visually dominant with a 'Most popular' badge. Change the CTA button from 'Get started' or 'Sign up' to 'Start your free trial — no credit card required'. The phrase 'no credit card required' consistently lifts conversion by 8–15% by removing friction.",
        },
        {
          action: "Add an exit-intent popup offering a 14-day extended trial",
          detail: "Install an exit-intent trigger (Hotjar, ConvertBox, or a simple JS event listener on mouseleave) that fires when a user is about to leave your pricing page without converting. Offer them a 14-day extended trial (vs your standard 7-day) in exchange for their email. This recovers 5–10% of abandoning visitors and adds them to a nurture sequence. Even at 5% recovery on 200 pricing-page exits per month, that is 10 additional trials.",
        },
      ],
    },
    {
      id: "mrr-growth-stalling",
      title: "MRR Growth Stalling — Expansion Revenue Is Near Zero",
      severity: "opportunity",
      category: "revenue",
      problem: "Your MRR has been flat at $11,200–$11,400 for the last 3 weeks. New MRR from sign-ups ($340) is barely outpacing churned MRR ($707), and your expansion MRR (upgrades) is effectively $0 — meaning 100% of your revenue growth must come from new customer acquisition.",
      impact: "Without expansion revenue you are entirely dependent on new customer acquisition to grow — the most expensive growth motion. SaaS companies with active expansion revenue grow 2–3× faster than acquisition-only businesses and have significantly lower effective CAC. Adding even $500/month in expansion MRR would meaningfully change your growth trajectory and LTV:CAC ratio.",
      expectedGain: "Generate $400–$600/month in expansion MRR within 60 days through in-app upgrade prompts",
      triggeredBy: [
        { label: "MRR", value: "$11,400", benchmark: "Growing > 10%/mo" },
        { label: "Expansion MRR", value: "~$0", benchmark: "> $300/mo" },
        { label: "Upgrade rate", value: "< 0.5%", benchmark: "> 3%" },
      ],
      steps: [
        {
          action: "Identify your 'power users' — those hitting plan limits most often",
          detail: "In your database, query for users who have used 80%+ of their plan's feature limits (seats, API calls, projects, etc.) in the last 14 days. These are your most likely upgraders. Export this list and tag them in your CRM or email platform as 'Upgrade ready'. This segment alone typically converts at 15–30% when you reach out with a targeted upgrade message — 10× better than broadcasting to your whole list.",
        },
        {
          action: "Add an in-app upgrade nudge at the point of limit approach",
          detail: "Implement a non-blocking banner or modal that appears when a user reaches 80% of their plan limit: 'You've used 8/10 projects — upgrade to Pro for unlimited projects and [key feature].' This is the highest-intent upgrade moment because the user is actively trying to do the thing the next plan unlocks. In-app upgrade nudges at limit approach convert at 8–18% — far higher than email campaigns.",
        },
        {
          action: "Reach out personally to your top 20 customers and offer an annual plan discount",
          detail: "Sort your customers by MRR contribution and identify the top 20. Send each a personal email (not a campaign) offering 2 months free in exchange for switching to annual billing. Annual plans typically convert at 20–30% when offered personally, and they reduce churn by ~50% because annual customers are far less likely to cancel. For 20 customers at $49/month, converting 6 to annual locks in $3,528 in upfront revenue immediately.",
        },
        {
          action: "Launch a 'Teams' add-on for your highest-usage accounts",
          detail: "If your product has any collaborative or multi-user value, package a 'Teams' add-on priced at $29–$49/month: additional seats, shared workspaces, admin controls, or audit logs. Email your single-seat customers who have invited at least one other user to your app — these are signals of team use. Even 10 upgrades at $39/month adds $390/month in expansion MRR immediately.",
        },
      ],
    },
  ],
};
