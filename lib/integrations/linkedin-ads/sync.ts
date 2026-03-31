import { createServiceClient } from "@/lib/supabase/service";

/**
 * LinkedIn Ads Analytics API (v202401)
 * GET /rest/adAnalytics
 * Metrics: costInLocalCurrency, impressions, clicks, externalWebsiteConversions
 */
export async function syncLinkedInAdsDay(
  userId: string,
  accessToken: string,
  accountId: string,
  date: string,
): Promise<{ spend: number; impressions: number; clicks: number; conversions: number; ctr: number }> {
  // LinkedIn dateRange uses year/month/day objects
  const [year, month, day] = date.split("-").map(Number);

  const params = new URLSearchParams({
    q:            "analytics",
    pivot:        "ACCOUNT",
    dateRange:    JSON.stringify({ start: { year, month, day }, end: { year, month, day } }),
    timeGranularity: "DAILY",
    accounts:     `urn:li:sponsoredAccount:${accountId}`,
    fields:       "costInLocalCurrency,impressions,clicks,externalWebsiteConversions",
  });

  const res = await fetch(
    `https://api.linkedin.com/rest/adAnalytics?${params}`,
    {
      headers: {
        Authorization:           `Bearer ${accessToken}`,
        "LinkedIn-Version":      "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`LinkedIn Ads sync ${res.status}: ${e?.message ?? res.statusText}`);
  }

  const body = await res.json();
  const elements: Array<{
    costInLocalCurrency?: string;
    impressions?: number;
    clicks?: number;
    externalWebsiteConversions?: number;
  }> = body?.elements ?? [];

  let spend       = 0;
  let impressions = 0;
  let clicks      = 0;
  let conversions = 0;

  for (const el of elements) {
    spend       += parseFloat(el.costInLocalCurrency ?? "0");
    impressions += el.impressions ?? 0;
    clicks      += el.clicks ?? 0;
    conversions += el.externalWebsiteConversions ?? 0;
  }

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "linkedin-ads",
      date,
      data: { spend, impressions, clicks, conversions, ctr },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { spend, impressions, clicks, conversions, ctr };
}
