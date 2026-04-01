import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateAmazonSellerCredentials } from "@/lib/integrations/amazon-seller/auth";

/**
 * Amazon SP-API OAuth callback.
 * Seller Central returns: ?spapi_oauth_code=...&selling_partner_id=...&state=userId
 * Exchange the oauth code for LWA access + refresh tokens using the app's LWA client credentials.
 *
 * Stores:
 *   access_token  = LWA access token (short-lived; re-fetched by sync using refresh_token)
 *   refresh_token = LWA refresh token (long-lived)
 *   account_id    = selling_partner_id (merchant token)
 */
export async function handleAmazonSellerOAuthCallback(
  userId: string,
  oauthCode: string,
  sellingPartnerId: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: oauthCode,
      client_id: process.env.AMAZON_SELLER_CLIENT_ID!,
      client_secret: process.env.AMAZON_SELLER_CLIENT_SECRET!,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.refresh_token) throw new Error("Amazon SP-API token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "amazon-seller",
      access_token: tokenData.access_token ?? "",
      refresh_token: tokenData.refresh_token,
      account_id: sellingPartnerId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "amazon-seller");
}

/**
 * Stores:
 *   access_token  = "clientId:clientSecret" (to re-exchange for LWA tokens)
 *   refresh_token = LWA refresh token
 *   account_id    = sellerId (Merchant Token)
 */
export async function handleAmazonSellerConnect(
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  sellerId: string,
): Promise<void> {
  const { valid, error } = await validateAmazonSellerCredentials(refreshToken, clientId, clientSecret);
  if (!valid) throw new Error(error ?? "Invalid Amazon SP-API credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:       userId,
      platform:      "amazon-seller",
      access_token:  `${clientId}:${clientSecret}`,
      refresh_token: refreshToken,
      account_id:    sellerId,
      connected_at:  new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Amazon Seller integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "amazon-seller");
}
