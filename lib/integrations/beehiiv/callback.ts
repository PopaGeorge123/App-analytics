import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateBeehiivApiKey } from "@/lib/integrations/beehiiv/auth";

export async function handleBeehiivConnect(
  userId: string,
  apiKey: string,
  publicationId: string,
): Promise<void> {
  const { valid, error } = await validateBeehiivApiKey(apiKey, publicationId);
  if (!valid) throw new Error(error ?? "Invalid Beehiiv credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "beehiiv",
      access_token: apiKey,
      account_id:   publicationId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Beehiiv integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "beehiiv");
}
