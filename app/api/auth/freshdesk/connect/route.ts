import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleFreshdeskConnect } from "@/lib/integrations/freshdesk/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subdomain, apiKey } = await req.json();
    if (!subdomain || !apiKey) {
      return NextResponse.json({ error: "subdomain and apiKey are required" }, { status: 400 });
    }

    await handleFreshdeskConnect(user.id, subdomain, apiKey);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
