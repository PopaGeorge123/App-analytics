import { NextRequest, NextResponse } from "next/server";
import { createClient }             from "@/lib/supabase/server";
import { handlePostHogConnect }     from "@/lib/integrations/posthog/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let apiKey: string, projectId: string;
  try {
    const body = await request.json();
    apiKey    = (body.apiKey as string)?.trim();
    projectId = (body.projectId as string)?.trim();
    if (!apiKey || !projectId) throw new Error("Missing apiKey or projectId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handlePostHogConnect(user.id, apiKey, projectId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("PostHog connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
