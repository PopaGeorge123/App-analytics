import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pinterest Ads Analytics API v5
 * GET /v5/ad_accounts/{id}/analytics
 * Metrics: SPEND_IN_DOLLAR, IMPRESSION_1, CLICK_TYPE_URL, TOTAL_CONVERSIONS
 */
export async function syncPinterestAdsDay(
  userId: string,
  accessToken: string,
  accountId: string,
  date: string,
): Promise<{ spend: number; impressions: number; clicks: number; conversions: number }> {
  const params = new URLSearchParams({
    start_date:  date,
    end_date:    date,
    columns:     "SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_TYPE_URL,TOTAL_CONVERSIONS",
    granularity: "DAY",
  });

  const res = await fetch(
    `https://api.pinterest.com/v5/ad_accounts/${accountId}/analytics?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Pinterest Ads sync ${res.status}: ${e?.message ?? res.statusText}`);
  }

  const body = await res.json();
  const rows: Array<{ metrics?: Record<string, number> }> = body?.value ?? body ?? [];

  let spend       = 0;
  let impressions = 0;
  let clicks      = 0;
  let conversions = 0;

  for (const row of rows) {
    spend       += row.metrics?.SPEND_IN_DOLLAR    ?? 0;
    impressions += row.metrics?.IMPRESSION_1       ?? 0;
    clicks      += row.metrics?.CLICK_TYPE_URL     ?? 0;
    conversions += row.metrics?.TOTAL_CONVERSIONS  ?? 0;
  }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "pinterest-ads",
      date,
      data: { spend, impressions, clicks, conversions },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, impressions, clicks, conversions };
}
