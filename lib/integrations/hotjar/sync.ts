import { createServiceClient } from "@/lib/supabase/service";

/**
 * Hotjar Trends API – daily snapshot.
 *
 * access_token = accessToken (Bearer)
 * account_id   = siteId
 * Metrics: sessions, recordings, heatmapViews, feedbackResponses
 */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface HotjarDailyStats {
  sessions?: number;
  recordings?: number;
}

export async function syncHotjarDay(
  userId: string,
  accessToken: string,
  siteId: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const headers  = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  let sessions          = 0;
  let recordings        = 0;
  let heatmapViews      = 0;
  let feedbackResponses = 0;

  try {
    // Daily session stats
    const statsRes = await fetch(
      `https://api.hotjar.com/v1/sites/${encodeURIComponent(siteId)}/stats/daily?start_date=${date}&end_date=${date}`,
      { headers },
    );
    await sleep(300);
    if (statsRes.ok) {
      const data = (await statsRes.json()) as { data?: HotjarDailyStats[] };
      for (const d of data?.data ?? []) {
        sessions   += d.sessions   ?? 0;
        recordings += d.recordings ?? 0;
      }
    }
  } catch { /* skip */ }

  try {
    // Heatmap page count
    const hmRes = await fetch(
      `https://api.hotjar.com/v1/sites/${encodeURIComponent(siteId)}/heatmaps?date_from=${date}&date_to=${date}&count=1`,
      { headers },
    );
    await sleep(300);
    if (hmRes.ok) {
      const hmData = (await hmRes.json()) as { total?: number };
      heatmapViews = hmData?.total ?? 0;
    }
  } catch { /* skip */ }

  try {
    // Feedback / NPS responses
    const fbRes = await fetch(
      `https://api.hotjar.com/v1/sites/${encodeURIComponent(siteId)}/feedback?date_from=${date}&date_to=${date}&count=1`,
      { headers },
    );
    await sleep(300);
    if (fbRes.ok) {
      const fbData = (await fbRes.json()) as { total?: number };
      feedbackResponses = fbData?.total ?? 0;
    }
  } catch { /* skip */ }

  const metrics = { sessions, recordings, heatmapViews, feedbackResponses };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "hotjar", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
