import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateWooCommerceCredentials } from "@/lib/integrations/woocommerce/auth";

export async function handleWooCommerceConnect(
  userId: string,
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<void> {
  const base = siteUrl.replace(/\/$/, "");
  const { valid, error } = await validateWooCommerceCredentials(base, consumerKey, consumerSecret);
  if (!valid) throw new Error(error ?? "Invalid WooCommerce credentials");

  // Store combined credential: "consumerKey:consumerSecret" in access_token; siteUrl in account_id
  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "woocommerce",
      access_token: `${consumerKey}:${consumerSecret}`,
      account_id:   base,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save WooCommerce integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "woocommerce");
}
