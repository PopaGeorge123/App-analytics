/**
 * app/dashboard/loading.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Next.js App Router streaming loading UI for the /dashboard route.
 * Renders instantly (no data needed) while page.tsx awaits Supabase queries.
 *
 * Matches the exact shell shape — top bar, sidebar, and content skeletons —
 * so there's no layout shift when real content arrives.
 */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-[#363650]/60 animate-pulse ${className}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#13131f] text-[#f8f8fc]">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#363650] bg-[#1c1c2a]/95">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {/* Logo placeholder */}
            <Skeleton className="h-7 w-20" />
            <span className="hidden text-[#363650] sm:block">/</span>
            <Skeleton className="hidden sm:block h-3 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden sm:block h-5 w-24 rounded-full" />
            <div className="hidden h-4 w-px bg-[#363650] sm:block" />
            <Skeleton className="hidden sm:block h-3 w-32" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      </header>

      {/* ── Sidebar + content ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-[#363650] bg-[#1c1c2a]">
          {/* User info */}
          <div className="px-4 pt-5 pb-4 border-b border-[#363650]/60 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2 w-12" />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 p-3 flex-1">
            <Skeleton className="h-2.5 w-16 mb-2 ml-2" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </nav>

          {/* Bottom card */}
          <div className="p-3 border-t border-[#363650]/60">
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          {/* Desktop notification row */}
          <div className="hidden lg:flex items-center justify-end px-8 pt-5 pb-0">
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>

          <div className="p-6 lg:p-8 space-y-6">

            {/* KPI cards row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[#363650] bg-[#1c1c2a] p-4 space-y-3">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-2 w-12" />
                  {/* Mini sparkline */}
                  <div className="flex items-end gap-0.5 h-6">
                    {[55, 40, 65, 50, 70, 60, 80].map((h, j) => (
                      <div
                        key={j}
                        className="flex-1 rounded-sm bg-[#363650]/80 animate-pulse"
                        style={{ height: `${h}%`, animationDelay: `${j * 60}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Main chart panel */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-48" />
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-10 rounded-lg" />
                  ))}
                </div>
              </div>
              {/* Chart area */}
              <Skeleton className="h-56 w-full rounded-xl" />
              {/* Legend row */}
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column lower row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Insights panel */}
              <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a] p-5 space-y-4">
                <Skeleton className="h-3 w-24" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-2.5 w-3/4" />
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity feed */}
              <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a] p-5 space-y-4">
                <Skeleton className="h-3 w-28" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-2 w-2 rounded-full shrink-0" />
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
