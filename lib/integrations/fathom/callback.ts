import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateFathomApiKey } from "@/lib/integrations/fathom/auth";

/**
 * Fathom OAuth2 callback — exchanges code for token, fetches first site ID.
 */
export async function handleFathomOAuthCallback(userId: string, code: string): Promise<void> {
  const tokenRes = await fetch("https://app.usefathom.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.FATHOM_CLIENT_ID!,
      client_secret: process.env.FATHOM_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/fathom/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Fathom token exchange failed");

  // Fetch the first site to use as account_id
  const sitesRes = await fetch("https://api.usefathom.com/v1/sites?limit=1", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const sites = await sitesRes.json();
  const siteId: string = sites?.data?.[0]?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "fathom",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: siteId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "fathom");
}

export async function handleFathomConnect(
  userId: string,
  apiKey: string,
  siteId: string,
): Promise<void> {
  const { valid, error } = await validateFathomApiKey(apiKey, siteId);
  if (!valid) throw new Error(error ?? "Invalid Fathom credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "fathom",
      access_token: apiKey,
      account_id:   siteId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Fathom integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "fathom");
}
