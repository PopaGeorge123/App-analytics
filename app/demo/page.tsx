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
            connectedPlatforms={DEMO_CONNECTED_PLATFORMS}
            snapshots={DEMO_SNAPSHOTS}
            websiteData={{
              url: "https://usefold.io",
              score: 78,
              status: "done",
              summary:
                "Good overall health. Mobile performance is the primary opportunity — compressing hero images and deferring non-critical JS could push the score above 90.",
              lastScanned: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              tasks: [
                {
                  id: "demo-1",
                  title: "Compress hero images",
                  description:
                    "Hero images are 1.8 MB uncompressed. Converting to WebP and adding width/height attributes would save ~1.2 MB and improve LCP by ~1.4 s.",
                  category: "Performance",
                  impact_score: 92,
                  completed: false,
                  completed_at: null,
                },
                {
                  id: "demo-2",
                  title: "Add meta descriptions to 3 pages",
                  description:
                    "Pricing, Features, and Blog index pages are missing meta descriptions. This directly affects click-through rates from search results.",
                  category: "SEO",
                  impact_score: 85,
                  completed: false,
                  completed_at: null,
                },
                {
                  id: "demo-3",
                  title: "Fix contrast on CTA button",
                  description:
                    "The secondary 'Sign in' button has a contrast ratio of 2.9:1 — below the WCAG AA minimum of 4.5:1. Change the text color from #8585aa to #bcbcd8.",
                  category: "Accessibility",
                  impact_score: 73,
                  completed: false,
                  completed_at: null,
                },
                {
                  id: "demo-4",
                  title: "Enable HTTP/2 push on CDN",
                  description:
                    "Assets are served over HTTP/1.1. Enabling HTTP/2 on your CDN (Vercel supports it natively) will reduce asset load latency by 20–40%.",
                  category: "Performance",
                  impact_score: 68,
                  completed: true,
                  completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                },
                {
                  id: "demo-5",
                  title: "Add Open Graph image",
                  description:
                    "No og:image tag detected. Adding a 1200×630 branded image dramatically improves link previews on Twitter, LinkedIn, and Slack.",
                  category: "SEO",
                  impact_score: 61,
                  completed: false,
                  completed_at: null,
                },
              ],
            }}
            metaCurrency="USD"
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
