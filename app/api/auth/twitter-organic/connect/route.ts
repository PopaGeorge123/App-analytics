import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleTwitterOrganicConnect } from "@/lib/integrations/twitter-organic/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { bearerToken, accountId } = await req.json();
    if (!bearerToken || !accountId) {
      return NextResponse.json({ error: "bearerToken and accountId are required" }, { status: 400 });
    }

    await handleTwitterOrganicConnect(user.id, bearerToken, accountId);
    await notifyIntegrationConnected(user.id, "twitter-organic");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
