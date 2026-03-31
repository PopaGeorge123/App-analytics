import { createServiceClient } from "@/lib/supabase/service";
import { validateTwitterCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleTwitterOrganicOAuthCallback(
  userId: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter-organic/callback`,
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Twitter OAuth token exchange failed");

  // Fetch authenticated user id
  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const meData = await meRes.json();
  const twitterUserId = meData.data?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "twitter-organic",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: twitterUserId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "twitter-organic");
}

export async function handleTwitterOrganicConnect(userId: string, bearerToken: string, accountId: string) {
  const { valid, error } = await validateTwitterCredentials(bearerToken, accountId);
  if (!valid) throw new Error(error ?? "Invalid Twitter credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: userId,
        platform: "twitter-organic",
        access_token: bearerToken,
        account_id: accountId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save Twitter integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "twitter-organic");
}
