import { createServiceClient } from "@/lib/supabase/service";
import { backfillStripeHistory } from "./backfill";
import { clearSnapshotsIfAccountChanged } from "@/lib/utils/snapshots";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleStripeCallback(
  userId: string,
  code: string
): Promise<void> {
  // Stripe Connect OAuth token exchange
  const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    throw new Error(err?.error_description ?? "Stripe OAuth token exchange failed");
  }

  const response = await tokenRes.json();
  const accessToken = response.access_token as string;
  const accountId = response.stripe_user_id as string;

  // If account changed, clear stale snapshots before backfill
  await clearSnapshotsIfAccountChanged(userId, "stripe", accountId);

  const db = createServiceClient();
  await db.from("integrations").upsert(
    {
      user_id: userId,
      platform: "stripe",
      access_token: accessToken,
      account_id: accountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  // Trigger remote backfill on upbid.dev server; fall back to local if remote not configured
  triggerRemoteBackfill(userId, "stripe");
  backfillStripeHistory(userId).catch(console.error);
}
