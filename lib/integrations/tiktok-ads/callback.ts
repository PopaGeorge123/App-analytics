import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateTikTokAdsCredentials } from "@/lib/integrations/tiktok-ads/auth";

export async function handleTikTokAdsOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.TIKTOK_APP_ID!,
      secret: process.env.TIKTOK_APP_SECRET!,
      auth_code: code,
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.data?.access_token;
  const advertiserId = tokenData.data?.advertiser_ids?.[0] ?? "";
  if (!accessToken) throw new Error("TikTok Ads token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "tiktok-ads",
      access_token: accessToken,
      account_id: advertiserId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "tiktok-ads");
}

export async function handleTikTokAdsConnect(
  userId: string,
  accessToken: string,
  advertiserId: string,
): Promise<void> {
  const { valid, error } = await validateTikTokAdsCredentials(accessToken, advertiserId);
  if (!valid) throw new Error(error ?? "Invalid TikTok Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "tiktok-ads",
      access_token: accessToken,
      account_id:   advertiserId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save TikTok Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "tiktok-ads");
}
