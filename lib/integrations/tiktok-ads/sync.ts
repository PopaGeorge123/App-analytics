import { createServiceClient } from "@/lib/supabase/service";

/**
 * TikTok Ads Reporting API v1.3
 * GET /open_api/v1.3/report/integrated/get/
 * Header: Access-Token
 * Metrics: spend, impressions, clicks, conversions
 */
export async function syncTikTokAdsDay(
  userId: string,
  accessToken: string,
  advertiserId: string,
  date: string,
): Promise<{ spend: number; impressions: number; clicks: number; conversions: number; ctr: number }> {
  const params = new URLSearchParams({
    advertiser_id:  advertiserId,
    report_type:    "BASIC",
    dimensions:     JSON.stringify(["stat_time_day"]),
    metrics:        JSON.stringify(["spend", "impressions", "clicks", "conversions"]),
    data_level:     "AUCTION_ADVERTISER",
    start_date:     date,
    end_date:       date,
    page_size:      "1",
  });

  const res = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`,
    { headers: { "Access-Token": accessToken } },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`TikTok Ads sync ${res.status}: ${e?.message ?? res.statusText}`);
  }

  const body = await res.json();
  if (body?.code !== 0) throw new Error(`TikTok Ads error: ${body?.message ?? "unknown"}`);

  const rows: Array<{ metrics?: { spend?: string; impressions?: string; clicks?: string; conversions?: string } }> =
    body?.data?.list ?? [];

  let spend       = 0;
  let impressions = 0;
  let clicks      = 0;
  let conversions = 0;

  for (const row of rows) {
    spend       += parseFloat(row.metrics?.spend       ?? "0");
    impressions += parseFloat(row.metrics?.impressions ?? "0");
    clicks      += parseFloat(row.metrics?.clicks      ?? "0");
    conversions += parseFloat(row.metrics?.conversions ?? "0");
  }

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "tiktok-ads",
      date,
      data: { spend, impressions, clicks, conversions, ctr },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, impressions, clicks, conversions, ctr };
}
