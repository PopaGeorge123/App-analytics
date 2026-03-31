export function getKlaviyoAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.KLAVIYO_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/klaviyo/callback`,
    scope: "campaigns:read metrics:read accounts:read",
    state: userId,
    code_challenge_method: "S256",
    code_challenge: "PKCE_PLACEHOLDER",
  });
  return `https://www.klaviyo.com/oauth/authorize?${params.toString()}`;
}

/**
 * Klaviyo API v2024-02-15 — validate via account info.
 * Klaviyo private API key format: pk_xxxxx
 */
export async function validateKlaviyoApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://a.klaviyo.com/api/accounts/", {
      headers: {
        Authorization:   `Klaviyo-API-Key ${apiKey}`,
        revision:        "2024-02-15",
        Accept:          "application/json",
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (!res.ok) return { valid: false, error: `Klaviyo returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
