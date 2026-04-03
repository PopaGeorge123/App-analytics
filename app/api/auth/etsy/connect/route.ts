import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleEtsyConnect } from "@/lib/integrations/etsy/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

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
