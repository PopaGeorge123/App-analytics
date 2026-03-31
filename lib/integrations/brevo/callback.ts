import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateBrevoApiKey } from "@/lib/integrations/brevo/auth";

export async function handleBrevoConnect(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { valid, error } = await validateBrevoApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Brevo API key");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "brevo",
      access_token: apiKey,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Brevo integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "brevo");
}
