import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateTwitterAdsCredentials } from "@/lib/integrations/twitter-ads/auth";

export async function handleTwitterAdsOAuthCallback(
  userId: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWITTER_ADS_CLIENT_ID}:${process.env.TWITTER_ADS_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter-ads/callback`,
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? "Twitter Ads token exchange failed");
  }

  // Fetch the authenticated user's Twitter Ads account IDs
  const adsRes = await fetch("https://ads-api.twitter.com/12/accounts", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const adsData = await adsRes.json();
  const accountId: string = adsData?.data?.[0]?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "twitter-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: accountId || null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "twitter-ads");
}

/**
 * Stores Twitter/X Ads credentials.
 * access_token  = bearer token (app-only OAuth 2.0 bearer) or
 *                 "apiKey:apiKeySecret:accessToken:accessTokenSecret" for OAuth 1.0a
 * account_id    = ads account ID
 */
export async function handleTwitterAdsConnect(
  userId: string,
  bearerToken: string,
  accountId: string,
): Promise<void> {
  const { valid, error } = await validateTwitterAdsCredentials(accountId);
  if (!valid) throw new Error(error ?? "Invalid Twitter Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "twitter-ads",
      access_token: bearerToken,
      account_id:   accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Twitter Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "twitter-ads");
}
