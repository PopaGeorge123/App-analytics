import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleShopifyConnect } from "@/lib/integrations/shopify/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { storeDomain, accessToken } = await req.json();
    if (!storeDomain || !accessToken) {
      return NextResponse.json({ error: "storeDomain and accessToken are required" }, { status: 400 });
    }

    await handleShopifyConnect(user.id, storeDomain, accessToken);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
