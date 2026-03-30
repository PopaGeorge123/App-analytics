import { createServiceClient } from "@/lib/supabase/service";
import { google } from "googleapis";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

export async function handleGoogleCallback(
  userId: string,
  code: string
): Promise<void> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );

  const { tokens } = await oauth2.getToken(code);
  const accessToken = tokens.access_token!;
  const refreshToken = tokens.refresh_token ?? undefined;

  // Save tokens immediately with account_id = "" (pending property selection)
  const db = createServiceClient();
  await db.from("integrations").upsert(
    {
      user_id: userId,
      platform: "ga4",
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      account_id: "", // will be set after user picks a property
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );
}

// Separate function: list all GA4 properties for a user (called from API route)
export async function listGA4Properties(
  userId: string
): Promise<{ id: string; displayName: string; accountName: string }[]> {
  const db = createServiceClient();
  const { data: integration } = await db
    .from("integrations")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .eq("platform", "ga4")
    .single();

  if (!integration) throw new Error("No GA4 integration found");

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({
    access_token: integration.access_token,
    ...(integration.refresh_token ? { refresh_token: integration.refresh_token } : {}),
  });

  const analyticsAdmin = google.analyticsadmin({ version: "v1beta", auth: oauth2 });
  const accountsRes = await analyticsAdmin.accounts.list();
  const accounts = accountsRes.data.accounts ?? [];

  const properties: { id: string; displayName: string; accountName: string }[] = [];

  for (const account of accounts) {
    if (!account.name) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propsRes: any = await (analyticsAdmin.properties.list as any)({
      filter: `parent:${account.name}`,
    });
    for (const prop of propsRes.data.properties ?? []) {
      properties.push({
        id: prop.name?.replace("properties/", "") ?? "",
        displayName: prop.displayName ?? prop.name ?? "",
        accountName: account.displayName ?? account.name ?? "",
      });
    }
  }

  return properties;
}

// Separate function: finalize property selection and start backfill
export async function selectGA4Property(
  userId: string,
  propertyId: string
): Promise<void> {
  const db = createServiceClient();

  // Fetch current property before overwriting so the daemon can detect a change
  const { data: existing } = await db
    .from("integrations")
    .select("account_id")
    .eq("user_id", userId)
    .eq("platform", "ga4")
    .maybeSingle();

  await db.from("integrations")
    .update({ account_id: propertyId })
    .eq("user_id", userId)
    .eq("platform", "ga4");

  // Trigger remote backfill — pass newAccountId so the daemon clears stale data
  // if the property changed. All data population happens on the remote sync server.
  const previousId = existing?.account_id;
  triggerRemoteBackfill(
    userId,
    "ga4",
    previousId && previousId !== "" && previousId !== propertyId ? propertyId : undefined
  );
}
