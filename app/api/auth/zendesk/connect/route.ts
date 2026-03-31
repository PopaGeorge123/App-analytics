import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleZendeskConnect } from "@/lib/integrations/zendesk/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subdomain, email, apiToken } = await req.json();
    if (!subdomain || !email || !apiToken) {
      return NextResponse.json({ error: "subdomain, email and apiToken are required" }, { status: 400 });
    }

    await handleZendeskConnect(user.id, subdomain, email, apiToken);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
