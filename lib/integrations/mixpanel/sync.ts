import { createServiceClient } from "@/lib/supabase/service";

/**
 * Mixpanel Annotations / Insights API (JQL-free).
 * Uses the /api/2.0/insights endpoint via service account basic auth.
 * We use the "segmentation" endpoint to get event counts per day.
 *
 * GET https://mixpanel.com/api/query/segmentation
 *   ?project_id=...&event=...&from_date=...&to_date=...&unit=day
 * Returns: { data: { values: { "EventName": { "YYYY-MM-DD": count } } } }
 */
export async function syncMixpanelDay(
  userId: string,
  credentials: string,   // base64 "user:secret"
  projectId: string,
  date: string,
): Promise<{ events: number; uniqueUsers: number }> {
  const headers = { Authorization: `Basic ${credentials}` };

  // Fetch total events (all events) for the day
  const params = new URLSearchParams({
    project_id: projectId,
    event:      '["$overall"]',
    from_date:  date,
    to_date:    date,
    unit:       "day",
    type:       "general",
  });

  const res = await fetch(`https://mixpanel.com/api/query/segmentation?${params}`, { headers });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Mixpanel segmentation: ${e?.error ?? res.status}`);
  }

  const body        = await res.json();
  const series      = body.data?.series ?? [];
  const values      = body.data?.values ?? {};

  // Sum all event counts for the date
  let events = 0;
  for (const eventName of Object.keys(values)) {
    const dayData = values[eventName];
    events += dayData?.[date] ?? 0;
  }

  // Unique users: use "unique" type query
  const uniqueParams = new URLSearchParams({
    project_id: projectId,
    event:      '["$overall"]',
    from_date:  date,
    to_date:    date,
    unit:       "day",
    type:       "unique",
  });

  let uniqueUsers = 0;
  try {
    const uniqueRes = await fetch(`https://mixpanel.com/api/query/segmentation?${uniqueParams}`, { headers });
    if (uniqueRes.ok) {
      const uniqueBody = await uniqueRes.json();
      const uniqueValues = uniqueBody.data?.values ?? {};
      for (const eventName of Object.keys(uniqueValues)) {
        uniqueUsers += uniqueValues[eventName]?.[date] ?? 0;
      }
    }
  } catch { /* optional */ }

  void series; // not used directly

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, provider: "mixpanel", date, data: { events, uniqueUsers } },
    { onConflict: "user_id,provider,date" }
  );

  return { events, uniqueUsers };
}
