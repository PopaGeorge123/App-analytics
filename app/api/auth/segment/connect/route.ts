import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleSegmentConnect } from "@/lib/integrations/segment/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const accessToken = (body.accessToken as string)?.trim();
    const workspaceId = (body.workspaceId as string)?.trim();
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
