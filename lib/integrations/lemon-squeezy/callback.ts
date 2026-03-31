import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateLemonSqueezyApiKey } from "@/lib/integrations/lemon-squeezy/auth";

export async function handleLemonSqueezyConnect(userId: string, apiKey: string): Promise<void> {
  const { valid, error } = await validateLemonSqueezyApiKey(apiKey);
  if (!valid) throw new Error(error ?? "Invalid Lemon Squeezy API key");

  // Fetch the first store to get storeId
  let storeId = "";
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/stores", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" },
    });
    if (res.ok) {
      const body = await res.json();
      storeId = body.data?.[0]?.id ?? "";
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "lemon-squeezy",
      access_token: apiKey,
      account_id:   storeId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (dbError) throw new Error(`Failed to save Lemon Squeezy integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "lemon-squeezy");
}
