import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { handlePinterestAdsConnect }  from "@/lib/integrations/pinterest-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let accessToken: string, accountId: string;
  try {
    const body   = await request.json();
    accessToken  = (body.accessToken as string)?.trim();
    accountId    = (body.accountId   as string)?.trim();
    if (!accessToken || !accountId) throw new Error("Missing accessToken or accountId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handlePinterestAdsConnect(user.id, accessToken, accountId);
    await notifyIntegrationConnected(user.id, "pinterest-ads");

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Pinterest Ads connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
