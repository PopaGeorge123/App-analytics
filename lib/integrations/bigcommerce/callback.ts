import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateBigCommerceCredentials } from "@/lib/integrations/bigcommerce/auth";

export async function handleBigCommerceOAuthCallback(
  userId: string,
  code: string,
  storeHash: string,
): Promise<void> {
  const tokenRes = await fetch("https://login.bigcommerce.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.BIGCOMMERCE_CLIENT_ID!,
      client_secret: process.env.BIGCOMMERCE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/bigcommerce/callback`,
      grant_type: "authorization_code",
      code,
      scope: "store_v2_orders_read_only store_v2_products_read_only store_v2_customers_read_only",
      context: `stores/${storeHash}`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("BigCommerce token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "bigcommerce",
      access_token: tokenData.access_token,
      account_id: storeHash,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "bigcommerce");
}

export async function handleBigCommerceConnect(
  userId: string,
  storeHash: string,
  accessToken: string,
): Promise<void> {
  const { valid, error } = await validateBigCommerceCredentials(storeHash, accessToken);
  if (!valid) throw new Error(error ?? "Invalid BigCommerce credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "bigcommerce",
      access_token: accessToken,
      account_id:   storeHash,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save BigCommerce integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "bigcommerce");
}
