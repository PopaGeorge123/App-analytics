import { createServiceClient } from "@/lib/supabase/service";

/**
 * Fathom Analytics API
 * GET https://api.usefathom.com/v1/aggregations?entity=pageview&entity_id={siteId}
 *   &aggregates=pageviews,uniques,visits,bounce_rate,avg_duration
 *   &date_grouping=day&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * Bearer auth.
 */
export async function syncFathomDay(
  userId: string,
  apiKey: string,
  siteId: string,
  date: string,
): Promise<{ pageviews: number; uniques: number; visits: number; bounceRate: number; avgDuration: number }> {
  const params = new URLSearchParams({
    entity:       "pageview",
    entity_id:    siteId,
    aggregates:   "pageviews,uniques,visits,bounce_rate,avg_duration",
    date_grouping:"day",
    date_from:    date,
    date_to:      date,
  });

  const res = await fetch(`https://api.usefathom.com/v1/aggregations?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Fathom API error ${res.status}: ${e?.detail ?? res.statusText}`);
  }

  const body = await res.json();
  const row  = Array.isArray(body) ? body[0] : body;

  const pageviews   = Number(row?.pageviews   ?? 0);
  const uniques     = Number(row?.uniques      ?? 0);
  const visits      = Number(row?.visits       ?? 0);
  const bounceRate  = Number(row?.bounce_rate  ?? 0);
  const avgDuration = Number(row?.avg_duration ?? 0);

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "fathom",
      date,
      data: { pageviews, uniques, visits, bounceRate, avgDuration },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { pageviews, uniques, visits, bounceRate, avgDuration };
}
