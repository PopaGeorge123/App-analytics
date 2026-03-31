export function getEtsyAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ETSY_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/etsy/callback`,
    scope: "transactions_r listings_r shops_r",
    state: userId,
    code_challenge_method: "S256",
    code_challenge: "PKCE_PLACEHOLDER",
  });
  return `https://www.etsy.com/oauth/connect?${params.toString()}`;
}

/**
 * Etsy Open API v3 — validate via shop lookup.
 * apiKey: Etsy API key (keystring)
 * shopId: Etsy shop ID or shop name
 */
export async function validateEtsyCredentials(
  apiKey: string,
  shopId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${encodeURIComponent(shopId)}`,
      { headers: { "x-api-key": apiKey } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Etsy API key." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Etsy shop not found." };
    }
    if (!res.ok) return { valid: false, error: `Etsy returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
