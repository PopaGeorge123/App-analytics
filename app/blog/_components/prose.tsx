"use client";
import type { ReactNode } from "react";

/* ─── Typography ─────────────────────────────────────────────────── */
export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 mt-14 font-mono text-2xl font-bold text-[#1a1a2e] tracking-tight">
      {children}
    </h2>
  );
}
export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 mt-9 font-mono text-lg font-bold text-[#d4d4f0]">{children}</h3>
  );
}
export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 text-[15px] leading-8 text-[#b0b0cc] font-sans">{children}</p>
  );
}
export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-6 space-y-3 font-sans text-[15px] leading-7 text-[#b0b0cc]">{children}</ul>
  );
}
export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4aa]" />
      <span>{children}</span>
    </li>
  );
}
export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mb-6 space-y-3 font-sans text-[15px] leading-7 text-[#b0b0cc] list-none">
      {children}
    </ol>
  );
}
export function OLI({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00d4aa]/15 font-mono text-[11px] font-bold text-[#00d4aa] border border-[#00d4aa]/30">
        {n}
      </span>
      <span className="mt-0.5">{children}</span>
    </li>
  );
}

/* ─── Pull quote ─────────────────────────────────────────────────── */
export function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-10 border-l-4 border-[#00d4aa] pl-6 py-1">
      <p className="font-mono text-xl font-semibold leading-relaxed text-[#1a1a2e] italic">
        {children}
      </p>
    </blockquote>
  );
}

/* ─── Callout ────────────────────────────────────────────────────── */
export function Callout({
  children,
  color = "#00d4aa",
  icon,
  title,
}: {
  children: ReactNode;
  color?: string;
  icon?: string;
  title?: string;
}) {
  return (
    <div
      className="my-8 rounded-2xl px-6 py-5"
      style={{
        background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
        borderLeft: `4px solid ${color}`,
      }}
    >
      {title && (
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color }}>
          {icon} {title}
        </p>
      )}
      <div className="font-sans text-[14px] leading-7 text-[#d4d4f0]">{children}</div>
    </div>
  );
}

