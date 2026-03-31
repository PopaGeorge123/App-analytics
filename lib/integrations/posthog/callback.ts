import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validatePostHogApiKey } from "@/lib/integrations/posthog/auth";

export async function handlePostHogConnect(
  userId: string,
  apiKey: string,
  projectId: string,
): Promise<void> {
  const { valid, error } = await validatePostHogApiKey(apiKey, projectId);
  if (!valid) throw new Error(error ?? "Invalid PostHog credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "posthog",
      access_token: apiKey,
      account_id:   projectId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save PostHog integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "posthog");
}
