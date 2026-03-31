import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateSalesforceCredentials } from "@/lib/integrations/salesforce/auth";

export async function handleSalesforceOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/salesforce/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.error_description ?? "Salesforce token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "salesforce",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: tokenData.instance_url ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "salesforce");
}

export async function handleSalesforceConnect(
  userId: string,
  instanceUrl: string,
  accessToken: string,
): Promise<void> {
  const base = instanceUrl.replace(/\/$/, "");
  const { valid, error } = await validateSalesforceCredentials(base, accessToken);
  if (!valid) throw new Error(error ?? "Invalid Salesforce credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "salesforce",
      access_token: accessToken,
      account_id:   base,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Salesforce integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "salesforce");
}
