import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleBigCommerceConnect } from "@/lib/integrations/bigcommerce/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { storeHash, accessToken } = await req.json();
    if (!storeHash || !accessToken) {
      return NextResponse.json({ error: "storeHash and accessToken are required" }, { status: 400 });
    }

    await handleBigCommerceConnect(user.id, storeHash, accessToken);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
