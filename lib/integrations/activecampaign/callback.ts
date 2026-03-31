import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateActiveCampaignApiKey } from "@/lib/integrations/activecampaign/auth";

export async function handleActiveCampaignOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://www.activecampaign.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ACTIVECAMPAIGN_CLIENT_ID!,
      client_secret: process.env.ACTIVECAMPAIGN_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/activecampaign/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("ActiveCampaign token exchange failed");

  // Fetch account URL to use as account_id
  const accountUrl = tokenData.account_url ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "activecampaign",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: accountUrl,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "activecampaign");
}

export async function handleActiveCampaignConnect(
  userId: string,
  apiUrl: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateActiveCampaignApiKey(apiUrl, apiKey);
  if (!valid) throw new Error(error ?? "Invalid ActiveCampaign credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "activecampaign",
      access_token: apiKey,
      account_id:   apiUrl.replace(/\/$/, ""),
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save ActiveCampaign integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "activecampaign");
}
