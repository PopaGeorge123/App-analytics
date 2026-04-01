/**
 * WooCommerce OAuth2 via WordPress.com (Jetpack)
 * Docs: https://developer.wordpress.com/docs/oauth2/
 * App registration: https://developer.wordpress.com/apps/new/
 * The store must have Jetpack connected to WordPress.com.
 * Scope: "auth" grants full API access to the connected WooCommerce store.
 */
export function getWooCommerceAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.WOOCOMMERCE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/woocommerce/callback`,
    response_type: "code",
    scope: "auth",
    state: userId,
  });
  return `https://public-api.wordpress.com/oauth2/authorize?${params.toString()}`;
}

/**
 * WooCommerce REST API v3 — validate via system status endpoint.
 * siteUrl: e.g. "https://mystore.com"
 * consumerKey + consumerSecret: WooCommerce REST API credentials
 */
export async function validateWooCommerceCredentials(
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const base = siteUrl.replace(/\/$/, "");
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const res  = await fetch(`${base}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid WooCommerce credentials." };
    }
    if (!res.ok) return { valid: false, error: `WooCommerce returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
