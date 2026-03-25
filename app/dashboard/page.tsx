import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { daysAgo } from "@/lib/utils/dates";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch premium status from public.users (Supabase)
  const { data: dbUser } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  const isPremium = dbUser?.is_premium === true;

  const db = createServiceClient();

  // Fetch connected integrations
  const { data: integrations } = await db
    .from("integrations")
    .select("platform, connected_at")
    .eq("user_id", user.id);

  const connectedPlatforms = (integrations ?? []).map((i) => i.platform);

  // Fetch last 180 days of snapshots across all providers (Analytics needs broad range)
  const { data: rawSnapshots } = await db
    .from("daily_snapshots")
    .select("id, provider, date, data")
    .eq("user_id", user.id)
    .gte("date", daysAgo(180))
    .order("date", { ascending: true });

  const snapshots = (rawSnapshots ?? []).map((s) => ({
    id: s.id,
    provider: s.provider,
    date: s.date,
    data: s.data,
  }));

  // Fetch website profile + tasks
  const { data: websiteProfile } = await db
    .from("website_profiles")
    .select("url, score, analysis_status, description, last_scanned_at, analysis_error")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: websiteTasks } = await db
    .from("website_tasks")
    .select("id, title, description, category, impact_score, completed, completed_at")
    .eq("user_id", user.id)
    .order("completed", { ascending: true })
    .order("impact_score", { ascending: false });

  const websiteData = {
    url: websiteProfile?.url ?? null,
    score: websiteProfile?.score ?? 0,
    status: (websiteProfile?.analysis_status ?? "idle") as "idle" | "analyzing" | "done" | "error",
    summary: websiteProfile?.description ?? null,
    lastScanned: websiteProfile?.last_scanned_at ?? null,
    tasks: websiteTasks ?? [],
  };

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#13131f] text-[#f8f8fc]">
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#363650] bg-[#1c1c2a]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5 group">
              <img src="/fold-icon.svg" alt="Fold" className="h-7 w-auto transition-opacity group-hover:opacity-80" />
            </a>
            <span className="hidden text-[#8585aa] sm:block">/</span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-widest text-[#8585aa] sm:block">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isPremium && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                <span className="h-1 w-1 rounded-full bg-[#00d4aa] animate-pulse" />
                Premium
              </span>
            )}
            <div className="hidden h-4 w-px bg-[#363650] sm:block" />
            <span className="hidden truncate max-w-48 font-mono text-[11px] text-[#8585aa] sm:block">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Sidebar + content ────────────────────────────── */}
      <DashboardShell
        email={user.email!}
        isPremium={isPremium}
        connectedPlatforms={connectedPlatforms}
        snapshots={snapshots}
        websiteData={websiteData}
      />
    </div>
  );
}
