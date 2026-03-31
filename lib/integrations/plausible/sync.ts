import { createServiceClient } from "@/lib/supabase/service";

/**
 * Plausible Stats API v1
 * GET /api/v1/stats/aggregate?site_id=...&period=custom&date=YYYY-MM-DD,YYYY-MM-DD&metrics=visitors,pageviews,bounce_rate,visit_duration
 */
export async function syncPlausibleDay(
  userId: string,
  apiKey: string,
  siteId: string,
  date: string,
): Promise<{ visitors: number; pageviews: number; bounceRate: number; visitDuration: number }> {
  const params = new URLSearchParams({
    site_id: siteId,
    period:  "custom",
    date:    `${date},${date}`,
    metrics: "visitors,pageviews,bounce_rate,visit_duration",
  });

  const res = await fetch(`https://plausible.io/api/v1/stats/aggregate?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Plausible stats: ${e?.error ?? res.status}`);
  }

  const body         = await res.json();
  const results      = body.results ?? {};
  const visitors     = results.visitors?.value     ?? 0;
  const pageviews    = results.pageviews?.value    ?? 0;
  const bounceRate   = results.bounce_rate?.value  ?? 0;
  const visitDuration = results.visit_duration?.value ?? 0;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "plausible",
      date,
      data:     { visitors, pageviews, bounceRate, visitDuration },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { visitors, pageviews, bounceRate, visitDuration };
}
