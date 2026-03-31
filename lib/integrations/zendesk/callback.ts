import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateZendeskCredentials } from "@/lib/integrations/zendesk/auth";

export async function handleZendeskOAuthCallback(
  userId: string,
  code: string,
  subdomain: string,
): Promise<void> {
  const tokenRes = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: process.env.ZENDESK_CLIENT_ID!,
      client_secret: process.env.ZENDESK_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zendesk/callback`,
      scope: "read",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Zendesk token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "zendesk",
      access_token: tokenData.access_token,
      account_id: subdomain,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "zendesk");
}

/**
 * Stores zendesk integration.
 * access_token = "email/token:apiToken" encoded in base64 (Basic auth)
 * account_id   = subdomain (e.g. "mycompany")
 */
export async function handleZendeskConnect(
  userId: string,
  subdomain: string,
  email: string,
  apiToken: string,
): Promise<void> {
  const { valid, error } = await validateZendeskCredentials(subdomain, email, apiToken);
  if (!valid) throw new Error(error ?? "Invalid Zendesk credentials");

  const credentials = `${email}:${apiToken}`;

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "zendesk",
      access_token: credentials,
      account_id:   subdomain,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (dbError) throw new Error(`Failed to save Zendesk integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "zendesk");
}
