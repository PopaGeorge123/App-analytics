import { createServiceClient } from "@/lib/supabase/service";

/**
 * Amplitude Events Segmentation API v2
 * GET https://amplitude.com/api/2/events/segmentation
 *   ?e={"event_type":"_active"}&start=YYYYMMDD&end=YYYYMMDD&m=totals
 * Basic auth: apiKey:secretKey
 */
export async function syncAmplitudeDay(
  userId: string,
  credentials: string,  // base64 "apiKey:secretKey"
  date: string,
): Promise<{ activeUsers: number; totalEvents: number; newUsers: number }> {
  const headers = { Authorization: `Basic ${credentials}` };
  const dateStr = date.replace(/-/g, "");

  async function fetchMetric(eventType: string, metric: string): Promise<number> {
    const e = JSON.stringify({ event_type: eventType });
    const params = new URLSearchParams({ e, start: dateStr, end: dateStr, m: metric });
    const res = await fetch(`https://amplitude.com/api/2/events/segmentation?${params}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Amplitude ${eventType}: ${err?.error ?? res.status}`);
    }
    const body   = await res.json();
    const series = body.data?.series?.[0] ?? [];
    return series.reduce((a: number, b: number) => a + b, 0);
  }

  const [activeUsers, totalEvents, newUsers] = await Promise.all([
    fetchMetric("_active",    "uniques").catch(() => 0),
    fetchMetric("_active",    "totals").catch(() => 0),
    fetchMetric("_new_user",  "uniques").catch(() => 0),
  ]);

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, provider: "amplitude", date, data: { activeUsers, totalEvents, newUsers } },
    { onConflict: "user_id,provider,date" }
  );

  return { activeUsers, totalEvents, newUsers };
}
