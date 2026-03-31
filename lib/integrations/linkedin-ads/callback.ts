import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateLinkedInAdsCredentials } from "@/lib/integrations/linkedin-ads/auth";

export async function handleLinkedInAdsOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin-ads/callback`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("LinkedIn token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "linkedin-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "linkedin-ads");
}

export async function handleLinkedInAdsConnect(
  userId: string,
  accessToken: string,
  accountId: string,
): Promise<void> {
  const { valid, error } = await validateLinkedInAdsCredentials(accessToken, accountId);
  if (!valid) throw new Error(error ?? "Invalid LinkedIn Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "linkedin-ads",
      access_token: accessToken,
      account_id:   accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save LinkedIn Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "linkedin-ads");
}
