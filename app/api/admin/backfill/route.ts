import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backfillStripeHistory } from "@/lib/integrations/stripe/backfill";
import { backfillGA4History } from "@/lib/integrations/ga4/backfill";
import { backfillMetaHistory } from "@/lib/integrations/meta/backfill";

// GET /api/admin/backfill?platform=stripe   (or ga4 / meta / all)
// Kicks off a backfill in the background and returns immediately so the
// request doesn't timeout on large datasets.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = request.nextUrl.searchParams.get("platform") ?? "all";
  const userId = user.id;

  // Run backfill in background — don't await so we return fast
  (async () => {
    try {
      if (platform === "stripe" || platform === "all") await backfillStripeHistory(userId);
      if (platform === "ga4"    || platform === "all") await backfillGA4History(userId);
      if (platform === "meta"   || platform === "all") await backfillMetaHistory(userId);
    } catch (err) {
      console.error("[backfill] Error:", err);
    }
  })();

  return NextResponse.json({ ok: true, message: `Backfill for ${platform} started in background.` });
}
