import { createServiceClient } from "@/lib/supabase/service";
import { validateFullStoryCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleFullStoryConnect(
  userId: string,
  apiKey: string,
  orgId: string,
): Promise<void> {
  const { valid, error } = await validateFullStoryCredentials(apiKey, orgId);
  if (!valid) throw new Error(error ?? "Invalid FullStory credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id:      userId,
        platform:     "fullstory",
        access_token: apiKey,
        account_id:   orgId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save FullStory integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "fullstory");
}

