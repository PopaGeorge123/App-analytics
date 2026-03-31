/**
 * Google Ads API — OAuth2 via Google.
 * Uses the same Google OAuth app as GA4 but requests the ads-specific scope.
 * account_id stores the customer_id (without dashes).
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
 * Google Ads API — validate by calling Customer list endpoint.
 * Uses developer token + OAuth access token (manager account access).
 * account_id stores the customer_id (without dashes).
 */
export async function validateGoogleAdsCredentials(
  accessToken: string,
  developerToken: string,
  customerId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Strip dashes from customer ID
    const cid = customerId.replace(/-/g, "");
    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization:    `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type":   "application/json",
        },
        body: JSON.stringify({ query: "SELECT customer.id FROM customer LIMIT 1" }),
      },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid credentials or insufficient permissions." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Customer ID not found." };
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { valid: false, error: e?.error?.message ?? `Google Ads returned ${res.status}` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
