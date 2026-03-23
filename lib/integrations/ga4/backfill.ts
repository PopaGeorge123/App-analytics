import { createServiceClient } from "@/lib/supabase/service";
import { google } from "googleapis";
import { daysAgo } from "@/lib/utils/dates";

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

export async function backfillGA4History(userId: string): Promise<void> {
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

  const DAYS = 90;

  // GA4 supports date ranges in a single request — we batch 30 days at a time
  const startDate = daysAgo(DAYS);
  const endDate = daysAgo(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await (analyticsData.properties.runReport as any)({
    property: `properties/${integration.account_id}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
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

  const rows = response.data.rows ?? [];

  for (const row of rows) {
    const rawDate = row.dimensionValues?.[0]?.value ?? ""; // YYYYMMDD
    // Convert YYYYMMDD → YYYY-MM-DD
    const date = rawDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    const mv = row.metricValues ?? [];
    const data = {
      sessions: Number(mv[0]?.value ?? 0),
      users: Number(mv[1]?.value ?? 0),
      newUsers: Number(mv[2]?.value ?? 0),
      bounceRate: parseFloat(mv[3]?.value ?? "0"),
      avgSessionDuration: parseFloat(mv[4]?.value ?? "0"),
      conversions: Number(mv[5]?.value ?? 0),
    };

    await db.from("daily_snapshots").upsert(
      { user_id: userId, provider: "ga4", date, data },
      { onConflict: "user_id,provider,date" }
    );
  }
}
