import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleYouTubeConnect } from "@/lib/integrations/youtube/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accessToken, channelId } = await req.json();
    if (!accessToken || !channelId) {
      return NextResponse.json({ error: "accessToken and channelId are required" }, { status: 400 });
    }

    await handleYouTubeConnect(user.id, accessToken, channelId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
