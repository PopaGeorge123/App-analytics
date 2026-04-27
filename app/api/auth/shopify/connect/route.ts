import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleShopifyConnect } from "@/lib/integrations/shopify/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { storeDomain, accessToken } = await req.json();
    if (!storeDomain || !accessToken) {
      return NextResponse.json({ error: "storeDomain and accessToken are required" }, { status: 400 });
    }

    await handleShopifyConnect(user.id, storeDomain, accessToken);
    await notifyIntegrationConnected(user.id, "shopify");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
