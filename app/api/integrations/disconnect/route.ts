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

  return NextResponse.json({ success: true });
}

