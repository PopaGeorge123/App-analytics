import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateIntercomAccessToken } from "@/lib/integrations/intercom/auth";

export async function handleIntercomOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.intercom.io/auth/eagle/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.INTERCOM_CLIENT_ID!,
      client_secret: process.env.INTERCOM_CLIENT_SECRET!,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.message ?? "Intercom token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "intercom",
      access_token: tokenData.access_token,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "intercom");
}

export async function handleIntercomConnect(
  userId: string,
  accessToken: string,
): Promise<void> {
  const { valid, error } = await validateIntercomAccessToken(accessToken);
  if (!valid) throw new Error(error ?? "Invalid Intercom access token");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "intercom",
      access_token: accessToken,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (dbError) throw new Error(`Failed to save Intercom integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "intercom");
}
