import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback — middleware should catch this first
  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-[#f0f0f5]">
      {/* Top bar */}
      <header className="border-b border-[#1e1e2e] bg-[#0d0d16]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-[#f0f0f5]">FOLD</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-[#4a4a6a] sm:block">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-[#4a4a6a] sm:block">
              {user.email}
            </span>
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

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="relative max-w-2xl w-full text-center">
          {/* Glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-96 w-96 rounded-full bg-[#00d4aa]/5 blur-3xl" />
          </div>

          <div className="relative">
            {/* Status badge */}
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                Coming soon
              </span>
            </div>

            <h1 className="mb-4 font-mono text-4xl font-bold text-[#f0f0f5]">
              Dashboard coming soon
            </h1>

            <p className="mb-10 text-base leading-relaxed text-[#8888aa]">
              You&apos;re signed in as{" "}
              <span className="font-semibold text-[#f0f0f5]">{user.email}</span>.
              <br />
              We&apos;re connecting Stripe, Mailchimp, PostHog, and your ad platforms.
            </p>

            {/* Placeholder metric tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
              {[
                { label: "MRR", value: "—" },
                { label: "Churn", value: "—" },
                { label: "Open Rate", value: "—" },
                { label: "CAC", value: "—" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4"
                >
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">
                    {m.label}
                  </p>
                  <p className="font-mono text-2xl font-bold text-[#2a2a4a]">{m.value}</p>
                </div>
              ))}
            </div>

            <Link
              href="/"
              className="text-sm text-[#4a4a6a] underline-offset-4 hover:text-[#8888aa] hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
