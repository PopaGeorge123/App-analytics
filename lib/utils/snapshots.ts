import { createServiceClient } from "@/lib/supabase/service";

/**
 * Call this inside every integration callback BEFORE saving the new integration row.
 *
 * When a user connects a DIFFERENT account for a platform we wipe:
 *   1. daily_snapshots  — for that specific provider only
 *   2. digests          — all of them (they are cross-platform aggregates)
 *   3. share_tokens     — all of them (snapshots embedded in payload are now stale)
 *
 * If the same account is reconnected (same account_id) nothing is deleted.
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

  // No previous integration → nothing to clear
  // Same account reconnected → nothing to clear
  // Empty account_id (GA4 initial state before property selection) → nothing to clear
  if (!existing || !existing.account_id || existing.account_id === newAccountId) return;

  const old = existing.account_id;

  // 1. Delete snapshots for this provider only
  const { error: snapErr } = await db
    .from("daily_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (snapErr) {
    console.error(`[clear] Failed to delete ${provider} snapshots:`, snapErr.message);
  }

  // 2. Delete all digests — they are cross-platform aggregates and are now stale
  const { error: digestErr } = await db
    .from("digests")
    .delete()
    .eq("user_id", userId);

  if (digestErr) {
    console.error(`[clear] Failed to delete digests:`, digestErr.message);
  }

  // 3. Delete all share tokens — their embedded payloads reference old data
  const { error: tokenErr } = await db
    .from("share_tokens")
    .delete()
    .eq("user_id", userId);

  if (tokenErr) {
    console.error(`[clear] Failed to delete share_tokens:`, tokenErr.message);
  }

  console.log(
    `[clear] Account changed for ${provider} (${old} → ${newAccountId}) — ` +
    `deleted snapshots[${provider}], all digests, all share_tokens for user ${userId}`
  );
}
