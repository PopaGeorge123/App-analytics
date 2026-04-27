import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleIntercomConnect } from "@/lib/integrations/intercom/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
    }

    await handleIntercomConnect(user.id, accessToken);
    await notifyIntegrationConnected(user.id, "intercom");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
