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

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-[#f0f0f5]">
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#1e1e2e] bg-[#0d0d16]/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/fold-icon.svg" alt="Fold" className="h-7 w-auto" />
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-[#4a4a6a] sm:block">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isPremium && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                <span className="h-1 w-1 rounded-full bg-[#00d4aa] animate-pulse" />
                Premium
              </span>
            )}
            <span className="hidden text-xs text-[#4a4a6a] sm:block">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-xl border border-[#1e1e2e] bg-[#12121a] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#8888aa] transition-all hover:border-red-500/30 hover:text-red-400"
              >
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
      />
    </div>
  );
}
