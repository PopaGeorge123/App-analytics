import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYNC_SECRET  = process.env.SYNC_SECRET ?? "";
const DAEMON_URL   = process.env.SYNC_DAEMON_URL ?? "http://localhost:4242";

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Premium check (same logic as dashboard page) ──────────────────────────
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

  // ── Forward to daemon ─────────────────────────────────────────────────────
  if (!SYNC_SECRET) {
    return NextResponse.json(
      { error: "Daemon not configured (SYNC_SECRET missing)" },
      { status: 503 }
    );
  }

  try {
    const daemonRes = await fetch(`${DAEMON_URL}/playbooks/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SYNC_SECRET}`,
      },
      body: JSON.stringify({ userId: user.id }),
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
