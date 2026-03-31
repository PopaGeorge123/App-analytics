export function getPinterestAdsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.PINTEREST_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/pinterest-ads/callback`,
    response_type: "code",
    scope: "ads:read",
    state: userId,
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

/**
 * Pinterest Ads API v5 — validate via ad account lookup.
 * access_token = OAuth 2.0 Bearer token
 * account_id   = Ad Account ID
 */
export async function validatePinterestAdsCredentials(
  accessToken: string,
  accountId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.pinterest.com/v5/ad_accounts/${encodeURIComponent(accountId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid access token." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Ad account not found. Check your Account ID." };
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { valid: false, error: e?.message ?? `Pinterest Ads returned ${res.status}` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
