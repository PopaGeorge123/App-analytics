"use client";

import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import OverviewTab from "@/app/dashboard/_components/OverviewTab";
import AnalyticsTab from "@/app/dashboard/_components/AnalyticsTab";
import GrowthTab from "@/app/dashboard/_components/GrowthTab";
import CustomersTab from "@/app/dashboard/_components/CustomersTab";
import AiTab from "@/app/dashboard/_components/AiTab";
import PlaybooksTab from "@/app/dashboard/_components/PlaybooksTab";
import DataSourcesTab from "@/app/dashboard/_components/DataSourcesTab";
import type { Snapshot } from "@/app/dashboard/_components/DashboardShell";
import type { Tab } from "@/app/dashboard/_components/DashboardShell";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Predictions {
  businessCategory: string;
  businessDescription: string;
  techStack: string[];
  mrr: number; mrrGrowth: number;
  monthlyVisitors: number; visitorsGrowth: number;
  bounceRate: number; conversionRate: number; avgSessionDuration: number;
  newCustomers: number; churnRate: number; ltv: number; adSpend: number; roas: number;
  revenueChart: { labels: string[]; data: number[] };
  visitorsChart: { labels: string[]; data: number[] };
  dailyRevenue: { labels: string[]; data: number[] };
  topPages: Array<{ path: string; views: number; bounceRate: number; avgTime: number }>;
  trafficSources: Array<{ source: string; sessions: number; pct: number }>;
  devices: { desktop: number; mobile: number; tablet: number };
  countries: Array<{ name: string; code: string; sessions: number; pct: number }>;
  recentCustomers: Array<{ name: string; email: string; plan: string; mrr: number; joinedDaysAgo: number }>;
  aiInsights: string[];
  opportunities: Array<{ title: string; impact: string; effort: string; estimatedRevenue: number }>;
}
interface DetectedIntegration { id: string; name: string; color: string; icon: string; category: string; }
interface PreviewResult {
  site: { url: string; title: string; description: string; favicon: string };
  detectedIntegrations: DetectedIntegration[];
  predictions: Predictions;
  cached?: boolean;
  domain: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert AI predictions → Snapshot[] (same format the real dashboard uses)
// ─────────────────────────────────────────────────────────────────────────────
function predictionsToSnapshots(p: Predictions): Snapshot[] {
  const snaps: Snapshot[] = [];
  let n = 0;
  const uid = () => `prev-${++n}`;

  const dailyRevCents  = (p.mrr * 100) / 30;
  const dailySessions  = p.monthlyVisitors / 30;
  const dailyNewCust   = p.newCustomers / 30;
  const dailySpendCents = ((p.adSpend ?? 0) * 100) / 30;
  const monthGrowth    = (p.mrrGrowth ?? 0) / 100;

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const dowMult   = dow === 0 || dow === 6 ? 0.72 : 1.08;
    const trendMult = 1 + monthGrowth * ((29 - i) / 30);
    const f         = dowMult * trendMult;

    const revenue    = Math.max(0, Math.round(dailyRevCents  * f));
    const sessions   = Math.max(1, Math.round(dailySessions  * f));
    const conversions = Math.max(0, Math.round(sessions * (p.conversionRate / 100)));
    const newCust    = Math.max(0, Math.round(dailyNewCust   * f));
    const spend      = Math.max(0, Math.round(dailySpendCents * f));

    snaps.push({ id: uid(), provider: "stripe", date, data: { revenue, transactions: Math.max(1, newCust), newCustomers: newCust, refunds: Math.round(revenue * 0.02) } });
    snaps.push({ id: uid(), provider: "ga4",    date, data: { sessions, users: Math.round(sessions * 0.78), conversions, bounceRate: Math.round(p.bounceRate), avgDuration: p.avgSessionDuration } });
    snaps.push({ id: uid(), provider: "meta",   date, data: { spend, clicks: Math.max(1, Math.round(spend / 80)), impressions: Math.max(10, Math.round(spend * 2.5)), conversions: Math.round(conversions * 0.35), currency: "USD" } });
  }
  return snaps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading steps
// ─────────────────────────────────────────────────────────────────────────────
const STEPS: { threshold: number; label: string; icon: React.ReactNode }[] = [
  { threshold: 0,  label: "Fetching your website…",          icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg> },
  { threshold: 20, label: "Parsing structure & metadata…",   icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg> },
  { threshold: 40, label: "Detecting integrations & tools…", icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg> },
  { threshold: 58, label: "Running AI business analysis…",   icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg> },
  { threshold: 88, label: "Assembling your dashboard…",      icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-4.5C9.75 8.004 10.254 7.5 10.875 7.5h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zm6.75-5.25c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0116.5 19.875V3.375z"/></svg> },
];
function stepAt(p: number) { let s = STEPS[0]; for (const x of STEPS) if (p >= x.threshold) s = x; return s; }

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar tab list (mirrors DashboardShell)
// ─────────────────────────────────────────────────────────────────────────────
const PREVIEW_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",      label: "Overview",        icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-4.5C9.75 8.004 10.254 7.5 10.875 7.5h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zm6.75-5.25c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0116.5 19.875V3.375z"/></svg> },
  { id: "analytics",     label: "Analytics",       icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/></svg> },
  { id: "playbooks",     label: "Fix-It Playbooks", icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg> },
  { id: "growth",        label: "Growth",          icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg> },
  { id: "customers",     label: "Customers",       icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg> },
  { id: "ai",            label: "AI Advisor",      icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg> },
  { id: "data-sources",  label: "Data Sources",   icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg> },
];

