import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePinterestAdsCredentials } from "@/lib/integrations/pinterest-ads/auth";

export async function handlePinterestAdsOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/pinterest-ads/callback`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Pinterest Ads token exchange failed");

  // Fetch first ad account
  const adAccountRes = await fetch("https://api.pinterest.com/v5/ad_accounts", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const adAccountData = await adAccountRes.json();
  const accountId = adAccountData.items?.[0]?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "pinterest-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "pinterest-ads");
}

export async function handlePinterestAdsConnect(
  userId: string,
  accessToken: string,
  accountId: string,
): Promise<void> {
  const { valid, error } = await validatePinterestAdsCredentials(accessToken, accountId);
  if (!valid) throw new Error(error ?? "Invalid Pinterest Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "pinterest-ads",
      access_token: accessToken,
      account_id:   accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Pinterest Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "pinterest-ads");
}
