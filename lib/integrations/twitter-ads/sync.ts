import { createServiceClient } from "@/lib/supabase/service";

/**
 * Twitter/X Ads Analytics API v12
 * GET /12/stats/accounts/{account_id}/reach/accounts
 * Bearer token (OAuth 2.0 app-only).
 * Fetches: billed_charge_local_micro, impressions, clicks, conversions for the day.
 */
export async function syncTwitterAdsDay(
  userId: string,
  bearerToken: string,
  accountId: string,
  date: string,
): Promise<{ spend: number; impressions: number; clicks: number; conversions: number }> {
  const startTime = `${date}T00:00:00Z`;
  const endTime   = `${date}T23:59:59Z`;

  const params = new URLSearchParams({
    metric_groups:     "BILLING,ENGAGEMENT",
    start_time:        startTime,
    end_time:          endTime,
    granularity:       "DAY",
    placement:         "ALL_ON_TWITTER",
  });

  const res = await fetch(
    `https://ads-api.twitter.com/12/stats/accounts/${accountId}?${params}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Twitter Ads sync ${res.status}: ${e?.errors?.[0]?.message ?? res.statusText}`);
  }

  const body = await res.json();
  const metrics = body?.data?.[0]?.id_data?.[0]?.metrics ?? {};

  const billedMicros = (metrics.billed_charge_local_micro as number[])?.[0] ?? 0;
  const impressions  = (metrics.impressions as number[])?.[0] ?? 0;
  const clicks       = (metrics.clicks as number[])?.[0] ?? 0;
  const conversions  = (metrics.conversion_custom as number[])?.[0] ?? 0;

  const spend = billedMicros / 1_000_000;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "twitter-ads",
      date,
      data: { spend, impressions, clicks, conversions },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, impressions, clicks, conversions };
}
