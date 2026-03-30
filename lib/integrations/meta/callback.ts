import { createServiceClient } from "@/lib/supabase/service";
import { backfillMetaHistory } from "./backfill";
import { clearSnapshotsIfAccountChanged } from "@/lib/utils/snapshots";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleMetaCallback(
  userId: string,
  code: string
): Promise<void> {
  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`,
        code,
      })
  );
  const tokenData = await tokenRes.json();
  const shortToken: string = tokenData.access_token;

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: shortToken,
      })
  );
  const longData = await longRes.json();
  const accessToken: string = longData.access_token;

  // Get ad account ID + currency
  const adAccountRes = await fetch(
    `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,currency&access_token=${accessToken}`
  );
  const adAccountData = await adAccountRes.json();
  const firstAccount  = adAccountData.data?.[0] ?? {};
  const accountId: string  = firstAccount.id       ?? "";
  const currency: string   = firstAccount.currency ?? "USD";

  // If account changed, clear stale snapshots before backfill
  await clearSnapshotsIfAccountChanged(userId, "meta", accountId);

  const db = createServiceClient();
  await db.from("integrations").upsert(
    {
      user_id: userId,
      platform: "meta",
      access_token: accessToken,
      account_id: accountId,
      currency,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  // Trigger remote backfill on upbid.dev server; fall back to local if remote not configured
  triggerRemoteBackfill(userId, "meta");
  backfillMetaHistory(userId).catch(console.error);
}
