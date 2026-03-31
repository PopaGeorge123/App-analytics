import { createServiceClient } from "@/lib/supabase/service";
import { validateYouTubeCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleYouTubeOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("YouTube token exchange failed");

  // Fetch channel id
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  const channelData = await channelRes.json();
  const channelId = channelData.items?.[0]?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "youtube",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: channelId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "youtube");
}

export async function handleYouTubeConnect(userId: string, accessToken: string, channelId: string): Promise<void> {
  const { valid, error } = await validateYouTubeCredentials(accessToken, channelId);
  if (!valid) throw new Error(error ?? "Invalid YouTube credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: userId,
        platform: "youtube",
        access_token: accessToken,
        account_id: channelId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save YouTube integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "youtube");
}
