import { createServiceClient } from "@/lib/supabase/service";
import { google } from "googleapis";
import { yesterday } from "@/lib/utils/dates";

function buildAuth(accessToken: string, refreshToken?: string | null) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  });
  return oauth2;
}

export async function syncGA4Data(userId: string): Promise<void> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("integrations")
    .select("access_token, refresh_token, account_id")
    .eq("user_id", userId)
    .eq("platform", "ga4")
    .single();

  if (!integration || !integration.account_id) return;

  const auth = buildAuth(integration.access_token, integration.refresh_token);
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const date = yesterday();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await (analyticsData.properties.runReport as any)({
    property: `properties/${integration.account_id}`,
    requestBody: {
      dateRanges: [{ startDate: date, endDate: date }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
      ],
    },
  });

  const row = response.data.rows?.[0]?.metricValues ?? [];
  const data = {
    sessions: Number(row[0]?.value ?? 0),
    users: Number(row[1]?.value ?? 0),
    newUsers: Number(row[2]?.value ?? 0),
    bounceRate: parseFloat(row[3]?.value ?? "0"),
    avgSessionDuration: parseFloat(row[4]?.value ?? "0"),
    conversions: Number(row[5]?.value ?? 0),
  };

  await db.from("daily_snapshots").upsert(
    { user_id: userId, provider: "ga4", date, data },
    { onConflict: "user_id,provider,date" }
  );
}
