import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { handleAmplitudeConnect }    from "@/lib/integrations/amplitude/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let apiKey: string, secretKey: string;
  try {
    const body = await request.json();
    apiKey    = (body.apiKey as string)?.trim();
    secretKey = (body.secretKey as string)?.trim();
    if (!apiKey || !secretKey) throw new Error("Missing apiKey or secretKey");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await handleAmplitudeConnect(user.id, apiKey, secretKey);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Amplitude connect error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
