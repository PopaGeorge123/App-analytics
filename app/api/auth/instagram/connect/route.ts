import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleInstagramConnect } from "@/lib/integrations/instagram/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { accessToken, businessAccountId } = await req.json();
    if (!accessToken || !businessAccountId) {
      return NextResponse.json({ error: "accessToken and businessAccountId are required" }, { status: 400 });
    }

    await handleInstagramConnect(user.id, accessToken, businessAccountId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
