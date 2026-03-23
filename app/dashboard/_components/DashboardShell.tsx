"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OverviewTab from "./OverviewTab";
import AnalyticsTab from "./AnalyticsTab";
import SettingsTab from "./SettingsTab";

export type Tab = "overview" | "analytics" | "settings";

export interface Snapshot {
  id: string;
  provider: string;
  date: string;
  data: unknown;
}

interface DashboardShellProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
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

export default function DashboardShell({ email, isPremium, connectedPlatforms, snapshots }: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync tab from URL query param
  useEffect(() => {
    const tab = searchParams.get("tab") as Tab | null;
    if (tab && ["overview", "analytics", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function navigate(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="flex flex-1">
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
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:top-0 lg:h-auto lg:translate-x-0 lg:block
        `}
      >
        <nav className="flex flex-col gap-1 p-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20"
                  : "text-[#8888aa] hover:bg-[#1e1e2e] hover:text-[#f0f0f5] border border-transparent"
              }`}
            >
              <span className={activeTab === tab.id ? "text-[#00d4aa]" : "text-[#4a4a6a]"}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Premium badge in sidebar */}
        {isPremium && (
          <div className="absolute bottom-6 left-4 right-4">
            <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-3 text-center">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                ✦ Premium
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 border-b border-[#1e1e2e] px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-[#8888aa] hover:bg-[#1e1e2e] hover:text-[#f0f0f5]"
            aria-label="Open menu"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-mono text-sm font-semibold capitalize text-[#f0f0f5]">
            {activeTab}
          </span>
        </div>

        <div className="p-6 lg:p-8">
          {activeTab === "overview" && (
            <OverviewTab
              email={email}
              isPremium={isPremium}
              connectedPlatforms={connectedPlatforms}
              snapshots={snapshots}
            />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab
              isPremium={isPremium}
              connectedPlatforms={connectedPlatforms}
              snapshots={snapshots}
            />
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
