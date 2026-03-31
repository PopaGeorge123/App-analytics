import { createServiceClient } from "@/lib/supabase/service";

/**
 * Beehiiv API v2
 * GET /v2/publications/{pub_id}/posts — filter by publish_date for posts sent on a date
 * GET /v2/publications/{pub_id}/subscriptions — filter by created date for new subscribers
 *
 * Metrics stored: postsPublished, totalSubscribers, newSubscribers, premiumSubscribers
 */
export async function syncBeehiivDay(
  userId: string,
  apiKey: string,
  publicationId: string,
  date: string,
): Promise<{ postsPublished: number; totalSubscribers: number; newSubscribers: number; premiumSubscribers: number }> {
  const base    = "https://api.beehiiv.com/v2";
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Convert date string to unix timestamps for filtering
  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd   = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  // ── Posts published on this day ───────────────────────────────────────
  let postsPublished = 0;
  try {
    const params = new URLSearchParams({
      status:          "confirmed",
      publish_date_gte: String(dayStart),
      publish_date_lte: String(dayEnd),
      limit:            "100",
    });
    const res = await fetch(`${base}/publications/${publicationId}/posts?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      postsPublished = body?.data?.length ?? 0;
    }
  } catch { /* optional */ }

  // ── Subscriber stats ──────────────────────────────────────────────────
  let totalSubscribers   = 0;
  let newSubscribers     = 0;
  let premiumSubscribers = 0;

  try {
    // Publication stats give total subscriber counts
    const res = await fetch(
      `${base}/publications/${publicationId}?expand[]=stats`,
      { headers },
    );
    if (res.ok) {
      const body = await res.json();
      const stats = body?.data?.stats ?? {};
      totalSubscribers   = stats.total_active_subscriptions ?? 0;
      premiumSubscribers = stats.total_premium_subscriptions ?? 0;
    }
  } catch { /* optional */ }

  try {
    // New subs created today
    const params = new URLSearchParams({
      created_gte: String(dayStart),
      created_lte: String(dayEnd),
      limit:       "1",
    });
    const res = await fetch(
      `${base}/publications/${publicationId}/subscriptions?${params}`,
      { headers },
    );
    if (res.ok) {
      const body = await res.json();
      newSubscribers = body?.total_results ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "beehiiv",
      date,
      data: { postsPublished, totalSubscribers, newSubscribers, premiumSubscribers },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { postsPublished, totalSubscribers, newSubscribers, premiumSubscribers };
}
