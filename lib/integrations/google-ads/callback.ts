import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateGoogleAdsCredentials } from "@/lib/integrations/google-ads/auth";

export async function handleGoogleAdsOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-ads/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? "Google Ads token exchange failed");
  }

  // Fetch the list of accessible customers to get the top-level customer ID
  const customerRes = await fetch(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      },
    },
  );
  const customerData = await customerRes.json();
  // Use the first accessible customer resource name, strip to numeric ID
  const resourceName: string = customerData?.resourceNames?.[0] ?? "";
  const customerId = resourceName.replace("customers/", "").replace(/-/g, "");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "google-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: customerId || null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "google-ads");
}

/**
 * Stores Google Ads credentials.
 * access_token  = OAuth access token (long-lived refresh token preferred via OAuth flow;
 *                 for manual entry we store the token provided)
 * refresh_token = developer token (reuse the refresh_token column as storage)
 * account_id    = Google Ads customer ID (digits only, no dashes)
 */
export async function handleGoogleAdsConnect(
  userId: string,
  accessToken: string,
  developerToken: string,
  customerId: string,
): Promise<void> {
  const cid = customerId.replace(/-/g, "");
  const { valid, error } = await validateGoogleAdsCredentials(accessToken, developerToken, cid);
  if (!valid) throw new Error(error ?? "Invalid Google Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:       userId,
      platform:      "google-ads",
      access_token:  accessToken,
      refresh_token: developerToken,
      account_id:    cid,
      connected_at:  new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Google Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "google-ads");
}
