import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "";
const DAEMON_URL  = process.env.SYNC_DAEMON_URL ?? "http://localhost:4242";

export async function POST() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SYNC_SECRET) {
    return NextResponse.json(
      { error: "Sync daemon not configured (SYNC_SECRET missing)" },
      { status: 503 }
    );
  }

  // ── Look up which platforms this user has connected ────────────────────────
  const db = createServiceClient();
  const { data: integrations } = await db
    .from("integrations")
    .select("platform")
    .eq("user_id", user.id);

  const platforms: string[] = (integrations ?? []).map((r: { platform: string }) => r.platform);

  if (platforms.length === 0) {
    return NextResponse.json({ ok: true, message: "No connected integrations" }, { status: 200 });
  }

  // ── Fire one trigger per platform (daemon requires userId + platform) ──────
  const errors: string[] = [];
  await Promise.all(
    platforms.map(async (platform) => {
      try {
        const res = await fetch(`${DAEMON_URL}/sync-today`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SYNC_SECRET}`,
          },
          body: JSON.stringify({ userId: user.id, platform }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok && res.status !== 202) {
          const text = await res.text().catch(() => "");
          errors.push(`${platform}: ${text.slice(0, 120)}`);
        }
      } catch (err: unknown) {
        errors.push(`${platform}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  if (errors.length === platforms.length) {
    // All failed
    return NextResponse.json({ error: `Daemon errors: ${errors.join("; ")}` }, { status: 502 });
  }

  return NextResponse.json(
    { ok: true, synced: platforms.length - errors.length, failed: errors.length },
    { status: 202 }
  );
}
