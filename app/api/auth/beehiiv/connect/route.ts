import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleBeehiivConnect } from "@/lib/integrations/beehiiv/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { apiKey, publicationId } = await req.json();
    if (!apiKey || !publicationId) {
      return NextResponse.json({ error: "apiKey and publicationId are required" }, { status: 400 });
    }

    await handleBeehiivConnect(user.id, apiKey, publicationId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
