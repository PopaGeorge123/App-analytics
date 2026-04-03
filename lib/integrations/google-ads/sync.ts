import { createServiceClient } from "@/lib/supabase/service";

/**
 * Refreshes a Google OAuth access token using the stored refresh token.
 * Returns a new access token, and persists it back to the integrations table.
 */
async function refreshGoogleAccessToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  // Persist the new access token
  const supabase = createServiceClient();
  await supabase
    .from("integrations")
    .update({ access_token: data.access_token })
    .eq("user_id", userId)
    .eq("platform", "google-ads");
  return data.access_token as string;
}

/**
 * Google Ads Reporting — GAQL query via googleAds:search.
 * Fetches cost, clicks, impressions, conversions for the given date.
 *
 * Credentials stored as:
 *   access_token  = OAuth access token (auto-refreshed if expired)
 *   refresh_token = OAuth refresh token (used to renew access_token)
 *   account_id    = customer ID (digits only, no dashes)
 *
 * Note: if account_id is a Manager Account (MCC), the login-customer-id header
 * is set to the same value so the API can route through the hierarchy correctly.
 */
export async function syncGoogleAdsDay(
  userId: string,
  accessToken: string,
  refreshToken: string,
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

  const doRequest = async (token: string) =>
    fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization:        `Bearer ${token}`,
          "developer-token":    process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          "login-customer-id":  customerId, // needed when customer is under an MCC
          "Content-Type":       "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );

  let res = await doRequest(accessToken);

  // If access token has expired (401), refresh and retry once
  if (res.status === 401 && refreshToken) {
    const newToken = await refreshGoogleAccessToken(userId, refreshToken);
    res = await doRequest(newToken);
  }

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
