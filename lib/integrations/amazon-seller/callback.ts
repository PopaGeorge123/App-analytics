import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateAmazonSellerCredentials } from "@/lib/integrations/amazon-seller/auth";

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
