import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── GET — load all feedback for the authenticated user ──────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("playbook_feedback")
    .select("playbook_id, rating, completed_steps")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return as a map keyed by playbook_id for easy lookup on the client
  const map: Record<string, { rating: number | null; completed_steps: number[] }> = {};
  for (const row of data ?? []) {
    map[row.playbook_id] = { rating: row.rating, completed_steps: row.completed_steps ?? [] };
  }
  return NextResponse.json(map);
}

// ─── POST — upsert rating and/or completed_steps for one playbook ─────────────
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    playbook_id: string;
    playbook_title?: string;
    rating?: number | null;
    completed_steps?: number[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { playbook_id, playbook_title, rating, completed_steps } = body;
  if (!playbook_id) return NextResponse.json({ error: "playbook_id required" }, { status: 400 });

  // Validate rating if provided
  if (rating !== undefined && rating !== null && rating !== 1 && rating !== -1) {
    return NextResponse.json({ error: "rating must be 1, -1, or null" }, { status: 400 });
  }

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    playbook_id,
    playbook_title: playbook_title ?? "",
    updated_at: new Date().toISOString(),
  };
  if (rating !== undefined) upsertData.rating = rating;
  if (completed_steps !== undefined) upsertData.completed_steps = completed_steps;

  const { error } = await supabase
    .from("playbook_feedback")
    .upsert(upsertData, { onConflict: "user_id,playbook_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
