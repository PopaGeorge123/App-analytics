import { NextRequest, NextResponse } from "next/server";
import { createClient }             from "@/lib/supabase/server";
import { handleFathomConnect }      from "@/lib/integrations/fathom/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let apiKey: string, siteId: string;
  try {
    const body = await request.json();
    apiKey = (body.apiKey as string)?.trim();
    siteId = (body.siteId as string)?.trim();
    if (!apiKey || !siteId) throw new Error("Missing apiKey or siteId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleFathomConnect(user.id, apiKey, siteId);
    await notifyIntegrationConnected(user.id, "fathom");

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Fathom connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
