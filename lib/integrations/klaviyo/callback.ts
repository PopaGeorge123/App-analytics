import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateKlaviyoApiKey } from "@/lib/integrations/klaviyo/auth";

export async function handleKlaviyoOAuthCallback(
  userId: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  const tokenRes = await fetch("https://a.klaviyo.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KLAVIYO_CLIENT_ID!,
      client_secret: process.env.KLAVIYO_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/klaviyo/callback`,
      code,
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Klaviyo token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "klaviyo",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "klaviyo");
}

export async function handleKlaviyoConnect(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateKlaviyoApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Klaviyo API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "klaviyo",
      access_token: apiKey,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Klaviyo integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "klaviyo");
}
