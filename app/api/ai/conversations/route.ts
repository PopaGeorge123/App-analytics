import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET — list all conversations for current user (newest first)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();

  const { data: conversations } = await db
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json({ conversations: conversations ?? [] });
}

// POST — create a new conversation
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isPremiumUser } = await import("@/lib/supabase/isPremiumUser");
  if (!(await isPremiumUser(user.id))) {
    return NextResponse.json({ error: "Premium required." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title: string = (body.title ?? "New Chat").trim() || "New Chat";

  const db = createServiceClient();

  const { data: conversation, error } = await db
    .from("ai_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation });
}
