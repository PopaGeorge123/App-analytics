import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateFathomApiKey } from "@/lib/integrations/fathom/auth";

export async function handleFathomConnect(
  userId: string,
  apiKey: string,
  siteId: string,
): Promise<void> {
  const { valid, error } = await validateFathomApiKey(apiKey, siteId);
  if (!valid) throw new Error(error ?? "Invalid Fathom credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "fathom",
      access_token: apiKey,
      account_id:   siteId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Fathom integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "fathom");
}
