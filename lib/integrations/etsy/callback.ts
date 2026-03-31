import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateEtsyCredentials } from "@/lib/integrations/etsy/auth";

export async function handleEtsyOAuthCallback(
  userId: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ETSY_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/etsy/callback`,
      code,
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Etsy token exchange failed");

  // Fetch shop info to get shopId
  const shopRes = await fetch("https://api.etsy.com/v3/application/users/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "x-api-key": process.env.ETSY_CLIENT_ID!,
    },
  });
  const shopData = await shopRes.json();
  const shopId = String(shopData.shop_id ?? "");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "etsy",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: shopId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "etsy");
}

export async function handleEtsyConnect(
  userId: string,
  apiKey: string,
  shopId: string,
): Promise<void> {
  const { valid, error } = await validateEtsyCredentials(apiKey, shopId);
  if (!valid) throw new Error(error ?? "Invalid Etsy credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "etsy",
      access_token: apiKey,
      account_id:   shopId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Etsy integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "etsy");
}
