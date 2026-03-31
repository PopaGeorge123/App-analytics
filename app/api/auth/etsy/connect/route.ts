import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleEtsyConnect } from "@/lib/integrations/etsy/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { apiKey, shopId } = await req.json();
    if (!apiKey || !shopId) {
      return NextResponse.json({ error: "apiKey and shopId are required" }, { status: 400 });
    }

    await handleEtsyConnect(user.id, apiKey, shopId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
