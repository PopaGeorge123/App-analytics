import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import { validateNotionApiToken } from "@/lib/integrations/notion/auth";

export async function handleNotionOAuthCallback(
  userId: string,
  code: string,
): Promise<void> {
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
  ).toString("base64");
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.error ?? "Notion token exchange failed");

  const supabase = createServiceClient();
  await supabase.from("integrations").upsert(
    {
      user_id: userId,
      platform: "notion",
      access_token: tokenData.access_token,
      account_id: tokenData.workspace_id ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  triggerRemoteBackfill(userId, "notion");
}

/**
 * Stores notion integration.
 * apiToken: Internal integration token
 * databaseId: The Notion database ID to sync metrics from
 */
export async function handleNotionConnect(
  userId: string,
  apiToken: string,
  databaseId: string,
): Promise<void> {
  const { valid, error } = await validateNotionApiToken(apiToken);
  if (!valid) throw new Error(error ?? "Invalid Notion integration token");

  const supabase = createServiceClient();
  const { error: dbError } = await supabase.from("integrations").upsert(
    {
      user_id:      userId,
      platform:     "notion",
      access_token: apiToken,
      account_id:   databaseId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (dbError) throw new Error(`Failed to save Notion integration: ${dbError.message}`);

  await triggerRemoteBackfill(userId, "notion");
}
