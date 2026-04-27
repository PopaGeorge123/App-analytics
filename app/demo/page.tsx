"use client";

import Link from "next/link";
import { Suspense } from "react";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { DEMO_SNAPSHOTS, DEMO_CONNECTED_PLATFORMS } from "@/app/dashboard/_components/demoData";

// ── Demo banner that sits above the shell ────────────────────────────────
function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#a78bfa]/20 bg-[#1c1c2a]/95 px-5 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/20 text-[10px]">👀</span>
        <p className="font-mono text-[11px] text-[#bcbcd8]">
          <span className="font-semibold text-[#f8f8fc]">Live demo</span> — sample data for a fictional SaaS business.{" "}
          <span className="hidden sm:inline">Your real numbers will look even better.</span>
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/login"
          className="font-mono text-[10px] text-[#8585aa] hover:text-[#bcbcd8] transition"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#a78bfa] px-3 py-1.5 font-mono text-[10px] font-bold text-[#13131f] hover:bg-[#9168f0] transition"
        >
          Start free →
        </Link>
      </div>
    </div>
  );
}

// ── Demo shell wrapper ────────────────────────────────────────────────────
function DemoShell() {
  return (
    <div className="flex min-h-screen flex-col bg-[#13131f]">
      <DemoBanner />
      {/* Wrap in a flex-1 box so DashboardShell fills the remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <Suspense>
          <DashboardShell
            email="demo@usefold.io"
            isPremium={true}
            isDemo={true}
            connectedPlatforms={DEMO_CONNECTED_PLATFORMS}
            snapshots={DEMO_SNAPSHOTS}
            currencies={{}}
            isSyncing={null}
            customers={[]}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function DemoPage() {
  return <DemoShell />;
}
