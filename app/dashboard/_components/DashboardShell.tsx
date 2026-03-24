"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OverviewTab from "./OverviewTab";
import AnalyticsTab from "./AnalyticsTab";
import SettingsTab from "./SettingsTab";
import WebsiteTab from "./WebsiteTab";
import AiTab from "./AiTab";

export type Tab = "overview" | "analytics" | "website" | "ai" | "settings";

export interface Snapshot {
  id: string;
  provider: string;
  date: string;
  data: unknown;
}

interface WebsiteData {
  url: string | null;
  score: number;
  status: "idle" | "analyzing" | "done" | "error";
  summary: string | null;
  lastScanned: string | null;
  tasks: {
    id: string;
    title: string;
    description: string;
    category: string;
    impact_score: number;
    completed: boolean;
    completed_at?: string | null;
  }[];
}

interface DashboardShellProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  websiteData: WebsiteData;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-4.5C9.75 8.004 10.254 7.5 10.875 7.5h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zm6.75-5.25c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0116.5 19.875V3.375z" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    id: "website",
    label: "Website",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12c0 .778.099 1.533.284 2.253" />
      </svg>
    ),
  },
  {
    id: "ai" as Tab,
    label: "AI Advisor",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <Suspense>
      <DashboardShellInner {...props} />
    </Suspense>
  );
}

function DashboardShellInner({ email, isPremium, connectedPlatforms, snapshots, websiteData }: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync tab from URL query param
  useEffect(() => {
    const tab = searchParams.get("tab") as Tab | null;
    if (tab && ["overview", "analytics", "website", "ai", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function navigate(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Mobile overlay ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-14 left-0 z-30 h-[calc(100vh-56px)] w-56 shrink-0 border-r border-[#1e1e2e] bg-[#0d0d16]
          transform transition-transform duration-200 flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:top-0 lg:h-full lg:translate-x-0 lg:flex
        `}
      >
        {/* Subtle top accent gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-[#00d4aa]/4 to-transparent" />

        {/* User info */}
        <div className="relative px-4 pt-5 pb-4 border-b border-[#1e1e2e]/60">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/15 text-[#00d4aa] font-mono text-xs font-bold uppercase select-none">
              {email.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-[10px] font-semibold text-[#8888aa]" title={email}>{email}</p>
              {isPremium ? (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold text-[#00d4aa]">
                  <span className="h-1 w-1 rounded-full bg-[#00d4aa] animate-pulse" />
                  Premium
                </span>
              ) : (
                <span className="font-mono text-[9px] text-[#4a4a6a]">Free plan</span>
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          <p className="px-2 pb-2 pt-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2a2a4a]">Navigation</p>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20"
                  : "text-[#8888aa] hover:bg-[#1e1e2e]/80 hover:text-[#f0f0f5] border border-transparent"
              }`}
            >
              {/* Active left-border indicator */}
              {activeTab === tab.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-[#00d4aa]" />
              )}
              <span className={activeTab === tab.id ? "text-[#00d4aa]" : "text-[#4a4a6a]"}>
                {tab.icon}
              </span>
              {tab.label}
              {/* Premium lock badge for non-premium tabs */}
              {!isPremium && (tab.id === "analytics" || tab.id === "website" || tab.id === "ai") && (
                <span className="ml-auto">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-[#2a2a4a]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="relative p-3 border-t border-[#1e1e2e]/60">
          {isPremium ? (
            <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">Premium Active</p>
              </div>
              <p className="mt-1 font-mono text-[9px] text-[#4a4a6a]">All features unlocked</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/5 px-3 py-2.5">
              <p className="font-mono text-[9px] font-semibold text-[#a78bfa]">Upgrade to Premium</p>
              <p className="mt-0.5 font-mono text-[9px] text-[#4a4a6a]">Unlock all features</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Mobile hamburger */}
        <div className="flex items-center gap-3 border-b border-[#1e1e2e] bg-[#0d0d16]/60 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-[#8888aa] hover:bg-[#1e1e2e] hover:text-[#f0f0f5] transition-colors"
            aria-label="Open menu"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-[#4a4a6a]">/</span>
          <div className="flex items-center gap-2">
            <span className="text-[#4a4a6a]">
              {tabs.find((t) => t.id === activeTab)?.icon}
            </span>
            <span className="font-mono text-sm font-semibold text-[#f0f0f5]">
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          {activeTab === "overview" && (
            <OverviewTab
              email={email}
              isPremium={isPremium}
              connectedPlatforms={connectedPlatforms}
              snapshots={snapshots}
              websiteData={websiteData}
              onNavigate={navigate}
            />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab
              isPremium={isPremium}
              connectedPlatforms={connectedPlatforms}
              snapshots={snapshots}
            />
          )}
          {activeTab === "website" && (
            <WebsiteTab
              isPremium={isPremium}
              initialUrl={websiteData.url}
              initialScore={websiteData.score}
              initialStatus={websiteData.status}
              initialSummary={websiteData.summary}
              initialLastScanned={websiteData.lastScanned}
              initialTasks={websiteData.tasks}
            />
          )}
          {activeTab === "ai" && (
            <AiTab isPremium={isPremium} />
          )}
          {activeTab === "settings" && (
            <SettingsTab
              email={email}
              isPremium={isPremium}
              connectedPlatforms={connectedPlatforms}
            />
          )}
        </div>
      </main>
    </div>
  );
}
