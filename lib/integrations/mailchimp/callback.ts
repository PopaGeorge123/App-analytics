import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateMailchimpApiKey } from "@/lib/integrations/mailchimp/auth";

export async function handleMailchimpOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://login.mailchimp.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MAILCHIMP_CLIENT_ID!,
      client_secret: process.env.MAILCHIMP_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/mailchimp/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Mailchimp token exchange failed");

  const metaRes = await fetch("https://login.mailchimp.com/oauth2/metadata", {
    headers: { Authorization: `OAuth ${tokenData.access_token}` },
  });
  const meta = await metaRes.json();
  const dc: string = meta.dc ?? "us1";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "mailchimp",
      access_token: tokenData.access_token,
      account_id: dc,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "mailchimp");
}

/**
 * Stores Mailchimp credentials.
 * access_token = API key
 * account_id   = datacenter prefix (e.g. "us1")
 */
export async function handleMailchimpConnect(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { valid, dc, error } = await validateMailchimpApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Mailchimp API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "mailchimp",
      access_token: apiKey,
      account_id:   dc ?? "",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Mailchimp integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "mailchimp");
}