/* ─── Stat row ───────────────────────────────────────────────────── */
export function StatRow({
  stats,
}: {
  stats: { value: string; label: string; color?: string }[];
}) {
  return (
    <div className="my-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-[#d4d4e8] bg-[#f0f0f8] p-5 text-center"
        >
          <p
            className="mb-1 font-mono text-2xl font-bold"
            style={{ color: s.color ?? "#00d4aa" }}
          >
            {s.value}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Compare table ──────────────────────────────────────────────── */
export function CompareTable({
  competitor,
  rows,
}: {
  competitor: string;
  rows: {
    feature: string;
    fold: string;
    other: string;
    winner: "fold" | "other" | "tie";
  }[];
}) {
  return (
    <div className="my-8 overflow-x-auto rounded-2xl border border-[#d4d4e8]">
      <table className="w-full font-mono text-[12px]">
        <thead>
          <tr className="border-b border-[#d4d4e8] bg-[#f0f0f8]">
            <th className="px-5 py-4 text-left text-[#8585aa] font-semibold">Feature</th>
            <th className="px-5 py-4 text-left font-semibold" style={{ color: "#00d4aa" }}>
              ✦ Fold Analytics
            </th>
            <th className="px-5 py-4 text-left text-[#8585aa] font-semibold">{competitor}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-[#d4d4e8] last:border-0 transition-colors hover:bg-[#f0f0f8]/50"
            >
              <td className="px-5 py-3.5 text-[#d4d4f0]">{r.feature}</td>
              <td className="px-5 py-3.5">
                <span
                  className={
                    r.winner === "fold"
                      ? "font-semibold text-[#00d4aa]"
                      : r.winner === "tie"
                      ? "text-[#f59e0b]"
                      : "text-[#8585aa]"
                  }
                >
                  {r.winner === "fold" && (
                    <span className="mr-1.5 text-[10px]">✓</span>
                  )}
                  {r.fold}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={
                    r.winner === "other"
                      ? "font-semibold text-[#1a1a2e]"
                      : "text-[#8585aa]"
                  }
                >
                  {r.other}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Dashboard screenshot mockups ──────────────────────────────── */

export function DashboardOverviewMockup() {
  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f5f5f8] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#d4d4e8] bg-[#f0f0f8] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]/70" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]/70" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]/70" />
        <span className="ml-3 font-mono text-[10px] text-[#8585aa]">Fold Analytics — Overview</span>
      </div>
      <div className="grid grid-cols-2 gap-0 border-b border-[#d4d4e8] sm:grid-cols-4">
        {[
          { label: "Revenue 7d", value: "$12,840", change: "+18.4%", up: true, color: "#00d4aa" },
          { label: "New Customers", value: "147", change: "+12.1%", up: true, color: "#6366f1" },
          { label: "Ad Spend 7d", value: "$3,210", change: "+5.2%", up: false, color: "#f59e0b" },
          { label: "Churn Rate", value: "2.1%", change: "−0.4%", up: true, color: "#10b981" },
        ].map((k, i) => (
          <div key={i} className="border-r border-[#d4d4e8] last:border-0 px-5 py-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">{k.label}</p>
            <p className="font-mono text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className={`mt-0.5 font-mono text-[10px] ${k.up ? "text-[#10b981]" : "text-[#f87171]"}`}>
              {k.change} vs last week
            </p>
          </div>
        ))}
      </div>
      <div className="px-5 py-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">Revenue trend — last 30 days</p>
        <svg viewBox="0 0 600 120" className="w-full" preserveAspectRatio="none" style={{ height: 100 }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00d4aa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,90 C30,85 60,75 90,70 C120,65 150,72 180,60 C210,48 240,55 270,45 C300,35 330,40 360,30 C390,20 420,25 450,18 C480,11 510,15 540,10 C560,7 580,5 600,3 L600,120 L0,120 Z" fill="url(#g1)" />
          <path d="M0,90 C30,85 60,75 90,70 C120,65 150,72 180,60 C210,48 240,55 270,45 C300,35 330,40 360,30 C390,20 420,25 450,18 C480,11 510,15 540,10 C560,7 580,5 600,3" fill="none" stroke="#00d4aa" strokeWidth="2" />
          <circle cx="270" cy="45" r="5" fill="#f59e0b" />
          <text x="280" y="42" fontFamily="monospace" fontSize="9" fill="#f59e0b">AI: dip detected</text>
        </svg>
      </div>
      <div className="border-t border-[#d4d4e8] bg-[#00d4aa]/5 px-5 py-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00d4aa]/20 font-mono text-[9px] font-bold text-[#00d4aa]">AI</span>
        <p className="font-mono text-[11px] leading-relaxed text-[#b0b0cc]">
          <span className="font-semibold text-[#1a1a2e]">Weekly digest:</span> Revenue is up 18% driven by 24 new Stripe subscribers. Meta ROAS is 3.8x. 3 customers haven't logged in for 30+ days — consider a re-engagement email.
        </p>
      </div>
    </figure>
  );
}

export function DashboardCustomersMockup() {
  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f5f5f8] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#d4d4e8] bg-[#f0f0f8] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]/70" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]/70" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]/70" />
        <span className="ml-3 font-mono text-[10px] text-[#8585aa]">Fold Analytics — Customers</span>
      </div>
      <div className="border-b border-[#f59e0b]/20 bg-[#f59e0b]/8 px-5 py-3 flex items-center gap-3">
        <span className="text-[#f59e0b] text-sm">⚠</span>
        <p className="font-mono text-[11px] text-[#1a1a2e]">
          <span className="font-bold text-[#f59e0b]">7 customers</span> haven&apos;t purchased in 30+ days — $4,200 combined LTV at risk.
        </p>
      </div>
      <div className="divide-y divide-[#f2f2f8]">
        {[
          { name: "Acme Corp", ltv: "$2,840", health: 82, status: "Active", days: 3 },
          { name: "Bright Labs", ltv: "$1,620", health: 44, status: "At Risk", days: 31 },
          { name: "Nova Studio", ltv: "$990", health: 71, status: "Active", days: 8 },
          { name: "Drift Co.", ltv: "$750", health: 18, status: "Dormant", days: 67 },
        ].map((c, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e5e5f5] font-mono text-[11px] font-bold text-[#8585aa]">
                {c.name[0]}
              </div>
              <div>
                <p className="font-mono text-[12px] font-semibold text-[#1a1a2e]">{c.name}</p>
                <p className="font-mono text-[10px] text-[#58588a]">Last seen {c.days}d ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="hidden sm:block">
                <p className="font-mono text-[11px] text-[#8585aa]">LTV</p>
                <p className="font-mono text-[12px] font-bold text-[#00d4aa]">{c.ltv}</p>
              </div>
              <div className="hidden w-24 sm:block">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-mono text-[10px] text-[#8585aa]">Health</p>
                  <p className="font-mono text-[10px] text-[#1a1a2e]">{c.health}</p>
                </div>
                <div className="h-1.5 rounded-full bg-[#e5e5f5]">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${c.health}%`,
                      backgroundColor: c.health >= 70 ? "#10b981" : c.health >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold"
                style={{
                  color: c.status === "Active" ? "#10b981" : c.status === "At Risk" ? "#f59e0b" : "#ef4444",
                  background: (c.status === "Active" ? "#10b981" : c.status === "At Risk" ? "#f59e0b" : "#ef4444") + "20",
                }}
              >
                {c.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function DashboardAdsMockup() {
  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f5f5f8] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#d4d4e8] bg-[#f0f0f8] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]/70" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]/70" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]/70" />
        <span className="ml-3 font-mono text-[10px] text-[#8585aa]">Fold Analytics — Ads Overview</span>
      </div>
      <div className="grid grid-cols-3 gap-0 border-b border-[#d4d4e8]">
        {[
          { platform: "Meta Ads", spend: "$1,840", roas: "4.2x", conv: "68", color: "#1877f2" },
          { platform: "Google Ads", spend: "$980", roas: "5.1x", conv: "41", color: "#4285F4" },
          { platform: "TikTok Ads", spend: "$390", roas: "2.8x", conv: "19", color: "#69C9D0" },
        ].map((p, i) => (
          <div key={i} className="border-r border-[#d4d4e8] last:border-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <p className="font-mono text-[10px] sm:text-[11px] font-semibold text-[#1a1a2e]">{p.platform}</p>
            </div>
            <p className="font-mono text-base sm:text-lg font-bold text-[#1a1a2e]">{p.spend}</p>
            <p className="font-mono text-[10px] text-[#8585aa]">spend</p>
            <div className="mt-3 flex gap-3 sm:gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-[#00d4aa]">{p.roas}</p>
                <p className="font-mono text-[9px] text-[#58588a]">ROAS</p>
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-[#a78bfa]">{p.conv}</p>
                <p className="font-mono text-[9px] text-[#58588a]">conv.</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#6366f1]/5 px-5 py-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-[#b0b0cc]">
          <span className="font-bold text-[#1a1a2e]">Blended ROAS: 4.1x</span> — $3,210 total spend across 3 platforms. Google driving highest-intent conversions.
        </p>
        <span className="shrink-0 rounded-full bg-[#10b981]/20 px-3 py-1 font-mono text-[10px] font-bold text-[#10b981]">Healthy</span>
      </div>
    </figure>
  );
}

export function DashboardMRRMockup() {
  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f5f5f8] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#d4d4e8] bg-[#f0f0f8] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]/70" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]/70" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]/70" />
        <span className="ml-3 font-mono text-[10px] text-[#8585aa]">Fold Analytics — Stripe · Subscription Intelligence</span>
      </div>
      <div className="grid grid-cols-2 gap-0 border-b border-[#d4d4e8] sm:grid-cols-4">
        {[
          { label: "MRR", value: "$8,420", delta: "+$610", color: "#00d4aa" },
          { label: "Active Subs", value: "284", delta: "+12", color: "#6366f1" },
          { label: "Churn Rate", value: "1.8%", delta: "−0.3%", color: "#10b981" },
          { label: "ARPU", value: "$29.65", delta: "+$1.20", color: "#f59e0b" },
        ].map((k, i) => (
          <div key={i} className="border-r border-[#d4d4e8] last:border-0 px-5 py-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">{k.label}</p>
            <p className="font-mono text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="mt-0.5 font-mono text-[10px] text-[#10b981]">{k.delta} MoM</p>
          </div>
        ))}
      </div>
      <div className="px-5 py-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">MRR movement this month</p>
        <div className="flex items-end gap-2" style={{ height: 80 }}>
          {[
            { label: "Starting", pct: 78, color: "#6a6a90" },
            { label: "+ New", pct: 35, color: "#00d4aa" },
            { label: "+ Expansion", pct: 18, color: "#6366f1" },
            { label: "− Churn", pct: 28, color: "#ef4444" },
            { label: "− Contract.", pct: 14, color: "#f59e0b" },
            { label: "Ending MRR", pct: 84, color: "#00d4aa" },
          ].map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t"
                style={{ height: `${b.pct}%`, background: b.color, opacity: 0.75, minHeight: 4 }}
              />
              <p className="font-mono text-[7px] sm:text-[8px] text-[#58588a] text-center leading-tight">{b.label}</p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function IntegrationsMockup() {
  const integrations = [
    { name: "Stripe", logo: "/integrations/stripe.svg", status: "connected", color: "#635bff" },
    { name: "Meta Ads", logo: "/integrations/meta.svg", status: "connected", color: "#1877f2" },
    { name: "GA4", logo: "/integrations/ga4.svg", status: "connected", color: "#f59e0b" },
    { name: "Google Ads", logo: "/integrations/google-ads.svg", status: "connected", color: "#4285F4" },
    { name: "PostHog", logo: "/integrations/posthog.svg", status: "connected", color: "#f76300" },
    { name: "Gumroad", logo: "/integrations/gumroad.svg", status: "available", color: "#ff90e8" },
    { name: "Paddle", logo: "/integrations/paddle.svg", status: "available", color: "#3ddc97" },
    { name: "TikTok Ads", logo: "/integrations/tiktok-ads.svg", status: "available", color: "#69C9D0" },
  ];
  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f5f5f8] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#d4d4e8] bg-[#f0f0f8] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]/70" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]/70" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]/70" />
        <span className="ml-3 font-mono text-[10px] text-[#8585aa]">Fold Analytics — Integrations</span>
      </div>
      <div className="grid grid-cols-4 gap-3 p-5">
        {integrations.map((int) => (
          <div
            key={int.name}
            className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4"
            style={{
              borderColor: int.status === "connected" ? int.color + "50" : "#e5e5f5",
              background: int.status === "connected" ? int.color + "08" : "transparent",
            }}
          >
            <img src={int.logo} alt={int.name} className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
            <p className="font-mono text-[9px] sm:text-[10px] text-[#d4d4f0] text-center">{int.name}</p>
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[7px] sm:text-[8px] font-semibold"
              style={{
                color: int.status === "connected" ? "#10b981" : "#6a6a90",
                background: int.status === "connected" ? "#10b98120" : "#e5e5f530",
              }}
            >
              {int.status === "connected" ? "● Connected" : "Connect"}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ─── Mid-article CTA ────────────────────────────────────────────── */
export function MidCTA({ text }: { text: string }) {
  return (
    <div className="my-12 overflow-hidden rounded-2xl border border-[#00d4aa]/20 bg-linear-to-br from-[#00d4aa]/10 via-[#6366f1]/5 to-transparent">
      <div className="px-8 py-7">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#00d4aa]">
          ✦ Try it free
        </p>
        <p className="mb-4 font-mono text-lg font-bold text-[#1a1a2e]">{text}</p>
        <a
          href="/signup"
          className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-2.5 font-mono text-[13px] font-bold text-[#3a3a4e] transition hover:bg-[#00bfa0]"
        >
          Start free 7-day trial
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/* ─── Final article CTA ──────────────────────────────────────────── */
export function ArticleCTA() {
  return (
    <div className="my-14 overflow-hidden rounded-2xl border border-[#d4d4e8] bg-[#f0f0f8]">
      <div className="bg-linear-to-r from-[#00d4aa]/15 via-[#6366f1]/10 to-transparent px-8 py-10 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#00d4aa]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" /> Free 7-day trial
        </span>
        <h3 className="mb-3 font-mono text-2xl font-bold text-[#1a1a2e]">
          See your whole business in one dashboard.
        </h3>
        <p className="mx-auto mb-6 max-w-md font-sans text-[14px] leading-relaxed text-[#8585aa]">
          Connect Stripe, Meta, Google Ads, GA4, and 20+ more platforms in under 5 minutes.
          No engineers, no spreadsheets, no dashboards to build. Just answers.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-8 py-3 font-mono text-sm font-bold text-[#3a3a4e] transition hover:bg-[#00bfa0]"
          >
            Start free trial
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <a href="/demo" className="font-mono text-[13px] text-[#8585aa] underline underline-offset-4 hover:text-[#1a1a2e] transition">
            Watch demo first →
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 border-t border-[#d4d4e8] px-6 py-4 flex-wrap">
        {["stripe", "meta", "google-ads", "ga4", "tiktok-ads", "posthog", "gumroad", "paddle"].map((slug) => (
          <img key={slug} src={`/integrations/${slug}.svg`} alt={slug} className="h-5 w-5 object-contain opacity-50" />
        ))}
      </div>
    </div>
  );
}
