import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleYouTubeConnect } from "@/lib/integrations/youtube/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { accessToken, channelId } = await req.json();
    if (!accessToken || !channelId) {
      return NextResponse.json({ error: "accessToken and channelId are required" }, { status: 400 });
    }

    await handleYouTubeConnect(user.id, accessToken, channelId);
    await notifyIntegrationConnected(user.id, "youtube");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
