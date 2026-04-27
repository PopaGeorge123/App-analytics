import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleBigCommerceConnect } from "@/lib/integrations/bigcommerce/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { storeHash, accessToken } = await req.json();
    if (!storeHash || !accessToken) {
      return NextResponse.json({ error: "storeHash and accessToken are required" }, { status: 400 });
    }

    await handleBigCommerceConnect(user.id, storeHash, accessToken);
    await notifyIntegrationConnected(user.id, "bigcommerce");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
