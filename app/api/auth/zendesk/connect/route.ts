import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleZendeskConnect } from "@/lib/integrations/zendesk/callback";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

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
