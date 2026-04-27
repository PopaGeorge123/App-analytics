import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleBeehiivConnect } from "@/lib/integrations/beehiiv/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body          = await req.json();
    const apiKey        = (body.apiKey        as string)?.trim();
    const publicationId = (body.publicationId as string)?.trim();
    if (!apiKey || !publicationId) {
      return NextResponse.json({ error: "apiKey and publicationId are required" }, { status: 400 });
    }

    await handleBeehiivConnect(user.id, apiKey, publicationId);
    await notifyIntegrationConnected(user.id, "beehiiv");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Beehiiv connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
