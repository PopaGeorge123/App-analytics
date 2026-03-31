import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateGumroadApiKey } from "@/lib/integrations/gumroad/auth";

export async function handleGumroadOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://api.gumroad.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.GUMROAD_CLIENT_ID!,
      client_secret: process.env.GUMROAD_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gumroad/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.message ?? "Gumroad token exchange failed");
  }

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "gumroad",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "gumroad");
}

export async function handleGumroadConnect(userId: string, apiKey: string): Promise<void> {
  const { valid, error } = await validateGumroadApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Gumroad API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "gumroad",
      access_token: apiKey,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Gumroad integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "gumroad");
}
