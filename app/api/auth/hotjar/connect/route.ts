import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleHotjarConnect } from "@/lib/integrations/hotjar/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accessToken, siteId } = await req.json();
    if (!accessToken || !siteId) {
      return NextResponse.json({ error: "accessToken and siteId are required" }, { status: 400 });
    }

    await handleHotjarConnect(user.id, accessToken, siteId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
