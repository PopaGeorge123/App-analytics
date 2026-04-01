import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateConvertKitApiKey } from "@/lib/integrations/convertkit/auth";

/**
 * ConvertKit (Kit) OAuth2 callback — exchanges code for token.
 */
export async function handleConvertKitOAuthCallback(userId: string, code: string): Promise<void> {
  const tokenRes = await fetch("https://app.kit.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.CONVERTKIT_CLIENT_ID!,
      client_secret: process.env.CONVERTKIT_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/convertkit/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("ConvertKit token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "convertkit",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "convertkit");
}

export async function handleConvertKitConnect(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateConvertKitApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid ConvertKit API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "convertkit",
      access_token: apiKey,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save ConvertKit integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "convertkit");
}
