import { createServiceClient } from "@/lib/supabase/service";

/**
 * PostHog Query API — Trends endpoint
 * POST https://app.posthog.com/api/projects/{projectId}/insights/trend/
 * Bearer auth with personal API key.
 */
export async function syncPostHogDay(
  userId: string,
  apiKey: string,
  projectId: string,
  date: string,
): Promise<{ pageviews: number; uniqueUsers: number; sessions: number }> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  async function fetchTrend(eventName: string, math: string): Promise<number> {
    const res = await fetch(
      `https://app.posthog.com/api/projects/${projectId}/insights/trend/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          events: [{ id: eventName, math }],
          date_from: date,
          date_to:   date,
          interval:  "day",
        }),
      },
    );
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`PostHog trend (${eventName}): ${e?.detail ?? res.status}`);
    }
    const body   = await res.json();
    const result = body.result?.[0];
    const series = result?.data ?? [];
    return series.reduce((a: number, b: number) => a + b, 0);
  }

  const [pageviews, uniqueUsers, sessions] = await Promise.all([
    fetchTrend("$pageview", "total").catch(() => 0),
    fetchTrend("$pageview", "dau").catch(() => 0),
    fetchTrend("$autocapture", "total").catch(() => 0),
  ]);

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, provider: "posthog", date, data: { pageviews, uniqueUsers, sessions } },
    { onConflict: "user_id,provider,date" }
  );

  return { pageviews, uniqueUsers, sessions };
}
