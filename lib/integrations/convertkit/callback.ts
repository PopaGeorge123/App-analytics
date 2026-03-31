import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateConvertKitApiKey } from "@/lib/integrations/convertkit/auth";

export async function handleConvertKitConnect(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateConvertKitApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid ConvertKit API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "convertkit",
      access_token: apiKey,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save ConvertKit integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "convertkit");
}
