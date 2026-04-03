import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleGoogleAdsConnect }    from "@/lib/integrations/google-ads/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let accessToken: string, customerId: string;
  try {
    const body = await request.json();
    accessToken = (body.accessToken as string)?.trim();
    customerId  = (body.customerId  as string)?.trim();
    if (!accessToken || !customerId) throw new Error("Missing required fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleGoogleAdsConnect(user.id, accessToken, customerId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Google Ads connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
