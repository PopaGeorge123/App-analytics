import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateWooCommerceCredentials } from "@/lib/integrations/woocommerce/auth";

/**
 * WooCommerce OAuth2 callback via WordPress.com.
 * access_token = WordPress.com OAuth token (used with wp-json/wc/v3 via Jetpack).
 * account_id   = WordPress.com blog ID / site URL.
 */
export async function handleWooCommerceOAuthCallback(userId: string, code: string): Promise<void> {
  const tokenRes = await fetch("https://public-api.wordpress.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.WOOCOMMERCE_CLIENT_ID!,
      client_secret: process.env.WOOCOMMERCE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/woocommerce/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("WooCommerce token exchange failed");

  // blog_id is the WordPress.com site identifier
  const blogId: string = String(tokenData.blog_id ?? "");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "woocommerce",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      account_id: blogId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "woocommerce");
}

export async function handleWooCommerceConnect(
  userId: string,
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<void> {
  const base = siteUrl.replace(/\/$/, "");
  const { valid, error } = await validateWooCommerceCredentials(base, consumerKey, consumerSecret);
  if (!valid) throw new Error(error ?? "Invalid WooCommerce credentials");

  // Fetch shop currency from WooCommerce settings
  let currency = "USD";
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const settingsRes = await fetch(`${base}/wp-json/wc/v3/settings/general`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (settingsRes.ok) {
      const settings: { id: string; value: string }[] = await settingsRes.json();
      const woofiCurrency = settings.find((s) => s.id === "woocommerce_currency");
      if (woofiCurrency?.value) currency = woofiCurrency.value.toUpperCase();
    }
  } catch { /* non-fatal */ }

  // Store combined credential: "consumerKey:consumerSecret" in access_token; siteUrl in account_id
  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "woocommerce",
      access_token: `${consumerKey}:${consumerSecret}`,
      account_id:   base,
      currency,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save WooCommerce integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "woocommerce");
}
