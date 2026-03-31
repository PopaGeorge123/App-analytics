import { createServiceClient } from "@/lib/supabase/service";

/**
 * Heap Analytics – daily snapshot via Heap REST API.
 *
 * access_token = "appId:apiKey"
 * account_id   = appId
 * Metrics: sessions, uniqueUsers, pageViews, events
 *
 * Heap's REST API is limited; we use the Events API v0
 * to fetch aggregated stats where available.
 */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncHeapDay(
  userId: string,
  credentials: string,
  _appId: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const [appId, apiKey] = credentials.split(/:(.+)/);
  const token = Buffer.from(`${appId}:${apiKey}`).toString("base64");
  const headers = {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let sessions     = 0;
  let uniqueUsers  = 0;
  let pageViews    = 0;
  let events       = 0;

  const startTime = `${date}T00:00:00.000Z`;
  const endTime   = `${date}T23:59:59.999Z`;

  try {
    // Heap v0 chart data endpoint (returns aggregated metrics)
    const body = {
      app_id: appId,
      time_period: "custom",
      start_time: startTime,
      end_time: endTime,
      event_filters: [],
    };

    const sessionRes = await fetch(`https://heapanalytics.com/api/v0/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, breakdown: null }),
    });
    await sleep(300);

    if (sessionRes.ok) {
      const data = (await sessionRes.json()) as { results?: Array<{ count?: number; users?: number }> };
      for (const r of data?.results ?? []) {
        sessions    += r.count ?? 0;
        uniqueUsers += r.users ?? 0;
      }
    }
  } catch { /* skip */ }

  try {
    // Page views
    const pvRes = await fetch(`https://heapanalytics.com/api/v0/page_views`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app_id: appId,
        start_time: startTime,
        end_time: endTime,
      }),
    });
    await sleep(300);
    if (pvRes.ok) {
      const pvData = (await pvRes.json()) as { results?: Array<{ count?: number }> };
      for (const r of pvData?.results ?? []) {
        pageViews += r.count ?? 0;
      }
    }
  } catch { /* skip */ }

  try {
    // Custom events
    const evRes = await fetch(`https://heapanalytics.com/api/v0/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app_id: appId,
        start_time: startTime,
        end_time: endTime,
      }),
    });
    await sleep(300);
    if (evRes.ok) {
      const evData = (await evRes.json()) as { results?: Array<{ count?: number }> };
      for (const r of evData?.results ?? []) {
        events += r.count ?? 0;
      }
    }
  } catch { /* skip */ }

  const metrics = { sessions, uniqueUsers, pageViews, events };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "heap", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
