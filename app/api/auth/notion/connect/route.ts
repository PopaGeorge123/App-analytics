import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleNotionConnect } from "@/lib/integrations/notion/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { apiToken, databaseId } = await req.json();
    if (!apiToken || !databaseId) {
      return NextResponse.json({ error: "apiToken and databaseId are required" }, { status: 400 });
    }

    await handleNotionConnect(user.id, apiToken, databaseId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
