import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface EligibilityResult {
  eligible: boolean;
  /** Short title shown in the blocking UI */
  reason?: string;
  /** Actionable hint shown below the reason */
  hint?: string;
}

export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Premium ───────────────────────────────────────────────────────────────
  const { data: dbUser } = await supabase
    .from("users")
    .select("is_premium, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isPremium =
    dbUser?.is_premium === true ||
    (!!dbUser?.trial_ends_at && new Date(dbUser.trial_ends_at) > new Date());

  if (!isPremium) {
    return NextResponse.json<EligibilityResult>({
      eligible: false,
      reason: "Premium plan required",
      hint: "Upgrade to unlock AI Playbooks and get personalised, data-driven action plans.",
    });
  }

  // ── Check connected integrations ──────────────────────────────────────────
  const { data: integrations, error: intErr } = await supabase
    .from("integrations")
    .select("platform")
    .eq("user_id", user.id);

  if (intErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!integrations || integrations.length === 0) {
    return NextResponse.json<EligibilityResult>({
      eligible: false,
      reason: "No integrations connected",
      hint: "Connect at least one platform (e.g. Stripe, GA4, Meta Ads) so the AI has real data to analyse.",
    });
  }

  // ── Check snapshot coverage ───────────────────────────────────────────────
  // Require at least 3 distinct days of snapshots in the last 60 days
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const { data: snapRows, error: snapErr } = await supabase
    .from("daily_snapshots")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", since.toISOString().slice(0, 10));

  if (snapErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const distinctDays = new Set((snapRows ?? []).map((r) => r.date)).size;

  if (distinctDays < 3) {
    const connected = integrations.map((i) => i.platform).join(", ");
    return NextResponse.json<EligibilityResult>({
      eligible: false,
      reason: "Not enough historical data yet",
      hint: `Your integrations (${connected}) are connected but we only have ${distinctDays} day${distinctDays !== 1 ? "s" : ""} of snapshots. Come back after a few more syncs — the daemon runs daily and playbooks need at least 3 days to give meaningful advice.`,
    });
  }

  // ── All good ─────────────────────────────────────────────────────────────
  return NextResponse.json<EligibilityResult>({ eligible: true });
}
