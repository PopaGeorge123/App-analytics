import { createServiceClient } from "@/lib/supabase/service";

/**
 * Klaviyo Metrics API (v2024-02-15)
 * GET /api/metrics/ — list all metrics
 * GET /api/metric-aggregates — aggregate by date
 *
 * We aggregate: Active on Site (sessions proxy), Received Email, Opened Email,
 * Clicked Email, Placed Order (revenue).
 */
export async function syncKlaviyoDay(
  userId: string,
  apiKey: string,
  date: string,
): Promise<{ emailsSent: number; opens: number; clicks: number; revenue: number; activeProfiles: number }> {
  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision:      "2024-02-15",
    Accept:        "application/json",
    "Content-Type": "application/json",
  };

  const dateStart = `${date}T00:00:00+00:00`;
  const dateEnd   = `${date}T23:59:59+00:00`;

  async function fetchAggregate(metricName: string, measurement: string): Promise<number> {
    // First find the metric ID
    const listRes = await fetch(
      `https://a.klaviyo.com/api/metrics/?filter=equals(name,"${encodeURIComponent(metricName)}")`,
      { headers },
    );
    if (!listRes.ok) return 0;
    const listBody = await listRes.json();
    const metricId: string = listBody?.data?.[0]?.id;
    if (!metricId) return 0;

    const body = {
      data: {
        type: "metric-aggregate",
        attributes: {
          metric_id:    metricId,
          measurements: [measurement],
          interval:     "day",
          page_size:    1,
          filter:       [`greater-or-equal(datetime,${dateStart})`, `less-than(datetime,${dateEnd})`],
          timezone:     "UTC",
        },
      },
    };

    const aggRes = await fetch("https://a.klaviyo.com/api/metric-aggregates/", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!aggRes.ok) return 0;
    const aggBody = await aggRes.json();
    const values: number[] = aggBody?.data?.attributes?.values?.[0] ?? [];
    return values.reduce((a: number, b: number) => a + b, 0);
  }

  const [emailsSent, opens, clicks, revenue] = await Promise.all([
    fetchAggregate("Received Email",  "count").catch(() => 0),
    fetchAggregate("Opened Email",    "count").catch(() => 0),
    fetchAggregate("Clicked Email",   "count").catch(() => 0),
    fetchAggregate("Placed Order",    "sum_value").catch(() => 0),
  ]);

  // Active profiles (unique people who triggered any event today)
  const activeProfiles = 0; // Not available from aggregates directly; leave as 0

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "klaviyo",
      date,
      data: { emailsSent, opens, clicks, revenue, activeProfiles },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { emailsSent, opens, clicks, revenue, activeProfiles };
}
