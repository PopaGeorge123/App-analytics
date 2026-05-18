/**
 * app/dashboard/loading.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Next.js App Router streaming loading UI for the /dashboard route.
 * Renders instantly (no data needed) while page.tsx awaits Supabase queries.
 *
 * Matches the exact shell shape — top bar, sidebar, tab strip, and content
 * skeletons — so there's no layout shift when real content arrives.
 */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-black/6 animate-pulse ${className}`} />
  );
}

// Nav item accent dots — matches the real sidebar nav colours
const NAV_DOTS = ["#6366f1", "#6366f1", "#10b981", "#f59e0b", "#6366f1", "#14b8a6", "#ef4444", "#6366f1", "#6b7280"];

export default function DashboardLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f5f7] text-[#1a1a2e]">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#eeeef4] bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-3">
            {/* Syncing badge */}
            <Skeleton className="hidden sm:block h-6 w-28 rounded-full" />
            <div className="hidden h-4 w-px bg-black/6 sm:block" />
            {/* Email */}
            <Skeleton className="hidden sm:block h-3 w-36" />
            {/* Bell */}
            <Skeleton className="h-8 w-8 rounded-lg" />
            {/* Theme toggle */}
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* ── Tab strip ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 pb-0 overflow-x-auto scrollbar-none border-t border-[#eeeef4]">
          {["Overview", "Analytics", "Fix-It Playbooks", "Growth", "Customers", "AI Advisor", "Data Sources", "Settings", "Advanced"].map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${
                i === 0 ? "border-[#6366f1]" : "border-transparent"
              }`}
            >
              <Skeleton className="h-3 w-3 rounded shrink-0" />
              <Skeleton className={`h-2.5 ${i === 0 ? "w-14" : "w-12"}`} />
            </div>
          ))}
        </div>
      </header>

      {/* ── Sidebar + content ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-[#eeeef4] bg-white">
          {/* User info */}
          <div className="px-4 pt-5 pb-4 border-b border-[#eeeef4] flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2 w-14" />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 p-2.5 flex-1">
            <div className="px-2 pt-1 pb-2">
              <Skeleton className="h-2 w-12" />
            </div>
            {NAV_DOTS.map((color, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
                {/* Coloured icon dot */}
                <div
                  className="h-4 w-4 rounded shrink-0 opacity-30 animate-pulse"
                  style={{ backgroundColor: color }}
                />
                <Skeleton className="h-2.5 w-20" />
              </div>
            ))}
          </nav>

          {/* Bottom upgrade card */}
          <div className="p-3 border-t border-[#eeeef4]">
            <div className="rounded-xl bg-black/4 p-3 space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          <div className="p-5 lg:p-7 space-y-5">

            {/* Page heading row */}
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-2.5 w-48" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>

            {/* ── KPI row: large revenue panel (55%) + 2×2 compact grid (45%) ── */}
            <div className="grid gap-4 lg:grid-cols-11">

              {/* Large featured revenue panel */}
              <div className="lg:col-span-6 bg-white rounded-2xl ring-1 ring-black/6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-7 w-36" />
                    <div className="flex items-center gap-2 pt-0.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                </div>
                {/* Chart area */}
                <Skeleton className="h-40 w-full rounded-xl" />
                {/* Period tabs */}
                <div className="flex gap-1">
                  {["7d", "30d", "90d", "1y"].map((p) => (
                    <Skeleton key={p} className="h-7 w-10 rounded-lg" />
                  ))}
                </div>
              </div>

              {/* 2×2 compact stats grid */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                {[
                  { color: "#10b981", w: "w-28" },
                  { color: "#6366f1", w: "w-20" },
                  { color: "#f59e0b", w: "w-24" },
                  { color: "#14b8a6", w: "w-20" },
                ].map(({ color, w }, i) => (
                  <div key={i} className="bg-white rounded-2xl ring-1 ring-black/6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-2.5 w-16" />
                      <div
                        className="h-6 w-6 rounded-lg opacity-20 animate-pulse"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <Skeleton className={`h-6 ${w}`} />
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-10 rounded-full" />
                      <Skeleton className="h-2 w-12" />
                    </div>
                    {/* Mini sparkline */}
                    <div className="flex items-end gap-0.5 h-8">
                      {[45, 60, 40, 70, 55, 75, 65].map((h, j) => (
                        <div
                          key={j}
                          className="flex-1 rounded-sm animate-pulse"
                          style={{
                            height: `${h}%`,
                            backgroundColor: color,
                            opacity: 0.2,
                            animationDelay: `${j * 60}ms`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Two-column lower row ──────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-2">

              {/* Insights panel */}
              <div className="bg-white rounded-2xl ring-1 ring-black/6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-6 w-14 rounded-lg" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-0.5">
                      <Skeleton className="h-2.5 w-3/4" />
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Alerts / activity feed */}
              <div className="bg-white rounded-2xl ring-1 ring-black/6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16 rounded-lg" />
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-black/8 shrink-0 animate-pulse" />
                    <Skeleton className="flex-1 h-2.5" />
                    <Skeleton className="h-2 w-10 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
