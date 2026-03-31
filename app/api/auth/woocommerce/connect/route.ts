import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleWooCommerceConnect } from "@/lib/integrations/woocommerce/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { siteUrl, consumerKey, consumerSecret } = await req.json();
    if (!siteUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json({ error: "siteUrl, consumerKey and consumerSecret are required" }, { status: 400 });
    }

    await handleWooCommerceConnect(user.id, siteUrl, consumerKey, consumerSecret);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
