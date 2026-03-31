import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleAmazonSellerConnect } from "@/lib/integrations/amazon-seller/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { refreshToken, clientId, clientSecret, sellerId } = await req.json();
    if (!refreshToken || !clientId || !clientSecret || !sellerId) {
      return NextResponse.json(
        { error: "refreshToken, clientId, clientSecret and sellerId are required" },
        { status: 400 }
      );
    }

    await handleAmazonSellerConnect(user.id, refreshToken, clientId, clientSecret, sellerId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
