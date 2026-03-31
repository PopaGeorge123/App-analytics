import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleSegmentConnect } from "@/lib/integrations/segment/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accessToken, workspaceId } = await req.json();
    if (!accessToken || !workspaceId) {
      return NextResponse.json({ error: "accessToken and workspaceId are required" }, { status: 400 });
    }

    await handleSegmentConnect(user.id, accessToken, workspaceId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
