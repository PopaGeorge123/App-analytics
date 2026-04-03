import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateGoogleAdsToken } from "@/lib/integrations/google-ads/auth";

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

  if (!customerId) {
    throw new Error("No Google Ads accounts found for this Google account. Please ensure you have at least one active Ads account.");
  }

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "google-ads",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: customerId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  await triggerRemoteBackfill(userId, "google-ads");
}

/**
 * Stores Google Ads credentials entered manually.
 * access_token  = OAuth access token
 * refresh_token = OAuth refresh token (null for manual entry — token won't auto-refresh)
 * account_id    = Google Ads customer ID (digits only, no dashes)
 *
 * Developer token is a server-side app credential from GOOGLE_ADS_DEVELOPER_TOKEN env var.
 */
export async function handleGoogleAdsConnect(
  userId: string,
  accessToken: string,
  customerId: string,
): Promise<void> {
  const cid = customerId.replace(/-/g, "");
  const { valid, error } = await validateGoogleAdsToken(accessToken, cid);
  if (!valid) throw new Error(error ?? "Invalid Google Ads credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:       userId,
      platform:      "google-ads",
      access_token:  accessToken,
      refresh_token: null,   // no refresh token on manual entry; use OAuth flow for long-lived access
      account_id:    cid,
      connected_at:  new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Google Ads integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "google-ads");
}
