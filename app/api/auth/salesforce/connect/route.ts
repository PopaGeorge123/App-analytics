import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleSalesforceConnect } from "@/lib/integrations/salesforce/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {

    const { instanceUrl, accessToken } = await req.json();
    if (!instanceUrl || !accessToken) {
      return NextResponse.json({ error: "instanceUrl and accessToken are required" }, { status: 400 });
    }

    await handleSalesforceConnect(user.id, instanceUrl, accessToken);
    await notifyIntegrationConnected(user.id, "salesforce");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
