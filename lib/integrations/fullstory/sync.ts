import { createServiceClient } from "@/lib/supabase/service";

/**
 * FullStory v2 API – daily snapshot.
 *
 * access_token = apiKey
 * account_id   = orgId
 * Metrics: sessions, pageViews, frustrationSignals, errorClicks
 *
 * Auth: Basic base64(apiKey:)
 */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface FSSessionsResponse {
  sessions?: Array<{
    pageViewCount?: number;
    frustrationSignals?: Array<unknown>;
    errorClickCount?: number;
  }>;
  nextPageToken?: string;
}

export async function syncFullStoryDay(
  userId: string,
  apiKey: string,
  orgId: string,
  date: string,
): Promise<void> {
  const supabase  = createServiceClient();
  const token     = Buffer.from(`${apiKey}:`).toString("base64");
  const headers   = {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
  };

  let sessions           = 0;
  let pageViews          = 0;
  let frustrationSignals = 0;
  let errorClicks        = 0;

  const startTime = new Date(`${date}T00:00:00Z`).toISOString();
  const endTime   = new Date(`${date}T23:59:59Z`).toISOString();

  try {
    let nextPageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        "timeRange.startTime": startTime,
        "timeRange.endTime":   endTime,
        limit: "100",
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      });

      const res = await fetch(
        `https://api.fullstory.com/v2/sessions?${params.toString()}`,
        { headers },
      );
      await sleep(250);
      if (!res.ok) break;

      const data = (await res.json()) as FSSessionsResponse;
      for (const s of data?.sessions ?? []) {
        sessions++;
        pageViews          += s.pageViewCount ?? 0;
        frustrationSignals += s.frustrationSignals?.length ?? 0;
        errorClicks        += s.errorClickCount ?? 0;
      }
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
  } catch { /* skip */ }

  const metrics = { sessions, pageViews, frustrationSignals, errorClicks };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "fullstory", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
