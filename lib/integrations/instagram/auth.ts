export function getInstagramAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
    scope: "instagram_basic,instagram_manage_insights,pages_read_engagement",
    response_type: "code",
    state: userId,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

/**
 * Instagram Business – validate credentials via Facebook Graph API.
 * accessToken = long-lived user/page token
 * businessAccountId = Instagram Business Account ID
 */
export async function validateInstagramCredentials(
  accessToken: string,
  businessAccountId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(businessAccountId)}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    );

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Instagram access token or Business Account ID" };
    }
    const json = (await res.json()) as { error?: { message?: string } };
    if (json.error) {
      return { valid: false, error: json.error.message ?? "Instagram API error" };
    }
    if (!res.ok) {
      return { valid: false, error: `Instagram API error: ${res.status}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to Instagram Graph API" };
  }
}
