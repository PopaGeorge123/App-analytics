import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backfillStripeHistory } from "@/lib/integrations/stripe/backfill";
import { backfillGA4History } from "@/lib/integrations/ga4/backfill";
import { backfillMetaHistory } from "@/lib/integrations/meta/backfill";

// Simple one-shot backfill endpoint — call once after reconnecting an integration
// GET /api/admin/backfill?platform=stripe   (or ga4 / meta / all)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = request.nextUrl.searchParams.get("platform") ?? "all";

  const results: Record<string, string> = {};

  try {
    if (platform === "stripe" || platform === "all") {
      await backfillStripeHistory(user.id);
      results.stripe = "done";
    }
    if (platform === "ga4" || platform === "all") {
      await backfillGA4History(user.id);
      results.ga4 = "done";
    }
    if (platform === "meta" || platform === "all") {
      await backfillMetaHistory(user.id);
      results.meta = "done";
    }
  } catch (err) {
    console.error("Backfill error:", err);
    return NextResponse.json(
      { error: String(err), partial: results },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, results });
}
