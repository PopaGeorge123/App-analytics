/**
 * Amazon Selling Partner API (SP-API) — OAuth2 via Login with Amazon (LWA).
 * Docs: https://developer-docs.amazon.com/sp-api/docs/authorizing-seller-central-applications
 * App registration: https://sellercentral.amazon.com/apps/develop/applications
 *
 * Flow: redirect to Seller Central → user authorizes → SP-API returns
 *       selling_partner_id + spapi_oauth_code → exchange for LWA tokens.
 */
export function getAmazonSellerAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    application_id: process.env.AMAZON_SELLER_APP_ID!,
    state: userId,
    version: "beta",
  });
  return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}

/**
 * Amazon Selling Partner API (SP-API) — validate via getMarketplaceParticipations.
 * This uses LWA (Login with Amazon) OAuth.
 * refreshToken: LWA refresh token
 * clientId + clientSecret: SP-API application credentials
 * sellerId: Amazon Seller ID (merchant token)
 */
export async function validateAmazonSellerCredentials(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ valid: boolean; accessToken?: string; error?: string }> {
  try {
    // Exchange refresh token for access token
    const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenRes.ok) {
      return { valid: false, error: "Failed to exchange LWA refresh token." };
    }
    const tokenBody = await tokenRes.json();
    const accessToken: string = tokenBody.access_token;
    if (!accessToken) return { valid: false, error: "No access token returned." };
    return { valid: true, accessToken };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
