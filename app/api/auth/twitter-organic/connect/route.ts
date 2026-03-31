import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleTwitterOrganicConnect } from "@/lib/integrations/twitter-organic/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bearerToken, accountId } = await req.json();
    if (!bearerToken || !accountId) {
      return NextResponse.json({ error: "bearerToken and accountId are required" }, { status: 400 });
    }

    await handleTwitterOrganicConnect(user.id, bearerToken, accountId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
