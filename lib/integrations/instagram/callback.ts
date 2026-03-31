import { createServiceClient } from "@/lib/supabase/service";
import { validateInstagramCredentials } from "./auth";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleInstagramOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  // Exchange code for short-lived token
  const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?` +
    new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
      code,
    }));
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Instagram token exchange failed");

  // Exchange for long-lived token
  const longRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: tokenData.access_token,
    }));
  const longData = await longRes.json();
  const accessToken: string = longData.access_token;

  // Fetch Instagram business account id via pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
  );
  const pagesData = await pagesRes.json();
  const pageToken = pagesData.data?.[0]?.access_token ?? accessToken;
  const pageId = pagesData.data?.[0]?.id ?? "";

  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`,
  );
  const igData = await igRes.json();
  const businessAccountId = igData.instagram_business_account?.id ?? "";

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "instagram",
      access_token: accessToken,
      account_id: businessAccountId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "instagram");
}

export async function handleInstagramConnect(
  userId: string,
  accessToken: string,
  businessAccountId: string,
): Promise<void> {
  const { valid, error } = await validateInstagramCredentials(accessToken, businessAccountId);
  if (!valid) throw new Error(error ?? "Invalid Instagram credentials");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id:      userId,
        platform:     "instagram",
        access_token: accessToken,
        account_id:   businessAccountId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

  if (dbError) throw new Error(`Failed to save Instagram integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "instagram");
}
