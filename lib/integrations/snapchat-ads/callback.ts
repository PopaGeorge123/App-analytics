import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateSnapchatAdsCredentials } from "@/lib/integrations/snapchat-ads/auth";

export async function handleSnapchatAdsOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://accounts.snapchat.com/login/oauth2/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SNAPCHAT_CLIENT_ID}:${process.env.SNAPCHAT_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/snapchat-ads/callback`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Snapchat Ads token exchange failed");

  // Fetch first ad account ID
  const adAccountRes = await fetch("https://adsapi.snapchat.com/v1/me/organizations", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const adAccountData = await adAccountRes.json();
  const accountId = adAccountData.organizations?.[0]?.organization?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "snapchat-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "snapchat-ads");
}

export async function handleSnapchatAdsConnect(
  userId: string,
  accessToken: string,
  accountId: string,
): Promise<void> {
  const { valid, error } = await validateSnapchatAdsCredentials(accessToken, accountId);
  if (!valid) throw new Error(error ?? "Invalid Snapchat Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "snapchat-ads",
      access_token: accessToken,
      account_id:   accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Snapchat Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "snapchat-ads");
}
