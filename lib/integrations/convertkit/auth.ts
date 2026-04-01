/**
 * ConvertKit (Kit) API v4 — OAuth2
 * Docs: https://developers.kit.com/v4#authentication
 * App registration: https://app.kit.com/oauth/applications/new
 */
export function getConvertKitAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CONVERTKIT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/convertkit/callback`,
    response_type: "code",
    state: userId,
  });
  return `https://app.kit.com/oauth/authorize?${params.toString()}`;
}

/**
 * ConvertKit (Kit) API v4 — validate via account info.
 * API key stored in access_token.
 */
export async function validateConvertKitApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.convertkit.com/v3/account?api_secret=${encodeURIComponent(apiKey)}`,
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (!res.ok) return { valid: false, error: `ConvertKit returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
