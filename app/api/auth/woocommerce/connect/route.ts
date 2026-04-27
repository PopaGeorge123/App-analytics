import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleWooCommerceConnect } from "@/lib/integrations/woocommerce/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body           = await req.json();
    const siteUrl        = (body.siteUrl        as string)?.trim();
    const consumerKey    = (body.consumerKey    as string)?.trim();
    const consumerSecret = (body.consumerSecret as string)?.trim();
    if (!siteUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json({ error: "siteUrl, consumerKey and consumerSecret are required" }, { status: 400 });
    }

    await handleWooCommerceConnect(user.id, siteUrl, consumerKey, consumerSecret);
    await notifyIntegrationConnected(user.id, "woocommerce");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("WooCommerce connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
