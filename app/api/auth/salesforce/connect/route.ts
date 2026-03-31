import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleSalesforceConnect } from "@/lib/integrations/salesforce/callback";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { instanceUrl, accessToken } = await req.json();
    if (!instanceUrl || !accessToken) {
      return NextResponse.json({ error: "instanceUrl and accessToken are required" }, { status: 400 });
    }

    await handleSalesforceConnect(user.id, instanceUrl, accessToken);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
