import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handlePipedriveConnect } from "@/lib/integrations/pipedrive/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { apiToken } = await req.json();
    if (!apiToken) {
      return NextResponse.json({ error: "apiToken is required" }, { status: 400 });
    }

    await handlePipedriveConnect(user.id, apiToken);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