// ─────────────────────────────────────────────────────────────────────────────
// Preview banner (sits above the shell like the demo banner)
// ─────────────────────────────────────────────────────────────────────────────
function PreviewBanner({ domain, cached, favicon }: { domain: string; cached?: boolean; favicon?: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#a78bfa]/20 bg-[#f0f0f8]/95 px-5 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Fold logo */}
        <Link href="/" className="shrink-0">
          <img src="/fold-primary-light.svg" alt="Fold" className="h-6 w-auto" />
        </Link>
        <span className="h-4 w-px bg-[#d4d4e8] shrink-0" />
        {/* Domain + status */}
        <div className="flex items-center gap-2">
          {favicon && (
            <img src={favicon} width={14} height={14} className="rounded-sm shrink-0" alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/20 text-[#a78bfa]">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
          </span>
          <p className="font-mono text-[11px] text-[#5a5a7a]">
            <span className="font-semibold text-[#6366f1]">{domain}</span>
            <span className="hidden sm:inline text-[#5a5a7a]"> — AI-estimated preview</span>
            {cached && (
              <span className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "#6366f1", background: "#ede9fe" }}>cached</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:block font-mono text-[10px] text-[#6a6a90]">
          These are AI estimates —
        </span>
        <Link href="/login" className="font-mono text-[10px] text-[#6a6a90] hover:text-[#3a3a5a] transition">
          Sign in
        </Link>
        <Link href="/signup"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-[10px] font-bold text-white hover:bg-[#00bfa0] transition">
          See real numbers →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full preview dashboard (mirrors DashboardShell layout)
// ─────────────────────────────────────────────────────────────────────────────
function PreviewDashboard({ result, onReset }: { result: PreviewResult; onReset: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const snapshots     = predictionsToSnapshots(result.predictions);
  const connected     = ["stripe", "ga4", "meta"];
  const { domain, site, cached } = result;

  function navigate(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f8]">
      {/* ── Top banner ──────────────────────────────────────────────────── */}
      <PreviewBanner domain={domain} cached={cached} favicon={site.favicon} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Mobile overlay ──────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className={`
          fixed top-12.25 left-0 z-30 h-[calc(100vh-49px)] w-56 shrink-0 border-r border-[#d4d4e8] bg-[#f2f2f8]
          transform transition-transform duration-200 flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:top-0 lg:h-full lg:translate-x-0 lg:flex
        `}>
          {/* Accent gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-[#00d4aa]/4 to-transparent" />

          {/* Fold brand header */}
          <div className="relative px-4 pt-4 pb-3 border-b border-[#d4d4e8]/60">
            <Link href="/" className="mb-3 block">
              <img src="/fold-primary-light.svg" alt="Fold" className="h-6 w-auto" />
            </Link>
            <div className="flex items-center gap-2.5">
              {site.favicon ? (
                <img src={site.favicon} width={28} height={28} className="rounded-lg shrink-0 border border-[#d4d4e8]" alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/15 text-[#00d4aa] font-mono text-xs font-bold uppercase select-none">
                  {domain.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-semibold text-[#4a4a6a]" title={domain}>{domain}</p>
                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold text-[#a78bfa]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
                  AI preview
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
            <p className="px-2 pb-2 pt-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Navigation</p>
            {PREVIEW_TABS.map((tab) => (
              <button key={tab.id} onClick={() => navigate(tab.id)}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all border ${
                  activeTab === tab.id
                    ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                    : "text-[#4a4a6a] hover:bg-[#d4d4e8]/80 hover:text-[#1a1a2e] border-transparent"
                }`}>
                {activeTab === tab.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-[#00d4aa]" />
                )}
                <span className={activeTab === tab.id ? "text-[#00d4aa]" : "text-[#6a6a90]"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Bottom: CTA */}
          <div className="relative p-3 border-t border-[#d4d4e8]/60 space-y-2">
            <div className="rounded-xl border border-[#00d4aa]/25 bg-linear-to-br from-[#00d4aa]/8 to-[#6366f1]/5 px-3 py-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#00d4aa]">Fold Preview</p>
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-[#6a6a90]">
                These numbers are AI estimates.<br/>Connect your real data to unlock your actual metrics.
              </p>
              <Link href="/signup"
                className="mt-2.5 block w-full rounded-lg bg-[#00d4aa] px-2 py-1.5 text-center font-mono text-[9px] font-bold text-white hover:bg-[#00bfa0] transition">
                Get real insights →
              </Link>
              <Link href="/login"
                className="mt-1.5 block w-full rounded-lg border border-[#d4d4e8] px-2 py-1.5 text-center font-mono text-[9px] text-[#6a6a90] hover:bg-[#d4d4e8]/60 transition">
                Sign in
              </Link>
            </div>
            <button onClick={onReset}
              className="w-full rounded-xl border border-[#d4d4e8] px-3 py-2 font-mono text-[9px] text-[#6a6a90] hover:bg-[#d4d4e8]/60 transition">
              ← Scan another site
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          {/* Mobile hamburger */}
          <div className="flex items-center gap-3 border-b border-[#d4d4e8] bg-[#f2f2f8]/60 px-4 py-3 lg:hidden">
            <button onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-[#4a4a6a] hover:bg-[#d4d4e8] hover:text-[#1a1a2e] transition-colors"
              aria-label="Open menu">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-[#6a6a90]">/</span>
            <span className="font-mono text-sm font-semibold text-[#1a1a2e]">
              {PREVIEW_TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>

          {/* Tab content */}
          <div className={activeTab === "data-sources" ? "" : "p-3 sm:p-6 lg:p-8"}>
            <Suspense>
              {activeTab === "overview" && (
                <OverviewTab
                  email={domain}
                  isPremium={true}
                  connectedPlatforms={connected}
                  snapshots={snapshots}
                  currencies={{}}
                  onNavigate={navigate}
                />
              )}
              {activeTab === "analytics" && (
                <AnalyticsTab
                  isPremium={true}
                  connectedPlatforms={connected}
                  snapshots={snapshots}
                  currencies={{}}
                />
              )}
              {activeTab === "playbooks" && (
                <PlaybooksTab
                  isPremium={true}
                  connectedPlatforms={connected}
                  snapshots={snapshots}
                  currencies={{}}
                  isDemo={true}
                />
              )}
              {activeTab === "growth" && (
                <GrowthTab
                  isPremium={true}
                  connectedPlatforms={connected}
                  snapshots={snapshots}
                  currencies={{}}
                />
              )}
              {activeTab === "customers" && (
                <CustomersTab
                  isPremium={true}
                  connectedPlatforms={connected}
                  snapshots={snapshots}
                  currencies={{}}
                  customers={[]}
                />
              )}
              {activeTab === "ai" && (
                <AiTab isPremium={true} isDemo={true} onNavigate={navigate} />
              )}
              {activeTab === "data-sources" && (
                <DataSourcesTab
                  email={domain}
                  isPremium={true}
                  connectedPlatforms={connected}
                  currencies={{}}
                  isDemo={true}
                />
              )}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading animation
// ─────────────────────────────────────────────────────────────────────────────
function LoadingPhase({ url }: { url: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const intervals = [
      { target: 20,  delay: 400  },
      { target: 40,  delay: 1200 },
      { target: 58,  delay: 2500 },
      { target: 88,  delay: 5000 },
      { target: 97,  delay: 9000 },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const { target, delay } of intervals) {
      timers.push(setTimeout(() => setProgress(target), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const step = stepAt(progress);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#f5f5f8] px-4">
      {/* Fold logo */}
      <Link href="/" className="absolute top-5 left-6">
        <img src="/fold-primary-light.svg" alt="Fold" className="h-6 w-auto opacity-70 hover:opacity-100 transition" />
      </Link>

      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e8e8f0" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#00d4aa" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.8s ease" }} />
          </svg>
          <span className="relative z-10 flex items-center justify-center text-[#4a4a6a]">{step.icon}</span>
        </div>
        <p className="font-mono text-sm font-semibold text-[#1a1a2e]">{step.label}</p>
        <p className="font-mono text-[11px] text-[#6a6a90]">Analyzing <span className="text-[#6366f1]">{url}</span></p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {STEPS.map((s) => (
          <div key={s.threshold} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${progress >= s.threshold ? "bg-white shadow-sm" : "opacity-30"}`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#6a6a90]">{s.icon}</span>
            <span className={`font-mono text-[11px] font-medium flex-1 ${progress >= s.threshold ? "text-[#1a1a2e]" : "text-[#6a6a90]"}`}>{s.label}</span>
            {progress > s.threshold && (
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {progress === s.threshold && (
              <svg className="animate-spin text-[#00d4aa]" width="12" height="12" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input phase
// ─────────────────────────────────────────────────────────────────────────────
function InputPhase({ onSubmit, loading, error }: { onSubmit: (url: string) => void; loading: boolean; error: string }) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handle(e: FormEvent) {
    e.preventDefault();
    const val = url.trim();
    if (!val) return;
    onSubmit(val);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f5f5f8] px-4">
      {/* Top nav logo */}
      <div className="absolute top-5 left-6 right-6 flex items-center justify-between">
        <Link href="/">
          <img src="/fold-primary-light.svg" alt="Fold" className="h-6 w-auto" />
        </Link>
        <Link href="/login" className="font-mono text-[11px] text-[#6a6a90] hover:text-[#1a1a2e] transition">
          Sign in →
        </Link>
      </div>

      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-4 py-1.5 font-mono text-[11px] font-semibold text-[#a78bfa]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
          Fold Preview — Free AI Analysis
        </div>
        <h1 className="font-mono text-3xl font-bold text-[#1a1a2e]">See your business dashboard</h1>
        <p className="text-[#6a6a90] text-sm max-w-md">
          Enter any website URL and get a full AI-powered analytics dashboard in under 30 seconds.
        </p>
        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <div className="flex -space-x-1.5">
            {["#00d4aa","#6366f1","#a78bfa","#f59e0b"].map((c, i) => (
              <div key={i} className="h-6 w-6 rounded-full border-2 border-[#f5f5f8] flex items-center justify-center font-mono text-[9px] font-bold text-white select-none"
                style={{ background: c }}>
                {["G","A","M","R"][i]}
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[#6a6a90]">
            Joined by <span className="font-semibold text-[#1a1a2e]">2,400+</span> founders
          </p>
        </div>
      </div>

      <form onSubmit={handle} className="w-full max-w-md space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6a6a90" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>
            </svg>
          </div>
          <input ref={inputRef} value={url} onChange={(e) => setUrl(e.target.value)}
            type="text" placeholder="https://yourwebsite.com"
            className="w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-4 font-mono text-sm text-[#1a1a2e] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 shadow-sm"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-600">{error}</div>
        )}

        <button type="submit" disabled={loading || !url.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-mono text-sm font-bold text-white transition disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa)" }}>
          {loading ? (
            <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
          )}
          {loading ? "Starting analysis…" : "Generate AI Dashboard →"}
        </button>

        <p className="text-center font-mono text-[10px] text-[#6a6a90]">Free · No account needed · Powered by <span className="font-semibold text-[#1a1a2e]">Fold</span></p>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────
const LAST_SCAN_KEY = "fold_preview_last_domain";

function PreviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [url, setUrl]       = useState("");
  const [error, setError]   = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);

  // On mount: load from ?d= param first, then fall back to localStorage last scan
  useEffect(() => {
    const paramDomain = searchParams.get("d");
    if (paramDomain) {
      startAnalysis(`https://${paramDomain}`);
      return;
    }
    // No URL param — check if they've scanned before
    try {
      const last = localStorage.getItem(LAST_SCAN_KEY);
      if (last) startAnalysis(`https://${last}`);
    } catch { /* localStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startAnalysis(rawUrl: string) {
    setUrl(rawUrl);
    setError("");
    setPhase("loading");
    try {
      const res  = await fetch("/api/preview/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPhase("input");
        router.replace("/preview", { scroll: false });
        return;
      }
      const previewResult = data as PreviewResult;
      setResult(previewResult);
      setPhase("result");
      // Persist domain for next visit + update URL
      try { localStorage.setItem(LAST_SCAN_KEY, previewResult.domain); } catch { /* ok */ }
      router.replace(`/preview?d=${encodeURIComponent(previewResult.domain)}`, { scroll: false });
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPhase("input");
      router.replace("/preview", { scroll: false });
    }
  }

  function reset() {
    setPhase("input");
    setUrl("");
    setError("");
    setResult(null);
    try { localStorage.removeItem(LAST_SCAN_KEY); } catch { /* ok */ }
    router.replace("/preview", { scroll: false });
  }

  if (phase === "loading") return <LoadingPhase url={url} />;
  if (phase === "result" && result) return <PreviewDashboard result={result} onReset={reset} />;
  return <InputPhase onSubmit={startAnalysis} loading={false} error={error} />;
}

export default function PreviewPage() {
  return (
    <Suspense>
      <PreviewPageInner />
    </Suspense>
  );
}
