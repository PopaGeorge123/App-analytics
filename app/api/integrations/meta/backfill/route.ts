import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backfillMetaHistory } from "@/lib/integrations/meta/backfill";

// POST /api/integrations/meta/backfill
// Re-runs the 30-day Meta backfill for the current user.
// Call this once after deploying the impressions fix.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run in background — responds immediately
  backfillMetaHistory(user.id).catch((err) =>
    console.error("[meta/backfill route] error:", err)
  );

  return NextResponse.json({ ok: true, message: "Meta backfill started" });
}
