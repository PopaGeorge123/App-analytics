import { createServiceClient } from "@/lib/supabase/service";

/**
 * PostHog Query API — Trends endpoint
 * POST https://{host}/api/projects/{projectId}/insights/trend/
 * Auth: Authorization: Bearer <personal_api_key>
 *
 * account_id format: "eu:<projectId>" for EU cloud, "<projectId>" for US cloud
 */
export async function syncPostHogDay(
  userId: string,
  apiKey: string,
  rawAccountId: string,
  date: string,
): Promise<{ pageviews: number; uniqueUsers: number; sessions: number }> {
  // Parse host + project ID from the stored account_id
  let host: string;
  let projectId: string;
  if (rawAccountId.startsWith("eu:")) {
    host = "https://eu.posthog.com";
    projectId = rawAccountId.slice(3);
  } else {
    host = "https://app.posthog.com";
    projectId = rawAccountId;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  async function fetchTrend(eventName: string, math: string): Promise<number> {
    const res = await fetch(
      `${host}/api/projects/${projectId}/insights/trend/`,
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
