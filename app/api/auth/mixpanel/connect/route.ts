import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleMixpanelConnect }     from "@/lib/integrations/mixpanel/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let projectId: string, serviceAccountUser: string, serviceAccountSecret: string;
  try {
    const body = await request.json();
    projectId           = (body.projectId as string)?.trim();
    serviceAccountUser  = (body.serviceAccountUser as string)?.trim();
    serviceAccountSecret = (body.serviceAccountSecret as string)?.trim();
    if (!projectId || !serviceAccountUser || !serviceAccountSecret) throw new Error("Missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleMixpanelConnect(user.id, projectId, serviceAccountUser, serviceAccountSecret);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Mixpanel connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
