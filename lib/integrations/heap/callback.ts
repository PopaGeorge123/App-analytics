import { createServiceClient } from "@/lib/supabase/service";
import { validateHeapCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleHeapConnect(
  userId: string,
  appId: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateHeapCredentials(appId, apiKey);
  if (!valid) throw new Error(error ?? "Invalid Heap credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id:      userId,
        platform:     "heap",
        access_token: `${appId}:${apiKey}`,
        account_id:   appId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save Heap integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "heap");
}

