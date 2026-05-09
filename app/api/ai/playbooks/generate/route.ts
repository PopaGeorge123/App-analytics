import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SYNC_SECRET  = process.env.SYNC_SECRET ?? "";
const DAEMON_URL   = process.env.SYNC_DAEMON_URL ?? "http://localhost:4242";

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Premium check ─────────────────────────────────────────────────────────
  const { data: dbUser } = await supabase
    .from("users")
    .select("is_premium, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isPremium =
    dbUser?.is_premium === true ||
    (!!dbUser?.trial_ends_at && new Date(dbUser.trial_ends_at) > new Date());

  if (!isPremium) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  if (!SYNC_SECRET) {
    return NextResponse.json(
      { error: "Daemon not configured (SYNC_SECRET missing)" },
      { status: 503 }
    );
  }

  const db = createServiceClient();

  // ── Archive current cache to history before generating a new one ──────────
  const { data: currentCache } = await db
    .from("ai_playbooks_cache")
    .select("payload, generated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentCache?.payload && currentCache?.generated_at) {
    // Only archive if the current generation is at least 10 minutes old
    // (avoids double-archiving on rapid re-generates)
    const ageMs = Date.now() - new Date(currentCache.generated_at).getTime();
    if (ageMs > 10 * 60 * 1000) {
      await db.from("ai_playbooks_history").insert({
        user_id: user.id,
        payload: currentCache.payload,
        generated_at: currentCache.generated_at,
        archived_at: new Date().toISOString(),
      });
    }
  }

  // ── Build previous-context for the AI to learn from ──────────────────────
  // Gather last 3 historical generations with their feedback ratings
  const [{ data: historyRows }, { data: feedbackRows }] = await Promise.all([
    db
      .from("ai_playbooks_history")
      .select("payload, generated_at")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(3),
    db
      .from("playbook_feedback")
      .select("playbook_id, playbook_title, rating, completed_steps")
      .eq("user_id", user.id),
  ]);

  // Shape previous-context as a compact summary the AI prompt can consume
  interface HistoryRow { payload: { playbooks?: Array<{ id: string; title: string; severity: string; category: string }> }; generated_at: string }
  interface FeedbackRow { playbook_id: string; playbook_title: string; rating: number | null; completed_steps: number[] }

  const previousContext = (historyRows as HistoryRow[] ?? []).map((row) => {
    const playbooks = row.payload?.playbooks ?? [];
    return {
      generatedAt: row.generated_at,
      playbooks: playbooks.map((p) => {
        const fb = (feedbackRows as FeedbackRow[] ?? []).find((f) => f.playbook_id === p.id);
        return {
          id: p.id,
          title: p.title,
          severity: p.severity,
          category: p.category,
          rating: fb?.rating ?? null,
          stepsCompleted: (fb?.completed_steps ?? []).length,
          totalSteps: 0, // daemon will ignore this field; it's informational
        };
      }),
    };
  });

  const completedPlaybookIds = (feedbackRows as FeedbackRow[] ?? [])
    .filter((f) => f.rating === 1)
    .map((f) => f.playbook_id);

  const dislikedPlaybookIds = (feedbackRows as FeedbackRow[] ?? [])
    .filter((f) => f.rating === -1)
    .map((f) => f.playbook_id);

  // ── Forward to daemon ─────────────────────────────────────────────────────
  try {
    const daemonRes = await fetch(`${DAEMON_URL}/playbooks/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SYNC_SECRET}`,
      },
      body: JSON.stringify({
        userId: user.id,
        // Context for the AI to learn from past generations
        previousContext,
        completedPlaybookIds,
        dislikedPlaybookIds,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!daemonRes.ok && daemonRes.status !== 202) {
      const text = await daemonRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Daemon error: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Cannot reach daemon: ${msg}` },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, message: "Playbook generation started" }, { status: 202 });
}
