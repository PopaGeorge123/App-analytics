import { createServiceClient } from "@/lib/supabase/service";

/**
 * Instagram Business Insights via Facebook Graph API v19.
 *
 * access_token      = long-lived user/page token
 * account_id        = Instagram Business Account ID
 * Metrics: followers, reach, impressions, profileVisits
 *
 * Graph API metrics: follower_count, reach, impressions, profile_views
 * Period: day
 */

interface InsightValue {
  value: number;
  end_time: string;
}

interface InsightMetric {
  name: string;
  values?: InsightValue[];
  value?: number;
}

interface InsightsResponse {
  data: InsightMetric[];
  error?: { message: string };
}

export async function syncInstagramDay(
  userId: string,
  accessToken: string,
  businessAccountId: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();

  let followers     = 0;
  let reach         = 0;
  let impressions   = 0;
  let profileVisits = 0;

  // since / until are Unix timestamps (start/end of day UTC)
  const since = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const until = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  try {
    const params = new URLSearchParams({
      metric:       "follower_count,reach,impressions,profile_views",
      period:       "day",
      since:        String(since),
      until:        String(until),
      access_token: accessToken,
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(businessAccountId)}/insights?${params.toString()}`,
    );

    if (res.ok) {
      const data = (await res.json()) as InsightsResponse;
      for (const metric of data?.data ?? []) {
        // period=day values array; grab the first entry matching our date
        const val =
          metric.value !== undefined
            ? metric.value
            : (metric.values ?? []).find((v) =>
                v.end_time?.startsWith(date),
              )?.value ?? 0;

        switch (metric.name) {
          case "follower_count":  followers     = val; break;
          case "reach":           reach         = val; break;
          case "impressions":     impressions   = val; break;
          case "profile_views":   profileVisits = val; break;
        }
      }
    }
  } catch { /* skip */ }

  const metrics = { followers, reach, impressions, profileVisits };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "instagram", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
