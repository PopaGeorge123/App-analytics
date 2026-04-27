import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleFullStoryConnect } from "@/lib/integrations/fullstory/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body   = await req.json();
    const apiKey = (body.apiKey as string)?.trim();
    const orgId  = (body.orgId  as string)?.trim();
    if (!apiKey || !orgId) {
      return NextResponse.json({ error: "apiKey and orgId are required" }, { status: 400 });
    }

    await handleFullStoryConnect(user.id, apiKey, orgId);
    await notifyIntegrationConnected(user.id, "fullstory");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("FullStory connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
