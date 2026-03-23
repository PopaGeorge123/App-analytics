import { createServiceClient } from "@/lib/supabase/service";
import { yesterday } from "@/lib/utils/dates";

async function fetchMetaInsights(
  accountId: string,
  accessToken: string,
  date: string
): Promise<Record<string, number>> {
  const fields = "spend,impressions,clicks,reach,actions";
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${accountId}/insights?` +
      new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since: date, until: date }),
        access_token: accessToken,
      })
  );
  const json = await res.json();
  const row = json.data?.[0] ?? {};

  const conversions: number =
    (row.actions as Array<{ action_type: string; value: string }> | undefined)
      ?.filter((a) => a.action_type === "purchase")
      .reduce((s: number, a) => s + Number(a.value), 0) ?? 0;

  return {
    spend: parseFloat(row.spend ?? "0"),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    reach: Number(row.reach ?? 0),
    conversions,
  };
}

export async function syncMetaData(userId: string): Promise<void> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("integrations")
    .select("access_token, account_id")
    .eq("user_id", userId)
    .eq("platform", "meta")
    .single();

  if (!integration || !integration.account_id) return;

  const date = yesterday();
  const data = await fetchMetaInsights(
    integration.account_id,
    integration.access_token,
    date
  );

  await db.from("daily_snapshots").upsert(
    { user_id: userId, provider: "meta", date, data },
    { onConflict: "user_id,provider,date" }
  );
}
