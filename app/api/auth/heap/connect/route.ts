import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleHeapConnect } from "@/lib/integrations/heap/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const appId  = (body.appId  as string)?.trim();
    const apiKey = (body.apiKey as string)?.trim();
    if (!appId || !apiKey) {
      return NextResponse.json({ error: "appId and apiKey are required" }, { status: 400 });
    }

    await handleHeapConnect(user.id, appId, apiKey);
    await notifyIntegrationConnected(user.id, "heap");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Heap connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
