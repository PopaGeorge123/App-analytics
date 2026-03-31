import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleNotionConnect } from "@/lib/integrations/notion/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
