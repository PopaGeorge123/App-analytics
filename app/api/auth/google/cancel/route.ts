import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/google/cancel
 *
 * Deletes the pending GA4 integration row that was created during OAuth
 * before the user completed property selection. Called when the user
 * clicks "Cancel" or "Back to Settings" on /dashboard/ga4-setup.
 */
export async function POST() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Only delete the row if account_id is still empty (i.e. property was never selected)
  await db
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", "ga4")
    .eq("account_id", "");

  return NextResponse.json({ ok: true });
}
