import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/website/tasks — returns all tasks for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();

  const { data: tasks, error } = await db
    .from("website_tasks")
    .select("id, title, description, category, impact_score, completed, completed_at, created_at")
    .eq("user_id", user.id)
    .order("completed", { ascending: true })
    .order("impact_score", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: tasks ?? [] });
}
