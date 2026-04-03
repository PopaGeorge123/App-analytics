/**
 * Google Ads API — OAuth2 via Google.
 * Uses the same Google OAuth app as GA4 but requests the ads-specific scope.
 *
 * Stored columns:
 *   access_token  = OAuth access token (short-lived, auto-refreshed on 401)
 *   refresh_token = OAuth refresh token (long-lived, used to renew access_token)
 *   account_id    = Google Ads customer ID (digits only, no dashes)
 *
 * Developer token is a server-side app credential stored in GOOGLE_ADS_DEVELOPER_TOKEN env var —
 * it is NOT stored per-user in the database.
 */
export function getGoogleAdsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-ads/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Google Ads API — validate by calling a minimal GAQL query.
 * Developer token comes from the server env var, not from user input.
 */
export async function validateGoogleAdsToken(
  accessToken: string,
  customerId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const cid = customerId.replace(/-/g, "");
    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization:       `Bearer ${accessToken}`,
          "developer-token":   process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          "login-customer-id": cid,
          "Content-Type":      "application/json",
        },
        body: JSON.stringify({ query: "SELECT customer.id FROM customer LIMIT 1" }),
      },
    );
    if (res.status === 401) return { valid: false, error: "Access token is invalid or expired." };
    if (res.status === 403) return { valid: false, error: "Insufficient permissions. Ensure the Google account has access to this Ads account." };
    if (res.status === 404) return { valid: false, error: "Customer ID not found. Check the ID in your Google Ads dashboard." };
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { valid: false, error: e?.error?.message ?? `Google Ads returned ${res.status}` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
