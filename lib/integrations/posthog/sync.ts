import { createServiceClient } from "@/lib/supabase/service";

/**
 * PostHog HogQL Query API (synchronous, modern)
 * POST https://{host}/api/projects/{projectId}/query
 * Auth: Authorization: Bearer <personal_api_key>
 *
 * The legacy /insights/trend/ endpoint creates cached insight objects and
 * can return empty data arrays or async task IDs — causing silent 0s.
 * The HogQL Query API is direct, synchronous, and always returns real counts.
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

  /**
   * Run a HogQL query and return the first row as a number array.
   * The HogQL Query API is synchronous and returns exact counts directly —
   * no caching, no async tasks, no stale-data issues.
   */
  async function hogql(sql: string): Promise<number[]> {
    const res = await fetch(`${host}/api/projects/${projectId}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`PostHog HogQL: ${e?.detail ?? e?.code ?? res.status}`);
    }
    const body = await res.json();
    // results is an array of rows; each row is an array of values
    const row: unknown[] = body.results?.[0] ?? [];
    return row.map((v) => Number(v) || 0);
  }

  // Single query — all three metrics in one round trip.
  // count()                            → total pageview events
  // count(distinct person_id)          → unique visitors (PostHog person identity)
  // count(distinct properties.$session_id) → session count via session property
  let pageviews = 0;
  let uniqueUsers = 0;
  let sessions = 0;

  try {
    const [pv, uu, sess] = await hogql(
      `SELECT
         count()                                    AS pageviews,
         count(distinct person_id)                  AS unique_users,
         count(distinct properties.\`$session_id\`) AS sessions
       FROM events
       WHERE event = '$pageview'
         AND toDate(timestamp) = '${date}'`
    );
    pageviews   = pv   ?? 0;
    uniqueUsers = uu   ?? 0;
    sessions    = sess ?? 0;
  } catch (err) {
    // Re-throw so the caller (syncPostHog / backfillPostHog) can log and skip
    throw new Error(`PostHog sync failed for ${date}: ${(err as Error).message}`);
  }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, provider: "posthog", date, data: { pageviews, uniqueUsers, sessions } },
    { onConflict: "user_id,provider,date" }
  );

  return { pageviews, uniqueUsers, sessions };
}
