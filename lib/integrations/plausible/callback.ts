import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePlausibleApiKey } from "@/lib/integrations/plausible/auth";

export async function handlePlausibleConnect(
  userId: string,
  apiKey: string,
  siteId: string,
): Promise<void> {
  const { valid, error } = await validatePlausibleApiKey(apiKey, siteId);
  if (!valid) throw new Error(error ?? "Invalid Plausible credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "plausible",
      access_token: apiKey,
      account_id:   siteId,       // store siteId in account_id
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Plausible integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "plausible");
}
