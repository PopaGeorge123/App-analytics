import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();

  // 1. Fetch the task (verify ownership + get impact_score)
  const { data: task, error: taskErr } = await db
    .from("website_tasks")
    .select("id, user_id, completed, impact_score")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (taskErr || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.completed) {
    return NextResponse.json({ error: "Task already completed" }, { status: 400 });
  }

  // 2. Mark task as done
  await db
    .from("website_tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", id);

  // 3. Increment score with diminishing returns — the higher the score,
  //    the less each completed task actually adds. Asymptotic toward ~97.
  const { data: profile } = await db
    .from("website_profiles")
    .select("score")
    .eq("user_id", user.id)
    .maybeSingle();

  const currentScore = profile?.score ?? 0;

  // Diminishing returns factor: full value below 60, shrinks toward 0 at 97
  const ceiling = 97;
  const remaining = Math.max(0, ceiling - currentScore);
  const factor = remaining / (ceiling - 0); // 1.0 at score=0, ~0 at score=97
  const earned = Math.max(1, Math.round(task.impact_score * factor));
  const newScore = Math.min(ceiling, currentScore + earned);

  await db
    .from("website_profiles")
    .update({ score: newScore })
    .eq("user_id", user.id);

  // 4. Check if all pending tasks are now done
  const { count: pendingCount } = await db
    .from("website_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("completed", false);

  return NextResponse.json({
    ok: true,
    newScore,
    allTasksDone: pendingCount === 0,
  });
}
