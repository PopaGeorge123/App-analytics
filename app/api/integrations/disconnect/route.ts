import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await request.json() as { platform: string };

  // Validate that platform is a non-empty string (no allowlist — catalog grows over time)
  if (!platform || typeof platform !== "string" || platform.trim().length === 0) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const db = createServiceClient();

  // Delete the integration row
  const { error } = await db
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  // Delete all historical snapshots for this platform
  await db
    .from("daily_snapshots")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", platform);

  // Delete customer records sourced from this platform
  await db
    .from("customers")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", platform);

  // Invalidate the AI playbooks cache so it is regenerated without this platform's data
  await db
    .from("ai_playbooks_cache")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
