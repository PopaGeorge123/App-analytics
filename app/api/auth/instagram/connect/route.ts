import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInstagramConnect } from "@/lib/integrations/instagram/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accessToken, businessAccountId } = await req.json();
    if (!accessToken || !businessAccountId) {
      return NextResponse.json({ error: "accessToken and businessAccountId are required" }, { status: 400 });
    }

    await handleInstagramConnect(user.id, accessToken, businessAccountId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
