import { createServiceClient } from "@/lib/supabase/service";

/**
 * Snapchat Ads Reporting API v1
 * GET /v1/adaccounts/{id}/stats
 * Metrics: impressions, swipes, spend
 */
export async function syncSnapchatAdsDay(
  userId: string,
  accessToken: string,
  accountId: string,
  date: string,
): Promise<{ spend: number; impressions: number; swipes: number; conversions: number }> {
  const startTime = `${date}T00:00:00.000-0000`;
  const endTime   = `${date}T23:59:59.000-0000`;

  const params = new URLSearchParams({
    granularity: "DAY",
    fields:      "impressions,swipes,spend,conversions",
    start_time:  startTime,
    end_time:    endTime,
  });

  const res = await fetch(
    `https://adsapi.snapchat.com/v1/adaccounts/${accountId}/stats?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Snapchat Ads sync ${res.status}: ${e?.request_status ?? res.statusText}`);
  }

  const body = await res.json();
  const timeseries: Array<{ stats?: { impressions?: number; swipes?: number; spend?: number; conversions?: number } }> =
    body?.total_stats?.[0]?.total_stat?.timeseries ?? [];

  let spend       = 0;
  let impressions = 0;
  let swipes      = 0;
  let conversions = 0;

  for (const t of timeseries) {
    spend       += (t.stats?.spend       ?? 0) / 1_000_000; // micro-currency
    impressions += t.stats?.impressions ?? 0;
    swipes      += t.stats?.swipes      ?? 0;
    conversions += t.stats?.conversions ?? 0;
  }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "snapchat-ads",
      date,
      data: { spend, impressions, swipes, conversions },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, impressions, swipes, conversions };
}
