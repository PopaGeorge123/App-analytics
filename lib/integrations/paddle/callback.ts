import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePaddleApiKey } from "@/lib/integrations/paddle/auth";

/**
 * Paddle OAuth2 callback — exchanges code for access token.
 */
export async function handlePaddleOAuthCallback(userId: string, code: string): Promise<void> {
  const tokenRes = await fetch("https://vendors.paddle.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.PADDLE_CLIENT_ID!,
      client_secret: process.env.PADDLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/paddle/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Paddle token exchange failed");

  // Fetch seller info to get account_id
  const sellerRes = await fetch("https://api.paddle.com/businesses?per_page=1", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const sellerData = await sellerRes.json();
  const accountId: string = String(sellerData?.data?.[0]?.id ?? "");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "paddle",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "paddle");
}

/**
 * Save a Paddle API key for a user.
 * Validates the key first, then stores it in the integrations table.
 */
export async function handlePaddleConnect(userId: string, apiKey: string): Promise<void> {
  // Validate the key first
  const { valid, error } = await validatePaddleApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Paddle API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "paddle",
      access_token: apiKey,         // stored as access_token (no OAuth)
      account_id:   "",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Paddle integration: ${dbError.message}`);

  // Fire backfill
  await triggerRemoteBackfill(userId, "paddle");
}
