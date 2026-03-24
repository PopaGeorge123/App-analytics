import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backfillStripeHistory } from "@/lib/integrations/stripe/backfill";
import { backfillGA4History } from "@/lib/integrations/ga4/backfill";
import { backfillMetaHistory } from "@/lib/integrations/meta/backfill";

/**
 * GET /api/integrations/sync-on-login
 *
 * Called once per browser session when the user lands on the dashboard.
 * Checks which platforms the user has connected and kicks off a backfill
 * for each one in the background. Returns immediately so the UI doesn't block.
 *
 * The client stores a sessionStorage flag ("syncedThisSession") so this
 * endpoint is only called once per browser session, not on every page navigation.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch which platforms this user has connected
  const { data: integrations } = await supabase
    .from("integrations")
    .select("platform")
    .eq("user_id", user.id);

  const platforms = (integrations ?? []).map((i: { platform: string }) => i.platform);

  if (platforms.length === 0) {
    return NextResponse.json({ ok: true, message: "No integrations connected." });
  }

  // Run all backfills in background — fire and forget
  (async () => {
    try {
      if (platforms.includes("stripe")) await backfillStripeHistory(user.id);
    } catch (e) {
      console.error("[sync-on-login] Stripe error:", e);
    }
    try {
      if (platforms.includes("ga4")) await backfillGA4History(user.id);
    } catch (e) {
      console.error("[sync-on-login] GA4 error:", e);
    }
    try {
      if (platforms.includes("meta")) await backfillMetaHistory(user.id);
    } catch (e) {
      console.error("[sync-on-login] Meta error:", e);
    }
  })();

  return NextResponse.json({
    ok: true,
    message: `Sync started for: ${platforms.join(", ")}`,
    platforms,
  });
}
