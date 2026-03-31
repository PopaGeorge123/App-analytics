import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateHubSpotAccessToken } from "@/lib/integrations/hubspot/auth";

export async function handleHubSpotOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.message ?? "HubSpot token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "hubspot",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "hubspot");
}

export async function handleHubSpotConnect(
  userId: string,
  accessToken: string,
): Promise<void> {
  const { valid, error } = await validateHubSpotAccessToken(accessToken);
  if (!valid) throw new Error(error ?? "Invalid HubSpot access token");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "hubspot",
      access_token: accessToken,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save HubSpot integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "hubspot");
}
