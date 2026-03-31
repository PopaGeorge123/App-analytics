import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateFreshdeskCredentials } from "@/lib/integrations/freshdesk/auth";

export async function handleFreshdeskOAuthCallback(
  userId: string,
  code: string,
  subdomain: string,
): Promise<void> {
  const tokenRes = await fetch(`https://${subdomain}.freshdesk.com/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.FRESHDESK_CLIENT_ID!,
      client_secret: process.env.FRESHDESK_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/freshdesk/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Freshdesk token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "freshdesk",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: subdomain,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "freshdesk");
}

/**
 * access_token = apiKey
 * account_id   = subdomain
 */
export async function handleFreshdeskConnect(
  userId: string,
  subdomain: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateFreshdeskCredentials(subdomain, apiKey);
  if (!valid) throw new Error(error ?? "Invalid Freshdesk credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "freshdesk",
      access_token: apiKey,
      account_id:   subdomain,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (dbError) throw new Error(`Failed to save Freshdesk integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "freshdesk");
}
