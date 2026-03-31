import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateMixpanelCredentials } from "@/lib/integrations/mixpanel/auth";

export async function handleMixpanelConnect(
  userId: string,
  projectId: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
): Promise<void> {
  const { valid, error } = await validateMixpanelCredentials(projectId, serviceAccountUser, serviceAccountSecret);
  if (!valid) throw new Error(error ?? "Invalid Mixpanel credentials");

  // Store: access_token = "user:secret" (basic auth), account_id = projectId
  const credentials = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "mixpanel",
      access_token: credentials,   // base64 basic auth
      account_id:   projectId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Mixpanel integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "mixpanel");
}
