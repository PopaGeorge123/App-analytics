import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AiPlaybooksResponse } from "../route";

export interface PlaybookHistoryEntry {
  id: string;
  generated_at: string;
  archived_at: string;
  payload: AiPlaybooksResponse;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Premium check
  const { data: dbUser } = await supabase
    .from("users")
    .select("is_premium, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isPremium =
    dbUser?.is_premium === true ||
    (!!dbUser?.trial_ends_at && new Date(dbUser.trial_ends_at) > new Date());

  if (!isPremium) return NextResponse.json({ error: "Premium required" }, { status: 403 });

  const db = createServiceClient();

  const { data, error } = await db
    .from("ai_playbooks_history")
    .select("id, generated_at, archived_at, payload")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
