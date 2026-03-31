import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateAmplitudeCredentials } from "@/lib/integrations/amplitude/auth";

export async function handleAmplitudeConnect(
  userId: string,
  apiKey: string,
  secretKey: string,
): Promise<void> {
  const { valid, error } = await validateAmplitudeCredentials(apiKey, secretKey);
  if (!valid) throw new Error(error ?? "Invalid Amplitude credentials");

  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "amplitude",
      access_token: credentials,  // base64 "apiKey:secretKey"
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Amplitude integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "amplitude");
}
