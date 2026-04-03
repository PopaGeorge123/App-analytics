import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleHotjarConnect } from "@/lib/integrations/hotjar/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body        = await req.json();
    const accessToken = (body.accessToken as string)?.trim();
    const siteId      = (body.siteId      as string)?.trim();
    if (!accessToken || !siteId) {
      return NextResponse.json({ error: "accessToken and siteId are required" }, { status: 400 });
    }

    await handleHotjarConnect(user.id, accessToken, siteId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Hotjar connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
