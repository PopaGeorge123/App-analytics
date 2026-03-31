import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateShopifyCredentials } from "@/lib/integrations/shopify/auth";

export async function handleShopifyOAuthCallback(
  userId: string,
  shop: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Shopify token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "shopify",
      access_token: tokenData.access_token,
      account_id: shop,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "shopify");
}

export async function handleShopifyConnect(
  userId: string,
  storeDomain: string,
  accessToken: string,
): Promise<void> {
  const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const { valid, error } = await validateShopifyCredentials(domain, accessToken);
  if (!valid) throw new Error(error ?? "Invalid Shopify credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "shopify",
      access_token: accessToken,
      account_id:   domain,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Shopify integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "shopify");
}
