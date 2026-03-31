import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateSegmentAccessToken } from "@/lib/integrations/segment/auth";

export async function handleSegmentOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const tokenRes = await fetch("https://oauth2.segment.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.SEGMENT_CLIENT_ID!,
      client_secret: process.env.SEGMENT_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/segment/callback`,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Segment token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "segment",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "segment");
}

/**
 * access_token = Segment Public API token
 * account_id   = workspaceId (slug)
 */
export async function handleSegmentConnect(
  userId: string,
  accessToken: string,
  workspaceId: string,
): Promise<void> {
  const { valid, error } = await validateSegmentAccessToken(accessToken);
  if (!valid) throw new Error(error ?? "Invalid Segment access token");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "segment",
      access_token: accessToken,
      account_id:   workspaceId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (dbError) throw new Error(`Failed to save Segment integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "segment");
}
