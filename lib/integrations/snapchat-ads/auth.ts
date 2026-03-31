export function getSnapchatAdsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SNAPCHAT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/snapchat-ads/callback`,
    response_type: "code",
    scope: "snapchat-marketing-api",
    state: userId,
  });
  return `https://accounts.snapchat.com/login/oauth2/authorize?${params.toString()}`;
}

/**
 * Snapchat Ads API — validate via ad account lookup.
 * access_token = OAuth 2.0 Bearer token
 * account_id   = Ad Account ID (UUID)
 */
export async function validateSnapchatAdsCredentials(
  accessToken: string,
  accountId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://adsapi.snapchat.com/v1/adaccounts/${encodeURIComponent(accountId)}`,
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
      return { valid: false, error: e?.request_status ?? `Snapchat Ads returned ${res.status}` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
