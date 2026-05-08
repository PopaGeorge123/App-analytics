import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { randomBytes } from "crypto";

// POST /api/playbook/share
// Body: { playbook: AiPlaybook }
// Returns: { url: string; token: string; expiresAt: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const playbook = body.playbook;
  if (!playbook?.id || !playbook?.title) {
    return NextResponse.json({ error: "Invalid playbook" }, { status: 400 });
  }

  const db = createServiceClient();

  // Fetch user email for attribution
  const { data: userData } = await db
    .from("users")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const label = `Playbook: ${playbook.title}`;

  const payload = {
    type: "playbook",
    sharedBy: userData?.email ?? "Anonymous",
    playbook,
  };

  const { error } = await db.from("share_tokens").insert({
    token,
    user_id: user.id,
    label,
    date_from: new Date().toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
    platforms: [],
    payload,
    expires_at: expiresAt,
    view_count: 0,
  });

  if (error) {
    console.error("[playbook/share] DB insert error:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/playbook/${token}`;

  return NextResponse.json({ url, token, expiresAt });
}
