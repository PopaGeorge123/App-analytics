export function getShopifyAuthUrl(userId: string, shop: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    scope: "read_orders,read_products,read_customers",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`,
    state: userId,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Shopify Admin REST API — validate via shop info endpoint.
 * storeDomain: e.g. "mystore.myshopify.com"
 * accessToken: Admin API access token
 */
export async function validateShopifyCredentials(
  storeDomain: string,
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Shopify credentials." };
    }
    if (!res.ok) return { valid: false, error: `Shopify returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
