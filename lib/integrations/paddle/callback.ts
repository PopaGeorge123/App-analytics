import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePaddleApiKey } from "@/lib/integrations/paddle/auth";

/**
 * Save a Paddle API key for a user.
 * Validates the key first, then stores it in the integrations table.
 */
export async function handlePaddleConnect(userId: string, apiKey: string): Promise<void> {
  // Validate the key first
  const { valid, error } = await validatePaddleApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Paddle API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "paddle",
      access_token: apiKey,         // stored as access_token (no OAuth)
      account_id:   "",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Paddle integration: ${dbError.message}`);

  // Fire backfill
  await triggerRemoteBackfill(userId, "paddle");
}
