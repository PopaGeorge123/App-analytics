import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePaddleApiKey } from "@/lib/integrations/paddle/auth";

/**
 * Save a Paddle Billing API key for a user.
 * Validates the key first, fetches the seller ID, then stores it in the integrations table.
 * Note: Paddle Billing v2 uses API keys only — there is no OAuth flow.
 */
export async function handlePaddleConnect(userId: string, apiKey: string): Promise<void> {
  // Validate the key first
  const { valid, error } = await validatePaddleApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Paddle API key");

  // Fetch seller/business ID for account_id
  let accountId = "";
  try {
    const sellerRes = await fetch("https://api.paddle.com/businesses?per_page=1", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    if (sellerRes.ok) {
      const sellerData = await sellerRes.json();
      accountId = String(sellerData?.data?.[0]?.id ?? "");
    }
  } catch {
    // Non-fatal — account_id is optional metadata
  }

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "paddle",
      access_token: apiKey,
      account_id:   accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Paddle integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "paddle");
}

