import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleActiveCampaignConnect } from "@/lib/integrations/activecampaign/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { apiUrl, apiKey } = await req.json();
    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
    }

    await handleActiveCampaignConnect(user.id, apiUrl, apiKey);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
