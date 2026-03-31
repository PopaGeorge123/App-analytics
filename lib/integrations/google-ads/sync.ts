import { createServiceClient } from "@/lib/supabase/service";

/**
 * Google Ads Reporting — GAQL query via googleAds:search.
 * Fetches cost, clicks, impressions, conversions for the given date.
 *
 * Credentials stored as:
 *   access_token  = OAuth access token
 *   refresh_token = developer token
 *   account_id    = customer ID (digits only)
 */
export async function syncGoogleAdsDay(
  userId: string,
  accessToken: string,
  developerToken: string,
  customerId: string,
  date: string,
): Promise<{ spend: number; clicks: number; impressions: number; conversions: number; ctr: number }> {
  const query = `
    SELECT
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM customer
    WHERE segments.date = '${date}'
  `.trim();

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization:    `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type":   "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Google Ads sync error ${res.status}: ${e?.error?.message ?? res.statusText}`);
  }

  const body = await res.json();
  const rows: Array<{ metrics?: { cost_micros?: number; clicks?: number; impressions?: number; conversions?: number } }> = body.results ?? [];

  let costMicros   = 0;
  let clicks       = 0;
  let impressions  = 0;
  let conversions  = 0;

  for (const row of rows) {
    costMicros  += Number(row.metrics?.cost_micros  ?? 0);
    clicks      += Number(row.metrics?.clicks       ?? 0);
    impressions += Number(row.metrics?.impressions  ?? 0);
    conversions += Number(row.metrics?.conversions  ?? 0);
  }

  const spend = costMicros / 1_000_000; // micros → dollars
  const ctr   = impressions > 0 ? (clicks / impressions) * 100 : 0;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "google-ads",
      date,
      data: { spend, clicks, impressions, conversions, ctr },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, clicks, impressions, conversions, ctr };
}
