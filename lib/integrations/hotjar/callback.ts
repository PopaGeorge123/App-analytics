import { createServiceClient } from "@/lib/supabase/service";
import { validateHotjarCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleHotjarConnect(
  userId: string,
  accessToken: string,
  siteId: string,
): Promise<void> {
  const { valid, error } = await validateHotjarCredentials(accessToken, siteId);
  if (!valid) throw new Error(error ?? "Invalid Hotjar credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id:      userId,
        platform:     "hotjar",
        access_token: accessToken,
        account_id:   siteId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save Hotjar integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "hotjar");
}
