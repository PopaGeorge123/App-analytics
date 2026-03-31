export function getLinkedInAdsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin-ads/callback`,
    scope: "r_ads_reporting r_basicprofile",
    state: userId,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * LinkedIn Ads API — validate by fetching ad account info.
 * access_token = OAuth 2.0 Bearer token
 * account_id   = LinkedIn Ad Account URN (numeric portion of urn:li:sponsoredAccount:{id})
 */
export async function validateLinkedInAdsCredentials(
  accessToken: string,
  accountId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.linkedin.com/rest/adAccounts/${encodeURIComponent(accountId)}`,
      {
        headers: {
          Authorization:           `Bearer ${accessToken}`,
          "LinkedIn-Version":      "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid access token or insufficient permissions." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Ad account not found. Check your Account ID." };
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { valid: false, error: e?.message ?? `LinkedIn returned ${res.status}` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
