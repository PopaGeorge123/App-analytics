import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type Goal = {
  id: string;
  platform: string;
  field: string;
  label: string;
  target: number;
  deadline: string | null; // ISO date "YYYY-MM-DD"
  created_at: string;
};

// ── GET — return this user's goals ───────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("users")
    .select("goals")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const goals: Goal[] = Array.isArray(data?.goals) ? (data.goals as Goal[]) : [];
  return NextResponse.json({ goals });
}

// ── PUT — overwrite the full goals array ─────────────────────────────────
// Body: { goals: Goal[], currentValues?: Record<string, number> }
// currentValues[goalId] = current metric total — used to fire notifications

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const goals: Goal[] = Array.isArray(body.goals) ? body.goals : [];
  const currentValues: Record<string, number> = body.currentValues ?? {};

  const db = createServiceClient();

  // Read existing goals to diff for newly-achieved ones
  const { data: existingRow } = await db
    .from("users")
    .select("goals")
    .eq("id", user.id)
    .single();

  const existingGoals: Goal[] = Array.isArray(existingRow?.goals)
    ? (existingRow.goals as Goal[])
    : [];

  // Persist updated goals
  const { error } = await db
    .from("users")
    .update({ goals })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire a notification for any goal that just crossed 100%
  const notifications: {
    user_id: string;
    message: string;
    detail: string;
    color: string;
    icon: string;
    read: boolean;
  }[] = [];

  for (const goal of goals) {
    const current = currentValues[goal.id];
    if (current === undefined) continue;

    const wasAchieved = (() => {
      const prev = existingGoals.find((g) => g.id === goal.id);
      if (!prev) return false;
      const prevCurrent = currentValues[`__prev_${goal.id}`]; // not provided → can't tell
      // We fire only when the new goals list is saved AND current >= target
      // To avoid repeated notifications we store achieved month in goals_notified_month
      return false; // fine-grained diff not feasible without prev snapshot; handled below
    })();
    void wasAchieved; // suppress lint

    if (current >= goal.target) {
      // Only notify once — check goals_notified_month
      const monthKey = new Date().toISOString().slice(0, 7); // "2026-04"
      const { data: userRow } = await db
        .from("users")
        .select("goals_notified_month")
        .eq("id", user.id)
        .single();

      const notifiedMap: Record<string, string> = (userRow?.goals_notified_month as Record<string, string>) ?? {};
      if (notifiedMap[goal.id] === monthKey) continue; // already notified this month

      // Mark as notified
      notifiedMap[goal.id] = monthKey;
      await db.from("users").update({ goals_notified_month: notifiedMap }).eq("id", user.id);

      notifications.push({
        user_id: user.id,
        message: `🎯 Goal achieved: ${goal.label}`,
        detail: `${goal.platform} · ${goal.field} reached ${current.toLocaleString()} / target ${goal.target.toLocaleString()}`,
        color: "#00d4aa",
        icon: "🎯",
        read: false,
      });
    }
  }

  if (notifications.length > 0) {
    await db.from("notifications").insert(notifications);
  }

  return NextResponse.json({ success: true, notified: notifications.length });
}
