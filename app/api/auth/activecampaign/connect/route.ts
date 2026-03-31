import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleActiveCampaignConnect } from "@/lib/integrations/activecampaign/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
