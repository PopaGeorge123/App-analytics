"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import type { AiPlaybook, AiPlaybookChart, AiPlaybooksResponse } from "@/app/api/ai/playbooks/route";
import type { PlaybookHistoryEntry } from "@/app/api/ai/playbooks/history/route";
import { REVENUE_PROVIDERS } from "@/lib/integrations/catalog";

// ─────────────────────────────────────────────────────────────────────────────
// Generating Tips Modal — shown while AI is running (no playbooks yet)
// ─────────────────────────────────────────────────────────────────────────────

const TIPS = [
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 0V3m0 18v-1.5M12 12a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
        <circle cx="12" cy="12" r="2.25" stroke="#00d4aa" strokeWidth={1.8} fill="none" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l4.5-4.5" />
      </svg>
    ),
    title: "Connect more platforms for better insights",
    body: "The more data sources you connect (Stripe, GA4, Meta Ads…), the more specific and actionable your playbooks become. Generic advice is worthless — real numbers unlock real recommendations.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: "Playbooks reference your actual metrics",
    body: "Every recommendation cites your real revenue, sessions, churn rate and ad spend — not industry averages. If a number looks wrong, check your integration is syncing correctly.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Critical issues are ranked first",
    body: "Your playbooks are ordered from most urgent to biggest opportunity. Start with Critical — those are issues that are actively costing you money or growth right now.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Check off steps as you complete them",
    body: "Each playbook has 4–6 concrete steps. Tick them off as you go — the AI will track your progress and avoid repeating advice you've already acted on in future generations.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
      </svg>
    ),
    title: "Rate playbooks to teach the AI",
    body: "Thumbs up / down on each playbook teaches the AI what works for your business. Over time it gets sharper, avoids unhelpful patterns, and surfaces better opportunities.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
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
        style={{ background: "#f3f3fb", borderColor: "#e8e8f5" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#6a6a90] hover:text-[#4a4a6a] transition-colors"
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
            <p className="text-sm font-bold text-[#1a1a2e]">Claude is analysing your data…</p>
            <p className="text-xs text-[#6a6a90] mt-0.5">This usually takes 30–90 seconds</p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {TIPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setTipIdx(i)}
              className="h-1 flex-1 rounded-full cursor-pointer transition-all duration-300"
              style={{ background: i === tipIdx ? "#00d4aa" : "#e8e8f5" }}
            />
          ))}
        </div>

        {/* Tip card */}
        <div
          key={tipIdx}
          className="rounded-xl border p-4 mb-5 transition-all"
          style={{ borderColor: "#e8e8f5", background: "#f4f4fc" }}
        >
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5">{tip.icon}</span>
            <div>
              <p className="text-sm font-semibold text-[#1a1a2e] mb-1">{tip.title}</p>
              <p className="text-sm text-[#6a6a90] leading-relaxed">{tip.body}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setTipIdx((i) => (i - 1 + TIPS.length) % TIPS.length)}
            className="rounded-lg border border-[#e0e0ec] px-3 py-1.5 text-xs text-[#6a6a90] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-[#5a5a7a]">{tipIdx + 1} / {TIPS.length}</span>
          <button
            onClick={() => setTipIdx((i) => (i + 1) % TIPS.length)}
            className="rounded-lg border border-[#e0e0ec] px-3 py-1.5 text-xs text-[#6a6a90] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onNeverShow}
            className="text-xs text-[#5a5a7a] hover:text-[#6a6a90] transition-colors underline underline-offset-2"
          >
            Don&apos;t show this again
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#dcdcec] bg-[#f5f5fb] px-4 py-2 text-xs font-semibold text-[#4a4a6a] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors"
          >
            Close for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility Blocked Modal — shown when user can't generate yet
// ─────────────────────────────────────────────────────────────────────────────

