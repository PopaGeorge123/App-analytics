import { createServiceClient } from "@/lib/supabase/service";

/**
 * Call this inside every integration callback BEFORE saving the new integration row.
 * If the user had a different account connected before (different account_id),
 * we delete all old snapshots for that provider so stale data doesn't mix with new data.
 */
export async function clearSnapshotsIfAccountChanged(
  userId: string,
  provider: string, // "stripe" | "ga4" | "meta"
  newAccountId: string
): Promise<void> {
  const db = createServiceClient();

  // Check if there's an existing integration with a different account
  const { data: existing } = await db
    .from("integrations")
    .select("account_id")
    .eq("user_id", userId)
    .eq("platform", provider)
    .single();

  // No previous integration, or same account → nothing to clear
  if (!existing || existing.account_id === newAccountId) return;

  // Different account → delete all snapshots for this provider
  await db
    .from("daily_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  console.log(
    `[snapshots] Cleared ${provider} snapshots for user ${userId} (account changed: ${existing.account_id} → ${newAccountId})`
  );
}
