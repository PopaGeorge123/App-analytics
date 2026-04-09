import { createServiceClient } from "@/lib/supabase/service";

/**
 * Returns true if the user has an active paid subscription OR an active free trial.
 * Always reads from the DB (server-side) — cannot be spoofed from the client.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from("users")
    .select("is_premium, trial_ends_at")
    .eq("id", userId)
    .single();

  if (!data) return false;
  if (data.is_premium === true) return true;
  if (data.trial_ends_at && new Date(data.trial_ends_at) > new Date()) return true;
  return false;
}
