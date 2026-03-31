export function getBigCommerceAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.BIGCOMMERCE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/bigcommerce/callback`,
    response_type: "code",
    scope: "store_v2_orders_read_only store_v2_products_read_only store_v2_customers_read_only",
    state: userId,
  });
  return `https://login.bigcommerce.com/oauth2/authorize?${params.toString()}`;
}

/**
 * BigCommerce Management API v2/v3 — validate via store info.
 * storeHash: e.g. "abc123" (from store URL: store-abc123.mybigcommerce.com)
 * accessToken: BigCommerce API access token
 */
export async function validateBigCommerceCredentials(
  storeHash: string,
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.bigcommerce.com/stores/${storeHash}/v2/store`,
      {
        headers: {
          "X-Auth-Token": accessToken,
          Accept:         "application/json",
        },
      },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid BigCommerce credentials." };
    }
    if (!res.ok) return { valid: false, error: `BigCommerce returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
