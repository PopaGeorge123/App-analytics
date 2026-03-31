import { createServiceClient } from "@/lib/supabase/service";

/**
 * ConvertKit (Kit) API v3
 * GET /v3/subscribers — count total subscribers
 * GET /v3/broadcasts — count broadcasts sent on this day
 *
 * Note: ConvertKit v3 doesn't have per-day aggregate stats for opens/clicks —
 * we use subscriber total + broadcast count as available metrics.
 */
export async function syncConvertKitDay(
  userId: string,
  apiKey: string,
  date: string,
): Promise<{ totalSubscribers: number; broadcastsSent: number; newSubscribers: number }> {
  const base   = "https://api.convertkit.com/v3";
  const secret = `api_secret=${encodeURIComponent(apiKey)}`;

  // ── Total subscribers ────────────────────────────────────────────────
  let totalSubscribers = 0;
  try {
    const res = await fetch(`${base}/subscribers?${secret}&sort_field=created_at&sort_order=desc`);
    if (res.ok) {
      const body = await res.json();
      totalSubscribers = body?.total_subscribers ?? 0;
    }
  } catch { /* optional */ }

  // ── New subscribers on this date ─────────────────────────────────────
  let newSubscribers = 0;
  try {
    const params = new URLSearchParams({
      api_secret:  apiKey,
      from:        date,
      to:          date,
      sort_field:  "created_at",
      sort_order:  "desc",
    });
    const res = await fetch(`${base}/subscribers?${params}`);
    if (res.ok) {
      const body = await res.json();
      newSubscribers = body?.total_subscribers ?? 0;
    }
  } catch { /* optional */ }

  // ── Broadcasts sent on this date ──────────────────────────────────────
  let broadcastsSent = 0;
  try {
    const res = await fetch(`${base}/broadcasts?${secret}`);
    if (res.ok) {
      const body = await res.json();
      const broadcasts: Array<{ published_at?: string; send_date?: string }> = body?.broadcasts ?? [];
      broadcastsSent = broadcasts.filter(b => {
        const sentDate = (b.published_at ?? b.send_date ?? "").slice(0, 10);
        return sentDate === date;
      }).length;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "convertkit",
      date,
      data: { totalSubscribers, broadcastsSent, newSubscribers },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { totalSubscribers, broadcastsSent, newSubscribers };
}