function EligibilityBlockedModal({
  reason,
  hint,
  onClose,
}: {
  reason: string;
  hint: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border p-7 shadow-2xl"
        style={{ background: "#f3f3fb", borderColor: "#e0e0f0" }}
      >
        {/* Icon */}
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(176,96,96,0.15)", border: "1px solid rgba(176,96,96,0.3)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b06060" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        {/* Text */}
        <h3 className="mb-2 text-center text-base font-semibold text-[#1a1a2e]">{reason}</h3>
        <p className="text-center text-sm leading-relaxed" style={{ color: "#8b8fa8" }}>{hint}</p>

        {/* Close */}
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl py-2.5 text-sm font-medium transition-colors"
          style={{ background: "#ebebf5", color: "#c0c4d8" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#ebebf5")}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No Revenue Platform Modal — shown when user has no revenue integration
// ─────────────────────────────────────────────────────────────────────────────

const REVENUE_PLATFORM_OPTIONS = [
  { id: "stripe",        name: "Stripe",        desc: "Subscriptions, MRR & revenue",  color: "#635bff", icon: "/integrations/stripe.svg" },
  { id: "paddle",        name: "Paddle",        desc: "SaaS billing & transactions",   color: "#06b6d4", icon: "/integrations/paddle.svg" },
  { id: "shopify",       name: "Shopify",       desc: "E-commerce sales & orders",     color: "#96bf48", icon: "/integrations/shopify.svg" },
  { id: "lemon-squeezy", name: "Lemon Squeezy", desc: "Digital product revenue",       color: "#ffd234", icon: "/integrations/lemon-squeezy.svg" },
];

function NoRevenuePlatformModal({ onClose, onGoToSettings }: { onClose: () => void; onGoToSettings: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border p-7 shadow-2xl"
        style={{ background: "#f3f3fb", borderColor: "#e0e0f0" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#6a6a90] hover:text-[#4a4a6a] transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(99,91,255,0.15)", border: "1px solid rgba(99,91,255,0.3)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>

        {/* Heading */}
        <h3 className="mb-1.5 text-center text-base font-semibold text-[#1a1a2e]">No revenue platform connected</h3>
        <p className="text-center text-sm leading-relaxed mb-5" style={{ color: "#8b8fa8" }}>
          Playbooks need revenue data to generate meaningful advice. Connect a payment platform to unlock MRR tracking, churn analysis, and growth playbooks.
        </p>

        {/* Platform buttons */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {REVENUE_PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={onGoToSettings}
              className="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-[#c8c8e8] group"
              style={{ borderColor: "#e8e8f5", background: "#f4f4fc" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.icon}
                alt={p.name}
                width={28}
                height={28}
                className="shrink-0 rounded-md"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#1a1a2e] group-hover:text-[#00d4aa]">{p.name}</p>
                <p className="text-[10px] text-[#6a6a90] truncate">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onGoToSettings}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors"
          style={{ background: "#635bff" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#5558dd")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#635bff")}
        >
          Go to Settings → Integrations
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2 text-xs text-[#6a6a90] hover:text-[#4a4a6a] transition-colors"
        >
          I&apos;ll connect one later
        </button>
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
// Effort helper
// ─────────────────────────────────────────────────────────────────────────────

function getEffort(stepsCount: number): { label: string; color: string } {
  if (stepsCount <= 2) return { label: "Quick",  color: "#10b981" };
  if (stepsCount <= 4) return { label: "Medium", color: "#f59e0b" };
  return { label: "Deep", color: "#6366f1" };
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
    <div className="rounded-xl border border-[#eaeaf5] bg-[#f3f3fb] p-4 overflow-hidden">
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
          <CartesianGrid strokeDasharray="3 3" stroke="#ebebf5" vertical={false} />
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
              background: "#ffffff",
              border: "1px solid #e0e0f0",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#1a1a2e",
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
        <p className="mt-2 text-xs text-[#6a6a90] text-center">
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
  critical:    { color: "#ef4444", label: "Critical",    bg: "rgba(239,68,68,0.1)",    icon: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#ef4444" /></svg> },
  warning:     { color: "#f59e0b", label: "Warning",     bg: "rgba(245,158,11,0.1)",   icon: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#f59e0b" /></svg> },
  opportunity: { color: "#10b981", label: "Opportunity", bg: "rgba(16,185,129,0.1)",   icon: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#10b981" /></svg> },
};

// ─────────────────────────────────────────────────────────────────────────────
// Playbook list item  (compact card, left-column sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookListItem({
  playbook,
  isSelected,
  isCompleted,
  onSelect,
}: {
  playbook: AiPlaybook;
  isSelected: boolean;
  isCompleted: boolean;
  onSelect: () => void;
}) {
  const sev        = SEV_CONFIG[playbook.severity] ?? SEV_CONFIG.opportunity;
  const catCfg     = CATEGORY_CONFIG[playbook.category as Exclude<Category, "all">];
  const catLabel   = catCfg?.label ?? playbook.category;
  const hasTriggered = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;
  const effort     = getEffort(playbook.steps.length);
  const borderColor = isCompleted ? "#10b981" : sev.color;

  return (
    <button
      onClick={onSelect}
      className="group w-full text-left rounded-xl overflow-hidden transition-all duration-150 focus:outline-none"
      style={{
        background:  isSelected ? "#ebebf5" : "transparent",
        borderLeft:  `3px solid ${borderColor}`,
        border:      `1px solid ${isSelected ? "rgba(255,255,255,0.07)" : "transparent"}`,
        borderLeftWidth: "3px",
        borderLeftColor: borderColor,
        boxShadow:   isSelected ? `0 0 0 0px transparent, inset 0 0 24px ${sev.color}06` : "none",
      }}
    >
      <div className="px-3 py-2.5 space-y-1.5">
        {/* Top: severity + category */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: isCompleted ? "#10b981" : sev.color }}
          >
            {isCompleted ? (
              <>
                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Done
              </>
            ) : sev.label}
          </span>
          <span className="text-[#3c3c50] shrink-0">·</span>
          <span
            className="text-[9px] uppercase tracking-wide font-medium truncate"
            style={{ color: catCfg?.color ?? "#6b7280" }}
          >
            {catLabel}
          </span>
        </div>

        {/* Title */}
        <p
          className="text-xs font-medium leading-snug line-clamp-2"
          style={{
            color: isCompleted ? "#9090b0" : isSelected ? "#1a1a2e" : "#4a4a6a",
            textDecoration: isCompleted ? "line-through" : "none",
          }}
        >
          {playbook.title}
        </p>

        {/* Bottom: live pill + effort */}
        <div className="flex items-center gap-2">
          {hasTriggered && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: "#ef4444" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
              Live data
            </span>
          )}
          <span className="text-[9px] font-medium" style={{ color: effort.color }}>
            {effort.label}
          </span>
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
  allPlaybooks,
  feedback,
  isCompleted,
  onRating,
  onToggleStep,
  onMarkComplete,
  onSelect,
  isDemo,
}: {
  playbook: AiPlaybook;
  allPlaybooks: AiPlaybook[];
  feedback: { rating: number | null; completed_steps: number[] };
  isCompleted: boolean;
  onRating: (r: 1 | -1 | null) => void;
  onToggleStep: (idx: number) => void;
  onMarkComplete: () => void;
  onSelect: (id: string) => void;
  isDemo: boolean;
}) {
  const sev      = SEV_CONFIG[playbook.severity] ?? SEV_CONFIG.opportunity;
  const catCfg   = CATEGORY_CONFIG[playbook.category as Exclude<Category, "all">];
  const catColor = catCfg?.color ?? "#8b8ba8";
  const catLabel = catCfg?.label ?? playbook.category;
  const hasTriggered   = Array.isArray(playbook.triggeredBy) && playbook.triggeredBy.length > 0;
  const hasChart       = !!(playbook.chart && playbook.chart.points.length >= 3);
  const completedSteps = feedback.completed_steps ?? [];
  const doneCount      = playbook.steps.filter((_, i) => completedSteps.includes(i)).length;
  const allStepsDone   = doneCount === playbook.steps.length && playbook.steps.length > 0;
  const effort         = getEffort(playbook.steps.length);
  const implTime       = playbook.steps.length <= 2 ? "~24 hours" : playbook.steps.length <= 4 ? "~48 hours" : "~72 hours";

  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Section numbering — computed once
  const sn = (() => {
    let n = 1;
    const next = () => (n++).toString().padStart(2, "0");
    return {
      problem:       next(),
      whyItMatters:  next(),
      proof:         hasChart ? next() : null,
      detected:      hasTriggered ? next() : null,
      get steps()    { return n.toString().padStart(2, "0"); },
    };
  })();

  // Related playbooks: same category first, then by severity
  const related = allPlaybooks
    .filter((p) => p.id !== playbook.id)
    .sort((a, b) => {
      const aCat = a.category === playbook.category ? 0 : 1;
      const bCat = b.category === playbook.category ? 0 : 1;
      if (aCat !== bCat) return aCat - bCat;
      const sO = { critical: 0, warning: 1, opportunity: 2 } as const;
      return sO[a.severity] - sO[b.severity];
    })
    .slice(0, 2);

  return (
    <div
      key={playbook.id}
      className="h-full flex flex-col overflow-hidden rounded-2xl"
      style={{ background: "#f3f3fb", border: `1px solid ${sev.color}22` }}
    >
      {/* Top accent gradient bar */}
      <div
        className="h-0.5 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${sev.color}, transparent 60%)` }}
      />

      {/* ── Header ── */}
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: "#ebebf8" }}>
        {/* Badges + action buttons row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}30` }}
          >
            {sev.label}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ background: catColor + "18", color: catColor }}
          >
            {catLabel}
          </span>
          {hasTriggered && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              Live data
            </span>
          )}

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-2">
            {!isDemo && (
              <button
                onClick={onMarkComplete}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
                style={{
                  background:  isCompleted ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.1)",
                  color:       "#10b981",
                  border:      `1px solid ${isCompleted ? "#10b98160" : "#10b98130"}`,
                  boxShadow:   (allStepsDone && !isCompleted) ? "0 0 14px rgba(16,185,129,0.35)" : "none",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {isCompleted ? "Completed" : "Mark Complete"}
              </button>
            )}
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e0ec] px-3 py-1.5 text-xs font-medium text-[#6a6a90] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors disabled:opacity-50"
              disabled={shareLoading}
              onClick={async () => {
                setShareLoading(true);
                setShareError("");
                try {
                  const res = await fetch("/api/playbook/share", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playbook }),
                  });
                  if (!res.ok) throw new Error("Failed");
                  const { url } = await res.json();
                  await navigator.clipboard.writeText(url);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                } catch {
                  setShareError("Could not create link");
                  setTimeout(() => setShareError(""), 3000);
                } finally {
                  setShareLoading(false);
                }
              }}
            >
              {shareLoading ? (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : shareCopied ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              )}
              <span style={{ color: shareCopied ? "#10b981" : shareError ? "#ef4444" : undefined }}>
                {shareLoading ? "Creating link…" : shareCopied ? "Link copied!" : shareError || "Share"}
              </span>
            </button>
          </div>
        </div>

        {/* Title — 24px bold */}
        <h3 className="text-xl sm:text-2xl font-bold text-[#1a1a2e] leading-snug">{playbook.title}</h3>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-7">

        {/* Completed banner */}
        {isCompleted && (
          <div className="flex items-center gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-400 font-medium">
              Marked complete — Fold will re-check this issue in your next nightly update.
            </p>
          </div>
        )}

        {/* ── Expected Gain — 2-column card ── */}
        <div
          className="rounded-xl border p-4 grid grid-cols-2 gap-4"
          style={{ borderColor: "#eef8f0", background: "rgba(16,185,129,0.05)" }}
        >
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
              <p className="text-[9px] font-bold text-[#6a6a90] uppercase tracking-widest">Expected Gain</p>
            </div>
            <p className="text-sm font-semibold text-[#2a2a3e] leading-snug">{playbook.expectedGain}</p>
          </div>
          <div className="border-l border-[#eaeaf5] pl-4 flex flex-col gap-2 justify-center">
            <div className="flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-[#6a6a90]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
              <span className="text-xs text-[#6a6a90] font-medium">{implTime} to implement</span>
            </div>
            <div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: effort.color + "20", color: effort.color }}
              >
                {effort.label} effort
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-[#6a6a90]"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <span className="text-xs text-[#6a6a90]">{playbook.steps.length} action step{playbook.steps.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* ── 01 Problem ── */}
        <div>
          <p className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
            <span className="font-mono text-[#3c3c50]">{sn.problem}</span> Problem
          </p>
          <p className="text-[15px] text-[#2a2a3e] leading-[1.7]">{playbook.problem}</p>
        </div>

        {/* ── 02 Why It Matters — amber left border ── */}
        <div
          className="rounded-r-xl border-l-2 pl-4 py-1"
          style={{ borderLeftColor: "#f59e0b", background: "rgba(245,158,11,0.03)" }}
        >
          <p className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
            <span className="font-mono text-[#3c3c50]">{sn.whyItMatters}</span> Why It Matters
          </p>
          <p className="text-[15px] text-[#4a4a6a] leading-[1.7]">{playbook.impact}</p>
        </div>

        {/* ── 03 Proof chart ── */}
        {sn.proof && playbook.chart && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
              <span className="font-mono text-[#3c3c50]">{sn.proof}</span> Proof
            </p>
            <div className="rounded-xl border border-[#eaeaf5] bg-[#f3f3fa] overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold text-[#4a4a6a]">{playbook.chart.title}</p>
                <p className="text-[10px] text-[#6a6a90] mt-0.5">
                  Your data{playbook.chart.benchmarkLabel ? ` · ${playbook.chart.benchmarkLabel}` : ""}
                </p>
                {/* Legend */}
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-5 rounded-full" style={{ background: sev.color }} />
                    <span className="text-[10px] text-[#6a6a90]">Your data</span>
                  </div>
                  {playbook.chart.benchmark != null && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 border-t-2 border-dashed" style={{ borderColor: sev.color + "70" }} />
                      <span className="text-[10px] text-[#6a6a90]">{playbook.chart.benchmarkLabel ?? "Target"}</span>
                    </div>
                  )}
                </div>
              </div>
              <ProofChart chart={playbook.chart} accentColor={sev.color} uid={playbook.id} />
            </div>
          </div>
        )}

        {/* ── 04 Detected metrics ── */}
        {sn.detected && hasTriggered && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
              <span className="font-mono text-[#3c3c50]">{sn.detected}</span> Detected in Your Data
            </p>
            <div className="grid grid-cols-2 gap-2">
              {playbook.triggeredBy!.map((t, i) => (
                <div key={i} className="rounded-xl border border-[#eaeaf5] bg-[#f8f8fc] p-3">
                  <p className="text-[10px] text-[#6a6a90] mb-0.5">{t.label}</p>
                  <p className="font-mono text-base font-semibold" style={{ color: sev.color }}>{t.value}</p>
                  <p className="text-[10px] text-[#5a5a7a] mt-0.5">Target: {t.benchmark}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action Steps ── */}
        {playbook.steps.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
                <span className="font-mono text-[#3c3c50]">{sn.steps}</span> Action Steps
              </p>
              {!isDemo && (
                <span className="font-mono text-[10px] text-[#5a5a7a]">
                  {doneCount} / {playbook.steps.length} complete
                </span>
              )}
            </div>

            {/* Progress bar */}
            {!isDemo && (
              <div className="mb-5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ebebf8]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(doneCount / playbook.steps.length) * 100}%`,
                      background: allStepsDone ? "#10b981" : catColor,
                    }}
                  />
                </div>
                {allStepsDone && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-green-400">
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    All steps done — press &ldquo;Mark Complete&rdquo; above to finalise.
                  </p>
                )}
              </div>
            )}

            <ol className="space-y-5">
              {playbook.steps.map((step, i) => {
                const done = completedSteps.includes(i);
                return (
                  <li key={i} className="flex gap-3">
                    {!isDemo ? (
                      <button
                        onClick={() => onToggleStep(i)}
                        title={done ? "Mark as not done" : "Mark as done"}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all focus:outline-none"
                        style={{
                          borderColor: done ? catColor : "#3a3a54",
                          background:  done ? catColor + "22" : "transparent",
                        }}
                      >
                        {done && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={catColor} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: catColor + "22", color: catColor, border: `1px solid ${catColor}30` }}
                      >
                        {i + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] font-semibold leading-snug transition-colors"
                        style={{ color: done ? "#aaaacc" : "#1a1a2e", textDecoration: done ? "line-through" : "none" }}
                      >
                        {step.action}
                      </p>
                      <p className="mt-1 text-[13px] text-[#6a6a90] leading-relaxed">{step.detail}</p>
                      {step.link && (
                        <a
                          href={step.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#f5f5fb]"
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
        )}

        {/* ── Feedback ── */}
        {!isDemo && (
          <div
            className="rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: "#ebebf5", background: "#ffffff" }}
          >
            <p className="text-xs text-[#6a6a90]">Was this playbook accurate and useful?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRating(feedback.rating === 1 ? null : 1)}
                title="Yes, helpful"
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: feedback.rating === 1 ? "#10b98180" : "#e0e0f0",
                  background:  feedback.rating === 1 ? "rgba(16,185,129,0.12)" : "transparent",
                  color:       feedback.rating === 1 ? "#10b981" : "#6b7280",
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
                  borderColor: feedback.rating === -1 ? "#ef444480" : "#e0e0f0",
                  background:  feedback.rating === -1 ? "rgba(239,68,68,0.12)" : "transparent",
                  color:       feedback.rating === -1 ? "#ef4444" : "#6b7280",
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

        {/* ── Related playbooks strip ── */}
        {related.length > 0 && (
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5a5a7a]">You might also need</p>
            <div className="flex flex-col gap-2">
              {related.map((rp) => {
                const rsev    = SEV_CONFIG[rp.severity] ?? SEV_CONFIG.opportunity;
                const rcatCfg = CATEGORY_CONFIG[rp.category as Exclude<Category, "all">];
                return (
                  <div
                    key={rp.id}
                    onClick={() => { onSelect(rp.id); scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:border-[#ccccec] transition-colors"
                    style={{
                      borderColor:     "#eeeef4",
                      background:      "#fafafa",
                      borderLeft:      `3px solid ${rsev.color}`,
                      borderLeftWidth: "3px",
                      borderLeftColor: rsev.color,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: rsev.color }}>
                        {rsev.label} · {rcatCfg?.label ?? rp.category}
                      </p>
                      <p className="text-xs text-[#4a4a6a] truncate">{rp.title}</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3a3a5a" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pb-6" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playbook History Drawer
// ─────────────────────────────────────────────────────────────────────────────

const SEV_ORDER = { critical: 0, warning: 1, opportunity: 2 } as const;
const SEV_COLORS = { critical: "#ef4444", warning: "#f59e0b", opportunity: "#10b981" };

function HistorySevBar({ playbooks }: { playbooks: AiPlaybook[] }) {
  const counts = { critical: 0, warning: 0, opportunity: 0 };
  for (const p of playbooks) counts[p.severity] = (counts[p.severity] ?? 0) + 1;
  const total = playbooks.length || 1;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px">
      {(["critical", "warning", "opportunity"] as const).map((sev) => (
        counts[sev] > 0 && (
          <div
            key={sev}
            style={{ width: `${(counts[sev] / total) * 100}%`, background: SEV_COLORS[sev] }}
          />
        )
      ))}
    </div>
  );
}

function PlaybookHistoryDrawer({
  open,
  onClose,
  feedback,
}: {
  open: boolean;
  onClose: () => void;
  feedback: Record<string, { rating: number | null; completed_steps: number[] }>;
}) {
  const [history, setHistory] = useState<PlaybookHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!open || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    fetch("/api/ai/playbooks/history")
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const fmtAgo = (iso: string) => {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    return `${Math.round(days / 30)}mo ago`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 h-full flex flex-col overflow-hidden shadow-2xl"
        style={{ width: "min(480px, 100vw)", background: "#f4f4fa", borderLeft: "1px solid rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "#ebebf5" }}
        >
          <div>
            <p className="text-sm font-bold text-[#1a1a2e]">Playbook History</p>
            <p className="text-xs text-[#6a6a90] mt-0.5">
              Past generations · AI learns from your ratings
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6a6a90] hover:text-[#4a4a6a] transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* AI learning banner */}
        <div
          className="shrink-0 mx-4 mt-3 rounded-xl border px-3 py-2.5 flex items-start gap-2.5"
          style={{ borderColor: "#6366f120", background: "rgba(99,102,241,0.05)" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a5b4fc" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <p className="text-[11px] text-indigo-300 leading-relaxed">
            The AI reads your past playbooks and ratings before each new generation — helpful ratings teach it what works for your business, negative ratings prevent it repeating the same advice.
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
              <span className="text-sm text-[#6a6a90]">Loading history…</span>
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#e0e0f0" strokeWidth={1.5} className="mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[#6a6a90]">No history yet</p>
              <p className="text-xs text-slate-700 mt-1">Previous generations will appear here after you regenerate playbooks.</p>
            </div>
          )}

          {!loading && history.map((entry) => {
            const playbooks = entry.payload?.playbooks ?? [];
            const critCount = playbooks.filter((p) => p.severity === "critical").length;

            // Aggregate ratings from feedback for this generation's playbooks
            const playbookIds = playbooks.map((p) => p.id);
            const helpful = playbookIds.filter((id) => feedback[id]?.rating === 1).length;
            const notUseful = playbookIds.filter((id) => feedback[id]?.rating === -1).length;

            const isExpanded = expandedId === entry.id;

            // Sort: critical first, then warning
            const sorted = [...playbooks].sort(
              (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
            );

            return (
              <div
                key={entry.id}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: isExpanded ? "#e0e0f0" : "#ebebf5", background: "#f3f3fb" }}
              >
                {/* Entry header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#f8f8fc] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#4a4a6a]">{fmtDate(entry.generated_at)}</span>
                      <span className="text-[10px] text-[#5a5a7a]">{fmtAgo(entry.generated_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] text-[#6a6a90]">{playbooks.length} playbooks</span>
                      {critCount > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: "#ef4444" }}>
                          {critCount} critical
                        </span>
                      )}
                      {(helpful > 0 || notUseful > 0) && (
                        <span className="flex items-center gap-1.5">
                          {helpful > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#10b981" }}>
                              <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.25M9 20.25h.008v.008H9v-.008zm-3.75 0h.008v.008H6v-.008z" /></svg>
                              {helpful}
                            </span>
                          )}
                          {notUseful > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#ef4444" }}>
                              <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75 2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.134 12.134 0 012.25 12c0-2.848.992-5.464 2.649-7.521.388-.482.987-.729 1.605-.729h9.768c.483 0 .964.078 1.423.23l3.114 1.04a4.501 4.501 0 001.423.23H21.75M15 3.75h-.008v.008H15V3.75zm3.75 0h-.008v.008H18.75V3.75z" /></svg>
                              {notUseful}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <HistorySevBar playbooks={playbooks} />
                  </div>

                  {/* Expand chevron */}
                  <svg
                    width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#3a3a5a" strokeWidth={2.5}
                    style={{ flexShrink: 0, marginTop: 8, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {/* Summary snippet */}
                {!isExpanded && entry.payload?.summary && (
                  <p className="px-4 pb-3 text-[11px] text-[#5a5a7a] leading-relaxed line-clamp-2">
                    {entry.payload.summary}
                  </p>
                )}

                {/* Expanded playbook list */}
                {isExpanded && (
                  <div className="border-t space-y-0" style={{ borderColor: "#ebebf8" }}>
                    {/* Summary */}
                    {entry.payload?.summary && (
                      <p className="px-4 py-3 text-[11px] text-[#6a6a90] leading-relaxed border-b" style={{ borderColor: "#ebebf8" }}>
                        {entry.payload.summary}
                      </p>
                    )}

                    {sorted.map((pb) => {
                      const sev = SEV_CONFIG[pb.severity] ?? SEV_CONFIG.opportunity;
                      const fb = feedback[pb.id];
                      const isOpen = expandedPlaybookId === `${entry.id}-${pb.id}`;
                      const catCfg = CATEGORY_CONFIG[pb.category as Exclude<Category, "all">];

                      return (
                        <div key={pb.id} style={{ borderBottom: "1px solid #ebebf8" }}>
                          {/* Playbook row */}
                          <button
                            className="w-full text-left px-4 py-3 hover:bg-[#f8f8fc] transition-colors flex items-start gap-3"
                            onClick={() => setExpandedPlaybookId(isOpen ? null : `${entry.id}-${pb.id}`)}
                          >
                            <div
                              className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                              style={{ background: sev.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: sev.color }}>
                                  {sev.label}
                                </span>
                                {catCfg && (
                                  <span className="text-[9px] font-medium" style={{ color: catCfg.color }}>
                                    {catCfg.label}
                                  </span>
                                )}
                                {fb?.rating === 1 && (
                                  <span className="text-[9px] font-semibold" style={{ color: "#10b981" }}>· Helpful</span>
                                )}
                                {fb?.rating === -1 && (
                                  <span className="text-[9px] font-semibold" style={{ color: "#ef4444" }}>· Not useful</span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-[#4a4a6a] leading-snug line-clamp-2">
                                {pb.title}
                              </p>
                            </div>
                            <svg
                              width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#3a3a5a" strokeWidth={2.5}
                              style={{ flexShrink: 0, marginTop: 4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>

                          {/* Expanded playbook detail (read-only) */}
                          {isOpen && (
                            <div className="px-4 pb-4 space-y-3" style={{ background: "#ffffff" }}>
                              {/* Expected gain */}
                              <div
                                className="rounded-lg border px-3 py-2"
                                style={{ borderColor: "#eef8f0", background: "rgba(16,185,129,0.04)" }}
                              >
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6a6a90] mb-1">Expected Gain</p>
                                <p className="text-xs text-[#4a4a6a]">{pb.expectedGain}</p>
                              </div>

                              {/* Problem */}
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[#5a5a7a] mb-1">Problem</p>
                                <p className="text-[12px] text-[#6a6a90] leading-relaxed">{pb.problem}</p>
                              </div>

                              {/* Steps */}
                              {pb.steps.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#5a5a7a] mb-2">
                                    {pb.steps.length} Action Steps
                                  </p>
                                  <ol className="space-y-2">
                                    {pb.steps.map((step, i) => (
                                      <li key={i} className="flex gap-2">
                                        <span
                                          className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                                          style={{ background: sev.color + "22", color: sev.color }}
                                        >
                                          {i + 1}
                                        </span>
                                        <div>
                                          <p className="text-[11px] font-semibold text-[#4a4a6a]">{step.action}</p>
                                          <p className="text-[10px] text-[#6a6a90] leading-relaxed mt-0.5 line-clamp-2">{step.detail}</p>
                                        </div>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Read-only label */}
                              <p className="text-[9px] text-slate-700 italic">Read-only · historical generation from {fmtDate(entry.generated_at)}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty detail state
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookDetailEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-[#eaeaf5] bg-[#f3f3fb]">
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#e0e0f0" strokeWidth={1.5} className="mb-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-xs text-[#6a6a90] mb-1">Select a playbook to view details</p>
      <p className="text-[11px] text-slate-700">← Choose from the list on the left</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PlaybookSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse" style={{ height: 560 }}>
      {/* Left list skeleton — hidden on mobile */}
      <div className="hidden sm:flex w-64 shrink-0 flex-col gap-1 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f3f3fb] p-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded bg-[#e0e0f0]" />
              <div className="h-4 w-10 rounded bg-[#e0e0f0] ml-auto" />
            </div>
            <div className="h-3 w-full rounded bg-[#f2f2f8]" />
            <div className="h-3 w-3/4 rounded bg-[#f2f2f8]" />
            <div className="h-3 w-20 rounded bg-[#f0f8f2]" />
          </div>
        ))}
      </div>
      {/* Right detail skeleton */}
      <div className="flex-1 rounded-2xl border border-[#d4d4e8] bg-[#f3f3fb] p-6 space-y-4">
        <div className="flex gap-2 mb-2">
          <div className="h-5 w-16 rounded-full bg-[#e0e0f0]" />
          <div className="h-5 w-20 rounded-full bg-[#e0e0f0]" />
        </div>
        <div className="h-6 w-2/3 rounded bg-[#e0e0f0]" />
        <div className="h-14 rounded-xl bg-[#f0f8f2]" />
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-[#e0e0f0]" />
          <div className="h-3 w-full rounded bg-[#f2f2f8]" />
          <div className="h-3 w-4/5 rounded bg-[#f2f2f8]" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-[#e0e0f0]" />
          <div className="h-32 rounded-xl bg-[#f5f5fb]" />
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
    <div className="rounded-2xl border border-[#e0e0ec] bg-[#f2f2fc] p-10 text-center">
      <div className="mb-5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#dcdcec] bg-[#f5f5fb]">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#4a6a8a" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-bold text-[#1a1a2e] mb-2">AI Fix-It Playbooks</h3>
      <p className="text-sm text-[#6a6a90] mb-6 max-w-sm mx-auto leading-relaxed">
        Claude analyses your live data and generates personalised, step-by-step playbooks for every problem detected in your business.
      </p>
      <a
        href="/dashboard?tab=settings"
        className="inline-flex items-center gap-2 rounded-xl border border-[#dcdcec] bg-[#f5f5fb] px-5 py-2.5 text-sm font-medium text-[#4a4a6a] hover:bg-[#ebebf5] transition-colors"
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
  snapshots,
  isDemo = false,
}: PlaybooksTabProps) {
  const [data, setData]         = useState<AiPlaybooksResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking]     = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [eligibilityBlock, setEligibilityBlock] = useState<{ reason: string; hint: string } | null>(null);
  const [showNoRevenue, setShowNoRevenue] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [activeCategory, setActiveCategory]       = useState<Category>("all");
  const [showOnlyTriggered, setShowOnlyTriggered] = useState(false);
  const [sortBy, setSortBy]     = useState<"priority" | "az" | "category">("priority");
  // Track completed playbooks — persisted to localStorage
  const [completedPlaybooks, setCompletedPlaybooks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("fold_completed_playbooks");
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const hasFetched = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMarkComplete = useCallback((playbookId: string) => {
    setCompletedPlaybooks((prev) => {
      const next = new Set(prev);
      if (next.has(playbookId)) {
        next.delete(playbookId);
      } else {
        next.add(playbookId);
      }
      try { localStorage.setItem("fold_completed_playbooks", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

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
    if (generating || checking) return;
    setError(null);
    setEligibilityBlock(null);
    setShowNoRevenue(false);

    // ── Instant client-side checks (zero latency) ─────────────────────────
    // We already have connectedPlatforms and snapshots from the dashboard shell.
    if (!isDemo) {
      if (connectedPlatforms.length === 0) {
        setEligibilityBlock({
          reason: "No integrations connected",
          hint:   "Connect at least one platform (e.g. Stripe, GA4, Meta Ads) so the AI has real data to analyse.",
        });
        return;
      }

      // Check if a revenue platform is connected
      const hasRevenuePlatform = connectedPlatforms.some((p) => REVENUE_PROVIDERS.includes(p));
      if (!hasRevenuePlatform) {
        setShowNoRevenue(true);
        return;
      }

      // Count distinct snapshot days in the last 60 days
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const recentDays = new Set(
        snapshots
          .filter((s) => new Date(s.date).getTime() >= cutoff)
          .map((s) => s.date),
      ).size;

      if (recentDays < 3) {
        setEligibilityBlock({
          reason: "Not enough historical data yet",
          hint:   `We only have ${recentDays} day${recentDays !== 1 ? "s" : ""} of synced data. Come back after a few more daily syncs — playbooks need at least 3 days of data to give meaningful advice.`,
        });
        return;
      }
    }

    // ── Server-side eligibility check ─────────────────────────────────────
    setChecking(true);
    try {
      const checkRes = await fetch("/api/ai/playbooks/check-eligibility");
      if (checkRes.ok) {
        const check = await checkRes.json() as { eligible: boolean; reason?: string; hint?: string };
        if (!check.eligible) {
          setEligibilityBlock({
            reason: check.reason ?? "Not eligible to generate playbooks",
            hint:   check.hint   ?? "Please connect more integrations and let your data sync first.",
          });
          setChecking(false);
          return;
        }
      }
    } catch {
      // Non-critical — proceed to generate; server will reject if truly ineligible
    }
    setChecking(false);

    setGenerating(true);
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
  }, [generating, checking, isDemo, connectedPlatforms, snapshots, data?.generatedAt]);

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
    if (sortBy === "az") return a.title.localeCompare(b.title);
    if (sortBy === "category") return a.category.localeCompare(b.category);
    // "priority": triggered first, then severity
    const sevOrder = { critical: 0, warning: 1, opportunity: 2 } as const;
    const aHas = a.triggeredBy && a.triggeredBy.length > 0 ? -1 : 0;
    const bHas = b.triggeredBy && b.triggeredBy.length > 0 ? -1 : 0;
    if (aHas !== bHas) return aHas - bHas;
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  const criticalCount   = playbooks.filter((p) => p.severity === "critical").length;
  const detectedCount   = playbooks.filter((p) => p.triggeredBy && p.triggeredBy.length > 0).length;
  const completedCount  = playbooks.filter((p) => completedPlaybooks.has(p.id)).length;
  const allComplete     = playbooks.length > 0 && completedCount === playbooks.length;

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

      {eligibilityBlock && (
        <EligibilityBlockedModal
          reason={eligibilityBlock.reason}
          hint={eligibilityBlock.hint}
          onClose={() => setEligibilityBlock(null)}
        />
      )}

      {showNoRevenue && (
        <NoRevenuePlatformModal
          onClose={() => setShowNoRevenue(false)}
          onGoToSettings={() => {
            setShowNoRevenue(false);
            window.location.href = "/dashboard?tab=data-sources";
          }}
        />
      )}

      {showTipsModal && (
        <GeneratingTipsModal
          onClose={() => setShowTipsModal(false)}
          onNeverShow={() => {
            localStorage.setItem(NEVER_SHOW_KEY, "true");
            setShowTipsModal(false);
          }}
        />
      )}

      <PlaybookHistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        feedback={feedback}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          BUSINESS SUMMARY COMMAND CENTER
      ══════════════════════════════════════════════════════════════════════ */}
      {isPremium && data && !loading ? (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.07)", background: "#ffffff", minHeight: 180 }}
        >
          <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-black/10">
            {/* ── Left zone (60%) ── */}
            <div className="flex-1 p-5 flex items-start gap-5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#6a6a90] mb-2">Business Summary</p>
                <p className="text-[15px] text-[#4a4a6a] leading-[1.6]">{data.summary}</p>
                <div className="mt-3 flex items-center gap-3">
                  {generatedAgo && (
                    <p className="text-[11px] text-[#5a5a7a]">Generated {generatedAgo} · auto-refreshes weekly</p>
                  )}
                  <button
                    onClick={() => setShowHistory(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0ec] px-2.5 py-1 text-[11px] text-[#6a6a90] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors"
                  >
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    History
                  </button>
                  <button
                    onClick={triggerGenerate}
                    disabled={loading || generating || checking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-500 px-2.5 py-1 text-[11px] text-[#6a6a90] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg
                      className={(loading || generating || checking) ? "animate-spin" : ""}
                      width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    {generating ? "Generating…" : checking ? "Checking…" : "Regenerate now"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right zone (40%) ── */}
            <div className="sm:w-72 shrink-0 p-5 flex flex-col gap-3">
              {/* 3 stat boxes */}
              <div className="grid grid-cols-3 gap-2">
                {/* Critical issues */}
                <div
                  className="rounded-xl border p-3 text-center"
                  style={{
                    borderColor: criticalCount > 0 ? "#ef444430" : "rgba(0,0,0,0.07)",
                    background:  criticalCount > 0 ? "rgba(239,68,68,0.07)" : "#f3f3f8",
                  }}
                >
                  <p className="font-mono text-xl font-bold" style={{ color: criticalCount > 0 ? "#ef4444" : "#94a3b8" }}>
                    {criticalCount}
                  </p>
                  <p className="text-[10px] text-[#6a6a90] mt-0.5">Critical</p>
                </div>
                {/* Playbooks */}
                <div className="rounded-xl border p-3 text-center" style={{ borderColor: "rgba(0,0,0,0.07)", background: "#f3f3f8" }}>
                  <p className="font-mono text-xl font-bold text-[#1a1a2e]">{playbooks.length}</p>
                  <p className="text-[10px] text-[#6a6a90] mt-0.5">Playbooks</p>
                </div>
                {/* Completed */}
                <div
                  className="rounded-xl border p-3 text-center"
                  style={{
                    borderColor: completedCount > 0 ? "#10b98130" : "rgba(0,0,0,0.07)",
                    background:  completedCount > 0 ? "rgba(16,185,129,0.07)" : "#f3f3f8",
                  }}
                >
                  <p className="font-mono text-xl font-bold" style={{ color: completedCount > 0 ? "#10b981" : "#4a5568" }}>
                    {completedCount}
                  </p>
                  <p className="text-[10px] text-[#6a6a90] mt-0.5">Done</p>
                </div>
              </div>
              {/* Progress bar */}
              {playbooks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-[#5a5a7a]">Playbook completion</p>
                    <p className="text-[10px] font-mono text-[#6a6a90]">{completedCount} of {playbooks.length}</p>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "#ebebf8" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width:      `${Math.round((completedCount / playbooks.length) * 100)}%`,
                        background: completedCount === playbooks.length && playbooks.length > 0
                          ? "#10b981"
                          : criticalCount > 0 ? "#ef4444" : "#6366f1",
                      }}
                    />
                  </div>
                  {criticalCount > 0 && completedCount < playbooks.length && (
                    <p className="mt-1 text-[10px] text-[#5a5a7a]">Start with Critical issues ↑</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isPremium ? (
        /* No data yet — show generate prompt */
        <div className="rounded-2xl border border-black/10 bg-white p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-1">AI Fix-It Playbooks</h2>
            <p className="text-sm text-[#6a6a90] leading-relaxed">
              Claude analyses your live data and generates personalised, step-by-step action plans for every problem detected in your business.
            </p>
          </div>
          <button
            onClick={triggerGenerate}
            disabled={loading || generating || checking}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-sm font-semibold text-[#1a1a2e] hover:bg-[#5558dd] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className={(loading || generating || checking) ? "animate-spin" : ""} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {generating ? "Generating…" : checking ? "Checking…" : loading ? "Loading…" : "Generate my playbooks"}
          </button>
        </div>
      ) : null}

      {/* ── Not premium ────────────────────────────────────────────────────── */}
      {!isPremium && <PremiumGate />}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isPremium && loading && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/20 p-5 flex items-center gap-4">
            <div className="h-9 w-9 shrink-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-[#1a1a2e]">Loading your playbooks…</p>
              <p className="text-sm text-[#6a6a90] mt-0.5">
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
          <p className="text-sm text-[#6a6a90] mb-4">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── All complete celebration ──────────────────────────────────────── */}
      {isPremium && data && !loading && allComplete && (
        <div className="rounded-2xl border border-green-500/25 bg-green-500/8 p-8 text-center">
          <div className="flex justify-center mb-3">
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-[#1a1a2e] mb-1">All {playbooks.length} playbooks complete!</h3>
          <p className="text-sm text-[#6a6a90]">Your next update generates tonight. Fold will re-check all issues.</p>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && !allComplete && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Category pill row — wraps on mobile */}
          <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const cfg    = cat === "all" ? null : CATEGORY_CONFIG[cat];
            const active = activeCategory === cat;
            const count  = cat === "all" ? playbooks.length : playbooks.filter((p) => p.category === cat).length;
            if (cat !== "all" && count === 0) return null;
            const color  = cfg?.color ?? "#6366f1";
            // Severity dots for this category
            const catPlaybooks = cat === "all" ? playbooks : playbooks.filter((p) => p.category === cat);
            const sevDots = cat === "all" ? [] : catPlaybooks.slice(0, 4).map((p) => SEV_CONFIG[p.severity]?.color ?? "#6b7280");
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: active ? color + "50" : "#e0e0f0",
                  color:       active ? color : "#6b7280",
                  background:  active ? color + "12" : "transparent",
                }}
              >
                {cat === "all" ? "All" : cfg!.label}
                {sevDots.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    {sevDots.map((c, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                )}
                <span
                  className="rounded-md px-1.5 py-0 text-[10px] font-semibold"
                  style={{ background: active ? color + "22" : "#e0e0f0", color: active ? color : "#6b7280" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
          </div>

          {/* Sort/filter controls — own row on mobile, ml-auto on desktop */}
          <div className="flex items-center gap-3 sm:ml-auto">
            {/* Live data toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={showOnlyTriggered}
                  onChange={(e) => setShowOnlyTriggered(e.target.checked)}
                />
                <div
                  className="h-5 w-9 rounded-full transition-colors"
                  style={{ background: showOnlyTriggered ? "#ef444440" : "#e0e0f0" }}
                />
                <div
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  style={{
                    left:      showOnlyTriggered ? "calc(100% - 18px)" : "2px",
                    background: showOnlyTriggered ? "#ef4444" : "#6b7280",
                  }}
                />
              </div>
              <span className="text-xs text-[#6a6a90]">Live data only</span>
            </label>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "priority" | "az" | "category")}
              className="rounded-lg border border-[#ccccec] bg-transparent px-2 py-1.5 text-xs text-[#6a6a90] focus:outline-none focus:border-black/20"
            >
              <option value="priority">Sort: Priority</option>
              <option value="az">Sort: A–Z</option>
              <option value="category">Sort: Category</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Playbook split layout ─────────────────────────────────────────── */}
      {isPremium && data && !loading && !allComplete && (
        <div>
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-[#eaeaf5] bg-white p-10 text-center">
              <p className="text-sm text-[#6a6a90]">No playbooks match the current filter.</p>
            </div>
          ) : (
            isMobile ? (
              /* ── Mobile: single-column, list ↔ detail ───────────────────── */
              openId ? (
                /* Detail view — full width */
                <div>
                  {/* Back button */}
                  <button
                    onClick={() => setOpenId(null)}
                    className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#dcdcec] bg-[#f5f5fb] px-3 py-1.5 text-xs font-semibold text-[#4a4a6a] hover:text-[#1a1a2e] hover:border-[#c8c8e8] transition-colors"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    All playbooks
                  </button>
                  {(() => {
                    const selected = sorted.find((pb) => pb.id === openId);
                    return selected ? (
                      <PlaybookDetail
                        playbook={selected}
                        allPlaybooks={playbooks}
                        feedback={feedback[selected.id] ?? { rating: null, completed_steps: [] }}
                        isCompleted={completedPlaybooks.has(selected.id)}
                        onRating={(r) => handleRating(selected, r)}
                        onToggleStep={(idx) => handleToggleStep(selected, idx)}
                        onMarkComplete={() => handleMarkComplete(selected.id)}
                        onSelect={(id) => setOpenId(id)}
                        isDemo={isDemo}
                      />
                    ) : <PlaybookDetailEmpty />;
                  })()}
                </div>
              ) : (
                /* List view — full width */
                <div
                  className="flex flex-col overflow-hidden rounded-2xl border"
                  style={{ borderColor: "#ebebf5", background: "#ffffff" }}
                >
                  {/* List header */}
                  <div
                    className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b"
                    style={{ borderColor: "#ebebf5", background: "#f5f5f8" }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
                      {sorted.length} playbook{sorted.length !== 1 ? "s" : ""}
                      {criticalCount > 0 && (
                        <span style={{ color: "#ef4444" }}> · {criticalCount} critical</span>
                      )}
                    </span>
                  </div>
                  {/* List items */}
                  <div className="p-1.5 space-y-1">
                    {sorted.map((pb) => (
                      <PlaybookListItem
                        key={pb.id}
                        playbook={pb}
                        isSelected={false}
                        isCompleted={completedPlaybooks.has(pb.id)}
                        onSelect={() => setOpenId(pb.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : (
            <div className="flex gap-4" style={{ minHeight: 640 }}>
              {/* ── Left: 280px sidebar ─────────────────────────────────── */}
              <div
                className="shrink-0 flex flex-col overflow-hidden rounded-2xl border"
                style={{ width: 280, borderColor: "#ebebf5", background: "#ffffff" }}
              >
                {/* Sticky sidebar header */}
                <div
                  className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b"
                  style={{ borderColor: "#ebebf5", background: "#f5f5f8" }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6a6a90]">
                    {sorted.length} playbook{sorted.length !== 1 ? "s" : ""}
                    {criticalCount > 0 ? ` · ` : ""}
                    {criticalCount > 0 && (
                      <span style={{ color: "#ef4444" }}>{criticalCount} critical</span>
                    )}
                  </span>
                  {sortBy !== "priority" && (
                    <button
                      onClick={() => setSortBy("priority")}
                      className="text-[9px] text-[#5a5a7a] hover:text-[#6a6a90] transition-colors"
                    >
                      ↓ Priority
                    </button>
                  )}
                </div>
                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {sorted.map((pb) => (
                    <PlaybookListItem
                      key={pb.id}
                      playbook={pb}
                      isSelected={openId === pb.id}
                      isCompleted={completedPlaybooks.has(pb.id)}
                      onSelect={() => setOpenId(openId === pb.id ? null : pb.id)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Right: detail panel ─────────────────────────────────── */}
              <div className="flex-1 min-w-0">
                {openId && (() => {
                  const selected = sorted.find((pb) => pb.id === openId);
                  return selected ? (
                    <PlaybookDetail
                      playbook={selected}
                      allPlaybooks={playbooks}
                      feedback={feedback[selected.id] ?? { rating: null, completed_steps: [] }}
                      isCompleted={completedPlaybooks.has(selected.id)}
                      onRating={(r) => handleRating(selected, r)}
                      onToggleStep={(idx) => handleToggleStep(selected, idx)}
                      onMarkComplete={() => handleMarkComplete(selected.id)}
                      onSelect={(id) => setOpenId(id)}
                      isDemo={isDemo}
                    />
                  ) : <PlaybookDetailEmpty />;
                })()}
                {!openId && <PlaybookDetailEmpty />}
              </div>
            </div>
            ) /* end desktop split */
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {isPremium && data && !loading && playbooks.length > 0 && (
        <p className="text-center text-xs text-[#5a5a7a]">
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
          detail: "Place a strip of 3–5 customer logos, or a single pull-quote from a recognisable customer, immediately below your hero headline — before any pricing table. Studies consistently show this single change improves conversion by 10–25%. If you don't have recognisable logos, use a '★★★★★ Rated 4.8/5 by 120+ teams' trust badge instead. This reduces the psychological risk of clicking 'Start free trial'.",
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
