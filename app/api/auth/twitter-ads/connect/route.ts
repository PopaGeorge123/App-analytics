import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleTwitterAdsConnect }   from "@/lib/integrations/twitter-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bearerToken: string, accountId: string;
  try {
    const body  = await request.json();
    bearerToken = (body.bearerToken as string)?.trim();
    accountId   = (body.accountId   as string)?.trim();
    if (!bearerToken || !accountId) throw new Error("Missing bearerToken or accountId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleTwitterAdsConnect(user.id, bearerToken, accountId);
    await notifyIntegrationConnected(user.id, "twitter-ads");

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Twitter Ads connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
