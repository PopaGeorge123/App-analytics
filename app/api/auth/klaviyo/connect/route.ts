import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleKlaviyoConnect }      from "@/lib/integrations/klaviyo/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let apiKey: string;
  try {
    const body = await request.json();
    apiKey = (body.apiKey as string)?.trim();
    if (!apiKey) throw new Error("Missing apiKey");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleKlaviyoConnect(user.id, apiKey);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Klaviyo connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
