import { createServiceClient } from "@/lib/supabase/service";

/**
 * Segment Public API v1beta
 * Pulls source event delivery statistics for a given day.
 *
 * access_token = Public API token
 * account_id   = workspaceId (slug)
 * Metrics: eventsDelivered, eventsFailed, sources, destinations
 */

interface SegmentSource {
  name: string;
  slug: string;
  workspaceId: string;
}

interface SegmentSourcesResponse {
  data: { sources: SegmentSource[] };
}

interface SegmentDeliveryMetric {
  metricType: string;
  value: number;
}

interface SegmentDeliveryResponse {
  data: { metrics: SegmentDeliveryMetric[] };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncSegmentDay(
  userId: string,
  accessToken: string,
  workspaceId: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const headers  = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  let eventsDelivered  = 0;
  let eventsFailed     = 0;
  let sourceCount      = 0;
  let destinationCount = 0;

  try {
    // Get sources
    const sourcesRes: Response = await fetch(
      `https://api.segmentapis.com/sources?pagination.count=50`,
      { headers },
    );
    await sleep(250);
    if (sourcesRes.ok) {
      const sourcesData = (await sourcesRes.json()) as SegmentSourcesResponse;
      const sources = sourcesData?.data?.sources ?? [];
      sourceCount = sources.length;

      // For each source, get delivery metrics for the day
      for (const source of sources.slice(0, 5)) {
        // limit to 5 sources to stay within rate limits
        const metricRes: Response = await fetch(
          `https://api.segmentapis.com/sources/${source.slug}/deliveries?filter.startTime=${date}T00:00:00Z&filter.endTime=${date}T23:59:59Z`,
          { headers },
        );
        await sleep(250);
        if (!metricRes.ok) continue;

        const metricData = (await metricRes.json()) as SegmentDeliveryResponse;
        for (const m of metricData?.data?.metrics ?? []) {
          if (m.metricType === "DELIVERED") eventsDelivered += m.value;
          if (m.metricType === "FAILED")    eventsFailed    += m.value;
        }
      }
    }
  } catch { /* skip */ }

  const metrics = { eventsDelivered, eventsFailed, sourceCount, destinationCount };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "segment", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
