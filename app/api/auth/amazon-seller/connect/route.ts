import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleAmazonSellerConnect } from "@/lib/integrations/amazon-seller/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { refreshToken, clientId, clientSecret, sellerId } = await req.json();
    if (!refreshToken || !clientId || !clientSecret || !sellerId) {
      return NextResponse.json(
        { error: "refreshToken, clientId, clientSecret and sellerId are required" },
        { status: 400 }
      );
    }

    await handleAmazonSellerConnect(user.id, refreshToken, clientId, clientSecret, sellerId);
    await notifyIntegrationConnected(user.id, "amazon-seller");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
