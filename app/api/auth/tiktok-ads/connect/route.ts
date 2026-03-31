import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleTikTokAdsConnect }    from "@/lib/integrations/tiktok-ads/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let accessToken: string, advertiserId: string;
  try {
    const body   = await request.json();
    accessToken  = (body.accessToken  as string)?.trim();
    advertiserId = (body.advertiserId as string)?.trim();
    if (!accessToken || !advertiserId) throw new Error("Missing accessToken or advertiserId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleTikTokAdsConnect(user.id, accessToken, advertiserId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("TikTok Ads connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
