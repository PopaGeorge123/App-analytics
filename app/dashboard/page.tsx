import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { daysAgo } from "@/lib/utils/dates";
import DashboardShell from "./_components/DashboardShell";
import { Suspense } from "react";
import ConversionTracker from "@/components/ConversionTracker";

/** Customer record shape returned from the customers table */
export interface CustomerRow {
  id:          string;
  provider:    string;
  provider_id: string;
  email:       string | null;
  name:        string | null;
  total_spent: number;   // cents (bigint → number via supabase-js)
  order_count: number;
  first_seen:  string | null;  // YYYY-MM-DD
  last_seen:   string | null;  // YYYY-MM-DD
  subscribed:  boolean;
  churned:     boolean;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Read ?syncing=platform from the URL (set by OAuth success redirects)
  const params = await searchParams;
  const isSyncing = (params.syncing as string | undefined) ?? null;

  // Fetch premium status from public.users (Supabase)
  const { data: dbUser } = await supabase
    .from("users")
    .select("is_premium, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isOnActiveTrial =
    !!dbUser?.trial_ends_at && new Date(dbUser.trial_ends_at) > new Date();
  const isPremium = dbUser?.is_premium === true || isOnActiveTrial;
  const trialEndsAt: string | null = isOnActiveTrial ? (dbUser!.trial_ends_at as string) : null;
  // Pre-compute time left server-side for the header badge (floor days, fallback to hours)
  const _trialMsLeft = trialEndsAt
    ? Math.max(0, new Date(trialEndsAt).getTime() - Date.now())
    : null;
  const trialDaysLeftServer = _trialMsLeft !== null
    ? Math.floor(_trialMsLeft / (1000 * 60 * 60 * 24))
    : null;
  const trialHoursLeftServer = _trialMsLeft !== null
    ? Math.ceil(_trialMsLeft / (1000 * 60 * 60))
    : null;
  // "2d left" / "5h left" / "Expires today"
  const trialTimeLabelServer =
    trialDaysLeftServer === null
      ? null
      : trialDaysLeftServer >= 2
      ? `Trial · ${trialDaysLeftServer}d left`
      : trialHoursLeftServer! > 0
      ? `Trial · ${trialHoursLeftServer}h left`
      : "Trial expires today";

  const db = createServiceClient();

  // Fetch connected integrations — exclude rows where account_id is empty string
  // (GA4 saves a row immediately after OAuth before the user picks a property;
  //  if they cancel the property-selection step the row stays but is not truly connected)
  const { data: integrations } = await db
    .from("integrations")
    .select("platform, connected_at, currency, account_id")
    .eq("user_id", user.id)
    .not("account_id", "eq", "");

  const connectedPlatforms = (integrations ?? []).map((i) => i.platform);

  // Currency map: platform → ISO currency code (e.g. { stripe: "EUR", meta: "USD", "lemon-squeezy": "USD" })
  // Populated at connect time by each integration's callback. Defaults to "USD" when absent.
  const currencies: Record<string, string> = Object.fromEntries(
    (integrations ?? [])
      .filter((i) => i.currency)
      .map((i) => [i.platform, (i.currency as string).toUpperCase()])
  );

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

  // Fetch customer records — all providers for this user, sorted by LTV desc
  // Multiple revenue platforms (Stripe + WooCommerce + Gumroad etc.) each write their
  // own rows; the Customers tab aggregates across all of them automatically.
  const { data: rawCustomers } = await db
    .from("customers")
    .select("id, provider, provider_id, email, name, total_spent, order_count, first_seen, last_seen, subscribed, churned")
    .eq("user_id", user.id)
    .order("total_spent", { ascending: false })
    .limit(500);

  const customers: CustomerRow[] = (rawCustomers ?? []).map((c) => ({
    id:          c.id,
    provider:    c.provider,
    provider_id: c.provider_id,
    email:       c.email       ?? null,
    name:        c.name        ?? null,
    total_spent: Number(c.total_spent ?? 0),
    order_count: Number(c.order_count ?? 0),
    first_seen:  c.first_seen  ?? null,
    last_seen:   c.last_seen   ?? null,
    subscribed:  Boolean(c.subscribed),
    churned:     Boolean(c.churned),
  }));

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#fafafa] text-[#1a1a2e]">
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#d4d4e8] bg-[#f2f2f8]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5 group">
              <img src="/fold-icon.svg" alt="Fold" className="h-7 w-auto transition-opacity group-hover:opacity-80" />
            </a>
            <span className="hidden text-[#6a6a90] sm:block">/</span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6a6a90] sm:block">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isPremium && !trialEndsAt && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                <span className="h-1 w-1 rounded-full bg-[#00d4aa] animate-pulse" />
                Premium
              </span>
            )}
            {trialEndsAt && trialTimeLabelServer && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/25 bg-[#f59e0b]/8 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#f59e0b]">
                <span className="h-1 w-1 rounded-full bg-[#f59e0b] animate-pulse" />
                {trialTimeLabelServer}
              </span>
            )}
            <div className="hidden h-4 w-px bg-[#d4d4e8] sm:block" />
            <span className="hidden truncate max-w-48 font-mono text-[11px] text-[#6a6a90] sm:block">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-[#d4d4e8] bg-[#e8e8f4] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#4a4a6a] transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
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
        trialEndsAt={trialEndsAt}
        connectedPlatforms={connectedPlatforms}
        snapshots={snapshots}
        currencies={currencies}
        isSyncing={isSyncing}
        customers={customers}
      />
      <Suspense><ConversionTracker /></Suspense>
    </div>
  );
}
